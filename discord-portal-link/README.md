# Discord Portal Link

Copy a Discord-flavoured paste for the currently selected portal — either a quick markdown link or a full readout with computed mod effects.

## Install

[**Install discord-portal-link**](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js)

Requires IITC-CE and a userscript manager (Tampermonkey or Violentmonkey).

## Usage

1. Click any portal on the intel map to open its details panel.
2. Click the small Discord logo that appears next to the portal name (just under the search box).
3. A popup menu offers two options:
   - **Copy link** — short bold markdown link, e.g. `**[Raintree Club Pool](<https://intel.ingress.com/intel?pll=35.415014,-77.869791>)**`
   - **Copy detailed paste** — multi-line block with owner, team, level, health, computed link range, in/out link counts, all 8 resonators (octant, level, agent, energy %), all 4 mods, and the *computed effects* of the mods.
4. Paste into Discord.

`]` and `\` characters in portal names are escaped so the link label can't be broken by unusual portal titles.

### Detailed paste format

```
**[Portal Name](<https://intel.ingress.com/intel?pll=lat,lng>)**
` ` `ansi
Owner: AgentX (L8, RES)  ·  Health: 96%
Range: 8.42 km (×2)  ·  Links: 7 out / 3 in
Resonators:
  N : L8 AgentX 100%   NE: L8 AgentY  95%
  NW: L7 AgentZ  88%   E : L8 AgentA  91%
  W : L8 AgentB 100%   SE: L6 AgentC  70%
  SW: L8 AgentD  99%   S : L7 AgentE  82%
Mods: SBUL-VR · MH-R · HS-VR · LA-R
Effects:
  Outbound: 16  ·  Hacks: 12 @ 0:54 (burnout 9:54)
  Defense: shield 70% · links ×3.5
  Attack: force ×2.5 · freq ×2 · hit +5%
` ` `
```

The body sits in a Discord `ansi`-tagged code block so agent names and the team tag render in bold faction colour:

| Team | Colour |
|---|---|
| RES | blue |
| ENL | green |
| NEU | yellow (closest 8-colour proxy for orange) |
| MAC (Machina) | red |

Discord on older mobile clients may render the raw ANSI escape codes instead of applying them — a cosmetic-only regression on those builds.

Both the quick link and the detailed-paste header wrap the URL in `<…>` so Discord won't generate a preview embed.

Resonators are listed in a two-column compass layout (N/NE, NW/E, W/SE, SW/S), top to bottom.

Mod-effect values (outbound cap, hack count, hack cooldown, burnout duration, range boost, shield mitigation, link defense, attack force/frequency/hit bonus) are pulled from IITC's own `window.getMaxOutgoingLinks` / `getPortalHackDetails` / `getLinkAmpRangeBoost` / `getPortalShieldMitigation` / `getPortalLinkDefenseBoost` / `getPortalAttackValues` so they match what IITC's portal panel computes. The hack cooldown reflects IITC's friendly-portal logic automatically (180 s for own faction vs 300 s for enemy/neutral/Machina). The **Defense** and **Attack** lines only appear when at least one corresponding mod is installed.

## Notes

- Uses the modern `navigator.clipboard` API where available, and falls back to a hidden `<textarea>` + `execCommand('copy')` for non-secure contexts.
- The button briefly turns green ("Copied") on success or red ("Failed") if the clipboard write is blocked.

## License

[MIT](../LICENSE).
