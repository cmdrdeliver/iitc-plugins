// ==UserScript==
// @id             iitc-plugin-discord-portal-link@cmdrdeliver
// @name           IITC plugin: Discord portal link
// @category       Info
// @version        0.1.20260513
// @author         CmdrDeLiver
// @namespace      https://github.com/cmdrdeliver/iitc-plugins
// @description    Adds a clickable icon to the portal details panel that copies a Discord-flavoured markdown link for the current portal to the clipboard.
// @updateURL      https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js
// @downloadURL    https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js
// @match          https://intel.ingress.com/*
// @match          https://intel-x.ingress.com/*
// @grant          none
// ==/UserScript==

/* ---------------------------------------------------------------------------
 * Version history
 * ---------------------------------------------------------------------------
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

  // Discord brand mark, simplified path. Rendered inline so we don't
  // depend on any external CDN and stay friendly to userscript sandboxes.
  self.DISCORD_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M19.27 5.33A17.5 17.5 0 0 0 15 4a.07.07 0 0 0-.07.04c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09a.08.08 0 0 0-.07-.04A17.3 17.3 0 0 0 4.7 5.33a.06.06 0 0 0-.03.02C2 9.42 1.25 13.38 1.62 17.3a.07.07 0 0 0 .03.05A17.6 17.6 0 0 0 6.9 20a.08.08 0 0 0 .08-.03c.4-.55.76-1.13 1.07-1.74a.07.07 0 0 0-.04-.1 11.6 11.6 0 0 1-1.65-.78.07.07 0 0 1 0-.12l.33-.26a.07.07 0 0 1 .07-.01 12.5 12.5 0 0 0 10.55 0 .07.07 0 0 1 .08.01l.33.26a.07.07 0 0 1-.01.12 11 11 0 0 1-1.64.78.07.07 0 0 0-.04.1c.32.61.68 1.19 1.07 1.74a.07.07 0 0 0 .08.03 17.5 17.5 0 0 0 5.26-2.65.07.07 0 0 0 .03-.05c.44-4.53-.73-8.46-3.1-11.95a.06.06 0 0 0-.03-.02ZM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12Zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12Z"/>' +
    '</svg>';

  self.getCurrentPortal = function () {
    var guid = window.selectedPortal;
    if (!guid) return null;
    var p = window.portals && window.portals[guid];
    if (!p) return null;
    var data = p.options && p.options.data;
    if (!data) return null;
    var ll = p.getLatLng();
    return {
      guid: guid,
      title: data.title || '(unknown)',
      lat: ll.lat,
      lng: ll.lng
    };
  };

  self.buildDiscordLink = function (portal) {
    // Discord markdown: [label](url). Escape ] and \ in the label so a portal
    // name with a square bracket can't break out of the link label.
    var safeTitle = String(portal.title).replace(/\\/g, '\\\\').replace(/\]/g, '\\]');
    var url = 'https://intel.ingress.com/intel?pll=' + portal.lat + ',' + portal.lng;
    return '[' + safeTitle + '](' + url + ')';
  };

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

  self.onClick = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    var btn = ev.currentTarget;
    var portal = self.getCurrentPortal();
    if (!portal) {
      self.flashButton(btn, 'No portal selected', 'dpl-bad');
      return;
    }
    var text = self.buildDiscordLink(portal);
    self.copyToClipboard(text).then(function () {
      self.flashButton(btn, 'Copied to clipboard', 'dpl-ok');
    }).catch(function (err) {
      console.warn('[discord-portal-link] copy failed:', err);
      self.flashButton(btn, 'Copy failed', 'dpl-bad');
    });
  };

  self.findTitleEl = function (details) {
    // IITC has historically rendered the portal name as #portaldetails .title
    // (an <h3> in current builds). Probe in priority order and fall back to
    // the first heading inside #portaldetails.
    return details.querySelector('.title') ||
           details.querySelector('h3') ||
           details.querySelector('h2');
  };

  self.renderButton = function () {
    var portal = self.getCurrentPortal();
    if (!portal) return;
    var details = document.getElementById('portaldetails');
    if (!details) return;
    // Avoid double-insert if portalDetailsUpdated re-fires on the same render.
    var existing = details.querySelector('#' + self.BTN_ID);
    if (existing) existing.remove();

    var btn = document.createElement('a');
    btn.id = self.BTN_ID;
    btn.href = '#';
    btn.className = 'dpl-btn';
    btn.title = 'Copy Discord-flavoured portal link to clipboard';
    btn.setAttribute('aria-label', 'Copy Discord portal link');
    btn.innerHTML = self.DISCORD_SVG;
    btn.addEventListener('click', self.onClick);

    var titleEl = self.findTitleEl(details);
    if (titleEl) {
      // Sit the icon inline with the title text so it follows the portal
      // name regardless of how the title wraps.
      titleEl.appendChild(btn);
    } else {
      details.insertBefore(btn, details.firstChild);
    }
  };

  var setup = function () {
    $('<style>').html(
      '#' + self.BTN_ID + '{display:inline-flex;align-items:center;justify-content:center;' +
        'width:20px;height:20px;margin-left:6px;vertical-align:middle;' +
        'color:#5865F2;text-decoration:none;cursor:pointer;border-radius:3px;' +
        'transition:color .15s,background .15s;}' +
      '#' + self.BTN_ID + ' svg{display:block;}' +
      '#' + self.BTN_ID + ':hover{color:#fff;background:#5865F2;}' +
      '#' + self.BTN_ID + '.dpl-ok{color:#fff;background:#3ba55d;}' +
      '#' + self.BTN_ID + '.dpl-bad{color:#fff;background:#ed4245;}'
    ).appendTo('head');

    if (typeof window.addHook === 'function') {
      window.addHook('portalDetailsUpdated', self.renderButton);
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
