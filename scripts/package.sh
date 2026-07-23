#!/bin/bash
# Package Aperture for Firefox AMO / Chrome Web Store (run from repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")"
OUTPUT_FILE="aperture-osint-v${VERSION}.zip"

echo "Aperture — OSINT Workbench packaging"
echo "===================================="
echo "Version: $VERSION"
echo ""

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip command not found"
  exit 1
fi

if [ -f "$OUTPUT_FILE" ]; then
  rm "$OUTPUT_FILE"
fi

echo "Creating $OUTPUT_FILE"

# Extension runtime only — no docs/, test/, preview/, design/, or release zips
zip -r "$OUTPUT_FILE" \
  manifest.json \
  LICENSE \
  README.md \
  ioc-utils.js \
  background.js \
  content.js \
  content.css \
  aperture.css \
  aperture-features.js \
  aperture-packs.js \
  aperture-store.js \
  ioc-scan-worker.js \
  palette.js \
  popup.html \
  popup.js \
  dashboard.html \
  dashboard.js \
  sidepanel.html \
  sidepanel.js \
  archive.html \
  archive-redirect.js \
  devtools.html \
  devtools.js \
  devtools-panel.html \
  devtools-panel.js \
  fonts \
  icon16.png \
  icon32.png \
  icon48.png \
  icon128.png \
  icon512.png \
  -x "*.git*" \
  -x "*~" \
  -x ".DS_Store"

echo ""
echo "Package created:"
ls -lh "$OUTPUT_FILE"
echo ""
echo "Release notes: docs/releases/RELEASE_NOTES_v${VERSION}.md"
