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
DERIVED_DATA_PATH="/tmp/agora-cocos-ios-device-derived"
RESULT_BUNDLE_PATH="/tmp/agora-cocos-ios-device-result.xcresult"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"

IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"
IOS_DEVELOPMENT_TEAM="${IOS_DEVELOPMENT_TEAM:-}"
IOS_PROVISIONING_PROFILE_SPECIFIER="${IOS_PROVISIONING_PROFILE_SPECIFIER:-}"
IOS_CODE_SIGN_IDENTITY="${IOS_CODE_SIGN_IDENTITY:-Apple Development}"
IOS_XCODE_DESTINATION_ID="${IOS_XCODE_DESTINATION_ID:-${IOS_DEVICE_ID:-}}"
IOS_DEVICE_ID="${IOS_DEVICE_ID:-}"

cd "$ROOT_DIR"

security find-identity -v -p codesigning >/dev/null

if [[ -z "$IOS_DEVELOPMENT_TEAM" || -z "$IOS_PROVISIONING_PROFILE_SPECIFIER" || -z "$IOS_DEVICE_ID" || -z "$IOS_XCODE_DESTINATION_ID" ]]; then
  echo "iOS device build requires signing and device environment variables:" >&2
  echo "  IOS_DEVELOPMENT_TEAM" >&2
  echo "  IOS_PROVISIONING_PROFILE_SPECIFIER" >&2
  echo "  IOS_DEVICE_ID" >&2
  echo "  IOS_XCODE_DESTINATION_ID (defaults to IOS_DEVICE_ID when unset)" >&2
  echo "Optional:" >&2
  echo "  IOS_CODE_SIGN_IDENTITY (default: Apple Development)" >&2
  exit 1
fi

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

IOS_BUNDLE_ID="$IOS_BUNDLE_ID" \
IOS_DEVELOPMENT_TEAM="$IOS_DEVELOPMENT_TEAM" \
IOS_PROVISIONING_PROFILE_SPECIFIER="$IOS_PROVISIONING_PROFILE_SPECIFIER" \
IOS_CODE_SIGN_IDENTITY="$IOS_CODE_SIGN_IDENTITY" \
./scripts/integrate-ios-project.rb --with-package >/dev/null

if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
  cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
fi

rm -rf "$RESULT_BUNDLE_PATH"

xcodebuild -project "$PROJECT_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Debug \
  -destination "id=$IOS_XCODE_DESTINATION_ID" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -resultBundlePath "$RESULT_BUNDLE_PATH" \
  build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Debug-iphoneos/${SCHEME_NAME}.app"

xcrun devicectl device install app --device "$IOS_DEVICE_ID" "$APP_PATH"
xcrun devicectl device process launch --device "$IOS_DEVICE_ID" "$IOS_BUNDLE_ID"

echo
echo "iOS device build/install/launch finished:"
echo "  Project: $PROJECT_PATH"
echo "  Scheme: $SCHEME_NAME"
echo "  Bundle ID: $IOS_BUNDLE_ID"
echo "  Team: $IOS_DEVELOPMENT_TEAM"
echo "  Profile: $IOS_PROVISIONING_PROFILE_SPECIFIER"
echo "  Xcode Destination: $IOS_XCODE_DESTINATION_ID"
echo "  Device: $IOS_DEVICE_ID"
echo "  Result Bundle: $RESULT_BUNDLE_PATH"
