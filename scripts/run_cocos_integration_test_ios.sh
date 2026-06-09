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
PROJECT_PATH="$IOS_PROJECT_DIR/agora-cocos-basic-call.xcodeproj"
SCHEME_NAME="agora-cocos-basic-call-mobile"
DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-/tmp/agora-cocos-ios-api-tests-derived}"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"
DEFAULT_AGORA_COCOS_TEST_MODE=api
AGORA_COCOS_TEST_MODE="${AGORA_COCOS_TEST_MODE:-$DEFAULT_AGORA_COCOS_TEST_MODE}"
DEFAULT_TEST_CHANNEL_ID="${DEFAULT_TEST_CHANNEL_ID:-cocos-ios-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}}"
TEST_CHANNEL_ID="${TEST_CHANNEL_ID:-${CHANNEL_ID:-$DEFAULT_TEST_CHANNEL_ID}}"
CHANNEL_ID="${CHANNEL_ID:-$TEST_CHANNEL_ID}"
TEST_UID="${TEST_UID:-1002}"
REPORT_DIR="$ROOT_DIR/test_shard/integration_test_app/reports"
LOG_PATH="$REPORT_DIR/ios-runtime.log"
DIAGNOSTIC_LOG_PATH="$REPORT_DIR/ios-diagnostic.log"
IOS_LAUNCH_LOG_PATH="$REPORT_DIR/ios-launch.log"
IOS_STDOUT_LOG_PATH="$REPORT_DIR/ios-stdout.log"
IOS_STDERR_LOG_PATH="$REPORT_DIR/ios-stderr.log"
IOS_SCREENSHOT_PATH="$REPORT_DIR/ios-timeout-screenshot.png"
IOS_SIMULATORS_LOG_PATH="$REPORT_DIR/ios-simulators.json"
TEST_TIMEOUT_SECONDS="${TEST_TIMEOUT_SECONDS:-180}"
REPORT_SIM_PATH=""
IOS_SIMULATOR_UDID="${IOS_SIMULATOR_UDID:-}"
IOS_CONTAINER_PATH=""
IOS_REPORT_SIM_PATH=""

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

should_skip_simulator_launch_assets() {
  case "${IOS_SIMULATOR_RESOURCE_MODE:-auto}" in
    skip|true|1)
      return 0
      ;;
    keep|false|0)
      return 1
      ;;
    auto)
      local sdk_build
      sdk_build=$(xcodebuild -version -sdk iphonesimulator ProductBuildVersion 2>/dev/null | tail -n 1 | tr -d '[:space:]')
      [[ -z "$sdk_build" ]] && return 1
      if xcrun simctl list runtimes -j 2>/dev/null | SDK_BUILD="$sdk_build" node -e '
const fs = require("node:fs");

const sdkBuild = process.env.SDK_BUILD;
const data = JSON.parse(fs.readFileSync(0, "utf8"));
const runtimes = Array.isArray(data.runtimes) ? data.runtimes : [];
const hasMatchingRuntime = runtimes.some((runtime) => {
  if (runtime.isAvailable === false) {
    return false;
  }
  const identity = [
    runtime.name,
    runtime.identifier,
    runtime.platform,
  ].filter(Boolean).join(" ");
  const buildVersion = String(runtime.buildversion ?? runtime.buildVersion ?? "");
  return /iOS/i.test(identity) && buildVersion === sdkBuild;
});

process.exit(hasMatchingRuntime ? 0 : 1);
'
      then
        return 1
      fi
      return 0
      ;;
    *)
      echo "Unsupported IOS_SIMULATOR_RESOURCE_MODE: ${IOS_SIMULATOR_RESOURCE_MODE:-auto}" >&2
      echo "Expected auto, skip, or keep." >&2
      exit 1
      ;;
  esac
}

resolve_ios_simulator_udid() {
  if [[ -n "${IOS_SIMULATOR_UDID:-}" ]]; then
    echo "$IOS_SIMULATOR_UDID"
    return
  fi

  if [[ -n "${SIMULATOR_UDID:-}" ]]; then
    echo "$SIMULATOR_UDID"
    return
  fi

  xcrun simctl list devices booted -j > "$IOS_SIMULATORS_LOG_PATH"
  node - "$IOS_SIMULATORS_LOG_PATH" "${IOS_SIMULATOR_NAME:-iPhone 16 Pro}" <<'NODE'
const fs = require('node:fs');

const [listPath, preferredName] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(listPath, 'utf8'));
const bootedDevices = Object.entries(data.devices ?? {})
  .flatMap(([runtime, devices]) => (Array.isArray(devices) ? devices : []).map((device) => ({ ...device, runtime })))
  .filter((device) => device.state === 'Booted' && device.isAvailable !== false && /iOS/i.test(device.runtime));
