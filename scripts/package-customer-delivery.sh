#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUTPUT_DIR=${1:-"$ROOT_DIR/dist/customer-delivery"}
DOCS_DIR="$OUTPUT_DIR/docs"
EXAMPLE_DIR="$OUTPUT_DIR/example-basic-call"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$DOCS_DIR"

"$ROOT_DIR/scripts/package-sdk.sh" "$ROOT_DIR/dist" >/dev/null

cp "$ROOT_DIR/dist/agora-rtc-cocos-plugin.zip" "$OUTPUT_DIR/agora-rtc-cocos-plugin.zip"

rm -rf "$EXAMPLE_DIR"
mkdir -p "$EXAMPLE_DIR"

cp -R "$ROOT_DIR/example/basic-call/assets" "$EXAMPLE_DIR/"
cp -R "$ROOT_DIR/example/basic-call/build-configs" "$EXAMPLE_DIR/"
cp "$ROOT_DIR/example/basic-call/README.md" "$EXAMPLE_DIR/README.md"
cp "$ROOT_DIR/example/basic-call/AGORA_RTC_SPM_SETUP.md" "$EXAMPLE_DIR/AGORA_RTC_SPM_SETUP.md" 2>/dev/null || true

cp "$ROOT_DIR/docs/customer-integration.md" "$DOCS_DIR/customer-integration.md"
cp "$ROOT_DIR/docs/api-verification-matrix.md" "$DOCS_DIR/api-verification-matrix.md"
cp "$ROOT_DIR/docs/android-debug.md" "$DOCS_DIR/android-debug.md"

find "$OUTPUT_DIR" -name ".DS_Store" -delete

echo "Created customer delivery bundle at $OUTPUT_DIR"
