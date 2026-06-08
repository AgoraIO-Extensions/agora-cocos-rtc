#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="${COCOS_CLI:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/android-debug.json"
ANDROID_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-android/android/proj"
APK_PATH="$ANDROID_PROJECT_DIR/build/agora-cocos-basic-call/outputs/apk/debug/agora-cocos-basic-call-debug.apk"
PACKAGE_NAME="io.agora.cocos.example"
ACTIVITY_NAME="com.cocos.game.AppActivity"
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ADB_BIN="${ADB_BIN:-$ANDROID_SDK_ROOT/platform-tools/adb}"
DEFAULT_AGORA_COCOS_TEST_MODE=api
AGORA_COCOS_TEST_MODE="${AGORA_COCOS_TEST_MODE:-$DEFAULT_AGORA_COCOS_TEST_MODE}"
LOG_PATH="$ROOT_DIR/test_shard/integration_test_app/reports/android-runtime.log"
TEST_TIMEOUT_SECONDS="${TEST_TIMEOUT_SECONDS:-180}"
REPORT_REMOTE_PATH=""

cd "$ROOT_DIR"

if [[ -z "${TEST_APP_ID:-${APP_ID:-}}" ]]; then
  echo "TEST_APP_ID or APP_ID is required." >&2
  exit 1
fi

APP_ID="${APP_ID:-${TEST_APP_ID:-}}" \
TEST_APP_ID="${TEST_APP_ID:-${APP_ID:-}}" \
CHANNEL_ID="${CHANNEL_ID:-${TEST_CHANNEL_ID:-testapi}}" \
TOKEN="${TOKEN:-${TEST_TOKEN:-}}" \
node ./scripts/write-example-build-config.mjs

./scripts/prepare-example.sh >/dev/null
AGORA_COCOS_TEST_MODE="$AGORA_COCOS_TEST_MODE" \
TEST_APP_ID="${TEST_APP_ID:-${APP_ID:-}}" \
TEST_TOKEN="${TEST_TOKEN:-${TOKEN:-}}" \
TEST_CHANNEL_ID="${TEST_CHANNEL_ID:-${CHANNEL_ID:-testapi}}" \
TEST_UID="${TEST_UID:-1001}" \
node ./scripts/inject-cocos-test-runner.mjs

"$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$COCOS_BUILD_CONFIG"
node ./scripts/sync-android-app-bridge.mjs >/dev/null

cd "$ANDROID_PROJECT_DIR"
./gradlew --offline :agora-cocos-basic-call:assembleDebug

"$ADB_BIN" install -g -r --no-streaming "$APK_PATH"
"$ADB_BIN" logcat -c
"$ADB_BIN" shell am start -n "$PACKAGE_NAME/$ACTIVITY_NAME" \
  --es AGORA_COCOS_TEST_MODE "$AGORA_COCOS_TEST_MODE" \
  --es TEST_APP_ID "${TEST_APP_ID:-${APP_ID:-}}" \
  --es TEST_TOKEN "${TEST_TOKEN:-${TOKEN:-}}" \
  --es TEST_CHANNEL_ID "${TEST_CHANNEL_ID:-${CHANNEL_ID:-testapi}}" \
  --es TEST_UID "${TEST_UID:-1001}"

mkdir -p "$(dirname "$LOG_PATH")"
: > "$LOG_PATH"
while [[ $SECONDS -lt $TEST_TIMEOUT_SECONDS ]]; do
  "$ADB_BIN" logcat -d > "$LOG_PATH"
  if grep -q "TEST_DONE status=" "$LOG_PATH"; then
    cat "$LOG_PATH"
    if grep -q "TEST_DONE status=fail" "$LOG_PATH"; then
      exit 1
    fi
    REPORT_REMOTE_PATH="$(sed -n 's/.*TEST_DONE status=pass.* report=\([^ ]*\).*/\1/p' "$LOG_PATH" | tail -n 1)"
    if [[ -n "$REPORT_REMOTE_PATH" ]]; then
      "$ADB_BIN" shell cat "$REPORT_REMOTE_PATH" > "$ROOT_DIR/test_shard/integration_test_app/reports/android-api-report.raw.json" || true
      if [[ -s "$ROOT_DIR/test_shard/integration_test_app/reports/android-api-report.raw.json" ]]; then
        node "$ROOT_DIR/scripts/collect-cocos-test-report.mjs" android "$ROOT_DIR/test_shard/integration_test_app/reports/android-api-report.raw.json"
      fi
    fi
    exit 0
  fi
  sleep 2
done

cat "$LOG_PATH"
echo "Timed out waiting for TEST_DONE status= after ${TEST_TIMEOUT_SECONDS}s." >&2
exit 1
