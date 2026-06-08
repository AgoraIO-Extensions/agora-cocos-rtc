#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="${COCOS_CLI:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/android-debug.json"
ANDROID_COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/local/android-debug.ci.json"
ANDROID_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-android/android/proj"
ANDROID_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/app/src/main/java/io/agora/cocos/rtc"
ANDROID_EXPORTED_PLUGIN_DIR="$ANDROID_PROJECT_DIR/app/src/main/java/io/agora/cocos/rtc"
APK_PATH="$ANDROID_PROJECT_DIR/build/agora-cocos-basic-call/outputs/apk/debug/agora-cocos-basic-call-debug.apk"
PACKAGE_NAME="io.agora.cocos.example"
ACTIVITY_NAME="com.cocos.game.AppActivity"
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
ADB_BIN="${ADB_BIN:-$ANDROID_SDK_ROOT/platform-tools/adb}"
DEFAULT_AGORA_COCOS_TEST_MODE=api
AGORA_COCOS_TEST_MODE="${AGORA_COCOS_TEST_MODE:-$DEFAULT_AGORA_COCOS_TEST_MODE}"
LOG_PATH="$ROOT_DIR/test_shard/integration_test_app/reports/android-runtime.log"
TEST_TIMEOUT_SECONDS="${TEST_TIMEOUT_SECONDS:-180}"
REPORT_REMOTE_PATH=""
LOCAL_AGORA_MAVEN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/local-maven"
ANDROID_GRADLE_OFFLINE="${ANDROID_GRADLE_OFFLINE:-false}"

log_step() {
  echo
  echo "==> $1"
}

resolve_android_ndk_path() {
  local candidate

  for candidate in "$ANDROID_NDK_HOME" "$ANDROID_SDK_ROOT/ndk/23.1.7779620"; do
    if [[ -n "$candidate" && -f "$candidate/source.properties" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  while IFS= read -r candidate; do
    if [[ -f "$candidate/source.properties" ]]; then
      echo "$candidate"
      return 0
    fi
  done < <(find "$ANDROID_SDK_ROOT/ndk" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -r)

  return 1
}

write_android_cocos_build_config() {
  if [[ ! -d "$ANDROID_SDK_ROOT/platform-tools" ]]; then
    echo "Android SDK is missing platform-tools under $ANDROID_SDK_ROOT." >&2
    exit 1
  fi

  ANDROID_NDK_HOME="$(resolve_android_ndk_path || true)"
  if [[ -z "$ANDROID_NDK_HOME" ]]; then
    echo "Android NDK was not found under $ANDROID_SDK_ROOT/ndk." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$ANDROID_COCOS_BUILD_CONFIG")"
  ANDROID_BUILD_CONFIG="$COCOS_BUILD_CONFIG" \
  ANDROID_COCOS_BUILD_CONFIG="$ANDROID_COCOS_BUILD_CONFIG" \
  ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
  ANDROID_NDK_HOME="$ANDROID_NDK_HOME" \
  node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.env.ANDROID_BUILD_CONFIG;
const outputPath = process.env.ANDROID_COCOS_BUILD_CONFIG;
const config = JSON.parse(await readFile(sourcePath, 'utf8'));

config.packages ??= {};
config.packages.android ??= {};
config.packages.android.sdkPath = process.env.ANDROID_SDK_ROOT;
config.packages.android.ndkPath = process.env.ANDROID_NDK_HOME;

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
NODE
}

run_cocos_build() {
  local config_path="$1"
  local label="$2"

  set +e
  "$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$config_path"
  local exit_code=$?
  set -e

  if [[ $exit_code -ne 0 && $exit_code -ne 36 ]]; then
    echo "$label Cocos build failed with exit code $exit_code" >&2
    exit $exit_code
  fi

  echo "$label Cocos build completed with exit code $exit_code."
}

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

log_step "Prepare Cocos example"
./scripts/prepare-example.sh >/dev/null
if [[ ! -d "$LOCAL_AGORA_MAVEN_DIR" ]]; then
  node ./scripts/fetch-agora-maven.mjs >/dev/null
fi

log_step "Inject Cocos API test runner"
AGORA_COCOS_TEST_MODE="$AGORA_COCOS_TEST_MODE" \
TEST_APP_ID="${TEST_APP_ID:-${APP_ID:-}}" \
TEST_TOKEN="${TEST_TOKEN:-${TOKEN:-}}" \
TEST_CHANNEL_ID="${TEST_CHANNEL_ID:-${CHANNEL_ID:-testapi}}" \
TEST_UID="${TEST_UID:-1001}" \
node ./scripts/inject-cocos-test-runner.mjs

log_step "Export Android project with Cocos"
write_android_cocos_build_config
run_cocos_build "$ANDROID_COCOS_BUILD_CONFIG" "Android"
node ./scripts/sync-native-engine-texture-bridge.mjs >/dev/null
node ./scripts/sync-android-app-bridge.mjs >/dev/null
if [[ -d "$ANDROID_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$ANDROID_EXPORTED_PLUGIN_DIR"
  cp -R "$ANDROID_RUNTIME_PLUGIN_DIR/." "$ANDROID_EXPORTED_PLUGIN_DIR/"
fi

log_step "Build Android debug APK"
cd "$ANDROID_PROJECT_DIR"
if [[ "$ANDROID_GRADLE_OFFLINE" == "true" ]]; then
  ./gradlew --offline :agora-cocos-basic-call:assembleDebug
else
  ./gradlew :agora-cocos-basic-call:assembleDebug
fi

log_step "Install and launch Android test app"
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
log_step "Wait for Android API test report"
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
