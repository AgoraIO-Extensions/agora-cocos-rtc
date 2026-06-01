#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/android-debug.json"
ANDROID_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-android/android/proj"
ANDROID_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/app/src/main/java/io/agora/cocos/rtc"
ANDROID_EXPORTED_PLUGIN_DIR="$ANDROID_PROJECT_DIR/app/src/main/java/io/agora/cocos/rtc"
APK_PATH="$ANDROID_PROJECT_DIR/build/agora-cocos-basic-call/outputs/apk/debug/agora-cocos-basic-call-debug.apk"
PACKAGE_NAME="io.agora.cocosbasiccall"
ACTIVITY_NAME="com.cocos.game.AppActivity"
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ADB_BIN="${ADB_BIN:-$ANDROID_SDK_ROOT/platform-tools/adb}"
LOCAL_AGORA_MAVEN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/local-maven"

cd "$ROOT_DIR"

if [[ ! -x "$ADB_BIN" ]]; then
  echo "adb not found at $ADB_BIN" >&2
  exit 1
fi

./scripts/prepare-example.sh >/dev/null
if [[ ! -d "$LOCAL_AGORA_MAVEN_DIR" ]]; then
  node ./scripts/fetch-agora-maven.mjs >/dev/null
fi

set +e
"$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$COCOS_BUILD_CONFIG"
COCOS_BUILD_EXIT_CODE=$?
set -e

if [[ $COCOS_BUILD_EXIT_CODE -ne 0 && $COCOS_BUILD_EXIT_CODE -ne 36 ]]; then
  echo "Cocos CLI build failed with exit code $COCOS_BUILD_EXIT_CODE" >&2
  exit $COCOS_BUILD_EXIT_CODE
fi

if [[ ! -f "$ROOT_DIR/example/basic-call/build-android/android/data/assets/main/index.js" ]]; then
  echo "Cocos CLI build did not produce build-android/android/data/assets/main/index.js" >&2
  exit 1
fi

if [[ -d "$ANDROID_RUNTIME_PLUGIN_DIR" ]]; then
  mkdir -p "$ANDROID_EXPORTED_PLUGIN_DIR"
  cp -R "$ANDROID_RUNTIME_PLUGIN_DIR/." "$ANDROID_EXPORTED_PLUGIN_DIR/"
fi

cd "$ANDROID_PROJECT_DIR"
./gradlew --offline :agora-cocos-basic-call:assembleDebug

# "$ADB_BIN" uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
"$ADB_BIN" install -g -r --no-streaming "$APK_PATH"
"$ADB_BIN" logcat -c
"$ADB_BIN" shell am start -n "$PACKAGE_NAME/$ACTIVITY_NAME"

echo
echo "Android debug build installed and launched:"
echo "  APK: $APK_PATH"
echo "  Package: $PACKAGE_NAME"
