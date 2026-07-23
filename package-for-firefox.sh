#!/bin/bash
# Package script for Aperture v3.1.1 (Firefox AMO / Chrome Web Store)

set -euo pipefail

VERSION="4.0.0"
OUTPUT_FILE="aperture-osint-v${VERSION}.zip"

echo "Aperture — OSINT Workbench packaging"
echo "===================================="
echo ""

if ! command -v zip >/dev/null 2>&1; then
  echo "Error: zip command not found"
  exit 1
fi

if [ -f "$OUTPUT_FILE" ]; then
  rm "$OUTPUT_FILE"
fi

echo "Creating $OUTPUT_FILE"

zip -r "$OUTPUT_FILE" \
  manifest.json \
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
  README.md \
  LICENSE \
  test-history.html \
  test-ioc-utils.html \
  test-ioc-utils.js \
  -x "*.git*" \
  -x "*.sh" \
  -x "*SUBMISSION*" \
  -x "*CHROME_WEB*" \
  -x "*STORAGE_*" \
  -x "*TESTING*" \
  -x "design/*" \
  -x "node_modules/*" \
  -x ".DS_Store" \
  -x "osint-search-*.zip" \
  -x "aperture-osint-*.zip" \
  -x "archive.js" \
  -x "check-storage.html" \
  -x "debug-storage.html" \
  -x "test-storage.html" \
  -x "test-unified.html"

echo ""
echo "Package created:"
ls -lh "$OUTPUT_FILE"
echo ""
echo "Next: upload with RELEASE_NOTES_v4.0.0.md"
