# Discord Portal Link

Copy a Discord-flavoured markdown link for the currently selected portal to the clipboard with one click.

## Install

[**Install discord-portal-link**](https://raw.githubusercontent.com/cmdrdeliver/iitc-plugins/main/discord-portal-link/discord-portal-link.user.js)

Requires IITC-CE and a userscript manager (Tampermonkey or Violentmonkey).

## Usage

1. Click any portal on the intel map to open its details panel.
2. Click the small Discord logo that appears next to the portal name (just under the search box).
3. Paste into Discord. The link expands to the portal name and resolves to the intel URL.

Format produced:

```
[Raintree Club Pool](https://intel.ingress.com/intel?pll=35.415014,-77.869791)
```

`]` and `\` characters in portal names are escaped so the link label can't be broken by unusual portal titles.

## Notes

- Uses the modern `navigator.clipboard` API where available, and falls back to a hidden `<textarea>` + `execCommand('copy')` for non-secure contexts.
- The button briefly turns green ("Copied") on success or red ("Failed") if the clipboard write is blocked.

## License

[MIT](../LICENSE).
