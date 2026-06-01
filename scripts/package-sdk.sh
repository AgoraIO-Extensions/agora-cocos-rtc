#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUTPUT_DIR=${1:-"$ROOT_DIR/dist"}
STAGING_DIR="$OUTPUT_DIR/agora-rtc"
ARCHIVE_PATH="$OUTPUT_DIR/agora-rtc-cocos-plugin.zip"

node "$ROOT_DIR/scripts/sync-sdk-version.mjs" >/dev/null

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
mkdir -p "$OUTPUT_DIR"

cp -R "$ROOT_DIR/sdk/agora-rtc/"* "$STAGING_DIR/"

find "$STAGING_DIR" -name ".DS_Store" -delete
rm -rf "$STAGING_DIR/dist-cache"

rm -f "$ARCHIVE_PATH"
(
  cd "$OUTPUT_DIR"
  /usr/bin/zip -rq "$(basename "$ARCHIVE_PATH")" "agora-rtc"
)

echo "Created $ARCHIVE_PATH"
