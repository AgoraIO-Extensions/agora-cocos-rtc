#!/usr/bin/env zsh

set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export RUBYOPT="${RUBYOPT:--EUTF-8:UTF-8}"

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
LOCAL_BUILD_ENV="${LOCAL_BUILD_ENV:-$ROOT_DIR/example/basic-call/local/build-all-platforms.env}"

if [[ -f "$LOCAL_BUILD_ENV" ]]; then
  set -a
  source "$LOCAL_BUILD_ENV"
  set +a
fi

COCOS_CLI="${COCOS_CLI:-/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator}"
COCOS_PROJECT_DIR="$ROOT_DIR/example/basic-call"
AGORA_CONFIG_PATH="$ROOT_DIR/example/basic-call/assets/resources/agora-config.json"
AGORA_BUILD_CONFIG_PATH="$ROOT_DIR/example/basic-call/assets/resources/agora-config.build.json"
TARGET_PLATFORMS="${1:-android,ios}"

ANDROID_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/android-release.json"
ANDROID_COCOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/local/android-release.ci.json"
ANDROID_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-android/android/proj"
ANDROID_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/app/src/main/java/io/agora/cocos/rtc"
ANDROID_EXPORTED_PLUGIN_DIR="$ANDROID_PROJECT_DIR/app/src/main/java/io/agora/cocos/rtc"
ANDROID_APK_DIR="$ANDROID_PROJECT_DIR/build/agora-cocos-basic-call/outputs/apk/release"
ANDROID_APK_PATH=""
ANDROID_SDK_ROOT_DEFAULT="$HOME/Library/Android/sdk"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_SDK_ROOT_DEFAULT}"
ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-}}"
ANDROID_GRADLE_OFFLINE="${ANDROID_GRADLE_OFFLINE:-false}"
LOCAL_AGORA_MAVEN_DIR="$ROOT_DIR/example/basic-call/native/engine/android/local-maven"

IOS_BUILD_CONFIG="$ROOT_DIR/example/basic-call/build-configs/ios-release.json"
IOS_PROJECT_DIR="$ROOT_DIR/example/basic-call/build-ios/ios/proj"
IOS_PROJECT_PATH="$IOS_PROJECT_DIR/agora-cocos-basic-call.xcodeproj"
IOS_SCHEME_NAME="agora-cocos-basic-call-mobile"
IOS_SKIP_COCOS_EXPORT="${IOS_SKIP_COCOS_EXPORT:-false}"
IOS_DERIVED_DATA_PATH="${IOS_DERIVED_DATA_PATH:-/tmp/agora-cocos-ios-all-platforms-derived}"
IOS_RUNTIME_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc/ios"
IOS_EXPORTED_PLUGIN_DIR="$IOS_PROJECT_DIR/agora-rtc"
IOS_ARCHIVE_PATH="$IOS_DERIVED_DATA_PATH/Archives/${IOS_SCHEME_NAME}.xcarchive"
IOS_EXPORT_OPTIONS_PLIST="$IOS_DERIVED_DATA_PATH/export-options.plist"
IOS_EXPORT_PATH="$ROOT_DIR/example/basic-call/build-ios/ipa"
IOS_IPA_PATH="$IOS_EXPORT_PATH/${IOS_SCHEME_NAME}.ipa"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-io.agora.cocos.example}"
BUILD_PROVISION_PROFILE_NAME="${BUILD_PROVISION_PROFILE_NAME:-}"
BUILD_PROVISION_PROFILE_TEAMID="${BUILD_PROVISION_PROFILE_TEAMID:-}"
BUILD_PROVISION_PROFILE_IDENTITY="${BUILD_PROVISION_PROFILE_IDENTITY:-Apple Distribution}"
IOS_EXPORT_METHOD="${IOS_EXPORT_METHOD:-ad-hoc}"
BUILT_ANDROID_APK=""
BUILT_IOS_IPA=""

IFS=',' read -rA REQUESTED_PLATFORMS <<< "$TARGET_PLATFORMS"

should_build_platform() {
  local requested="$1"

  for platform in "${REQUESTED_PLATFORMS[@]}"; do
    platform="${platform//[[:space:]]/}"
    if [[ "$platform" == "$requested" ]]; then
      return 0
    fi
  done

  return 1
}

