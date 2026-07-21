#!/bin/bash
# Package script for Aperture v3.1.0 (Firefox AMO / Chrome Web Store)

set -euo pipefail

VERSION="3.1.0"
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
  palette.js \
  popup.html \
  popup.js \
  dashboard.html \
  dashboard.js \
  archive.html \
  archive-redirect.js \
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
  -x "*RELEASE_NOTES*" \
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
echo "Next: upload to AMO / Chrome Web Store with RELEASE_NOTES_v3.1.0.md"
