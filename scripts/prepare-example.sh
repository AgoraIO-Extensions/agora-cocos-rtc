#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SDK_DIR="$ROOT_DIR/sdk/agora-rtc"
TARGET_LINK="$ROOT_DIR/example/basic-call/extensions/agora-rtc"
RUNTIME_SDK_DIR="$ROOT_DIR/example/basic-call/assets/agora-rtc-sdk"
NATIVE_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc"
SCENE_DIR="$ROOT_DIR/example/basic-call/assets/scene"
SCRIPTS_DIR="$ROOT_DIR/example/basic-call/assets/scripts"
RESOURCES_DIR="$ROOT_DIR/example/basic-call/assets/resources"

mkdir -p "$(dirname "$TARGET_LINK")"
mkdir -p "$RUNTIME_SDK_DIR"
mkdir -p "$NATIVE_PLUGIN_DIR"
mkdir -p "$SCENE_DIR"
mkdir -p "$SCRIPTS_DIR"
mkdir -p "$RESOURCES_DIR"

node "$ROOT_DIR/scripts/sync-sdk-version.mjs" >/dev/null

ln -sfn "../../../sdk/agora-rtc" "$TARGET_LINK"
cp "$ROOT_DIR/sdk/agora-rtc/js/agora.ts" "$RUNTIME_SDK_DIR/agora.ts"
cp "$ROOT_DIR/sdk/agora-rtc/js/types.ts" "$RUNTIME_SDK_DIR/types.ts"
mkdir -p "$RUNTIME_SDK_DIR/internal"
cp "$ROOT_DIR/sdk/agora-rtc/js/internal/bridge.ts" "$RUNTIME_SDK_DIR/internal/bridge.ts"
cp "$ROOT_DIR/sdk/agora-rtc/cc_plugin.json" "$NATIVE_PLUGIN_DIR/cc_plugin.json"
mkdir -p "$NATIVE_PLUGIN_DIR/android/src/main/java/io/agora/cocos/rtc"
mkdir -p "$NATIVE_PLUGIN_DIR/ios"
cp -R "$ROOT_DIR/sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/." \
  "$NATIVE_PLUGIN_DIR/android/src/main/java/io/agora/cocos/rtc/"
cp "$ROOT_DIR/sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift" \
  "$NATIVE_PLUGIN_DIR/ios/AgoraRtcBridge.swift"
cp "$ROOT_DIR/sdk/agora-rtc/templates/ios/AgoraRtcPlugin.mm" \
  "$NATIVE_PLUGIN_DIR/ios/AgoraRtcPlugin.mm"
cp "$ROOT_DIR/sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.h" \
  "$NATIVE_PLUGIN_DIR/ios/AgoraEngineTextureSlotBridge.h"
cp "$ROOT_DIR/sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.mm" \
  "$NATIVE_PLUGIN_DIR/ios/AgoraEngineTextureSlotBridge.mm"
node "$ROOT_DIR/scripts/sync-native-engine-texture-bridge.mjs"
node "$ROOT_DIR/scripts/sync-android-app-bridge.mjs"
node "$ROOT_DIR/scripts/sync-example-sdk-config.mjs"

write_directory_meta() {
  local target_dir="$1"
  local uuid="$2"
  if [ -f "${target_dir}.meta" ]; then
    return
  fi
  cat > "${target_dir}.meta" <<EOF
{
  "ver": "1.1.0",
  "importer": "directory",
  "imported": true,
  "uuid": "${uuid}",
  "files": [],
  "subMetas": {},
  "userData": {
    "compressionType": {},
    "isRemoteBundle": {}
  }
}
EOF
}

write_typescript_meta() {
  local target_file="$1"
  local uuid="$2"
  if [ -f "${target_file}.meta" ]; then
    return
  fi
  cat > "${target_file}.meta" <<EOF
{
  "ver": "4.0.23",
  "importer": "typescript",
  "imported": true,
  "uuid": "${uuid}",
  "files": [],
  "subMetas": {},
  "userData": {
    "simulateGlobals": []
  }
}
EOF
}

