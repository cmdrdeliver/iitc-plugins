# IITC Plugins

A collection of plugins for [IITC-CE](https://iitc.app/) — the Ingress Intel Total Conversion overlay for the Niantic intel map.

## Plugins

| Plugin | Description | Install |
|---|---|---|
| [nearest-portals](nearest-portals/) | List the closest portals matching a status (visited / captured / scouted), export them, and plan a multi-stop route between them via OSRM. | [Install](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/nearest-portals/nearest-portals.user.js) |
| [live-inventory](live-inventory/) | Show your in-game inventory (CORE required). Fork of DanielOnDiordna's plugin that keeps the previously cached inventory when the Intel API returns an empty result. | [Install](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/live-inventory/live-inventory.user.js) |
| [discord-portal-link](discord-portal-link/) | Adds a Discord-icon button to the portal details panel that copies a Discord-flavoured markdown link (`[name](intel-url)`) to the clipboard. | [Install](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js) |

## Installing

1. Install [IITC-CE](https://iitc.app/) (browser extension or userscript).
2. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
3. Click the **Install** link for any plugin above. Your userscript manager will prompt to install.
4. Reload `intel.ingress.com`.

Each plugin's `@updateURL` points back to this repository, so installed scripts auto-update when a new version is published.

## License

[MIT](LICENSE) — modify and redistribute freely, attribution preserved.

## Author

CmdrDeLiver
