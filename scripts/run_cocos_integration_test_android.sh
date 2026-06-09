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
DEFAULT_TEST_CHANNEL_ID="${DEFAULT_TEST_CHANNEL_ID:-cocos-android-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}}"
TEST_CHANNEL_ID="${TEST_CHANNEL_ID:-${CHANNEL_ID:-$DEFAULT_TEST_CHANNEL_ID}}"
CHANNEL_ID="${CHANNEL_ID:-$TEST_CHANNEL_ID}"
TEST_UID="${TEST_UID:-1001}"
REPORT_DIR="$ROOT_DIR/test_shard/integration_test_app/reports"
LOG_PATH="$REPORT_DIR/android-runtime.log"
ANDROID_DIAGNOSTIC_LOG_PATH="$REPORT_DIR/android-diagnostic.log"
TEST_TIMEOUT_SECONDS="${TEST_TIMEOUT_SECONDS:-180}"
ANDROID_SCRIPT_TIMEOUT_SECONDS="${ANDROID_SCRIPT_TIMEOUT_SECONDS:-2100}"
REPORT_REMOTE_PATH=""
LOCAL_AGORA_MAVEN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/local-maven"
ANDROID_GRADLE_OFFLINE="${ANDROID_GRADLE_OFFLINE:-false}"
ANDROID_TEST_ABI="${ANDROID_TEST_ABI:-x86_64}"
ANDROID_TEST_SCRIPT_PID=""
ANDROID_TIMEOUT_WATCHDOG_PID=""

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
  ANDROID_TEST_ABI="$ANDROID_TEST_ABI" \
  node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.env.ANDROID_BUILD_CONFIG;
const outputPath = process.env.ANDROID_COCOS_BUILD_CONFIG;
const config = JSON.parse(await readFile(sourcePath, 'utf8'));

config.packages ??= {};
config.packages.android ??= {};
config.packages.android.sdkPath = process.env.ANDROID_SDK_ROOT;
config.packages.android.ndkPath = process.env.ANDROID_NDK_HOME;
config.packages.android.appABIs = [process.env.ANDROID_TEST_ABI || 'x86_64'];

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
NODE
}

write_android_apk_contents_report() {
  local report_dir="$ROOT_DIR/test_shard/integration_test_app/reports"
  local report_path="$report_dir/android-apk-contents.txt"
  local required_abi="$ANDROID_TEST_ABI"

  mkdir -p "$report_dir"
  unzip -l "$APK_PATH" > "$report_path"
  if ! grep -q "lib/$required_abi/" "$report_path"; then
    cat "$report_path"
    echo "APK does not contain native libraries for Android test ABI: $required_abi." >&2
    exit 1
  fi
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

collect_android_diagnostics() {
  mkdir -p "$REPORT_DIR"
  {
    echo "== adb devices =="
    "$ADB_BIN" devices -l || true
    echo
    echo "== adb shell getprop =="
    "$ADB_BIN" shell getprop ro.build.version.release || true
    "$ADB_BIN" shell getprop ro.product.cpu.abi || true
    "$ADB_BIN" shell getprop sys.boot_completed || true
    echo
    echo "== adb shell pidof $PACKAGE_NAME =="
    "$ADB_BIN" shell pidof "$PACKAGE_NAME" || true
    echo
    echo "== adb shell dumpsys activity top =="
    "$ADB_BIN" shell dumpsys activity top || true
    echo
    echo "== adb shell ps package =="
    "$ADB_BIN" shell ps -A | grep "$PACKAGE_NAME" || true
    echo
    echo "== latest logcat =="
    "$ADB_BIN" logcat -d -t 1000 || true
  } > "$ANDROID_DIAGNOSTIC_LOG_PATH" 2>&1 || true

  if [[ -f "$ANDROID_DIAGNOSTIC_LOG_PATH" ]]; then
    cat "$ANDROID_DIAGNOSTIC_LOG_PATH"
  fi
}

terminate_android_process_tree() {
  local target_pid="$1"
  local child_pid

  if [[ -z "$target_pid" ]]; then
    return
  fi

  while IFS= read -r child_pid; do
    terminate_android_process_tree "$child_pid"
  done < <(pgrep -P "$target_pid" 2>/dev/null || true)

  kill -TERM "$target_pid" 2>/dev/null || true
}

cleanup_android_test() {
  if [[ -n "$ANDROID_TIMEOUT_WATCHDOG_PID" ]]; then
    kill "$ANDROID_TIMEOUT_WATCHDOG_PID" 2>/dev/null || true
    wait "$ANDROID_TIMEOUT_WATCHDOG_PID" 2>/dev/null || true
    ANDROID_TIMEOUT_WATCHDOG_PID=""
  fi
}

run_android_script_with_timeout() {
  run_android_api_test_main "$@" &
  ANDROID_TEST_SCRIPT_PID="$!"

  (
    sleep "$ANDROID_SCRIPT_TIMEOUT_SECONDS"
    if kill -0 "$ANDROID_TEST_SCRIPT_PID" 2>/dev/null; then
      echo "Android Cocos API test script exceeded ${ANDROID_SCRIPT_TIMEOUT_SECONDS}s." >&2
      terminate_android_process_tree "$ANDROID_TEST_SCRIPT_PID"
      collect_android_diagnostics
      sleep 10
      kill -KILL "$ANDROID_TEST_SCRIPT_PID" 2>/dev/null || true
    fi
  ) &
  ANDROID_TIMEOUT_WATCHDOG_PID="$!"

  set +e
  wait "$ANDROID_TEST_SCRIPT_PID"
  local exit_code=$?
  set -e

  cleanup_android_test
  return "$exit_code"
}

trap cleanup_android_test EXIT

run_android_api_test_main() {
cd "$ROOT_DIR"

if [[ -z "${TEST_APP_ID:-${APP_ID:-}}" ]]; then
  echo "TEST_APP_ID or APP_ID is required." >&2
  exit 1
fi

APP_ID="${APP_ID:-${TEST_APP_ID:-}}" \
TEST_APP_ID="${TEST_APP_ID:-${APP_ID:-}}" \
CHANNEL_ID="$CHANNEL_ID" \
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
TEST_CHANNEL_ID="$TEST_CHANNEL_ID" \
TEST_UID="$TEST_UID" \
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
write_android_apk_contents_report

log_step "Install and launch Android test app"
"$ADB_BIN" install -g -r --no-streaming "$APK_PATH"
"$ADB_BIN" logcat -c
"$ADB_BIN" shell am start -n "$PACKAGE_NAME/$ACTIVITY_NAME" \
  --es AGORA_COCOS_TEST_MODE "$AGORA_COCOS_TEST_MODE" \
  --es TEST_APP_ID "${TEST_APP_ID:-${APP_ID:-}}" \
  --es TEST_TOKEN "${TEST_TOKEN:-${TOKEN:-}}" \
  --es TEST_CHANNEL_ID "$TEST_CHANNEL_ID" \
  --es TEST_UID "$TEST_UID"

mkdir -p "$(dirname "$LOG_PATH")"
: > "$LOG_PATH"
log_step "Wait for Android API test report"
SECONDS=0
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
collect_android_diagnostics
echo "Timed out waiting for TEST_DONE status= after ${TEST_TIMEOUT_SECONDS}s." >&2
exit 1
}

run_android_script_with_timeout "$@"