if [ ! -f "$SCENE_DIR/main.scene" ]; then
cat > "$SCENE_DIR/main.scene" <<'EOF'
[
  {
    "__type__": "cc.SceneAsset",
    "_name": "",
    "_objFlags": 0,
    "_native": "",
    "scene": {
      "__id__": 1
    },
    "asyncLoadAssets": false
  },
  {
    "__type__": "cc.Scene",
    "_name": "main",
    "_objFlags": 0,
    "_parent": null,
    "_children": [
      {
        "__id__": 2
      },
      {
        "__id__": 6
      }
    ],
    "_active": true,
    "_components": [],
    "_prefab": null,
    "autoReleaseAssets": false,
    "_globals": {
      "__id__": 8
    },
    "_id": "fc1b7f53-7712-4b8c-bd75-c3f7ec540001"
  },
  {
    "__type__": "cc.Node",
    "_name": "Canvas",
    "_objFlags": 0,
    "_parent": {
      "__id__": 1
    },
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 3
      },
      {
        "__id__": 4
      },
      {
        "__id__": 5
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 360,
      "y": 640,
      "z": 0
    },
    "_lrot": {
      "__type__": "cc.Quat",
      "x": 0,
      "y": 0,
      "z": 0,
      "w": 1
    },
    "_lscale": {
      "__type__": "cc.Vec3",
      "x": 1,
      "y": 1,
      "z": 1
    },
    "_layer": 33554432,
    "_euler": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
      "z": 0
    },
    "_id": "0a0cb6de-12db-4d1f-a18a-ae0c68f12001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "Canvas<UITransform>",
    "_objFlags": 0,
    "node": {
      "__id__": 2
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 720,
      "height": 1280
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "612GBCz0BBJbBUIIcp2JC1"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 2
    },
    "_enabled": true,
    "__prefab": null,
    "_alignFlags": 45,
    "_target": null,
    "_left": 0,
    "_right": 0,
    "_top": 0,
    "_bottom": 0,
    "_horizontalCenter": 0,
    "_verticalCenter": 0,
    "_isAbsLeft": true,
    "_isAbsRight": true,
    "_isAbsTop": true,
    "_isAbsBottom": true,
    "_isAbsHorizontalCenter": true,
    "_isAbsVerticalCenter": true,
    "_originalWidth": 0,
    "_originalHeight": 0,
    "_alignMode": 2,
    "_lockFlags": 0,
    "_id": "15X6rIUw5OH4TgF5X8prqX"
  },
  {
    "__type__": "cc.Canvas",
    "_name": "Canvas<Canvas>",
    "_objFlags": 0,
    "node": {
      "__id__": 2
    },
    "_enabled": true,
    "__prefab": null,
    "_cameraComponent": {
      "__id__": 7
    },
    "_alignCanvasWithScreen": true,
    "_id": "e26NYcYBlLWqXkVxoUl3Cx"
  },
  {
    "__type__": "cc.Node",
    "_name": "Main Camera",
    "_objFlags": 0,
    "_parent": {
      "__id__": 1
    },
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 7
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
      "z": 1000
    },
    "_lrot": {
      "__type__": "cc.Quat",
      "x": 0,
      "y": 0,
      "z": 0,
      "w": 1
    },
    "_lscale": {
      "__type__": "cc.Vec3",
      "x": 1,
      "y": 1,
      "z": 1
    },
    "_layer": 1073741824,
    "_euler": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
      "z": 0
    },
    "_id": "1f5e0670-14b7-40ec-b6a7-4d845c180001"
  },
  {
    "__type__": "cc.Camera",
    "_name": "Main Camera<Camera>",
    "_objFlags": 0,
    "node": {
      "__id__": 6
    },
    "_enabled": true,
    "__prefab": null,
    "_projection": 0,
    "_priority": 0,
    "_fov": 45,
    "_fovAxis": 0,
    "_orthoHeight": 640,
    "_near": 1,
    "_far": 2000,
    "_color": {
      "__type__": "cc.Color",
      "r": 51,
      "g": 51,
      "b": 51,
      "a": 255
    },
    "_depth": 1,
    "_stencil": 0,
    "_clearFlags": 14,
    "_rect": {
      "__type__": "cc.Rect",
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "_aperture": 19,
    "_shutter": 7,
    "_iso": 0,
    "_screenScale": 1,
    "_visibility": 1853882369,
    "_targetTexture": null,
    "_id": "7dWQTpwS5LrIHnc1zAPUag"
  },
  {
    "__type__": "cc.SceneGlobals",
    "ambient": {
      "__id__": 9
    },
    "shadows": {
      "__id__": 10
    },
    "_skybox": {
      "__id__": 11
    },
    "fog": {
      "__id__": 12
    }
  },
  {
    "__type__": "cc.AmbientInfo",
    "_skyColor": {
      "__type__": "cc.Color",
      "r": 51,
      "g": 128,
      "b": 204,
      "a": 1
    },
    "_skyIllum": 20000,
    "_groundAlbedo": {
      "__type__": "cc.Color",
      "r": 51,
      "g": 51,
      "b": 51,
      "a": 255
    }
  },
  {
    "__type__": "cc.ShadowsInfo",
    "_type": 0,
    "_enabled": false,
    "_normal": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 1,
      "z": 0
    },
    "_distance": 1,
    "_shadowColor": {
      "__type__": "cc.Color",
      "r": 0,
      "g": 0,
      "b": 0,
      "a": 115
    },
    "_autoAdapt": true,
    "_pcf": 2,
    "_bias": 0.000001,
    "_near": 0.1,
    "_far": 50,
    "_aspect": 1,
    "_shadowDistance": 10,
    "_invisibleOcclusionRange": 200,
    "_orthoSize": 10,
    "_maxReceived": 4,
    "_size": {
      "__type__": "cc.Vec2",
      "x": 512,
      "y": 512
    }
  },
  {
    "__type__": "cc.SkyboxInfo",
    "_envmap": null,
    "_isRGBE": false,
    "_enabled": false,
    "_useIBL": false
  },
  {
    "__type__": "cc.FogInfo",
    "_type": 0,
    "_fogColor": {
      "__type__": "cc.Color",
      "r": 200,
      "g": 200,
      "b": 200,
      "a": 255
    },
    "_enabled": false,
    "_fogDensity": 0.3,
    "_fogStart": 0.5,
    "_fogEnd": 300,
    "_fogAtten": 5,
    "_fogTop": 1.5,
    "_fogRange": 1.2
  },
  }
]
EOF
fi