const preferredDevices = bootedDevices.filter((device) => device.name === preferredName);
const selectedDevice = preferredDevices[0] ?? bootedDevices[0];

if (!selectedDevice?.udid) {
  console.error('No booted iOS simulator was found.');
  process.exit(1);
}

console.error(`Selected iOS simulator: ${selectedDevice.name} ${selectedDevice.udid}`);
process.stdout.write(selectedDevice.udid);
NODE
}

refresh_ios_report_path() {
  if [[ -n "$IOS_REPORT_SIM_PATH" ]]; then
    return
  fi

  IOS_CONTAINER_PATH="$(xcrun simctl get_app_container "$IOS_SIMULATOR_UDID" "$IOS_BUNDLE_ID" data 2>/dev/null || true)"
  if [[ -n "$IOS_CONTAINER_PATH" ]]; then
    echo "$IOS_CONTAINER_PATH" > "$REPORT_DIR/ios-container-path.txt"
    IOS_REPORT_SIM_PATH="$IOS_CONTAINER_PATH/Documents/api-report.json"
  fi
}

ios_report_has_failures() {
  local report_path="$1"
  node - "$report_path" <<'NODE'
const fs = require('node:fs');

const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.exit(Number(report?.totals?.failed ?? 1) > 0 ? 0 : 1);
NODE
}

ios_log_predicate() {
  local launch_pid
  launch_pid="$(sed -n 's/.*: \([0-9][0-9]*\)$/\1/p' "$IOS_LAUNCH_LOG_PATH" 2>/dev/null | tail -n 1)"
  if [[ -n "$launch_pid" ]]; then
    echo "processIdentifier == $launch_pid OR process == \"$SCHEME_NAME\" OR eventMessage CONTAINS \"[agora-cocos-test]\" OR eventMessage CONTAINS \"[agora-rtc]\" OR eventMessage CONTAINS \"$IOS_BUNDLE_ID\""
  else
    echo "process == \"$SCHEME_NAME\" OR eventMessage CONTAINS \"[agora-cocos-test]\" OR eventMessage CONTAINS \"[agora-rtc]\" OR eventMessage CONTAINS \"$IOS_BUNDLE_ID\""
  fi
}

append_ios_runtime_logs() {
  : > "$LOG_PATH"
  {
    echo "== ios-launch.log =="
    if [[ -f "$IOS_LAUNCH_LOG_PATH" ]]; then
      cat "$IOS_LAUNCH_LOG_PATH"
    fi
    echo "== ios-stdout.log =="
    if [[ -f "$IOS_STDOUT_LOG_PATH" ]]; then
      cat "$IOS_STDOUT_LOG_PATH"
    fi
    echo "== ios-stderr.log =="
    if [[ -f "$IOS_STDERR_LOG_PATH" ]]; then
      cat "$IOS_STDERR_LOG_PATH"
    fi
    echo "== unified-log =="
  } >> "$LOG_PATH"
  xcrun simctl spawn "$IOS_SIMULATOR_UDID" log show --last 5m --style compact \
    --predicate "$(ios_log_predicate)" \
    >> "$LOG_PATH" || true
}

collect_ios_diagnostics() {
  xcrun simctl spawn "$IOS_SIMULATOR_UDID" log show --last 10m --style compact \
    --predicate "$(ios_log_predicate)" \
    > "$DIAGNOSTIC_LOG_PATH" || true
}

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

log_step "Inject Cocos API test runner"
AGORA_COCOS_TEST_MODE="$AGORA_COCOS_TEST_MODE" \
TEST_APP_ID="${TEST_APP_ID:-${APP_ID:-}}" \
TEST_TOKEN="${TEST_TOKEN:-${TOKEN:-}}" \
TEST_CHANNEL_ID="$TEST_CHANNEL_ID" \
TEST_UID="$TEST_UID" \
node ./scripts/inject-cocos-test-runner.mjs

log_step "Export iOS project with Cocos"
run_cocos_build "$COCOS_BUILD_CONFIG" "iOS"
node ./scripts/sync-native-engine-texture-bridge.mjs >/dev/null
IOS_INTEGRATION_ARGS=(--with-package)
if should_skip_simulator_launch_assets; then
  IOS_INTEGRATION_ARGS+=(--skip-simulator-launch-assets)
  echo "Skipping simulator launch assets because the installed simulator runtimes do not match the active iOS Simulator SDK."
fi
./scripts/integrate-ios-project.rb "${IOS_INTEGRATION_ARGS[@]}" >/dev/null
if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
  cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
fi

