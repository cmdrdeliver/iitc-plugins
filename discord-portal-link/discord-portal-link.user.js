// ==UserScript==
// @id             iitc-plugin-discord-portal-link@cmdrdeliver
// @name           IITC plugin: Discord portal link
// @category       Info
// @version        0.8.20260513
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
 * 0.8.20260513
 *   - Effects block now delegates to IITC's own mod-stat functions
 *     (getMaxOutgoingLinks, getPortalHackDetails, getLinkAmpRangeBoost,
 *     getPortalShieldMitigation, getPortalLinkDefenseBoost,
 *     getPortalAttackValues) so the numbers match what the portal panel
 *     shows. IITC's getPortalHackDetails already handles the friendly
 *     180 s / enemy 300 s cooldown base, so the plugin no longer needs
 *     its own faction-vs-portal logic for that.
 *   - Effects expanded to multi-line block: outbound cap, hacks @
 *     cooldown (burnout), and conditional lines for range boost (LA),
 *     defense (shield + link def boost), and attack (force/freq/hit).
 *     Conditional lines are omitted when the corresponding mods aren't
 *     installed.
 *   - Removed unused portalRelation / playerFaction / baseCooldown
 *     helpers and the SBUL/MH/HS local constants. IITC owns these now,
 *     with conservative fallbacks if its functions aren't exposed.
 *
 * 0.7.20260513
 *   - Resonator readout is now a two-column compass layout:
 *       N | NE     (top)
 *       NW| E
 *       W | SE
 *       SW| S      (bottom)
 *   - Mod list no longer includes the installer name.
 *   - Link-range value now delegates to IITC's window.getPortalRange()
 *     so it matches what the portal panel and the intel map show
 *     (and so it picks up Link Amp boosts). Falls back to the bare
 *     160 × meanLevel^4 formula if getPortalRange isn't exposed.
 *   - Dropped the (friendly)/(enemy)/(neutral)/(machina) tag from the
 *     Effects line; the team colouring of the team tag makes it
 *     redundant. Cooldown base still derives from player-vs-portal
 *     team internally.
 *
 * 0.6.20260513
 *   - Faction-coloured tokens (owner, team tag, resonator/mod agents,
 *     relation label) now render bold via ANSI "1;<colour>" so they
 *     stand out against the surrounding text in the detailed paste.
 *
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
  // Conservative fallbacks if IITC's mod-stat helpers aren't exposed on
  // this build. IITC owns the canonical math for everything else.
  self.FALLBACK_MAX_LINKS    = 8;
  self.FALLBACK_MAX_HACKS    = 4;
  self.FALLBACK_COOLDOWN_S   = 300;
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
    RED:    '\x1b[1;31m',
    GREEN:  '\x1b[1;32m',
    YELLOW: '\x1b[1;33m',
    BLUE:   '\x1b[1;34m'
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

  self.colorize = function (text, color) {
    if (!color) return String(text);
    return color + String(text) + self.ANSI.RESET;
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

  // 2 → "2", 2.5 → "2.5", 2.05 → "2.05" — trims trailing zeros for tidy display.
  self.formatBoost = function (v) {
    return (Math.round(v * 100) / 100).toString();
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

  // Strip ANSI escape sequences so padding reflects what Discord actually shows.
  self.visibleLen = function (s) {
    return String(s).replace(/\x1b\[[0-9;]*m/g, '').length;
  };

  self.padCell = function (s, n) {
    var pad = n - self.visibleLen(s);
    while (pad-- > 0) s += ' ';
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

  // Prefer IITC's own range calc so we match what the portal panel shows
  // (and so we pick up Link Amp boosts). Fall back to the bare formula
  // if IITC isn't exposing the function on this build.
  self.getRange = function (d, meanLevel) {
    if (typeof window.getPortalRange === 'function') {
      try {
        var rd = window.getPortalRange(d);
        if (rd && typeof rd === 'object' && typeof rd.range === 'number') return rd.range;
        if (typeof rd === 'number') return rd;
      } catch (e) { /* fall through */ }
    }
    return 160 * Math.pow(meanLevel, 4);
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

  // Pull mod-effect values from IITC's own helpers. Each call is wrapped in
  // a try/catch with a conservative fallback so a missing/broken helper
  // can't break the whole paste.
  self.modEffects = function (d) {
    var eff = {
      maxOut:       self.FALLBACK_MAX_LINKS,
      hacks:        self.FALLBACK_MAX_HACKS,
      cooldown:     self.FALLBACK_COOLDOWN_S,
      burnout:      self.FALLBACK_COOLDOWN_S * (self.FALLBACK_MAX_HACKS - 1),
      rangeBoost:   1,
      shieldMit:    0,
      linkDefBoost: 1,
      forceAmp:     0,
      attackFreq:   0,
      hitBonus:     0
    };
    self.tryCall(function () { eff.maxOut       = window.getMaxOutgoingLinks(d); });
    self.tryCall(function () {
      var h = window.getPortalHackDetails(d);
      if (h) {
        if (typeof h.hacks    === 'number') eff.hacks    = h.hacks;
        if (typeof h.cooldown === 'number') eff.cooldown = h.cooldown;
        if (typeof h.burnout  === 'number') eff.burnout  = h.burnout;
      }
    });
    self.tryCall(function () { eff.rangeBoost   = window.getLinkAmpRangeBoost(d);    });
    self.tryCall(function () { eff.shieldMit    = window.getPortalShieldMitigation(d); });
    self.tryCall(function () { eff.linkDefBoost = window.getPortalLinkDefenseBoost(d); });
    self.tryCall(function () {
      var av = window.getPortalAttackValues(d);
      if (av) {
        if (typeof av.force_amplifier  === 'number') eff.forceAmp   = av.force_amplifier;
        if (typeof av.attack_frequency === 'number') eff.attackFreq = av.attack_frequency;
        if (typeof av.hit_bonus        === 'number') eff.hitBonus   = av.hit_bonus;
      }
    });
    return eff;
  };

  self.tryCall = function (fn) {
    try { fn(); } catch (e) { /* leave the fallback in place */ }
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
    var range    = self.getRange(d, mean);
    var links    = self.countLinks(portal.guid);
    var eff      = self.modEffects(d);

    var ownerC = self.colorize(owner,   teamCol);
    var teamC  = self.colorize(teamTag, teamCol);

    var rangeText = self.formatRange(range);
    if (eff.rangeBoost > 1) rangeText += ' (×' + self.formatBoost(eff.rangeBoost) + ')';

    var body = [];
    body.push('Owner: ' + ownerC + ' (L' + level + ', ' + teamC + ')  ·  Health: ' + health + '%');
    body.push('Range: ' + rangeText + '  ·  Links: ' + links.out + ' out / ' + links.in + ' in');

    body.push('Resonators:');
    // Two-column compass layout, top to bottom.
    var ROW_PAIRS = [
      [2, 1],  // N , NE
      [3, 0],  // NW, E
      [4, 7],  // W , SE
      [5, 6]   // SW, S
    ];
    var cells = ROW_PAIRS.map(function (pair) {
      return [
        self.formatResoCell(resos[pair[0]], pair[0], teamCol),
        self.formatResoCell(resos[pair[1]], pair[1], teamCol)
      ];
    });
    var leftWidth = 0;
    for (var ci = 0; ci < cells.length; ci++) {
      leftWidth = Math.max(leftWidth, self.visibleLen(cells[ci][0]));
    }
    for (var ri = 0; ri < cells.length; ri++) {
      body.push('  ' + self.padCell(cells[ri][0], leftWidth) + '   ' + cells[ri][1]);
    }

    var modStrs = [];
    for (var j = 0; j < mods.length; j++) {
      var mm = mods[j];
      if (!mm) continue;
      var abbr = self.MOD_ABBREV[mm.name] || mm.name;
      var rar  = self.normalizeRarity(mm.rarity);
      var rs   = self.RARITY_ABBREV[rar] || rar;
      modStrs.push(abbr + '-' + rs);
    }
    body.push('Mods: ' + (modStrs.length ? modStrs.join(' · ') : '—'));

    // Build the Effects block. Always-relevant line first, then optional
    // lines for range/defense/attack only when mods actually do something.
    var effLines = [];
    effLines.push('Outbound: ' + eff.maxOut +
                  '  ·  Hacks: ' + eff.hacks +
                  ' @ ' + self.formatCooldown(eff.cooldown) +
                  ' (burnout ' + self.formatCooldown(eff.burnout) + ')');

    var defParts = [];
    if (eff.shieldMit    > 0) defParts.push('shield ' + eff.shieldMit + '%');
    if (eff.linkDefBoost > 1) defParts.push('links ×' + self.formatBoost(eff.linkDefBoost));
    if (defParts.length) effLines.push('Defense: ' + defParts.join(' · '));

    var attParts = [];
    if (eff.forceAmp   > 0) attParts.push('force ×' + self.formatBoost(eff.forceAmp));
    if (eff.attackFreq > 0) attParts.push('freq ×'  + self.formatBoost(eff.attackFreq));
    if (eff.hitBonus   > 0) attParts.push('hit +'   + Math.round(eff.hitBonus * 100) + '%');
    if (attParts.length) effLines.push('Attack: ' + attParts.join(' · '));

    body.push('Effects:');
    for (var ei = 0; ei < effLines.length; ei++) body.push('  ' + effLines[ei]);

    return header + '\n```ansi\n' + body.join('\n') + '\n```';
  };

  self.formatResoCell = function (r, idx, teamCol) {
    var label = self.padRight(self.OCTANTS[idx], 2);
    if (!r) return label + ': —';
    var max   = self.RESO_MAX[r.level] || 1;
    var pct   = Math.round((r.energy / max) * 100);
    var agent = self.colorize(r.owner || '?', teamCol);
    return label + ': L' + r.level + ' ' + agent + ' ' + self.padLeft(pct + '%', 4);
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
