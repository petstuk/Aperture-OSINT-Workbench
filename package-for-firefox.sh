#!/bin/bash

# Package script for Firefox Add-ons submission
# Version 2.3.0

echo "🔧 SOC OSINT Search - Firefox Add-ons Packaging Script"
echo "======================================================="
echo ""

# Set version
VERSION="2.3.0"
OUTPUT_FILE="osint-search-v${VERSION}.zip"

# Check if zip command exists
if ! command -v zip &> /dev/null; then
    echo "❌ Error: 'zip' command not found. Please install zip utility."
    exit 1
fi

# Remove old package if it exists
if [ -f "$OUTPUT_FILE" ]; then
    echo "🗑️  Removing old package: $OUTPUT_FILE"
    rm "$OUTPUT_FILE"
fi

echo "📦 Creating package: $OUTPUT_FILE"
echo ""

# Create the zip file with all necessary files
zip -r "$OUTPUT_FILE" \
  manifest.json \
  ioc-utils.js \
  background.js \
  content.js \
  content.css \
  popup.html \
  popup.js \
  archive.html \
  archive.js \
  check-storage.html \
  debug-storage.html \
  icon512.png \
  README.md \
  test-history.html \
  test-storage.html \
  test-unified.html \
  -x "*.git*" \
  -x "*.sh" \
  -x "*RELEASE_NOTES*" \
  -x "*SUBMISSION_CHECKLIST*" \
  -x "node_modules/*" \
  -x ".DS_Store" \
  -x "*.swp" \
  -x "*.bak"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Package created successfully!"
    echo ""
    echo "📊 Package details:"
    ls -lh "$OUTPUT_FILE"
    echo ""
    echo "📋 Contents:"
    unzip -l "$OUTPUT_FILE"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Go to: https://addons.mozilla.org/developers/addon/soc-osint-extension/versions/submit/"
    echo "   2. Upload: $OUTPUT_FILE"
    echo "   3. Fill in release notes from: RELEASE_NOTES_v2.3.0.md"
    echo "   4. Submit for review"
    echo ""
    echo "📝 Don't forget to check: SUBMISSION_CHECKLIST.md"
else
    echo ""
    echo "❌ Error creating package"
    exit 1
fi



