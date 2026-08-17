# Preview fixtures

Demo-only assets for README / GitHub social preview screenshots.

| File | Purpose |
|---|---|
| [`dashboard-preview.html`](dashboard-preview.html) | Dashboard shell with stubbed extension APIs |
| [`preview-demo.js`](preview-demo.js) | Seeds sample cases, inbox, playbooks |

**Not shipped** in the store package. Does not change production defaults.

The preview shell matches the current workbench chrome (`dashboard.html` body) and carries a copy of its `<style>` block. Re-copy that block whenever the dashboard's styles change, and keep the header/sidebar markup in lockstep — otherwise the screenshots will not look like the shipped UI.

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# http://127.0.0.1:8765/preview/dashboard-preview.html
```

See [`.github/SOCIAL_PREVIEW.md`](../.github/SOCIAL_PREVIEW.md).