log_step "Build iOS simulator app"
cd "$IOS_PROJECT_DIR"
IOS_PRODUCTS_DIR="$DERIVED_DATA_PATH/Build/Products"
IOS_INTERMEDIATES_DIR="$DERIVED_DATA_PATH/Build/Intermediates.noindex"
rm -rf "$DERIVED_DATA_PATH/Build"
mkdir -p "$IOS_PRODUCTS_DIR" "$IOS_INTERMEDIATES_DIR"
xcodebuild -project "$PROJECT_PATH" \
  -target "$SCHEME_NAME" \
  -configuration Debug \
  -sdk iphonesimulator \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  SYMROOT="$IOS_PRODUCTS_DIR" \
  OBJROOT="$IOS_INTERMEDIATES_DIR" \
  build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator/agora-cocos-basic-call-mobile.app"
log_step "Install and launch iOS test app"
mkdir -p "$REPORT_DIR"
: > "$LOG_PATH"
: > "$DIAGNOSTIC_LOG_PATH"
: > "$IOS_LAUNCH_LOG_PATH"
: > "$IOS_STDOUT_LOG_PATH"
: > "$IOS_STDERR_LOG_PATH"
IOS_SIMULATOR_UDID="$(resolve_ios_simulator_udid)"
echo "IOS_SIMULATOR_UDID=$IOS_SIMULATOR_UDID" > "$REPORT_DIR/ios-simulator-udid.txt"
xcrun simctl install "$IOS_SIMULATOR_UDID" "$APP_PATH"
xcrun simctl privacy "$IOS_SIMULATOR_UDID" grant camera "$IOS_BUNDLE_ID" || true
xcrun simctl privacy "$IOS_SIMULATOR_UDID" grant microphone "$IOS_BUNDLE_ID" || true
refresh_ios_report_path
if [[ -n "$IOS_REPORT_SIM_PATH" ]]; then
  rm -f "$IOS_REPORT_SIM_PATH"
fi
xcrun simctl launch --terminate-running-process --stdout="$IOS_STDOUT_LOG_PATH" --stderr="$IOS_STDERR_LOG_PATH" "$IOS_SIMULATOR_UDID" "$IOS_BUNDLE_ID" \
  -AGORA_COCOS_TEST_MODE "$AGORA_COCOS_TEST_MODE" \
  -TEST_APP_ID "${TEST_APP_ID:-${APP_ID:-}}" \
  -TEST_TOKEN "${TEST_TOKEN:-${TOKEN:-}}" \
  -TEST_CHANNEL_ID "$TEST_CHANNEL_ID" \
  -TEST_UID "$TEST_UID" \
  > "$IOS_LAUNCH_LOG_PATH" 2>&1

log_step "Wait for iOS API test report"
SECONDS=0
while [[ $SECONDS -lt $TEST_TIMEOUT_SECONDS ]]; do
  append_ios_runtime_logs
  refresh_ios_report_path
  if [[ -n "$IOS_REPORT_SIM_PATH" && -s "$IOS_REPORT_SIM_PATH" ]]; then
    cat "$LOG_PATH"
    node "$ROOT_DIR/scripts/collect-cocos-test-report.mjs" ios "$IOS_REPORT_SIM_PATH"
    if ios_report_has_failures "$IOS_REPORT_SIM_PATH"; then
      exit 1
    fi
    exit 0
  fi
  if grep -q "TEST_DONE status=" "$LOG_PATH"; then
    cat "$LOG_PATH"
    if grep -q "TEST_DONE status=fail" "$LOG_PATH"; then
      exit 1
    fi
    REPORT_SIM_PATH="$(sed -n 's/.*TEST_DONE status=pass.* report=\([^ ]*\).*/\1/p' "$LOG_PATH" | tail -n 1)"
    if [[ -n "$REPORT_SIM_PATH" ]]; then
      refresh_ios_report_path
      if [[ -n "$IOS_CONTAINER_PATH" && "$REPORT_SIM_PATH" == "$IOS_CONTAINER_PATH"* && -f "$REPORT_SIM_PATH" ]]; then
        node "$ROOT_DIR/scripts/collect-cocos-test-report.mjs" ios "$REPORT_SIM_PATH"
      fi
    fi
    exit 0
  fi
  sleep 2
done

xcrun simctl io "$IOS_SIMULATOR_UDID" screenshot "$IOS_SCREENSHOT_PATH" || true
append_ios_runtime_logs
collect_ios_diagnostics
cat "$LOG_PATH"
cat "$DIAGNOSTIC_LOG_PATH"
echo "Timed out waiting for TEST_DONE status= after ${TEST_TIMEOUT_SECONDS}s." >&2
exit 1
