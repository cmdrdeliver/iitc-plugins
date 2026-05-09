# Nearest Portals

Find the closest portals matching a status and plan a route between them.

## Install

[**Install nearest-portals**](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/nearest-portals/nearest-portals.user.js)

Requires IITC-CE and a userscript manager (Tampermonkey or Violentmonkey).

## Features

- Filter portals by status: all / not visited / not captured / not scouted / either / neither
- Origin from map center or browser geolocation
- Sortable distance list with V/C/S badges
- Click a portal title to pan the map and open its details
- Per-row selection plus master toggle
- Export selected portals as **CSV** (with intel URLs) or **GPX** waypoints
- Multi-stop walking, cycling, or driving route via the free [OSRM](https://project-osrm.org/) public demo (TSP-optimised), drawn as a polyline with numbered stops
- "Dim others on map" highlighter — visually hide non-matched portals
- Auto-refresh on map data load with adjustable debounce
- "Show all matched" toggle to override the default top-N cap

## Notes

Only portals currently loaded by IITC are searched. Pan and zoom over the area at intel zoom 17 to populate the cache before opening the dialog.

## Routing

Routes are computed by the [OSRM public demo server](https://router.project-osrm.org/). For heavy use, [host your own OSRM instance](https://github.com/Project-OSRM/osrm-backend#quick-start) and change `OSRM_BASE` near the top of the script.

## License

[MIT](../LICENSE).
