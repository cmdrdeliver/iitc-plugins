# Discord Portal Link

Copy a Discord-flavoured paste for the currently selected portal — either a quick markdown link or a full readout with computed mod effects.

## Install

[**Install discord-portal-link**](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js)

Requires IITC-CE and a userscript manager (Tampermonkey or Violentmonkey).

## Usage

1. Click any portal on the intel map to open its details panel.
2. Click the small Discord logo that appears next to the portal name (just under the search box).
3. A popup menu offers two options:
   - **Copy link** — short markdown link, e.g. `[Raintree Club Pool](https://intel.ingress.com/intel?pll=35.415014,-77.869791)`
   - **Copy detailed paste** — multi-line block with owner, team, level, health, computed link range, in/out link counts, all 8 resonators (octant, level, agent, energy %), all 4 mods, and the *computed effects* of the mods.
4. Paste into Discord.

`]` and `\` characters in portal names are escaped so the link label can't be broken by unusual portal titles.

### Detailed paste format

```
**[Portal Name](<https://intel.ingress.com/intel?pll=lat,lng>)**
` ` `ansi
Owner: AgentX (L8, RES)  ·  Health: 96%
Range: 4.21 km  ·  Links: 7 out / 3 in
Resonators:
  E : L8 AgentX 100%
  NE: L8 AgentY  95%
  ...
Mods: SBUL-VR (AgentX) · MH-R (AgentY) · HS-VR (AgentX) · —
Effects: 16 max outbound · 12 hacks · 0:54 cooldown (friendly)
` ` `
```

The body sits in a Discord `ansi`-tagged code block so agent names and team tags render in faction colour:

| Team | Colour |
|---|---|
| RES | blue |
| ENL | green |
| NEU | yellow (closest 8-colour proxy for orange) |
| MAC (Machina) | red |

The `(friendly)` / `(enemy)` / `(neutral)` / `(machina)` tag on the **Effects** line is coloured to match its relation. Discord on older mobile clients may render the raw ANSI escape codes instead of suppressing them — a cosmetic-only regression on those builds.

The header link wraps the URL in `<…>` so Discord won't generate a preview embed for the detailed paste.

The **Effects** line reflects the actual values implied by installed mods:

- **Max outbound links** — default 8; each SBUL adds +8.
- **Hacks before burnout** — default 4; Multi-hack adds +4 (Common), +8 (Rare), or +12 (Very Rare).
- **Hack cooldown** — base depends on your faction vs the portal's team: **3:00** for a friendly portal, **5:00** for an enemy, neutral, or Machina portal. Heat Sink then multiplies the base by 0.8 (C), 0.5 (R), or 0.3 (VR), stacking multiplicatively. The label in parentheses on the **Effects** line shows which base was used; it reads `(faction unknown)` if IITC hasn't populated `window.PLAYER` yet.

## Notes

- Uses the modern `navigator.clipboard` API where available, and falls back to a hidden `<textarea>` + `execCommand('copy')` for non-secure contexts.
- The button briefly turns green ("Copied") on success or red ("Failed") if the clipboard write is blocked.

## License

[MIT](../LICENSE).