validate_ios_signing() {
  local missing=()

  if [[ -z "$BUILD_PROVISION_PROFILE_NAME" ]]; then
    missing+=("BUILD_PROVISION_PROFILE_NAME")
  fi
  if [[ -z "$BUILD_PROVISION_PROFILE_TEAMID" ]]; then
    missing+=("BUILD_PROVISION_PROFILE_TEAMID")
  fi
  if [[ -z "$BUILD_PROVISION_PROFILE_IDENTITY" ]]; then
    missing+=("BUILD_PROVISION_PROFILE_IDENTITY")
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "iOS release IPA build requires signing environment variables:" >&2
    for name in "${missing[@]}"; do
      echo "  $name" >&2
    done
    echo "Local builds also require the certificate in Keychain and the provisioning profile installed." >&2
    echo "CI installs them from BUILD_CERTIFICATE_BASE64 and BUILD_PROVISION_PROFILE_BASE64 secrets." >&2
    exit 1
  fi

  if ! security find-identity -v -p codesigning 2>/dev/null | grep -Fq "$BUILD_PROVISION_PROFILE_IDENTITY"; then
    echo "No codesigning identity matching '$BUILD_PROVISION_PROFILE_IDENTITY' was found in Keychain." >&2
    echo "Run 'security find-identity -v -p codesigning' to inspect available identities." >&2
    exit 1
  fi
}

resolve_android_release_apk() {
  local candidates=(
    "$ANDROID_APK_DIR/agora-cocos-basic-call-release.apk"
    "$ANDROID_APK_DIR/agora-cocos-basic-call-release-unsigned.apk"
  )
  local candidate

  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  local discovered_apks=("${(@f)$(find "$ANDROID_APK_DIR" -maxdepth 1 -name '*.apk' -type f 2>/dev/null)}")
  if [[ ${#discovered_apks[@]} -eq 1 ]]; then
    echo "$discovered_apks[1]"
    return 0
  fi

  return 1
}

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

write_android_cocos_build_config() {
  if [[ ! -d "$ANDROID_SDK_ROOT/platform-tools" ]]; then
    echo "Android SDK is missing platform-tools under $ANDROID_SDK_ROOT." >&2
    echo "Set ANDROID_SDK_ROOT or install Android command-line tools before building Android." >&2
    exit 1
  fi

  ANDROID_NDK_HOME="$(resolve_android_ndk_path || true)"
  if [[ -z "$ANDROID_NDK_HOME" ]]; then
    echo "Android NDK was not found under $ANDROID_SDK_ROOT/ndk." >&2
    echo "Set ANDROID_NDK_HOME or install NDK 23.1.7779620 before building Android." >&2
    exit 1
  fi

  mkdir -p "$(dirname "$ANDROID_COCOS_BUILD_CONFIG")"
  ANDROID_BUILD_CONFIG="$ANDROID_BUILD_CONFIG" \
  ANDROID_COCOS_BUILD_CONFIG="$ANDROID_COCOS_BUILD_CONFIG" \
  ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT" \
  ANDROID_NDK_HOME="$ANDROID_NDK_HOME" \
  node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.env.ANDROID_BUILD_CONFIG;
const outputPath = process.env.ANDROID_COCOS_BUILD_CONFIG;
const config = JSON.parse(await readFile(sourcePath, 'utf8'));

config.packages ??= {};
config.packages.android ??= {};
config.packages.android.sdkPath = process.env.ANDROID_SDK_ROOT;
config.packages.android.ndkPath = process.env.ANDROID_NDK_HOME;

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
NODE
}

print_build_artifacts() {
  echo
  echo "=========================================="
  echo "Release packages:"
  if [[ -n "$BUILT_ANDROID_APK" ]]; then
    echo "  Android: $BUILT_ANDROID_APK"
  fi
  if [[ -n "$BUILT_IOS_IPA" ]]; then
    echo "  iOS:     $BUILT_IOS_IPA"
  fi
  echo "=========================================="
}

validate_requested_platforms() {
  local platform

  for platform in "${REQUESTED_PLATFORMS[@]}"; do
    platform="${platform//[[:space:]]/}"
    case "$platform" in
      android|ios)
        ;;
      '')
        ;;
      *)
        echo "unsupported platform: $platform. Supported platforms are android and ios." >&2
        exit 1
        ;;
    esac
  done
}

cd "$ROOT_DIR"

validate_requested_platforms

if [[ ! -x "$COCOS_CLI" ]]; then
  echo "Cocos Creator CLI not found at $COCOS_CLI" >&2
  echo "Set COCOS_CLI to the CocosCreator executable path if needed." >&2
  exit 1
fi

if [[ ! -f "$AGORA_CONFIG_PATH" ]]; then
  echo "Agora config file is missing: $AGORA_CONFIG_PATH" >&2
  exit 1
fi

if [[ -n "${APP_ID:-}${TEST_APP_ID:-}${CHANNEL_ID:-}${TEST_CHANNEL_ID:-}${TOKEN:-}${TEST_TOKEN:-}${TEST_UID:-}${AUTO_PREVIEW:-}${AUTO_JOIN:-}${PUBLISH_CAMERA_TRACK:-}${PUBLISH_MICROPHONE_TRACK:-}${AUTO_SUBSCRIBE_AUDIO:-}${AUTO_SUBSCRIBE_VIDEO:-}" ]]; then
  node ./scripts/write-example-build-config.mjs >/dev/null
