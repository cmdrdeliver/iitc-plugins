// ==UserScript==
// @id             iitc-plugin-nearest-portals@cmdrdeliver
// @name           IITC plugin: Nearest unvisited/uncaptured portals
// @category       Info
// @version        0.1.0
// @author         CmdrDeLiver
// @namespace      https://github.com/cmdrdeliver/iitc-nearest-portals
// @description    Lists the nearest portals you have not visited and/or captured, with export and walking-route planning via OSRM.
// @match          https://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
  if (typeof window.plugin !== 'function') window.plugin = function () {};

  var self = window.plugin.nearestPortals = function () {};

  // ---- config / state -------------------------------------------------------

  self.OSRM_BASE = 'https://router.project-osrm.org';
  self.OSRM_SELF_HOST_URL = 'https://github.com/Project-OSRM/osrm-backend#quick-start';
  self.MAX_RECOMMENDED_POINTS = 10; // public demo: stay polite, avoid cool-down
  self.PROFILE = 'foot'; // OSRM public demo also supports car, bike

  self.HIGHLIGHTER_NAME = 'Nearest portals: dim non-matched';

  self.state = {
    filter: 'either',      // 'all' | 'either' | 'both' | 'unvisited' | 'uncaptured' | 'unscouted'
    origin: 'map',         // 'map' | 'geo'
    geoLatLng: null,
    maxCount: 10,
    maxDistanceM: 0,       // 0 = no limit
    selected: {},          // guid -> bool
    lastList: [],          // [{guid, latLng, title, distance}]
    matchedSet: {},        // guid -> true for currently matched portals
    routeLayer: null,
    profile: 'foot',
    dimActive: false,
    previousHighlight: null,
    diag: { total: 0, kept: 0 }
  };

  // ---- portal status helpers ------------------------------------------------
  // IITC stores portal history as a bitmask integer in data.history:
  //   bit 0 = visited, bit 1 = captured, bit 2 = scoutControlled.
  // Older / stripped builds may expose it as an object, and basic-detail
  // entities may not have history populated at all (undefined).
  self.getStatus = function (portal) {
    var d = portal && portal.options && portal.options.data;
    if (!d) return { unknown: true };
    var h = d.history;
    if (h === undefined || h === null) return { unknown: true };
    if (typeof h === 'number') {
      return {
        visited:         (h & 1) === 1,
        captured:        (h & 2) === 2,
        scoutControlled: (h & 4) === 4,
        unknown: false
      };
    }
    if (typeof h === 'object') {
      return {
        visited:         !!h.visited,
        captured:        !!h.captured,
        scoutControlled: !!h.scoutControlled,
        unknown: false
      };
    }
    return { unknown: true };
  };

  self.matchesFilter = function (status, filter) {
    if (!status) return false;
    if (filter === 'all') return true; // ignore status entirely; unknowns OK for routing
    if (status.unknown) return false;  // status-based filters require known history
    switch (filter) {
      case 'uncaptured': return !status.captured;
      case 'unvisited':  return !status.visited;
      case 'unscouted':  return !status.scoutControlled;
      case 'either':     return !status.visited || !status.captured;
      case 'both':       return !status.visited && !status.captured;
    }
    return false;
  };

  // ---- distance / origin ----------------------------------------------------

  self.haversine = function (a, b) {
    var R = 6371000;
    var toR = function (d) { return d * Math.PI / 180; };
    var dLat = toR(b.lat - a.lat);
    var dLng = toR(b.lng - a.lng);
    var lat1 = toR(a.lat);
    var lat2 = toR(b.lat);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };

  self.getOrigin = function () {
    if (self.state.origin === 'geo' && self.state.geoLatLng) return self.state.geoLatLng;
    var c = window.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  };

  // ---- list builder ---------------------------------------------------------

  self.buildList = function () {
    var origin = self.getOrigin();
    var out = [];
    var portals = window.portals || {};
    var diag = { total: 0, kept: 0 };
    for (var guid in portals) {
      diag.total++;
      var p = portals[guid];
      var status = self.getStatus(p);
      if (!self.matchesFilter(status, self.state.filter)) continue;
      var ll = p.getLatLng();
      var pos = { lat: ll.lat, lng: ll.lng };
      var dist = self.haversine(origin, pos);
      if (self.state.maxDistanceM > 0 && dist > self.state.maxDistanceM) continue;
      out.push({
        guid: guid,
        latLng: pos,
        title: (p.options.data && p.options.data.title) || '(unknown)',
        distance: dist,
        status: status
      });
    }
    out.sort(function (a, b) { return a.distance - b.distance; });
    if (self.state.maxCount > 0) out = out.slice(0, self.state.maxCount);
    diag.kept = out.length;
    self.state.diag = diag;
    self.state.lastList = out;

    self.state.matchedSet = {};
    for (var k = 0; k < out.length; k++) self.state.matchedSet[out[k].guid] = true;
    if (self.state.dimActive && typeof window.resetHighlightedPortals === 'function') {
      window.resetHighlightedPortals();
    }

    // Default-select any newly seen portals.
    for (var i = 0; i < out.length; i++) {
      if (!(out[i].guid in self.state.selected)) self.state.selected[out[i].guid] = true;
    }
    return out;
  };

  // ---- rendering ------------------------------------------------------------

  self.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  self.formatDistance = function (m) {
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(2) + ' km';
  };

  self.statusBadges = function (s) {
    if (s.unknown) return '<span style="color:#666">—</span>';
    var parts = [];
    parts.push(s.visited         ? '<span style="color:#9c9">V</span>' : '<span style="color:#c66">·</span>');
    parts.push(s.captured        ? '<span style="color:#9c9">C</span>' : '<span style="color:#c66">·</span>');
    parts.push(s.scoutControlled ? '<span style="color:#9c9">S</span>' : '<span style="color:#c66">·</span>');
    return parts.join('');
  };

  self.renderListHtml = function (list) {
    if (!list.length) return '<div style="padding:8px;">No portals match.</div>';
    var rows = list.map(function (item) {
      var checked = self.state.selected[item.guid] ? 'checked' : '';
      return '<tr data-guid="' + item.guid + '">' +
        '<td><input type="checkbox" class="np-sel" ' + checked + '></td>' +
        '<td><a class="np-pan" href="#">' + self.escapeHtml(item.title) + '</a></td>' +
        '<td style="text-align:right;white-space:nowrap;">' + self.formatDistance(item.distance) + '</td>' +
        '<td style="text-align:center;">' + self.statusBadges(item.status) + '</td>' +
      '</tr>';
    }).join('');
    return '<table class="np-table" style="width:100%;border-collapse:collapse;">' +
      '<thead><tr>' +
        '<th><input type="checkbox" id="np-all" checked></th>' +
        '<th style="text-align:left;">Portal</th>' +
        '<th style="text-align:right;">Dist</th>' +
        '<th title="Visited / Captured / Scouted">V/C/S</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  };

  self.refreshDialog = function () {
    var list = self.buildList();
    var container = document.getElementById('np-list-container');
    if (container) container.innerHTML = self.renderListHtml(list);
    self.bindRowHandlers();
    self.updateCount();
    var diagEl = document.getElementById('np-diag');
    if (diagEl) {
      var d = self.state.diag;
      diagEl.textContent = 'Loaded portals: ' + d.total + '  ·  matched: ' + d.kept;
    }
  };

  self.bindRowHandlers = function () {
    var tbl = document.querySelector('#np-list-container .np-table');
    if (!tbl) return;
    tbl.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('np-sel')) {
        var tr = e.target.closest('tr');
        var guid = tr && tr.getAttribute('data-guid');
        if (guid) self.state.selected[guid] = e.target.checked;
        self.updateCount();
      } else if (e.target && e.target.id === 'np-all') {
        var on = e.target.checked;
        var checks = tbl.querySelectorAll('.np-sel');
        for (var i = 0; i < checks.length; i++) {
          checks[i].checked = on;
          var guid = checks[i].closest('tr').getAttribute('data-guid');
          self.state.selected[guid] = on;
        }
        self.updateCount();
      }
    });
    tbl.addEventListener('click', function (e) {
      if (e.target && e.target.classList.contains('np-pan')) {
        e.preventDefault();
        var tr = e.target.closest('tr');
        var guid = tr && tr.getAttribute('data-guid');
        var item = self.state.lastList.find(function (x) { return x.guid === guid; });
        if (item) {
          window.map.panTo([item.latLng.lat, item.latLng.lng]);
          if (window.renderPortalDetails) window.renderPortalDetails(guid);
        }
      }
    });
  };

  self.updateCount = function () {
    var el = document.getElementById('np-count');
    if (!el) return;
    var n = self.state.lastList.filter(function (x) { return self.state.selected[x.guid]; }).length;
    el.textContent = n + ' / ' + self.state.lastList.length + ' selected';
  };

  // ---- export ---------------------------------------------------------------

  self.selectedItems = function () {
    return self.state.lastList.filter(function (x) { return self.state.selected[x.guid]; });
  };

  self.exportCSV = function () {
    var rows = [['title', 'lat', 'lng', 'distance_m', 'visited', 'captured', 'intel_url']];
    self.selectedItems().forEach(function (x) {
      var ll = x.latLng.lat + ',' + x.latLng.lng;
      var url = 'https://intel.ingress.com/intel?ll=' + ll + '&z=17&pll=' + ll;
      rows.push([x.title, x.latLng.lat, x.latLng.lng, Math.round(x.distance), x.status.visited ? 1 : 0, x.status.captured ? 1 : 0, url]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(',');
    }).join('\n');
    self.download('nearest-portals.csv', 'text/csv', csv);
  };

  self.exportGPX = function () {
    var pts = self.selectedItems().map(function (x) {
      return '  <wpt lat="' + x.latLng.lat + '" lon="' + x.latLng.lng + '">' +
             '<name>' + self.escapeHtml(x.title) + '</name>' +
             '<desc>' + (x.status.visited ? 'V' : '-') + (x.status.captured ? 'C' : '-') + ' ' + Math.round(x.distance) + 'm</desc>' +
             '</wpt>';
    }).join('\n');
    var gpx = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<gpx version="1.1" creator="iitc-nearest-portals" xmlns="http://www.topografix.com/GPX/1/1">\n' +
      pts + '\n</gpx>';
    self.download('nearest-portals.gpx', 'application/gpx+xml', gpx);
  };

  self.download = function (name, mime, body) {
    var blob = new Blob([body], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  };

  // ---- about ---------------------------------------------------------------

  self.openAbout = function () {
    var html =
      '<div style="font-size:12px;line-height:1.4;">' +
        '<p><b>Nearest portals</b> — find the closest portals that match a status, ' +
        'export them, and plan a walking/cycling/driving route between them.</p>' +
        '<p><b>Features</b></p>' +
        '<ul style="margin:4px 0 8px 18px;padding:0;">' +
          '<li>Filter by status: all / not visited / not captured / not scouted / either / neither</li>' +
          '<li>Origin from map center or your browser geolocation</li>' +
          '<li>Sortable distance list with per-portal V/C/S badges</li>' +
          '<li>Click a portal title to pan the map and open its details</li>' +
          '<li>Selectable rows for export and routing</li>' +
          '<li>Export selected portals as CSV (with intel URLs) or GPX waypoints</li>' +
          '<li>Multi-stop route via the free OSRM public demo (TSP-optimised)</li>' +
          '<li>"Dim others on map" highlighter to hide non-matched portals</li>' +
        '</ul>' +
        '<p><b>Author:</b> CmdrDeLiver</p>' +
        '<p><b>Routing:</b> <a href="https://project-osrm.org/" target="_blank" rel="noopener">OSRM</a> public demo. ' +
        'For heavy use, <a href="' + self.OSRM_SELF_HOST_URL + '" target="_blank" rel="noopener">self-host OSRM</a>.</p>' +
        '<p style="color:#888;font-size:11px;">Only portals currently loaded in IITC are considered. ' +
        'Pan/zoom over the area at zoom 17 to populate the cache before searching.</p>' +
      '</div>';
    window.dialog({
      id: 'plugin-nearest-portals-about',
      title: 'About Nearest portals',
      html: html,
      width: 460
    });
  };

  // ---- map dimming (highlighter) -------------------------------------------

  self.dimHighlighter = function (data) {
    var guid = data.portal.options.guid;
    if (self.state.matchedSet[guid]) return; // matched: leave default styling
    data.portal.setStyle({ fillOpacity: 0.04, opacity: 0.18 });
  };

  self.setDim = function (on) {
    self.state.dimActive = !!on;
    if (typeof window.changePortalHighlights !== 'function') return;
    if (on) {
      if (window._highlight && window._highlight !== self.HIGHLIGHTER_NAME) {
        self.state.previousHighlight = window._highlight;
      }
      window.changePortalHighlights(self.HIGHLIGHTER_NAME);
    } else {
      window.changePortalHighlights(self.state.previousHighlight || 'No Highlights');
    }
  };

  // ---- routing (OSRM) -------------------------------------------------------

  self.clearRoute = function () {
    if (self.state.routeLayer) {
      self.state.routeLayer.clearLayers();
    }
  };

  self.ensureRouteLayer = function () {
    if (!self.state.routeLayer) {
      self.state.routeLayer = L.layerGroup();
      window.addLayerGroup('Nearest-portals route', self.state.routeLayer, true);
    }
    return self.state.routeLayer;
  };

  self.showRoute = function () {
    var items = self.selectedItems();
    if (items.length < 1) {
      alert('Select at least one portal.');
      return;
    }
    if (items.length > self.MAX_RECOMMENDED_POINTS) {
      self.confirmOverLimit(items.length, function () { self.executeRoute(items); });
      return;
    }
    self.executeRoute(items);
  };

  self.confirmOverLimit = function (count, onContinue) {
    var html =
      '<p>Maximum recommended route points is <b>' + self.MAX_RECOMMENDED_POINTS + '</b>. ' +
      'Routing more than that will cause a cool down.</p>' +
      '<p>You selected <b>' + count + '</b> points.</p>' +
      '<p>To remove the limit, host your own OSRM server: ' +
      '<a href="' + self.OSRM_SELF_HOST_URL + '" target="_blank" rel="noopener">OSRM self-hosting guide</a>.</p>';
    window.dialog({
      id: 'plugin-nearest-portals-warn',
      title: 'Routing limit warning',
      html: html,
      width: 420,
      buttons: {
        'Continue anyway': function () { $(this).dialog('close'); onContinue(); },
        'Cancel': function () { $(this).dialog('close'); }
      }
    });
  };

  self.executeRoute = function (items) {
    var origin = self.getOrigin();
    var coords = [origin].concat(items.map(function (x) { return x.latLng; }));
    var coordStr = coords.map(function (c) { return c.lng + ',' + c.lat; }).join(';');
    var url = self.OSRM_BASE + '/trip/v1/' + self.state.profile + '/' + coordStr +
              '?source=first&roundtrip=false&geometries=geojson&overview=full';

    var btn = document.getElementById('np-route-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Routing…'; }

    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('OSRM HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      if (data.code !== 'Ok' || !data.trips || !data.trips.length) {
        throw new Error('OSRM: ' + (data.message || data.code || 'no trip'));
      }
      self.drawRoute(data, coords, items);
    }).catch(function (err) {
      alert('Routing failed: ' + err.message);
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Show route'; }
    });
  };

  self.drawRoute = function (data, coords, items) {
    var layer = self.ensureRouteLayer();
    layer.clearLayers();
    var trip = data.trips[0];
    var line = L.geoJSON(trip.geometry, {
      style: { color: '#ff5500', weight: 5, opacity: 0.85 }
    });
    layer.addLayer(line);

    // waypoints carry the original input order -> visit index in the optimised trip
    var ordered = data.waypoints.map(function (wp, i) {
      return { inputIndex: i, tripIndex: wp.waypoint_index, name: wp.name };
    }).sort(function (a, b) { return a.tripIndex - b.tripIndex; });

    ordered.forEach(function (o) {
      var c = coords[o.inputIndex];
      var label = o.tripIndex === 0 ? 'S' : String(o.tripIndex);
      var title = o.inputIndex === 0 ? 'Start' : items[o.inputIndex - 1].title;
      var icon = L.divIcon({
        className: 'np-route-marker',
        html: '<div style="background:#222;color:#fff;border:2px solid #ff5500;border-radius:11px;width:22px;height:22px;line-height:18px;text-align:center;font-weight:bold;font-size:11px;opacity:0.92;">' + label + '</div>',
        iconSize: [22, 22],
        iconAnchor: [-4, 26] // sit up-and-right of the portal dot so the level badge stays visible
      });
      L.marker([c.lat, c.lng], { icon: icon, title: title }).addTo(layer);
    });

    var stats = '\nDistance: ' + (trip.distance / 1000).toFixed(2) + ' km' +
                '\nDuration: ' + Math.round(trip.duration / 60) + ' min';
    var info = document.getElementById('np-route-info');
    if (info) info.textContent = stats.trim();

    window.map.fitBounds(line.getBounds().pad(0.1));
  };

  // ---- dialog ---------------------------------------------------------------

  self.openDialog = function () {
    var html =
      '<div class="np-controls">' +
        '<label>Filter:' +
          '<select id="np-filter">' +
            '<option value="all">All portals</option>' +
            '<option value="either">Not visited or not captured</option>' +
            '<option value="both">Neither visited nor captured</option>' +
            '<option value="unvisited">Not visited</option>' +
            '<option value="uncaptured">Not captured</option>' +
            '<option value="unscouted">Not scouted</option>' +
          '</select></label>' +
        '<label>Origin:' +
          '<select id="np-origin">' +
            '<option value="map">Map center</option>' +
            '<option value="geo">My location</option>' +
          '</select></label>' +
        '<label>Profile:' +
          '<select id="np-profile">' +
            '<option value="foot">Walking</option>' +
            '<option value="bike">Cycling</option>' +
            '<option value="car">Driving</option>' +
          '</select></label>' +
        '<div class="np-break"></div>' +
        '<label>Max count:<input id="np-max" type="number" min="1" max="500" value="' + self.state.maxCount + '"></label>' +
        '<label>Max distance (m, 0=∞):<input id="np-maxdist" type="number" min="0" value="' + self.state.maxDistanceM + '" style="width:6em;"></label>' +
        '<label title="Dim every other portal on the map so only the matched ones are visible."><input id="np-dim" type="checkbox" ' + (self.state.dimActive ? 'checked' : '') + '>Dim others on map</label>' +
        '<button id="np-refresh">Refresh</button>' +
      '</div>' +
      '<div id="np-diag" style="font-size:11px;color:#888;margin-bottom:4px;"></div>' +
      '<div id="np-list-container" style="max-height:50vh;overflow:auto;border:1px solid #444;"></div>' +
      '<div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
        '<span id="np-count"></span>' +
        '<button id="np-csv">Export CSV</button>' +
        '<button id="np-gpx">Export GPX</button>' +
        '<button id="np-route-btn">Show route</button>' +
        '<button id="np-clear">Clear route</button>' +
        '<button id="np-about" style="margin-left:auto;">About</button>' +
      '</div>' +
      '<pre id="np-route-info" style="white-space:pre-wrap;margin:4px 0 0;color:#9c9;font-size:11px;"></pre>';

    window.dialog({
      id: 'plugin-nearest-portals',
      title: 'Nearest unvisited / uncaptured portals',
      html: html,
      width: 580
    });

    document.getElementById('np-filter').value = self.state.filter;
    document.getElementById('np-origin').value = self.state.origin;
    document.getElementById('np-profile').value = self.state.profile;

    document.getElementById('np-filter').onchange = function (e) { self.state.filter = e.target.value; self.refreshDialog(); };
    document.getElementById('np-origin').onchange = function (e) {
      self.state.origin = e.target.value;
      if (e.target.value === 'geo') {
        if (!navigator.geolocation) { alert('Geolocation unavailable.'); self.state.origin = 'map'; e.target.value = 'map'; return; }
        navigator.geolocation.getCurrentPosition(function (pos) {
          self.state.geoLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          self.refreshDialog();
        }, function (err) {
          alert('Geolocation failed: ' + err.message);
          self.state.origin = 'map';
          e.target.value = 'map';
          self.refreshDialog();
        });
      } else {
        self.refreshDialog();
      }
    };
    document.getElementById('np-profile').onchange = function (e) { self.state.profile = e.target.value; };
    document.getElementById('np-max').onchange = function (e) {
      var v = parseInt(e.target.value, 10);
      self.state.maxCount = isNaN(v) ? 0 : Math.max(0, v);
      self.refreshDialog();
    };
    document.getElementById('np-maxdist').onchange = function (e) {
      var v = parseInt(e.target.value, 10);
      self.state.maxDistanceM = isNaN(v) ? 0 : Math.max(0, v);
      self.refreshDialog();
    };
    document.getElementById('np-dim').onchange = function (e) { self.setDim(e.target.checked); };
    document.getElementById('np-refresh').onclick = function () { self.refreshDialog(); };
    document.getElementById('np-csv').onclick = self.exportCSV;
    document.getElementById('np-gpx').onclick = self.exportGPX;
    document.getElementById('np-route-btn').onclick = self.showRoute;
    document.getElementById('np-clear').onclick = self.clearRoute;
    document.getElementById('np-about').onclick = self.openAbout;

    self.refreshDialog();
  };

  // ---- setup ----------------------------------------------------------------

  var setup = function () {
    $('<style>').html(
      '.np-table th,.np-table td{padding:2px 4px;border-bottom:1px solid #333;}' +
      '.np-table tbody tr:hover{background:#222;}' +
      '.np-controls{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin-bottom:6px;}' +
      '.np-controls > label{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}' +
      '.np-controls input[type="number"]{width:5em;}' +
      '.np-controls .np-break{flex-basis:100%;height:0;}'
    ).appendTo('head');

    if (typeof window.addPortalHighlighter === 'function') {
      window.addPortalHighlighter(self.HIGHLIGHTER_NAME, self.dimHighlighter);
    }

    $('#toolbox').append(' <a onclick="window.plugin.nearestPortals.openDialog();return false;" title="List nearest unvisited/uncaptured portals">Nearest portals</a>');
  };

  setup.info = plugin_info;
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  if (window.iitcLoaded && typeof setup === 'function') setup();
}

(function () {
  var script = document.createElement('script');
  var info = {};
  if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
    info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
  }
  script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(info) + ');'));
  (document.body || document.head || document.documentElement).appendChild(script);
})();
