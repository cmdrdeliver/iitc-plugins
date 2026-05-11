# Live Inventory (cached)

Show your current in-game inventory inside IITC. This is a fork that keeps the previously cached inventory whenever the Intel API returns an empty `result` (`[]`), instead of letting the empty response wipe the cache.

Requires an active **Ingress CORE** subscription — the Intel API only returns inventory data for CORE subscribers.

## Install

[**Install live-inventory**](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/live-inventory/live-inventory.user.js)

Requires IITC-CE and a userscript manager (Tampermonkey or Violentmonkey).

If you already have the original `liveInventory@DanielOnDiordna` script installed, disable or uninstall it first — both plugins share the same `localStorage` key (`plugin-live-inventory`), so the cached inventory carries over.

## What this fork changes

- **Empty-result fallback.** When `getInventory` returns `result: []`, the previous inventory in `localStorage` is kept and the in-memory state is left untouched. The 10-minute rate-limit window is still honoured.
- **"⚠ CACHED" marker in the dialog title bar.** While the in-memory inventory is the previously cached copy (because the last refresh returned empty), every Live Inventory dialog shows `Live Inventory ⚠ CACHED` in its title bar. The marker clears on the next successful (non-empty) refresh and persists across page reloads.
- **Counts moved out of the title bar.** The `N keys / N portals` count that used to be appended to the dialog title now appears as a bold line at the top of the dialog body.
- **About dialog.** A new **About** button in the Settings panel credits all upstream authors with links to their repositories.

Everything else (item / key / capsule views, copy-to-clipboard, draw bookmarks, portal-key icons on the map, etc.) is unchanged from the DanielOnDiordna fork.

## Credits

| Author | Contribution |
|---|---|
| **EisFrei** | Original plugin — <https://github.com/EisFrei/IngressLiveInventory> |
| **DanielOnDiordna** | Fork with menu buttons, capsule view, key counts on portals list, draw bookmarks, etc. — <https://github.com/DanielOndiordna/IngressLiveInventory> |
| **CmdrDeLiver** | This fork: empty-result cache fallback, CACHED title marker, body-mounted counts, About dialog — <https://github.com/cmdrdeliver/iitc-plugins> |

Open the **About** button inside the plugin's Settings panel to see the same credits in-app.

## License

Distributed under the original terms; see linked repositories above.
