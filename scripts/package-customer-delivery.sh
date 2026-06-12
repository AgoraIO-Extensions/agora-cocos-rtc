#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUTPUT_DIR=${1:-"$ROOT_DIR/dist/customer-delivery"}
EXAMPLE_DIR="$OUTPUT_DIR/example-basic-call"
ENGINE_ROOT="$ROOT_DIR/example/basic-call/native/engine"

mkdir -p "$OUTPUT_DIR"

"$ROOT_DIR/scripts/package-sdk.sh" "$ROOT_DIR/dist" >/dev/null

cp "$ROOT_DIR/dist/agora-rtc-cocos-plugin.zip" "$OUTPUT_DIR/agora-rtc-cocos-plugin.zip"

engine_bootstrap_required=false
if [[ ! -f "$ENGINE_ROOT/android/res/values/strings.xml" ]]; then
  engine_bootstrap_required=true
fi
if [[ ! -f "$ENGINE_ROOT/common/CMakeLists.txt" ]]; then
  engine_bootstrap_required=true
fi
if [[ ! -f "$ENGINE_ROOT/ios/Info.plist" ]]; then
  engine_bootstrap_required=true
fi

if [[ "$engine_bootstrap_required" == true ]]; then
  mkdir -p "$ENGINE_ROOT/android/res/values"
  mkdir -p "$ENGINE_ROOT/common"
  mkdir -p "$ENGINE_ROOT/ios"

  if [[ ! -f "$ENGINE_ROOT/android/res/values/strings.xml" ]]; then
    cat > "$ENGINE_ROOT/android/res/values/strings.xml" <<'EOF'
<resources>
</resources>
EOF
  fi

  if [[ ! -f "$ENGINE_ROOT/common/CMakeLists.txt" ]]; then
    cat > "$ENGINE_ROOT/common/CMakeLists.txt" <<'EOF'
enable_language(C ASM)
set(DEVELOPMENT_TEAM    ""  CACHE STRING "APPLE Developtment Team")
set(RES_DIR             ""  CACHE STRING "Resource path")
set(COCOS_X_PATH        ""  CACHE STRING "Path to engine/native/")

set(TARGET_OSX_VERSION "10.14" CACHE STRING "Target MacOSX version" FORCE)
set(TARGET_IOS_VERSION "11.0"  CACHE STRING "Target iOS version" FORCE)

set(CMAKE_CXX_STANDARD 17)
option(CC_DEBUG_FORCE           "Force enable CC_DEBUG in release mode" OFF)
option(USE_SE_V8                "Use V8 JavaScript Engine"              ON)
option(USE_SE_JSVM              "Use JSVM JavaScript Engine"            OFF)
option(USE_SE_JSC               "Use JavaScriptCore on MacOSX/iOS"      OFF)
option(USE_V8_DEBUGGER          "Compile v8 inspector ws server"        ON)
option(USE_V8_DEBUGGER_FORCE    "Force enable debugger in release mode" OFF)
option(USE_SOCKET               "Enable WebSocket & SocketIO"           ON)
option(USE_AUDIO                "Enable Audio"                          ON)
option(USE_EDIT_BOX             "Enable EditBox"                        ON)
option(USE_VIDEO                "Enable VideoPlayer Component"          ON)
option(USE_WEBVIEW              "Enable WebView Component"              ON)
option(USE_MIDDLEWARE           "Enable Middleware"                     ON)
option(USE_DRAGONBONES          "Enable Dragonbones"                    ON)
option(USE_SPINE_3_8            "Enable Spine 3.8"                      ON)
option(USE_SPINE_4_2            "Enable Spine 4.2"                      OFF)
option(USE_WEBSOCKET_SERVER     "Enable WebSocket Server"               OFF)
option(USE_JOB_SYSTEM_TASKFLOW  "Use taskflow as job system backend"    OFF)
option(USE_JOB_SYSTEM_TBB       "Use tbb as job system backend"         OFF)
option(USE_PHYSICS_PHYSX        "Use PhysX Physics"                     ON)
option(USE_OCCLUSION_QUERY      "Use Occlusion Query"                   ON)
option(USE_DEBUG_RENDERER       "Use Debug Renderer"                    ON)
option(USE_GEOMETRY_RENDERER    "Use Geometry Renderer"                 ON)
option(USE_WEBP                 "Use Webp"                              ON)

