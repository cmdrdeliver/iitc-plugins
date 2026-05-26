// ==UserScript==
// @id             iitc-plugin-toolbox-dropdown@cmdrdeliver
// @name           IITC plugin: Toolbox Dropdown
// @category       Misc
// @version        0.9.20260526
// @author         CmdrDeLiver
// @namespace      https://github.com/cmdrdeliver/iitc-plugins
// @description    Moves the Toolbox from the Sidebar Portal View to a Layers style hover-to-open menu and hides the toolbox items. New tools added after toolbox-dropdown is initialized will be added automatically.
// @updateURL      https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/toolbox-dropdown/toolbox-dropdown.user.js
// @downloadURL    https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/toolbox-dropdown/toolbox-dropdown.user.js
// @match          https://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @grant          none
// ==/UserScript==

/* ---------------------------------------------------------------------------
 * Version history
 * ---------------------------------------------------------------------------
 * 0.3.20260522
 *   - Architecture corrected. v0.1/v0.2 put the <select> INSIDE the
 *     toolbox div, which is wrong — the dropdown is a replacement FOR
 *     the toolbox, not a member of it (and it needs to render in the
 *     same sidebar position the highlighter dropdown does). v0.3:
 *       * Items source: direct <a> children of #toolbox_component
 *         (the rendered toolbox the user actually clicks on).
 *       * Placement: the <select> is inserted as a SIBLING immediately
 *         BEFORE #toolbox_component, so it occupies the same spot in
 *         the sidebar.
 *       * Hiding: #toolbox_component itself is hidden (display:none),
 *         which removes the entire menu strip in one move — no need
 *         to per-anchor toggle a class.
 *
 * 0.2.20260522
 *   - v0.1 only scanned `#toolbox`, which on the reporter's IITC build
 *     turned out to be just half the toolbox surface — about 10 items
 *     live in `#toolbox_component` (sibling div under `#sidebar`), used
 *     for core IITC entries (About IITC, Permalink, Artifacts, etc.)
 *     plus a few plugins that file themselves there (Bookmarks Opt,
 *     DrawTools Opt, Ornaments Opt, L7 Farms, Auto draw, Portals list,
 *     Region scores). v0.2 generalizes to a CONTAINERS list and scans
 *     every entry on it. Hide / observe / sort logic walks all of them;
 *     the consolidated <select> lives in whichever container the
 *     PRIMARY_FOR_SELECT match finds first (`#toolbox` by default).
 *
 * 0.1.20260522
 *   - Initial release. Hides every <a> child of #toolbox (display:none
 *     via a .tbd-hidden class so we can find them again) and inserts a
 *     <select id="tbd-select"> in their place. The first option is a
 *     disabled "Toolbox ▾" placeholder; each subsequent option mirrors
 *     one toolbox anchor (alphabetical, with "About IITC" pinned at the
 *     top). Picking an option triggers the original anchor's click and
 *     resets the select back to the placeholder so it's not sticky.
 *   - MutationObserver on #toolbox (childList only, filtered to anchor
 *     adds/removes) rebuilds the select when plugins register their
 *     toolbox link asynchronously after our setup runs. Rebuilds are
 *     debounced 100ms and idempotent — a signature check skips the work
 *     entirely when the anchor set hasn't changed.
 *
 * --- (above this line: pre-v0.4 sidebar-select approach, superseded) ---
 *
 * 0.9.20260526
 *   - About dialog housekeeping. Author moved to right under the
 *     title. Description rewritten to one user-facing sentence pair
 *     about what the plugin does + that newly-registered tools are
 *     picked up automatically. Detected section reduced to a single
 *     "Moved N items from the #toolbox" line. Reads-from / Writes-to
 *     / MutationObserver-note sections removed — they read like a
 *     dev's notes rather than an end-user About.
 *
 * 0.8.20260526
 *   - Moved the toolbox out from BELOW the layers control to LEFT of
 *     it. v0.4-v0.7's "below" placement had the icon partially hidden
 *     under IITC's sidebar toggle in the user's build. The new layout
 *     keeps the L.Control at topright (same container, no API churn)
 *     but uses CSS to pull our control out of the .leaflet-top.leaflet-
 *     right grid flow and absolutely position it 46px from the right
 *     edge — 36px (collapsed layers width) + 10px (gap). Layers
 *     control remains in its grid slot; toolbox sits flush to its left.
 *
 * 0.7.20260522
 *   - "About toolbox-dropdown" entry added as a synthetic item at the
 *     top of the dropdown (above the pinned "About IITC"). Click opens
 *     an About dialog following the same pattern as the other private
 *     plugins (reswue-keys / reswue-export / reswue-tracer): version,
 *     description, what it reads from, detection status, author. Items
 *     in the dropdown can now carry a `handler:fn` instead of an
 *     `anchor:Element`; the click delegate calls whichever is present.
 *
 * 0.6.20260522
 *   - Hide the toggle inside the expanded panel. Leaflet's stylesheet
 *     has `.leaflet-control-layers-expanded .leaflet-control-layers-toggle
 *     { display:none }` which is what hides the layers toggle when the
 *     layers panel opens. v0.5 dropped the .leaflet-control-layers-toggle
 *     class on our toggle (to kill the layers PNG bleed-through), so
 *     that rule no longer matched and our 🧰 glyph stayed visible at
 *     the top of the expanded list. v0.6 adds the equivalent rule
 *     scoped to .tbd-control-toggle.
 *
 * 0.5.20260522
 *   - v0.4 toggle reused Leaflet's .leaflet-control-layers-toggle
 *     class, which carries `background-image: url(images/layers.png)`
 *     from Leaflet's stylesheet. That layers icon was visible behind
 *     our 🧰 :before glyph (visual "layers behind toolbox" overlap).
 *     v0.5 drops the inherited class on the toggle and styles it
 *     fully from .tbd-control-toggle: display:block, 36×36, no
 *     background-image. Container still uses .leaflet-control-layers
 *     for the white-box / shadow / expand-on-hover Leaflet CSS;
 *     just the toggle <a> is no longer a Leaflet-layers element.
 *
 * 0.4.20260522
 *   - Architecture rewritten as a Leaflet map control, modeled on
 *     L.Control.Layers' collapsed/mouseenter-expand pattern. The
 *     dropdown now lives in .leaflet-control-container, slotted into
 *     the top-right corner DIRECTLY BELOW the layers control (which
 *     is also a topright Leaflet control). Mouseenter expands; mouse
 *     leave collapses. Reuses Leaflet's own
 *     .leaflet-control-layers / .leaflet-control-layers-list /
 *     .leaflet-control-layers-expanded class scheme so its CSS
 *     handles the visual styling for free.
 *   - Items render as <a class="tbd-item"> clickable rows inside the
 *     expanded list (not a <select>). Click fires the original
 *     #toolbox_component anchor's onclick + collapses the menu.
 *   - The sidebar's #toolbox_component is hidden (display:none via
 *     .tbd-hidden) so the original menu strip no longer appears —
 *     the map control is the only entry point.
 *   - Setup waits for window.map to exist (polls every 100ms up to
 *     5s) before adding the control, since L isn't available until
 *     IITC has finished initializing Leaflet.
 * ---------------------------------------------------------------------------
 */

