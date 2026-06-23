#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
COCOS_CLI="/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
GOOGLE_PLAY_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/google-play-debug.json"
GOOGLE_PLAY_COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-google-play/google-play-debug.local.json"
GOOGLE_PLAY_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-google-play/google-play/proj"
APK_PATH="$GOOGLE_PLAY_PROJECT_DIR/build/agora-cocos-basic-call/outputs/apk/debug/agora-cocos-basic-call-debug.apk"
PACKAGE_NAME="io.agora.cocos.example"
ACTIVITY_NAME="com.cocos.game.AppActivity"
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
ADB_BIN="${ADB_BIN:-$ANDROID_SDK_ROOT/platform-tools/adb}"
LOCAL_AGORA_MAVEN_DIR="$ROOT_DIR/example/basic-call/local-maven"
TARGET_ANDROID_SERIAL="${1:-${ANDROID_SERIAL:-}}"
ADB_TARGET_ARGS=()
if [[ -n "$TARGET_ANDROID_SERIAL" ]]; then
  ADB_TARGET_ARGS=(-s "$TARGET_ANDROID_SERIAL")
fi

cd "$ROOT_DIR"

resolve_android_ndk_path() {
  local candidate

  for candidate in "$ANDROID_NDK_HOME" "$ANDROID_SDK_ROOT/ndk/23.1.7779620"; do
    if [[ -n "$candidate" && -f "$candidate/source.properties" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  local discovered_ndks=("${(@f)$(find "$ANDROID_SDK_ROOT/ndk" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort -r)}")
  if [[ ${#discovered_ndks[@]} -gt 0 ]]; then
    for candidate in "${discovered_ndks[@]}"; do
      if [[ -f "$candidate/source.properties" ]]; then
        echo "$candidate"
        return 0
      fi
    done
  fi

  return 1
}

write_google_play_cocos_build_config() {
  if [[ ! -d "$ANDROID_SDK_ROOT/platform-tools" ]]; then
    echo "Android SDK is missing platform-tools under $ANDROID_SDK_ROOT." >&2
    echo "Set ANDROID_SDK_ROOT or install Android command-line tools before building Google Play." >&2
    exit 1
  fi

  ANDROID_NDK_HOME="$(resolve_android_ndk_path || true)"
  if [[ -z "$ANDROID_NDK_HOME" ]]; then
    echo "Android NDK was not found under $ANDROID_SDK_ROOT/ndk." >&2
    echo "Set ANDROID_NDK_HOME or install NDK 23.1.7779620 before building Google Play." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$GOOGLE_PLAY_COCOS_BUILD_CONFIG")"
  COCOS_BUILD_SOURCE_CONFIG="$GOOGLE_PLAY_BUILD_CONFIG" \
  COCOS_BUILD_OUTPUT_CONFIG="$GOOGLE_PLAY_COCOS_BUILD_CONFIG" \
  ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
  ANDROID_NDK_HOME="$ANDROID_NDK_HOME" \
  node "$ROOT_DIR/scripts/write-cocos-native-build-config.mjs"
}

has_example_build_config_env() {
  [[ -n "${APP_ID:-}${TEST_APP_ID:-}${CHANNEL_ID:-}${TEST_CHANNEL_ID:-}${TOKEN:-}${TEST_TOKEN:-}${TEST_UID:-}${AUTO_PREVIEW:-}${AUTO_JOIN:-}${PUBLISH_CAMERA_TRACK:-}${PUBLISH_MICROPHONE_TRACK:-}${AUTO_SUBSCRIBE_AUDIO:-}${AUTO_SUBSCRIBE_VIDEO:-}" ]]
}

if [[ ! -x "$ADB_BIN" ]]; then
  echo "adb not found at $ADB_BIN" >&2
  exit 1
fi

./scripts/prepare-example.sh >/dev/null
if has_example_build_config_env; then
  node ./scripts/write-example-build-config.mjs >/dev/null
fi
if [[ ! -d "$LOCAL_AGORA_MAVEN_DIR" ]]; then
  node ./scripts/fetch-agora-maven.mjs >/dev/null
fi
write_google_play_cocos_build_config

set +e
"$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$GOOGLE_PLAY_COCOS_BUILD_CONFIG"
COCOS_BUILD_EXIT_CODE=$?
set -e

if [[ $COCOS_BUILD_EXIT_CODE -ne 0 && $COCOS_BUILD_EXIT_CODE -ne 36 ]]; then
  echo "Cocos CLI build failed with exit code $COCOS_BUILD_EXIT_CODE" >&2
  exit $COCOS_BUILD_EXIT_CODE
fi

if [[ ! -f "$ROOT_DIR/example/basic-call/build-google-play/google-play/data/assets/main/index.js" ]]; then
  echo "Cocos CLI build did not produce build-google-play/google-play/data/assets/main/index.js" >&2
  exit 1
fi

node ./scripts/sync-android-app-bridge.mjs >/dev/null

cd "$GOOGLE_PLAY_PROJECT_DIR"
./gradlew --offline :agora-cocos-basic-call:assembleDebug

"$ADB_BIN" "${ADB_TARGET_ARGS[@]}" install -g -r --no-streaming "$APK_PATH"
"$ADB_BIN" "${ADB_TARGET_ARGS[@]}" logcat -c || echo "Warning: failed to clear logcat; continuing." >&2
"$ADB_BIN" "${ADB_TARGET_ARGS[@]}" shell am start -n "$PACKAGE_NAME/$ACTIVITY_NAME"

echo
echo "Google Play debug build installed and launched:"
echo "  APK: $APK_PATH"
echo "  Package: $PACKAGE_NAME"
if [[ -n "$TARGET_ANDROID_SERIAL" ]]; then
  echo "  Device: $TARGET_ANDROID_SERIAL"
fi
