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
WORKSPACE_PATH="$IOS_PROJECT_DIR/agora-cocos-basic-call.xcworkspace"
SCHEME_NAME="agora-cocos-basic-call-mobile"
DERIVED_DATA_PATH="/tmp/agora-cocos-ios-device-derived"
RESULT_BUNDLE_PATH="/tmp/agora-cocos-ios-device-result.xcresult"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"

IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"
IOS_DEVELOPMENT_TEAM="${IOS_DEVELOPMENT_TEAM:-}"
IOS_PROVISIONING_PROFILE_SPECIFIER="${IOS_PROVISIONING_PROFILE_SPECIFIER:-}"
IOS_DEVICE_ID="${IOS_DEVICE_ID:-}"

cd "$ROOT_DIR"

security find-identity -v -p codesigning >/dev/null

./scripts/prepare-example.sh >/dev/null
node ./scripts/generate-ios-podfile.mjs >/dev/null

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
./scripts/integrate-ios-project.rb >/dev/null

if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
  cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
fi

cd "$IOS_PROJECT_DIR"
env LANG="$LANG" LC_ALL="$LC_ALL" RUBYOPT="$RUBYOPT" pod install
rm -rf "$RESULT_BUNDLE_PATH"

xcodebuild -workspace "$WORKSPACE_PATH" \
  -scheme "$SCHEME_NAME" \
  -configuration Debug \
  -destination "id=$IOS_DEVICE_ID" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  -resultBundlePath "$RESULT_BUNDLE_PATH" \
  PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID" \
  DEVELOPMENT_TEAM="$IOS_DEVELOPMENT_TEAM" \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="$IOS_PROVISIONING_PROFILE_SPECIFIER" \
  build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Debug-iphoneos/${SCHEME_NAME}.app"

xcrun devicectl device install app --device "$IOS_DEVICE_ID" "$APP_PATH"
xcrun devicectl device process launch --device "$IOS_DEVICE_ID" "$IOS_BUNDLE_ID"

echo
echo "iOS device build/install/launch finished:"
echo "  Workspace: $WORKSPACE_PATH"
echo "  Scheme: $SCHEME_NAME"
echo "  Bundle ID: $IOS_BUNDLE_ID"
echo "  Team: $IOS_DEVELOPMENT_TEAM"
echo "  Profile: $IOS_PROVISIONING_PROFILE_SPECIFIER"
echo "  Device: $IOS_DEVICE_ID"
echo "  Result Bundle: $RESULT_BUNDLE_PATH"
