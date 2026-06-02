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
DERIVED_DATA_PATH="/tmp/agora-cocos-ios-derived"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"

cd "$ROOT_DIR"

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

./scripts/integrate-ios-project.rb >/dev/null

if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
  cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
fi

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
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"

echo
echo "iOS simulator build finished:"
echo "  Workspace: $WORKSPACE_PATH"
echo "  Scheme: $SCHEME_NAME"

open -a Simulator >/dev/null 2>&1 || true
xcrun simctl bootstatus booted -b >/dev/null 2>&1 || true
xcrun simctl install booted "$APP_PATH"
xcrun simctl launch booted "$IOS_BUNDLE_ID"

echo "  Installed and launched on simulator: $IOS_BUNDLE_ID"
