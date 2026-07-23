# Aperture v4.0.1

Patch release for issues reported against the AMO 4.0.0 build.

## Fixes

- **Open full workbench** — popup opens the dashboard via `tabs.create` so the tab is not lost when the popup closes
- **Settings services empty** — messaging no longer double-resolves; dashboard data always returns the service list, with a `getServices` fallback
- Hardened `getDashboardData` when feature-flag helpers are unavailable

## Improvements

- Pivot card **Open link** when the highlight is inside a page `<a href>` or the IoC is a URL
- Scheme-less host/path strings (e.g. `evil.test/phish/login`) highlight as a full **url**, not domain-only
