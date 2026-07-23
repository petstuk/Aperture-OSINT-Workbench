#!/bin/bash
# Package Aperture for Firefox AMO / Chrome Web Store (run from repo root)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$ROOT/extension"
cd "$ROOT"

VERSION="$(python3 -c "import json; print(json.load(open('$EXT/manifest.json'))['version'])")"
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

echo "Creating $OUTPUT_FILE from extension/"

# Store zip must have manifest.json at the archive root (not under extension/)
(
  cd "$EXT"
  zip -r "$ROOT/$OUTPUT_FILE" . \
    -x "*.git*" \
    -x "*~" \
    -x ".DS_Store"
)
# License + README at zip root for reviewers
zip -u "$OUTPUT_FILE" LICENSE README.md

echo ""
echo "Package created:"
ls -lh "$OUTPUT_FILE"
echo ""
echo "Release notes: docs/releases/RELEASE_NOTES_v${VERSION}.md"