if [ ! -f "$SCENE_DIR/main.scene.meta" ]; then
cat > "$SCENE_DIR/main.scene.meta" <<'EOF'
{
  "ver": "1.1.27",
  "importer": "scene",
  "imported": true,
  "uuid": "fc1b7f53-7712-4b8c-bd75-c3f7ec540001",
  "files": [
    ".json"
  ],
  "subMetas": {},
  "userData": {}
}
EOF
fi

write_directory_meta "$SCENE_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200001"
write_directory_meta "$SCRIPTS_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200002"
write_directory_meta "$RUNTIME_SDK_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200003"
write_directory_meta "$RUNTIME_SDK_DIR/internal" "2eae89cb-6f8e-4615-ac44-0012f1200004"
write_directory_meta "$RESOURCES_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200005"

write_typescript_meta "$ROOT_DIR/example/basic-call/assets/scripts/AgoraRtcExampleController.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000001"
write_typescript_meta "$ROOT_DIR/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000005"
write_typescript_meta "$ROOT_DIR/example/basic-call/assets/scripts/agoraRtcConfigOverride.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000006"
write_typescript_meta "$RUNTIME_SDK_DIR/agora.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000002"
write_typescript_meta "$RUNTIME_SDK_DIR/types.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000003"
write_typescript_meta "$RUNTIME_SDK_DIR/internal/bridge.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000004"

echo "Linked $SDK_DIR -> $TARGET_LINK"
