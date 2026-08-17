# Aperture v4.2.1

A light theme, and a playbook editor you can actually edit playbooks in.

## Features

- **Light theme** — `Settings → Appearance` offers System, Dark and Light. It applies to the workbench, the popup, and the pivot and palette drawn on pages. Both token sets are checked against WCAG AA: every text-on-surface pair in the theme is at least 4.5:1.
- **Page highlights follow the page, not the theme** — a highlight sits in the site's own content, so it now picks its colour from the page's background rather than from your Aperture theme. On a white page the indicator colours were 2.2–3:1 before; they are 5.3–7.7:1 now.
- **The workbench keeps up with your pivots** — an indicator you run from the on-page pivot, the context menu or the palette in another window now appears in the inbox on its own, no reload. The refresh holds off while you are typing or have a dialog open, and waits until you come back to the tab, so the list never moves under you. Scroll position and an open pivot card survive it.
- **Ordered service editor for playbooks** — the multi-select is replaced by a numbered list with move and remove controls, plus an add menu grouped into the usual pivots for the trigger type and all other services. The list is the run order, so reordering is now possible at all.

## Fixes

- **Playbook services could not be edited.** The tool picker was a native multi-select forced to 34px by a modal rule, so it showed roughly one row of a twenty-item list, and any plain click cleared the whole selection.
- **Form controls were browser-default light** inside the dark UI. Checkboxes rendered as white 34px squares because the same height rule applied to them. Aperture surfaces now declare `color-scheme`, style their own inputs, and render checkboxes inline with a sentence-case label.
- **Low-contrast small text.** `--text-dim` and `--text-faint` were 3.06:1 and 2.44:1 against the surfaces they were used on — below AA for the 9.5–11px text that used them. Both were raised, and modal field labels moved up to `--text-muted` at 11px.
- **Honest tab counts.** "Run · opens N tabs" counted every entry in a playbook, including service names from an import or an older build that resolve to no URL and open nothing. Counts now come from `IOCUtils.runnableTools`, and the editor flags an unresolvable entry as *unknown — skipped*.
- **The side panel is gone.** It had no way in: the manifest declares no `side_panel` key or `sidePanel` permission, and nothing has sent the `openSidePanel` message since the popup became a launcher in v4.2. Opening `sidepanel.html` by URL gave you an ordinary tab, not a panel. The two files, the dead background handler and the README entry advertising it are removed.
- **Injected variables no longer land on the host page's root.** `aperture.css` is injected everywhere and defined `--bg`, `--text`, `--accent` and friends on `:root`, which on a visited site is that site's `html` element. Tokens are now defined only on Aperture's own surfaces.

## Notes

No change to fonts, permissions or the local-only model. The theme preference is stored in `storage.sync` alongside your other settings, and mirrored into `localStorage` so a themed surface paints correctly on first frame.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.2.1.zip
```
