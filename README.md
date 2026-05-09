# IITC Plugins

A collection of plugins for [IITC-CE](https://iitc.app/) — the Ingress Intel Total Conversion overlay for the Niantic intel map.

## Plugins

| Plugin | Description | Install |
|---|---|---|
| [nearest-portals](nearest-portals/) | List the closest portals matching a status (visited / captured / scouted), export them, and plan a multi-stop route between them via OSRM. | [Install](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/nearest-portals/nearest-portals.user.js) |

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