if(NOT RES_DIR)
    message(FATAL_ERROR "RES_DIR is not set!")
endif()

include(${RES_DIR}/proj/cfg.cmake)

if(EXISTS ${CMAKE_CURRENT_LIST_DIR}/localCfg.cmake)
    include(${CMAKE_CURRENT_LIST_DIR}/localCfg.cmake)
endif()

if(NOT COCOS_X_PATH)
    message(FATAL_ERROR "COCOS_X_PATH is not set!")
endif()

if(USE_XR OR USE_AR_MODULE)
    include(${CMAKE_CURRENT_LIST_DIR}/xr.cmake)
endif()

include(${COCOS_X_PATH}/CMakeLists.txt)

list(APPEND CC_COMMON_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/Classes/Game.h
    ${CMAKE_CURRENT_LIST_DIR}/Classes/Game.cpp
)
EOF
  fi

  if [[ ! -f "$ENGINE_ROOT/ios/Info.plist" ]]; then
    cat > "$ENGINE_ROOT/ios/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>CFBundleDevelopmentRegion</key>
	<string>English</string>
	<key>CFBundleDisplayName</key>
	<string>${PRODUCT_NAME}</string>
	<key>CFBundleExecutable</key>
	<string>${CC_EXECUTABLE_NAME}</string>
	<key>CFBundleIcons~ipad</key>
	<dict/>
	<key>CFBundleIdentifier</key>
	<string>${MACOSX_BUNDLE_GUI_IDENTIFIER}</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>${PRODUCT_NAME}</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0.0</string>
	<key>CFBundleSignature</key>
	<string>????</string>
	<key>CFBundleVersion</key>
	<string>1.0</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
	<key>NSCameraUsageDescription</key>
	<string>Agora RTC needs camera access for local video preview and calls.</string>
	<key>NSMicrophoneUsageDescription</key>
	<string>Agora RTC needs microphone access for voice calls.</string>
	<key>UIPrerenderedIcon</key>
	<true/>
	<key>UIRequiredDeviceCapabilities</key>
	<dict>
		<key>accelerometer</key>
		<true/>
		<key>opengles-1</key>
		<true/>
	</dict>
	<key>UIRequiresFullScreen</key>
	<true/>
	<key>UIStatusBarHidden</key>
	<true/>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationLandscapeRight</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
	</array>
</dict>
</plist>
EOF
  fi

  node "$ROOT_DIR/scripts/sync-example-sdk-config.mjs" >/dev/null
fi

rm -rf "$EXAMPLE_DIR"
mkdir -p "$EXAMPLE_DIR"

cp -R "$ROOT_DIR/example/basic-call/.creator" "$EXAMPLE_DIR/"
cp "$ROOT_DIR/example/basic-call/.gitignore" "$EXAMPLE_DIR/.gitignore"
cp "$ROOT_DIR/example/basic-call/package.json" "$EXAMPLE_DIR/package.json"
cp "$ROOT_DIR/example/basic-call/tsconfig.json" "$EXAMPLE_DIR/tsconfig.json"
cp -R "$ROOT_DIR/example/basic-call/assets" "$EXAMPLE_DIR/"
cp -R "$ROOT_DIR/example/basic-call/build-configs" "$EXAMPLE_DIR/"
cp -R "$ROOT_DIR/example/basic-call/settings" "$EXAMPLE_DIR/"
cp -R "$ROOT_DIR/example/basic-call/native" "$EXAMPLE_DIR/"
cp "$ROOT_DIR/example/basic-call/README.md" "$EXAMPLE_DIR/README.md"
cp "$ROOT_DIR/example/basic-call/AGORA_RTC_SPM_SETUP.md" "$EXAMPLE_DIR/AGORA_RTC_SPM_SETUP.md" 2>/dev/null || true

rm -f "$EXAMPLE_DIR/assets/resources/agora-config.build.json"
rm -f "$EXAMPLE_DIR/assets/resources/agora-config.build.json.meta"
find "$OUTPUT_DIR" -name ".DS_Store" -delete

echo "Created customer delivery bundle at $OUTPUT_DIR"
