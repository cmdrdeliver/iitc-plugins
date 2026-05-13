// ==UserScript==
// @id             iitc-plugin-discord-portal-link@cmdrdeliver
// @name           IITC plugin: Discord portal link
// @category       Info
// @version        0.5.20260513
// @author         CmdrDeLiver
// @namespace      https://github.com/cmdrdeliver/iitc-plugins
// @description    Adds a clickable Discord icon to the portal details panel. Click for a popup menu: quick markdown link or a detailed Discord paste (owner, range, links, resonators, mods, computed effects).
// @updateURL      https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js
// @downloadURL    https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js
// @match          https://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @grant          none
// ==/UserScript==

/* ---------------------------------------------------------------------------
 * Version history
 * ---------------------------------------------------------------------------
 * 0.5.20260513
 *   - Detailed paste now ships in a Discord ```ansi``` block so agent
 *     names and team tags render in the appropriate faction colour:
 *     RES = blue, ENL = green, NEU = yellow (closest 8-colour proxy
 *     for orange), Machina = red. The (friendly)/(enemy)/(neutral)/
 *     (machina) tag on the Effects line also takes its colour from
 *     the relation.
 *   - teamLabel() now recognises Machina (data.team starting with 'M')
 *     and portalRelation() returns 'machina' for cooldown labelling;
 *     Machina portals still use the 300-second enemy base for cooldown.
 *   - Both the quick "Copy link" and the detailed-paste header now
 *     wrap the intel URL in <…> so Discord suppresses the auto-embed
 *     preview.
 *
 * 0.4.20260513
 *   - Hack-cooldown base now depends on the player's faction vs the portal's
 *     team: friendly portals use 180 s, enemy/neutral portals use 300 s.
 *     Player faction is read from window.PLAYER.team. The detailed paste
 *     labels the cooldown with (friendly) / (enemy) / (neutral) so the
 *     basis is unambiguous, and falls back to (faction unknown) + 300 s
 *     if PLAYER isn't populated.
 *
 * 0.3.20260513
 *   - Left-click on the icon now opens a popup menu with two options:
 *       * "Copy link"       — quick "[name](url)" markdown link (old behaviour)
 *       * "Copy detailed"   — multi-line Discord paste with owner, team, level,
 *                             health, link range, in/out link counts, all 8
 *                             resonators (octant, level, agent, energy %), all
 *                             4 mods, and the *computed effects* of SBUL/MH/HS
 *                             (max outbound links, max hacks before burnout,
 *                             hack cooldown).
 *   - Menu closes on outside-click, Escape, item selection, or icon re-click.
 *
 * 0.2.20260513
 *   - Icon now prepended to the portal-name title so it stays reachable
 *     when the name is long enough to overflow the sidebar.
 *   - Lightened the resting icon colour to a brighter blurple for better
 *     contrast on IITC's dark sidebar background.
 *
 * 0.1.20260513
 *   - Initial release.
 *   - Injects a Discord-logo icon next to the portal name in the details
 *     panel; click copies "[Portal Name](https://intel.ingress.com/intel?pll=lat,lng)".
 *   - Falls back to a hidden-textarea + execCommand path when
 *     navigator.clipboard is unavailable (e.g. non-secure contexts).
 * ---------------------------------------------------------------------------
 */

