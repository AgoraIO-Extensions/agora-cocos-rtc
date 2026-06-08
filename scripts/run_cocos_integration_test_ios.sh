#!/usr/bin/env bash

set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export RUBYOPT="${RUBYOPT:--EUTF-8:UTF-8}"

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="${COCOS_CLI:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/ios-debug.json"
IOS_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-ios/ios/proj"
WORKSPACE_PATH="$IOS_PROJECT_DIR/agora-cocos-basic-call.xcworkspace"
SCHEME_NAME="agora-cocos-basic-call-mobile"
DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-/tmp/agora-cocos-ios-api-tests-derived}"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"
DEFAULT_AGORA_COCOS_TEST_MODE=api
AGORA_COCOS_TEST_MODE="${AGORA_COCOS_TEST_MODE:-$DEFAULT_AGORA_COCOS_TEST_MODE}"
LOG_PATH="$ROOT_DIR/test_shard/integration_test_app/reports/ios-runtime.log"
DIAGNOSTIC_LOG_PATH="$ROOT_DIR/test_shard/integration_test_app/reports/ios-diagnostic.log"
TEST_TIMEOUT_SECONDS="${TEST_TIMEOUT_SECONDS:-180}"
REPORT_SIM_PATH=""

log_step() {
  echo
  echo "==> $1"
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

collect_ios_diagnostics() {
  xcrun simctl spawn booted log show --last 10m --style compact \
    --predicate 'process == "agora-cocos-basic-call-mobile" OR eventMessage CONTAINS "[agora-cocos-test]" OR eventMessage CONTAINS "[agora-rtc]" OR eventMessage CONTAINS "io.agora.cocos.example"' \
    > "$DIAGNOSTIC_LOG_PATH" || true
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

log_step "Inject Cocos API test runner"
AGORA_COCOS_TEST_MODE="$AGORA_COCOS_TEST_MODE" \
TEST_APP_ID="${TEST_APP_ID:-${APP_ID:-}}" \
TEST_TOKEN="${TEST_TOKEN:-${TOKEN:-}}" \
TEST_CHANNEL_ID="${TEST_CHANNEL_ID:-${CHANNEL_ID:-testapi}}" \
TEST_UID="${TEST_UID:-1001}" \
node ./scripts/inject-cocos-test-runner.mjs

log_step "Export iOS project with Cocos"
run_cocos_build "$COCOS_BUILD_CONFIG" "iOS"
node ./scripts/sync-native-engine-texture-bridge.mjs >/dev/null
node ./scripts/generate-ios-podfile.mjs >/dev/null
./scripts/integrate-ios-project.rb >/dev/null
if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
  cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
fi

log_step "Build iOS simulator app"
cd "$IOS_PROJECT_DIR"
env LANG="$LANG" LC_ALL="$LC_ALL" RUBYOPT="$RUBYOPT" pod install
xcodebuild -workspace "$WORKSPACE_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator/agora-cocos-basic-call-mobile.app"
log_step "Install and launch iOS test app"
xcrun simctl install booted "$APP_PATH"
xcrun simctl launch booted "$IOS_BUNDLE_ID" \
  -AGORA_COCOS_TEST_MODE "$AGORA_COCOS_TEST_MODE" \
  -TEST_APP_ID "${TEST_APP_ID:-${APP_ID:-}}" \
  -TEST_TOKEN "${TEST_TOKEN:-${TOKEN:-}}" \
  -TEST_CHANNEL_ID "${TEST_CHANNEL_ID:-${CHANNEL_ID:-testapi}}" \
  -TEST_UID "${TEST_UID:-1001}"

mkdir -p "$(dirname "$LOG_PATH")"
: > "$LOG_PATH"
: > "$DIAGNOSTIC_LOG_PATH"
log_step "Wait for iOS API test report"
SECONDS=0
while [[ $SECONDS -lt $TEST_TIMEOUT_SECONDS ]]; do
  xcrun simctl spawn booted log show --last 5m --style compact \
    --predicate 'process == "agora-cocos-basic-call-mobile" OR eventMessage CONTAINS "[agora-cocos-test]" OR eventMessage CONTAINS "[agora-rtc]"' \
    > "$LOG_PATH"
  if grep -q "TEST_DONE status=" "$LOG_PATH"; then
    cat "$LOG_PATH"
    if grep -q "TEST_DONE status=fail" "$LOG_PATH"; then
      exit 1
    fi
    REPORT_SIM_PATH="$(sed -n 's/.*TEST_DONE status=pass.* report=\([^ ]*\).*/\1/p' "$LOG_PATH" | tail -n 1)"
    if [[ -n "$REPORT_SIM_PATH" ]]; then
      xcrun simctl get_app_container booted "$IOS_BUNDLE_ID" data > "$ROOT_DIR/test_shard/integration_test_app/reports/ios-container-path.txt" || true
      IOS_CONTAINER_PATH="$(cat "$ROOT_DIR/test_shard/integration_test_app/reports/ios-container-path.txt" 2>/dev/null || true)"
      if [[ -n "$IOS_CONTAINER_PATH" && "$REPORT_SIM_PATH" == "$IOS_CONTAINER_PATH"* && -f "$REPORT_SIM_PATH" ]]; then
        node "$ROOT_DIR/scripts/collect-cocos-test-report.mjs" ios "$REPORT_SIM_PATH"
      fi
    fi
    exit 0
  fi
  sleep 2
done

collect_ios_diagnostics
cat "$LOG_PATH"
cat "$DIAGNOSTIC_LOG_PATH"
echo "Timed out waiting for TEST_DONE status= after ${TEST_TIMEOUT_SECONDS}s." >&2
exit 1
