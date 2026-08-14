# Aperture v4.2.0

One indicator card, rendered in two hosts. The pivot, the popup detect block and the inbox row all answered the same question — *what is this indicator and what do I do with it* — from their own markup, section order and control sizes. They are now one definition in `extension/indicator-card.js`.

## Features

- **Anchored pivot popovers** — on-page and workbench pivots are 320px popovers anchored to the token, with a caret, focus trap, and dismissal on Escape, outside click or the anchor scrolling away. The full-height drawer and both scrims are gone.
- **Navigation band for links** — a highlighted token inside an `<a>` captures its real `href`, so the card can open the destination in a background tab (http(s) only) and flags where the link text and the href disagree.
- **Popup is a launcher** — open the workbench, plus the two settings only the current tab can answer for: on-page detect on/off and disable this site. Detect field, quick tools, playbook list, recent and the services/domain lists move out.
- **Workbench Settings screen** — enabled services, the global on-page detect default and disabled-domain rules now live in one place instead of the popup. Labs stays experimental-only.
- **Playbook defaults per IoC type** — assign the playbook each type should run by default, from the Playbooks screen or the edit modal. Consumed by the pivot's primary action, the context menu's **Run default playbook**, and ⌘K.
- **⌘K is indicator-first** — paste an indicator and the default playbook for its type is the first, pinned result; Enter runs it. No follow-up `prompt()`.
- **Workbench overview** — a single metrics rail replaces the metric blocks, one filter bar with a Tags menu replaces the scattered filters, and the reworked row anatomy anchors the pivot to the row you clicked.

## Fixes

- **Global CSS resets no longer leak onto visited pages.** `aperture.css` is injected into every page and its bare `*`, `html, body`, `a`, `button` and scrollbar rules were rewriting host sites: links took Aperture's blue and lost their underlines, and every element became `border-box`. The resets are now scoped to extension pages and Aperture's own on-page roots, using `:where()` so component specificity is unchanged.
- **Popover geometry in short viewports.** A card that fitted neither above nor below the anchor was clamped into the viewport while its caret still pointed the other way. The card is now capped to the room on its chosen side and its body scrolls, so it stays flush against the token; the caret hides if the clamp ever moves it.
- **⌘K "Open pivot" with no visible row** rendered the card in the viewport corner with a caret pointing at nothing. It now centres with the caret suppressed.
- **Copy actions on `http://` pages.** `navigator.clipboard` only exists in secure contexts, so Copy, Defang, STIX and Base64 in the on-page pivot failed on plain-http sites. The shared card falls back to a `document.execCommand('copy')` path and restores focus.
- **Hidden card rows** — `[hidden]` fact rows and the related-IoC list were still displayed because component `display: flex` rules overrode the attribute.
- **Side panel** styling is corrected (`body.aperture`); the surface itself is otherwise unchanged this release.

## Notes

No change to tokens, fonts, permissions or the local-only model. `tabs.create` remains the only network-adjacent call, and it still requires an explicit user action.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.2.0.zip
```