function wrapper(plugin_info) {
  if (typeof window.plugin !== 'function') window.plugin = function () {};

  var self = window.plugin.toolboxDropdown = function () {};

  // ---- constants ------------------------------------------------------------

  self.VERSION     = '0.9.20260526';
  self.ABOUT_LABEL = 'About toolbox-dropdown';    // synthetic item, pinned topmost
  self.HIDE_CLASS  = 'tbd-hidden';                // applied to #toolbox_component
  self.CONTROL_CLASS = 'tbd-control';             // applied to our Leaflet control container
  self.ITEM_CLASS  = 'tbd-item';                  // applied to each clickable list entry
  self.TOOLBOX_SELECTOR = '#toolbox_component';   // source of items (the rendered toolbox)
  self.REBUILD_DEBOUNCE_MS = 100;
  self.MAP_WAIT_INTERVAL_MS = 100;
  self.MAP_WAIT_TIMEOUT_MS  = 5000;

  // Ordered pin list: items whose text matches one of these strings are
  // sorted into the same order, ABOVE everything else. Anything not in
  // the list falls back to alphabetical.
  self.PIN_ORDER = ['About toolbox-dropdown', 'About IITC'];

  // ---- state ----------------------------------------------------------------

  var rebuildTimer = null;

  // ---- item collection ------------------------------------------------------

  // Walk #toolbox_component's direct <a> children and produce a sorted
  // item list. Anchors with no readable text are dropped (they can't be
  // labelled meaningfully in the menu). The synthetic "About
  // toolbox-dropdown" entry is prepended; it carries a handler instead
  // of an anchor so the click delegate runs our openAbout() directly.
  self.collectItems = function () {
    var $toolbox = $(self.TOOLBOX_SELECTOR);
    var items = [{
      text:    self.ABOUT_LABEL,
      title:   'About this plugin',
      handler: function () { self.openAbout(); }
    }];
    if ($toolbox.length) {
      $toolbox.children('a').each(function () {
        var $a = $(this);
        var text = ($a.text() || '').trim();
        if (!text) return;
        items.push({
          text:   text,
          title:  $a.attr('title') || '',
          anchor: this
        });
      });
    }
    items.sort(self._compareItems);
    return items;
  };

  // Sort comparator: PIN_ORDER entries first in their listed order,
  // everything else alphabetical (case-insensitive locale compare).
  self._compareItems = function (a, b) {
    var pa = self.PIN_ORDER.indexOf(a.text);
    var pb = self.PIN_ORDER.indexOf(b.text);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.text.localeCompare(b.text);
  };

  // ---- Leaflet control ------------------------------------------------------

  // Build and return an L.Control subclass. We reuse the Leaflet
  // L.Control.Layers CSS class names (leaflet-control-layers, …-toggle,
  // …-list, …-expanded) so Leaflet's stylesheet handles the visual
  // styling, the collapse/expand transitions, and the toggle-hide-when-
  // expanded behaviour without us reinventing any of it.
  self.createControl = function () {
    if (typeof L === 'undefined' || !L.Control) return null;

    return L.Control.extend({
      options: { position: 'topright' },

      onAdd: function () {
        var container = L.DomUtil.create('div', 'leaflet-control-layers ' + self.CONTROL_CLASS);
        container.setAttribute('aria-haspopup', 'true');
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        // Collapsed-state toggle (the icon-only view). Intentionally
        // does NOT use Leaflet's .leaflet-control-layers-toggle class —
        // that class sets `background-image: url(layers.png)` and the
        // layers icon would render behind our toolbox glyph. All toggle
        // styling lives in .tbd-control-toggle instead.
        var toggle = L.DomUtil.create('a', self.CONTROL_CLASS + '-toggle', container);
        toggle.href = '#';
        toggle.title = 'Toolbox';
        toggle.setAttribute('role', 'button');
        L.DomEvent.on(toggle, 'click', L.DomEvent.preventDefault);

        // Expanded section. Leaflet's CSS only displays this when the
        // parent has .leaflet-control-layers-expanded.
        var section = L.DomUtil.create('section', 'leaflet-control-layers-list ' + self.CONTROL_CLASS + '-list', container);

        // Hover-to-expand, matching L.Control.Layers' default behaviour.
        L.DomEvent.on(container, {
          mouseenter: function () { L.DomUtil.addClass(container, 'leaflet-control-layers-expanded'); },
          mouseleave: function () { L.DomUtil.removeClass(container, 'leaflet-control-layers-expanded'); }
        });

        self._container = container;
        self._list      = section;
        self.rebuild();
        return container;
      }
    });
  };

  // Populate self._list with one row per item. Each row is an <a> styled
  // as a clickable line; click triggers the original anchor + collapses
  // the menu.
  self.rebuild = function () {
    if (!self._list) return;
    var items = self.collectItems();
    var signature = items.map(function (it) { return it.text; }).join('|');
    if (self._signature === signature) return;
    self._signature = signature;
    self._items = items;

    // Wipe + rebuild. Cheap; only runs when the anchor set actually
    // changes.
    while (self._list.firstChild) self._list.removeChild(self._list.firstChild);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var row = L.DomUtil.create('a', self.ITEM_CLASS, self._list);
      row.href = '#';
      row.textContent = item.text;
      if (item.title) row.title = item.title;
      row.setAttribute('data-idx', String(i));
    }
    // One delegated click handler covers the whole list; survives
    // rebuilds because the listener is on self._list, not the rows.
    if (!self._list._tbdClickBound) {
      L.DomEvent.on(self._list, 'click', self._onListClick);
      self._list._tbdClickBound = true;
    }
  };

  // Delegated click handler for the item list. Walks up from the click
  // target to find the .tbd-item ancestor (handles clicks on any inner
  // text node), invokes the item (either its synthetic handler or the
  // original toolbox anchor's click), and collapses the control so the
  // next hover reopens it fresh.
  self._onListClick = function (e) {
    var t = e.target;
    while (t && t !== self._list && !(t.classList && t.classList.contains(self.ITEM_CLASS))) {
      t = t.parentNode;
    }
    if (!t || t === self._list) return;
    L.DomEvent.preventDefault(e);
    var idx = parseInt(t.getAttribute('data-idx'), 10);
    if (!isFinite(idx) || !self._items || !self._items[idx]) return;
    var item = self._items[idx];
    if (self._container) L.DomUtil.removeClass(self._container, 'leaflet-control-layers-expanded');
    if (typeof item.handler === 'function') {
      try { item.handler(); } catch (err) { /* swallow */ }
      return;
    }
    if (item.anchor) {
      try { item.anchor.click(); }
      catch (err) {
        try { $(item.anchor).trigger('click'); } catch (err2) { /* swallow */ }
      }
    }
  };

  // ---- about dialog ---------------------------------------------------------

  self.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  self.openAbout = function () {
    var ver = (plugin_info && plugin_info.script && plugin_info.script.version) || self.VERSION;
    var $toolbox = $(self.TOOLBOX_SELECTOR);
    var movedCount = $toolbox.length ? $toolbox.children('a').length : 0;

    var html =
      '<div class="tbd-about">' +
        '<h3>Toolbox Dropdown <span class="tbd-ver">v' + self.escapeHtml(ver) + '</span></h3>' +
        '<p><b>Author:</b> CmdrDeLiver</p>' +
        '<p>Moves the Toolbox from the Sidebar Portal View to a Layers style hover-to-open menu ' +
        'and hides the toolbox items. New tools added after toolbox-dropdown is initialized will ' +
        'be added automatically.</p>' +
        '<h4>Detected</h4>' +
        '<p>Moved ' + movedCount + ' items from the <code>#toolbox</code></p>' +
      '</div>';

    window.dialog({
      id: 'plugin-toolbox-dropdown-about',
      title: 'About Toolbox Dropdown',
      html: html,
      width: 480
    });
  };

  // ---- observer -------------------------------------------------------------

  // Watch #toolbox_component for anchor add/remove (childList only,
  // filtered) and trigger a debounced rebuild so plugins that register
  // their toolbox link asynchronously still get folded into the menu.
  self.installObserver = function () {
    if (typeof MutationObserver === 'undefined') return;
    var target = document.querySelector(self.TOOLBOX_SELECTOR);
    if (!target) return;
    var observer = new MutationObserver(function (mutations) {
      var hasAnchorChange = false;
      for (var i = 0; i < mutations.length && !hasAnchorChange; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length && !hasAnchorChange; j++) {
          if (m.addedNodes[j].tagName === 'A') hasAnchorChange = true;
        }
        for (var k = 0; k < m.removedNodes.length && !hasAnchorChange; k++) {
          if (m.removedNodes[k].tagName === 'A') hasAnchorChange = true;
        }
      }
      if (!hasAnchorChange) return;
      clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(function () { self.rebuild(); }, self.REBUILD_DEBOUNCE_MS);
    });
    observer.observe(target, { childList: true });
    self._observer = observer;
  };

  // ---- map wait + install ---------------------------------------------------

  // window.map is created by IITC during boot; depending on plugin load
  // order our setup may run before it exists. Poll every 100ms (cheap)
  // up to MAP_WAIT_TIMEOUT_MS, then install the control. If the map
  // never appears we just bail — at worst the menu strip is hidden and
  // no replacement appears; the user can disable the plugin.
  self.installWhenMapReady = function () {
    var elapsed = 0;
    var poll = function () {
      if (window.map && typeof L !== 'undefined' && L.Control) {
        var Ctrl = self.createControl();
        if (Ctrl) {
          self._control = new Ctrl();
          window.map.addControl(self._control);
          // Fallback rebuild after install in case the observer missed
          // a late-arriving anchor during the wait.
          setTimeout(function () { self.rebuild(); }, 500);
          setTimeout(function () { self.rebuild(); }, 2000);
        }
        return;
      }
      elapsed += self.MAP_WAIT_INTERVAL_MS;
      if (elapsed >= self.MAP_WAIT_TIMEOUT_MS) {
        console.warn('[toolbox-dropdown] window.map never appeared; control not installed.');
        return;
      }
      setTimeout(poll, self.MAP_WAIT_INTERVAL_MS);
    };
    poll();
  };

  // ---- setup ----------------------------------------------------------------

  var setup = function () {
    // Hide the original sidebar toolbox strip. The map control replaces it.
    // !important is defensive — some IITC builds set inline display
    // styles that would otherwise win on specificity.
    $('<style>').html(
      '.' + self.HIDE_CLASS + '{display:none !important;}' +

      // Pull our control out of the leaflet-right grid stack and pin
      // it absolutely to the LEFT of the layers control (instead of
      // below). 46px = 36px (collapsed layers toggle width) + 10px gap.
      // If a build has a wider collapsed layers control this offset
      // will need to grow (or we measure it dynamically in JS).
      '.leaflet-top.leaflet-right .' + self.CONTROL_CLASS + '{' +
        'position:absolute;top:0;right:46px;margin:0;' +
      '}' +

      // Our control container reuses Leaflet's .leaflet-control-layers
      // visuals (white box, border-radius, box-shadow). The toggle is
      // styled from scratch here so it doesn't carry the layers PNG
      // background that .leaflet-control-layers-toggle would have given
      // us. Size matches the layers toggle (36×36) so the control
      // visually slots into the same spot.
      '.' + self.CONTROL_CLASS + '-toggle{' +
        'display:block;' +
        'width:36px;height:36px;line-height:36px;' +
        'text-align:center;font-size:22px;color:#333;' +
        'text-decoration:none;background:none;cursor:pointer;' +
      '}' +
      '.' + self.CONTROL_CLASS + '-toggle:before{content:"🧰";}' +
      // Mirror Leaflet's "hide the toggle when the panel is expanded"
      // rule. Without this, our 🧰 glyph would sit at the top of the
      // expanded list because dropping .leaflet-control-layers-toggle
      // in v0.5 also dropped Leaflet's own hide-when-expanded selector.
      '.leaflet-control-layers-expanded .' + self.CONTROL_CLASS + '-toggle{display:none;}' +
      '.' + self.CONTROL_CLASS + '-list{' +
        'min-width:160px;max-height:70vh;overflow:auto;' +
      '}' +
      '.' + self.CONTROL_CLASS + ' .' + self.ITEM_CLASS + '{' +
        'display:block;padding:3px 10px;color:#333;text-decoration:none;' +
        'white-space:nowrap;cursor:pointer;border-radius:3px;' +
      '}' +
      '.' + self.CONTROL_CLASS + ' .' + self.ITEM_CLASS + ':hover{' +
        'background:#e6efff;color:#000;' +
      '}' +

      // About dialog styling. Self-contained so this plugin doesn't
      // depend on any other plugin's CSS being loaded.
      '.tbd-about{font-size:12px;}' +
      '.tbd-about h3{margin:0 0 4px 0;color:#cce;}' +
      '.tbd-about h4{margin:10px 0 2px 0;color:#bbb;font-size:12px;}' +
      '.tbd-about .tbd-ver{color:#888;font-weight:normal;font-size:11px;margin-left:6px;}' +
      '.tbd-about ul{margin:4px 0;padding-left:20px;}' +
      '.tbd-about li{margin:2px 0;line-height:1.4;}' +
      '.tbd-about code{background:#222;padding:1px 4px;border-radius:2px;font-size:11px;color:#cce;}' +
      '.tbd-about .tbd-ok-text{color:#9c9;}' +
      '.tbd-about .tbd-bad-text{color:#c99;}' +
      '.tbd-about .tbd-about-foot{color:#888;font-size:11px;margin-top:8px;}'
    ).appendTo('head');

    // Hide the rendered toolbox immediately (don't wait for the map —
    // even if the control never installs, the sidebar strip stays
    // hidden, which surfaces the problem rather than silently
    // duplicating the menu).
    $(self.TOOLBOX_SELECTOR).addClass(self.HIDE_CLASS);

    self.installObserver();
    self.installWhenMapReady();
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
