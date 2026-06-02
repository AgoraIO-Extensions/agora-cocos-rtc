#!/usr/bin/env zsh

set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export RUBYOPT="${RUBYOPT:--EUTF-8:UTF-8}"

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="${COCOS_CLI:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
AGORA_CONFIG_PATH="$ROOT_DIR/example/basic-call/assets/resources/agora-config.json"

ANDROID_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/android-debug.json"
ANDROID_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-android/android/proj"
ANDROID_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/app/src/main/java/io/agora/cocos/rtc"
ANDROID_EXPORTED_PLUGIN_DIR="$ANDROID_PROJECT_DIR/app/src/main/java/io/agora/cocos/rtc"
ANDROID_APK_PATH="$ANDROID_PROJECT_DIR/build/agora-cocos-basic-call/outputs/apk/debug/agora-cocos-basic-call-debug.apk"
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ANDROID_GRADLE_OFFLINE="${ANDROID_GRADLE_OFFLINE:-false}"
LOCAL_AGORA_MAVEN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/local-maven"

IOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/ios-debug.json"
IOS_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-ios/ios/proj"
IOS_WORKSPACE_PATH="$IOS_PROJECT_DIR/agora-cocos-basic-call.xcworkspace"
IOS_SCHEME_NAME="agora-cocos-basic-call-mobile"
IOS_DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-/tmp/agora-cocos-ios-all-platforms-derived}"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"
IOS_APP_PATH="$IOS_DERIVED_DATA_PATH/Build/Products/Debug-iphonesimulator/${IOS_SCHEME_NAME}.app"
IOS_APP_ZIP_PATH="$ROOT_DIR/example/basic-call/build-ios/${IOS_SCHEME_NAME}-Debug-iphonesimulator.app.zip"

cd "$ROOT_DIR"

if [[ ! -x "$COCOS_CLI" ]]; then
  echo "Cocos Creator CLI not found at $COCOS_CLI" >&2
  echo "Set COCOS_CLI to the CocosCreator executable path if needed." >&2
  exit 1
fi

if [[ ! -f "$AGORA_CONFIG_PATH" ]]; then
  echo "Agora config file is missing: $AGORA_CONFIG_PATH" >&2
  exit 1
fi

if grep -Eq '<YOUR_AGORA_APP_ID>|<YOUR_CHANNEL_ID>' "$AGORA_CONFIG_PATH"; then
  echo "Please edit example/basic-call/assets/resources/agora-config.json before building packages." >&2
  echo "Required fields:" >&2
  echo "  appId: your Agora App ID" >&2
  echo "  channelId: the test channel name" >&2
  echo "  token: leave empty only when your Agora project allows tokenless testing" >&2
  exit 1
fi

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
}

echo "Preparing example project..."
./scripts/prepare-example.sh >/dev/null

echo "Building Android APK..."
if [[ ! -d "$LOCAL_AGORA_MAVEN_DIR" ]]; then
  node ./scripts/fetch-agora-maven.mjs >/dev/null
fi
run_cocos_build "$ANDROID_BUILD_CONFIG" "Android"

if [[ ! -f "$ROOT_DIR/example/basic-call/build-android/android/data/assets/main/index.js" ]]; then
  echo "Cocos Android export did not produce build-android/android/data/assets/main/index.js" >&2
  exit 1
fi

if [[ -d "$ANDROID_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$ANDROID_EXPORTED_PLUGIN_DIR"
  cp -R "$ANDROID_RUNTIME_PLUGIN_DIR/." "$ANDROID_EXPORTED_PLUGIN_DIR/"
fi

(
  cd "$ANDROID_PROJECT_DIR"
  if [[ "$ANDROID_GRADLE_OFFLINE" == "true" ]]; then
    ./gradlew --offline :agora-cocos-basic-call:assembleDebug
  else
    ./gradlew :agora-cocos-basic-call:assembleDebug
  fi
)

if [[ ! -f "$ANDROID_APK_PATH" ]]; then
  echo "Android APK was not produced at $ANDROID_APK_PATH" >&2
  exit 1
fi

echo "Building iOS simulator app..."
node ./scripts/generate-ios-podfile.mjs >/dev/null
run_cocos_build "$IOS_BUILD_CONFIG" "iOS"
./scripts/integrate-ios-project.rb >/dev/null

if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
  cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
fi

(
  cd "$IOS_PROJECT_DIR"
  env LANG="$LANG" LC_ALL="$LC_ALL" RUBYOPT="$RUBYOPT" pod install
  xcodebuild -workspace "$IOS_WORKSPACE_PATH" \
    -scheme "$IOS_SCHEME_NAME" \
    -configuration Debug \
    -sdk iphonesimulator \
    -derivedDataPath "$IOS_DERIVED_DATA_PATH" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    build
)

if [[ ! -d "$IOS_APP_PATH" ]]; then
  echo "iOS simulator app was not produced at $IOS_APP_PATH" >&2
  exit 1
fi

mkdir -p "$(dirname "$IOS_APP_ZIP_PATH")"
rm -f "$IOS_APP_ZIP_PATH"
ditto -c -k --keepParent "$IOS_APP_PATH" "$IOS_APP_ZIP_PATH"

echo
echo "Build artifacts:"
echo "  Android APK: $ANDROID_APK_PATH"
echo "  iOS simulator app: $IOS_APP_ZIP_PATH"
