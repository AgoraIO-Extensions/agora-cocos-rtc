#!/usr/bin/env zsh

set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export RUBYOPT="${RUBYOPT:--EUTF-8:UTF-8}"

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/ios-debug.json"
IOS_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-ios/ios/proj"
PROJECT_PATH="$IOS_PROJECT_DIR/agora-cocos-basic-call.xcodeproj"
SCHEME_NAME="agora-cocos-basic-call-mobile"
IOS_BUILD_ROOT="${IOS_BUILD_ROOT:-/tmp/agora-cocos-ios-derived}"
IOS_PRODUCTS_DIR="$IOS_BUILD_ROOT/Build/Products"
IOS_INTERMEDIATES_DIR="$IOS_BUILD_ROOT/Build/Intermediates.noindex"
IOS_SIMULATOR_RESOURCE_MODE="${IOS_SIMULATOR_RESOURCE_MODE:-auto}"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"

should_skip_simulator_launch_assets() {
  case "$IOS_SIMULATOR_RESOURCE_MODE" in
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
      xcrun simctl list runtimes 2>/dev/null | grep -Fq "$sdk_build" && return 1
      return 0
      ;;
    *)
      echo "Unsupported IOS_SIMULATOR_RESOURCE_MODE: $IOS_SIMULATOR_RESOURCE_MODE" >&2
      echo "Expected auto, skip, or keep." >&2
      exit 1
      ;;
  esac
}

cd "$ROOT_DIR"

./scripts/prepare-example.sh >/dev/null
if [[ -n "${APP_ID:-}${TEST_APP_ID:-}${CHANNEL_ID:-}${TEST_CHANNEL_ID:-}${TOKEN:-}${TEST_TOKEN:-}${TEST_UID:-}${AUTO_PREVIEW:-}${AUTO_JOIN:-}${PUBLISH_CAMERA_TRACK:-}${PUBLISH_MICROPHONE_TRACK:-}${AUTO_SUBSCRIBE_AUDIO:-}${AUTO_SUBSCRIBE_VIDEO:-}" ]]; then
  node ./scripts/write-example-build-config.mjs >/dev/null
fi

set +e
"$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$COCOS_BUILD_CONFIG"
COCOS_BUILD_EXIT_CODE=$?
set -e

if [[ $COCOS_BUILD_EXIT_CODE -ne 0 && $COCOS_BUILD_EXIT_CODE -ne 36 ]]; then
  echo "Cocos CLI build failed with exit code $COCOS_BUILD_EXIT_CODE" >&2
  exit $COCOS_BUILD_EXIT_CODE
fi

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

rm -rf "$IOS_BUILD_ROOT"
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

APP_PATH="$IOS_PRODUCTS_DIR/Debug-iphonesimulator/agora-cocos-basic-call-mobile.app"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"

echo
echo "iOS simulator build finished:"
echo "  Project: $PROJECT_PATH"
echo "  Scheme: $SCHEME_NAME"

open -a Simulator >/dev/null 2>&1 || true
xcrun simctl bootstatus booted -b >/dev/null 2>&1 || true
xcrun simctl install booted "$APP_PATH"
xcrun simctl launch booted "$IOS_BUNDLE_ID"

echo "  Installed and launched on simulator: $IOS_BUNDLE_ID"
