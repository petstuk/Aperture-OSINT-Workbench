# Aperture v4.2.2

Light mode uses the same typeface as dark, and small text is easier to read in both.

## Fixes

- **Light theme fell back to the browser font.** `--font-ui`, `--font-mono` and the corner radii were defined only on the dark token block. With `html.ap-theme-light` set, `font-family: var(--font-ui)` was invalid, so the workbench, popup, pivot and palette rendered in the system sans instead of IBM Plex. Those tokens now live on a shared block both themes use.
- **Antialiased glyphs on white.** Light inherited `-webkit-font-smoothing: antialiased` from the dark surface, which thins strokes on a light background. Light now uses the browser default; dark keeps antialiased.
- **Secondary text and type colours.** Muted, dim and faint labels were only just over AA at 9–12px (about 5:1). Both palettes step those tokens up to roughly 6–9:1. Light accent, verdict and IoC type colours are a shade darker so pills and links hold up on white.

## Notes

No change to permissions or the local-only model.

## Package

```bash
./scripts/package.sh
# → aperture-osint-v4.2.2.zip
```
