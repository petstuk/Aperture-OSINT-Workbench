# GitHub social preview

## Asset

- [social-preview.png](social-preview.png) — **1280×640** Open Graph image for the repository
- Source: dashboard triage overview with **preview-only** demo data
- Fixture: [`../preview/dashboard-preview.html`](../preview/dashboard-preview.html) + [`../preview/preview-demo.js`](../preview/preview-demo.js)

## Regenerate locally

```bash
# from repo root
python3 -m http.server 8765 --bind 127.0.0.1
google-chrome --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=5000 \
  --screenshot=.github/dashboard-shot.png \
  "http://127.0.0.1:8765/preview/dashboard-preview.html"

magick .github/dashboard-shot.png -crop 1440x720+0+0 +repage -resize 1280x640 \
  -depth 8 .github/social-preview.png
```

Do **not** composite `icon512.png` onto the shot — the dashboard header already has the brand mark.

`preview/dashboard-preview.html` stubs `chrome.runtime` / storage and injects sample SOC cases, inbox, and playbooks. It is **not** included in the store zip and does not affect production defaults.

## Upload to GitHub

1. Open the repo on GitHub: **Settings**
2. Scroll to **Social preview**
3. Click **Edit** → **Upload an image…**
4. Select `.github/social-preview.png` (PNG, under 1 MB, 1280×640)
5. Save

Docs: [Customizing your repository's social media preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)