function wrapper(plugin_info) {
  if (typeof window.plugin !== 'function') window.plugin = function () {};

  var self = window.plugin.discordPortalLink = function () {};

  self.BTN_ID = 'dpl-copy-btn';
  self.MENU_ID = 'dpl-menu';

  // Discord brand mark, simplified path. Rendered inline so we don't
  // depend on any external CDN and stay friendly to userscript sandboxes.
  self.DISCORD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M19.27 5.33A17.5 17.5 0 0 0 15 4a.07.07 0 0 0-.07.04c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09a.08.08 0 0 0-.07-.04A17.3 17.3 0 0 0 4.7 5.33a.06.06 0 0 0-.03.02C2 9.42 1.25 13.38 1.62 17.3a.07.07 0 0 0 .03.05A17.6 17.6 0 0 0 6.9 20a.08.08 0 0 0 .08-.03c.4-.55.76-1.13 1.07-1.74a.07.07 0 0 0-.04-.1 11.6 11.6 0 0 1-1.65-.78.07.07 0 0 1 0-.12l.33-.26a.07.07 0 0 1 .07-.01 12.5 12.5 0 0 0 10.55 0 .07.07 0 0 1 .08.01l.33.26a.07.07 0 0 1-.01.12 11 11 0 0 1-1.64.78.07.07 0 0 0-.04.1c.32.61.68 1.19 1.07 1.74a.07.07 0 0 0 .08.03 17.5 17.5 0 0 0 5.26-2.65.07.07 0 0 0 .03-.05c.44-4.53-.73-8.46-3.1-11.95a.06.06 0 0 0-.03-.02ZM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12Zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12Z"/>' +
    '</svg>';

  // ---- game constants -------------------------------------------------------
  // Resonator slot order matches IITC's processed data layout.
  self.OCTANTS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  // Max energy per resonator level. Index = level.
  self.RESO_MAX = [0, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000];
  // Default max outbound link cap, default hack count before burnout, and
  // default hack cooldown (seconds). Mods adjust these.
  self.DEFAULT_MAX_LINKS = 8;
  self.DEFAULT_MAX_HACKS = 4;
  // Hack cooldown depends on whether the portal is friendly to the player.
  self.DEFAULT_COOLDOWN_FRIENDLY_S = 180;
  self.DEFAULT_COOLDOWN_ENEMY_S    = 300;
  // Per-mod bonuses. SBUL is always Very Rare in current Ingress.
  self.SBUL_BONUS = 8;
  self.MH_BONUS  = { COMMON: 4,   RARE: 8,   VERY_RARE: 12 };
  self.HS_MULT   = { COMMON: 0.8, RARE: 0.5, VERY_RARE: 0.3 };
  // Short forms used in the paste.
  self.MOD_ABBREV = {
    'SoftBank Ultra Link': 'SBUL',
    'Multi-hack':          'MH',
    'Heat Sink':           'HS',
    'Link Amp':            'LA',
    'Force Amp':           'FA',
    'Turret':              'TURR',
    'Portal Shield':       'SH',
    'Aegis Shield':        'AXA',
    'ITO En Transmuter':   'ITO+',
    'ITO De Transmuter':   'ITO-'
  };
  self.RARITY_ABBREV = {
    COMMON:    'C',
    RARE:      'R',
    VERY_RARE: 'VR'
  };

  // ---- portal lookup --------------------------------------------------------

  self.getCurrentPortal = function () {
    var guid = window.selectedPortal;
    if (!guid) return null;
    var p = window.portals && window.portals[guid];
    if (!p) return null;
    var data = p.options && p.options.data;
    if (!data) return null;
    var ll = p.getLatLng();
    return {
      guid:  guid,
      title: data.title || '(unknown)',
      lat:   ll.lat,
      lng:   ll.lng,
      data:  data
    };
  };

  // ---- formatting helpers ---------------------------------------------------

  self.escapeMd = function (s) {
    // Just keep "]" and "\" safe inside the link label.
    return String(s).replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
  };

  self.intelUrl = function (portal) {
    return 'https://intel.ingress.com/intel?pll=' + portal.lat + ',' + portal.lng;
  };

  self.buildDiscordLink = function (portal) {
    // Angle brackets around the URL suppress Discord's auto-embed preview.
    return '[' + self.escapeMd(portal.title) + '](<' + self.intelUrl(portal) + '>)';
  };

  self.teamLabel = function (t) {
    if (!t) return 'NEU';
    var s = String(t).toUpperCase();
    if (s.charAt(0) === 'R') return 'RES';
    if (s.charAt(0) === 'E') return 'ENL';
    if (s.charAt(0) === 'M') return 'MAC';
    return 'NEU';
  };

  // ANSI escape sequences for Discord's ```ansi``` code blocks.
  // Discord's renderer honours the standard 8-colour palette plus reset.
  self.ANSI = {
    RESET:  '\x1b[0m',
    RED:    '\x1b[31m',
    GREEN:  '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE:   '\x1b[34m'
  };

  // Discord's palette has no true orange, so NEU borrows yellow as the
  // closest 8-colour approximation.
  self.teamColor = function (teamTag) {
    switch (teamTag) {
      case 'RES': return self.ANSI.BLUE;
      case 'ENL': return self.ANSI.GREEN;
      case 'MAC': return self.ANSI.RED;
      case 'NEU': return self.ANSI.YELLOW;
      default:    return '';
    }
  };

  self.relationColor = function (relation) {
    switch (relation) {
      case 'friendly': return self.ANSI.GREEN;
      case 'enemy':    return self.ANSI.RED;
      case 'machina':  return self.ANSI.RED;
      case 'neutral':  return self.ANSI.YELLOW;
      default:         return '';
    }
  };

  self.colorize = function (text, color) {
    if (!color) return String(text);
    return color + String(text) + self.ANSI.RESET;
  };

  // window.PLAYER is populated by IITC after login. .team is the full faction
  // name ('RESISTANCE' / 'ENLIGHTENED') in modern builds. Returns 'RES',
  // 'ENL', or null if the faction can't be determined.
  self.playerFaction = function () {
    var t = window.PLAYER && window.PLAYER.team;
    if (!t) return null;
    var s = String(t).toUpperCase();
    if (s.charAt(0) === 'R') return 'RES';
    if (s.charAt(0) === 'E') return 'ENL';
    return null;
  };

  // 'friendly' | 'enemy' | 'neutral' | 'machina' | 'unknown'
  self.portalRelation = function (portalTeam) {
    var portal = self.teamLabel(portalTeam);
    if (portal === 'NEU') return 'neutral';
    if (portal === 'MAC') return 'machina';
    var player = self.playerFaction();
    if (!player) return 'unknown';
    return player === portal ? 'friendly' : 'enemy';
  };

  self.baseCooldown = function (relation) {
    return relation === 'friendly' ? self.DEFAULT_COOLDOWN_FRIENDLY_S
                                   : self.DEFAULT_COOLDOWN_ENEMY_S;
  };

  self.relationLabel = function (relation) {
    return relation === 'unknown' ? 'faction unknown' : relation;
  };

  self.formatRange = function (m) {
    if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
    return Math.round(m) + ' m';
  };

  self.formatCooldown = function (s) {
    s = Math.round(s);
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  };

  self.padRight = function (s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  };

  self.padLeft = function (s, n) {
    s = String(s);
    while (s.length < n) s = ' ' + s;
    return s;
  };

  // ---- data extraction ------------------------------------------------------

  self.countLinks = function (guid) {
    var out = 0, inb = 0;
    var links = window.links || {};
    for (var k in links) {
      var d = links[k] && links[k].options && links[k].options.data;
      if (!d) continue;
      if (d.oGuid === guid) out++;
      else if (d.dGuid === guid) inb++;
    }
    return { out: out, in: inb };
  };

  // Mean resonator level over all 8 slots (missing = 0). This is the value
  // that drives Ingress's max-link-range formula.
  self.meanResoLevel = function (resos) {
    var sum = 0;
    for (var i = 0; i < 8; i++) {
      var r = resos && resos[i];
      if (r && r.level) sum += r.level;
    }
    return sum / 8;
  };

  // Sum-of-energies / sum-of-max — matches in-game "portal health".
  self.portalHealth = function (resos) {
    var max = 0, cur = 0;
    for (var i = 0; i < 8; i++) {
      var r = resos && resos[i];
      if (!r) continue;
      max += self.RESO_MAX[r.level] || 0;
      cur += r.energy || 0;
    }
    return max > 0 ? (cur / max) * 100 : 0;
  };

  self.normalizeRarity = function (raw) {
    return String(raw || '').toUpperCase().replace(/[ -]/g, '_');
  };

  self.modEffects = function (mods, relation) {
    var maxOut   = self.DEFAULT_MAX_LINKS;
    var maxHacks = self.DEFAULT_MAX_HACKS;
    var cooldown = self.baseCooldown(relation);
    for (var i = 0; i < (mods || []).length; i++) {
      var m = mods[i];
      if (!m) continue;
      var name = m.name || '';
      var rar  = self.normalizeRarity(m.rarity);
      if (name === 'SoftBank Ultra Link') {
        maxOut += self.SBUL_BONUS;
      } else if (name === 'Multi-hack') {
        maxHacks += (self.MH_BONUS[rar] || 0);
      } else if (name === 'Heat Sink') {
        cooldown *= (self.HS_MULT[rar] != null ? self.HS_MULT[rar] : 1);
      }
    }
    return { maxOut: maxOut, maxHacks: maxHacks, cooldown: cooldown };
  };

  // ---- detailed paste -------------------------------------------------------

  self.buildDetailedText = function (portal) {
    var d     = portal.data;
    var resos = d.resonators || [];
    var mods  = d.mods || [];

    var header = '**[' + self.escapeMd(portal.title) + '](<' + self.intelUrl(portal) + '>)**';

    var owner    = d.owner || '—';
    var teamTag  = self.teamLabel(d.team);
    var teamCol  = self.teamColor(teamTag);
    var level    = d.level || 0;
    var health   = d.health != null ? Math.round(d.health) : Math.round(self.portalHealth(resos));
    var mean     = self.meanResoLevel(resos);
    var range    = 160 * Math.pow(mean, 4);
    var links    = self.countLinks(portal.guid);
    var relation = self.portalRelation(d.team);
    var eff      = self.modEffects(mods, relation);

    var ownerC   = self.colorize(owner,   teamCol);
    var teamC    = self.colorize(teamTag, teamCol);

    var body = [];
    body.push('Owner: ' + ownerC + ' (L' + level + ', ' + teamC + ')  ·  Health: ' + health + '%');
    body.push('Range: ' + self.formatRange(range) + '  ·  Links: ' + links.out + ' out / ' + links.in + ' in');

    body.push('Resonators:');
    for (var i = 0; i < 8; i++) {
      var r = resos[i];
      var label = self.padRight(self.OCTANTS[i], 2);
      if (!r) {
        body.push('  ' + label + ': —');
        continue;
      }
      var max   = self.RESO_MAX[r.level] || 1;
      var pct   = Math.round((r.energy / max) * 100);
      var lvl   = 'L' + r.level;
      // Resonators always match portal team, so reuse teamCol for the agent.
      var agent = self.colorize(r.owner || '?', teamCol);
      body.push('  ' + label + ': ' + lvl + ' ' + agent + ' ' + self.padLeft(pct + '%', 4));
    }

    var modStrs = [];
    for (var j = 0; j < mods.length; j++) {
      var mm = mods[j];
      if (!mm) continue;
      var abbr = self.MOD_ABBREV[mm.name] || mm.name;
      var rar  = self.normalizeRarity(mm.rarity);
      var rs   = self.RARITY_ABBREV[rar] || rar;
      // Mods can only be installed on a friendly portal, so installer
      // shares the portal's team colour.
      var installer = self.colorize(mm.owner || '?', teamCol);
      modStrs.push(abbr + '-' + rs + ' (' + installer + ')');
    }
    body.push('Mods: ' + (modStrs.length ? modStrs.join(' · ') : '—'));

    var relC = self.colorize(self.relationLabel(relation), self.relationColor(relation));
    body.push('Effects: ' + eff.maxOut + ' max outbound · ' +
              eff.maxHacks + ' hacks · ' +
              self.formatCooldown(eff.cooldown) + ' cooldown (' + relC + ')');

    return header + '\n```ansi\n' + body.join('\n') + '\n```';
  };

  // ---- clipboard ------------------------------------------------------------

  self.copyToClipboard = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand copy returned false'));
      } catch (e) {
        reject(e);
      }
    });
  };

  self.flashButton = function (btn, tooltip, colorClass) {
    var originalTitle = btn.getAttribute('data-original-title') || btn.title;
    btn.setAttribute('data-original-title', originalTitle);
    btn.title = tooltip;
    btn.classList.add(colorClass);
    setTimeout(function () {
      btn.title = originalTitle;
      btn.classList.remove(colorClass);
    }, 1200);
  };

  // ---- popup menu -----------------------------------------------------------

  self.menuEl = null;

  self.closeMenu = function () {
    if (!self.menuEl) return;
    self.menuEl.remove();
    self.menuEl = null;
    document.removeEventListener('mousedown', self.onOutsideClick, true);
    document.removeEventListener('keydown',   self.onMenuKey,      true);
    window.removeEventListener('resize',      self.closeMenu);
    window.removeEventListener('scroll',      self.closeMenu, true);
  };

  self.onOutsideClick = function (ev) {
    if (!self.menuEl) return;
    if (self.menuEl.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest('#' + self.BTN_ID)) return;
    self.closeMenu();
  };

  self.onMenuKey = function (ev) {
    if (ev.key === 'Escape') self.closeMenu();
  };

  self.openMenu = function (btn) {
    self.closeMenu();
    var rect = btn.getBoundingClientRect();
    var menu = document.createElement('ul');
    menu.id = self.MENU_ID;
    menu.className = 'dpl-menu';
    menu.style.top  = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';
    menu.innerHTML =
      '<li data-action="quick">Copy link</li>' +
      '<li data-action="detailed">Copy detailed paste</li>';
    menu.addEventListener('click', function (ev) {
      var li = ev.target.closest && ev.target.closest('li[data-action]');
      if (!li) return;
      var action = li.getAttribute('data-action');
      self.closeMenu();
      self.performAction(action, btn);
    });
    document.body.appendChild(menu);
    self.menuEl = menu;
    // Defer listener registration so the click that opened the menu doesn't
    // immediately trigger the outside-click handler.
    setTimeout(function () {
      document.addEventListener('mousedown', self.onOutsideClick, true);
      document.addEventListener('keydown',   self.onMenuKey,      true);
      window.addEventListener('resize',      self.closeMenu);
      window.addEventListener('scroll',      self.closeMenu, true);
    }, 0);
  };

  self.performAction = function (action, btn) {
    var portal = self.getCurrentPortal();
    if (!portal) {
      self.flashButton(btn, 'No portal selected', 'dpl-bad');
      return;
    }
    var text;
    if (action === 'quick')         text = self.buildDiscordLink(portal);
    else if (action === 'detailed') text = self.buildDetailedText(portal);
    else return;
    self.copyToClipboard(text).then(function () {
      self.flashButton(btn, 'Copied to clipboard', 'dpl-ok');
    }).catch(function (err) {
      console.warn('[discord-portal-link] copy failed:', err);
      self.flashButton(btn, 'Copy failed', 'dpl-bad');
    });
  };

  // ---- icon -----------------------------------------------------------------

  self.onClick = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (self.menuEl) { self.closeMenu(); return; }
    self.openMenu(ev.currentTarget);
  };

  self.findTitleEl = function (details) {
    return details.querySelector('.title') ||
           details.querySelector('h3') ||
           details.querySelector('h2');
  };

  self.renderButton = function () {
    var portal = self.getCurrentPortal();
    if (!portal) return;
    var details = document.getElementById('portaldetails');
    if (!details) return;
    var existing = details.querySelector('#' + self.BTN_ID);
    if (existing) existing.remove();
    self.closeMenu();

    var btn = document.createElement('a');
    btn.id = self.BTN_ID;
    btn.href = '#';
    btn.className = 'dpl-btn';
    btn.title = 'Discord portal link (click for options)';
    btn.setAttribute('aria-label', 'Discord portal link options');
    btn.innerHTML = self.DISCORD_SVG;
    btn.addEventListener('click', self.onClick);

    var titleEl = self.findTitleEl(details);
    if (titleEl) {
      titleEl.insertBefore(btn, titleEl.firstChild);
    } else {
      details.insertBefore(btn, details.firstChild);
    }
  };

  // ---- setup ----------------------------------------------------------------

  var setup = function () {
    $('<style>').html(
      '#' + self.BTN_ID + '{display:inline-flex;align-items:center;justify-content:center;' +
        'width:20px;height:20px;margin-right:6px;vertical-align:middle;' +
        'color:#c7ccff;text-decoration:none;cursor:pointer;border-radius:3px;' +
        'transition:color .15s,background .15s;}' +
      '#' + self.BTN_ID + ' svg{display:block;}' +
      '#' + self.BTN_ID + ':hover{color:#fff;background:#5865F2;}' +
      '#' + self.BTN_ID + '.dpl-ok{color:#fff;background:#3ba55d;}' +
      '#' + self.BTN_ID + '.dpl-bad{color:#fff;background:#ed4245;}' +
      '#' + self.MENU_ID + '{position:fixed;z-index:9999;margin:0;padding:4px 0;' +
        'list-style:none;background:#1b1c20;border:1px solid #5865F2;border-radius:4px;' +
        'box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:12px;min-width:170px;}' +
      '#' + self.MENU_ID + ' li{padding:6px 12px;color:#e6e8ff;cursor:pointer;white-space:nowrap;}' +
      '#' + self.MENU_ID + ' li:hover{background:#5865F2;color:#fff;}'
    ).appendTo('head');

    if (typeof window.addHook === 'function') {
      window.addHook('portalDetailsUpdated', self.renderButton);
      // Hide the menu if a different portal is loaded under it.
      window.addHook('portalSelected', self.closeMenu);
    }
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