fi

if [[ ! -f "$AGORA_BUILD_CONFIG_PATH" ]] && grep -Eq '<YOUR_AGORA_APP_ID>|<YOUR_CHANNEL_ID>' "$AGORA_CONFIG_PATH"; then
  echo "Please edit example/basic-call/assets/resources/agora-config.json before building packages." >&2
  echo "Alternatively pass APP_ID or TEST_APP_ID when running this script." >&2
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

if should_build_platform "android"; then
  echo "Building Android release APK..."
  if [[ ! -d "$LOCAL_AGORA_MAVEN_DIR" ]]; then
    node ./scripts/fetch-agora-maven.mjs >/dev/null
  fi
  write_android_cocos_build_config
  run_cocos_build "$ANDROID_COCOS_BUILD_CONFIG" "Android"
  node ./scripts/sync-native-engine-texture-bridge.mjs >/dev/null
  node ./scripts/sync-android-app-bridge.mjs >/dev/null

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
      ./gradlew --offline :agora-cocos-basic-call:assembleRelease
    else
      ./gradlew :agora-cocos-basic-call:assembleRelease
    fi
  )

  ANDROID_APK_PATH="$(resolve_android_release_apk || true)"
  if [[ -z "$ANDROID_APK_PATH" ]]; then
    echo "Android release APK was not produced under $ANDROID_APK_DIR" >&2
    exit 1
  fi
  BUILT_ANDROID_APK="$ANDROID_APK_PATH"
fi

if should_build_platform "ios"; then
  echo "Building iOS release IPA..."

  if [[ "$IOS_SKIP_COCOS_EXPORT" != "true" ]]; then
    run_cocos_build "$IOS_BUILD_CONFIG" "iOS"
  else
    echo "Skipping Cocos iOS export because IOS_SKIP_COCOS_EXPORT=true."
  fi
  node ./scripts/sync-native-engine-texture-bridge.mjs >/dev/null
  IOS_BUNDLE_ID="$IOS_BUNDLE_ID" \
  IOS_DEVELOPMENT_TEAM="$BUILD_PROVISION_PROFILE_TEAMID" \
  IOS_PROVISIONING_PROFILE_SPECIFIER="$BUILD_PROVISION_PROFILE_NAME" \
  IOS_CODE_SIGN_IDENTITY="$BUILD_PROVISION_PROFILE_IDENTITY" \
  ./scripts/integrate-ios-project.rb --with-package >/dev/null

  validate_ios_signing

  if [[ -d "$IOS_RUNTIME_PLUGIN_DIR" ]]; then
    mkdir -p "$IOS_EXPORTED_PLUGIN_DIR"
    cp -R "$IOS_RUNTIME_PLUGIN_DIR/." "$IOS_EXPORTED_PLUGIN_DIR/"
  fi

  mkdir -p "$IOS_DERIVED_DATA_PATH" "$IOS_EXPORT_PATH"
  cat > "$IOS_EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>$IOS_EXPORT_METHOD</string>
  <key>signingStyle</key>
  <string>manual</string>
  <key>teamID</key>
  <string>$BUILD_PROVISION_PROFILE_TEAMID</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>$IOS_BUNDLE_ID</key>
    <string>$BUILD_PROVISION_PROFILE_NAME</string>
  </dict>
</dict>
</plist>
PLIST

  rm -rf "$IOS_ARCHIVE_PATH" "$IOS_EXPORT_PATH"
  mkdir -p "$IOS_EXPORT_PATH"

  (
    cd "$IOS_PROJECT_DIR"
    xcodebuild -project "$IOS_PROJECT_PATH" \
      -scheme "$IOS_SCHEME_NAME" \
      -configuration Release \
      -sdk iphoneos \
      -destination generic/platform=iOS \
      -archivePath "$IOS_ARCHIVE_PATH" \
      PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID" \
      archive

    xcodebuild -exportArchive \
      -archivePath "$IOS_ARCHIVE_PATH" \
      -exportPath "$IOS_EXPORT_PATH" \
      -exportOptionsPlist "$IOS_EXPORT_OPTIONS_PLIST"
  )

  if [[ ! -f "$IOS_IPA_PATH" ]]; then
    exported_ipa_paths=("${(@f)$(find "$IOS_EXPORT_PATH" -maxdepth 1 -name '*.ipa' -type f)}")
    if [[ ${#exported_ipa_paths[@]} -eq 1 ]]; then
      mv "$exported_ipa_paths[1]" "$IOS_IPA_PATH"
    fi
  fi

  if [[ ! -f "$IOS_IPA_PATH" ]]; then
    echo "iOS release IPA was not produced at $IOS_IPA_PATH" >&2
    exit 1
  fi
  BUILT_IOS_IPA="$IOS_IPA_PATH"
fi

print_build_artifacts
