#!/usr/bin/env zsh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
SDK_DIR="$ROOT_DIR/sdk/agora-rtc"
TARGET_LINK="$ROOT_DIR/example/basic-call/extensions/agora-rtc"
NATIVE_PLUGIN_DIR="$ROOT_DIR/example/basic-call/native/agora-rtc"
SCENE_DIR="$ROOT_DIR/example/basic-call/assets/scene"
SCRIPTS_DIR="$ROOT_DIR/example/basic-call/assets/scripts"
RESOURCES_DIR="$ROOT_DIR/example/basic-call/assets/resources"
PREFABS_DIR="$ROOT_DIR/example/basic-call/assets/prefabs"

mkdir -p "$(dirname "$TARGET_LINK")"
mkdir -p "$NATIVE_PLUGIN_DIR"
mkdir -p "$SCENE_DIR"
mkdir -p "$SCRIPTS_DIR"
mkdir -p "$RESOURCES_DIR"
mkdir -p "$PREFABS_DIR"
mkdir -p "$SCRIPTS_DIR/demo/panels"
mkdir -p "$SCRIPTS_DIR/demo/ui"

node "$ROOT_DIR/scripts/sync-sdk-version.mjs" >/dev/null

if [ -d "$TARGET_LINK" ] && [ ! -L "$TARGET_LINK" ]; then
  rm -rf "$TARGET_LINK"
fi
ln -sfn "../../../sdk/agora-rtc" "$TARGET_LINK"
cp "$ROOT_DIR/sdk/agora-rtc/cc_plugin.json" "$NATIVE_PLUGIN_DIR/cc_plugin.json"
node "$ROOT_DIR/scripts/sync-customer-delivery-templates.mjs"
node "$ROOT_DIR/scripts/sync-native-engine-texture-bridge.mjs"
node "$ROOT_DIR/scripts/sync-ios-demo-permissions-bridge.mjs"
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

write_prefab_meta() {
  local target_file="$1"
  local uuid="$2"
  local sync_node_name="$3"
  if [ -f "${target_file}.meta" ]; then
    return
  fi
  cat > "${target_file}.meta" <<EOF
{
  "ver": "1.1.50",
  "importer": "prefab",
  "imported": true,
  "uuid": "${uuid}",
  "files": [
    ".json"
  ],
  "subMetas": {},
  "userData": {
    "syncNodeName": "${sync_node_name}"
  }
}
EOF
}

if [ ! -f "$SCENE_DIR/main.scene" ]; then
cat > "$SCENE_DIR/main.scene" <<'EOF'
[
  {
    "__type__": "cc.SceneAsset",
    "_name": "main",
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
        "__id__": 7
      }
    ],
    "_active": true,
    "_components": [],
    "_prefab": {
      "__id__": 13
    },
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
    "_children": [
      {
        "__id__": 14
      }
    ],
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
      "width": 960,
      "height": 640
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
      "__id__": 6
    },
    "_alignCanvasWithScreen": true,
    "_id": "e26NYcYBlLWqXkVxoUl3Cx"
  },
  {
    "__type__": "cc.Camera",
    "_name": "Main Camera<Camera>",
    "_objFlags": 0,
    "node": {
      "__id__": 7
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
        "__id__": 6
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
      "__type__": "cc.Vec4",
      "x": 0.2,
      "y": 0.5019607843137255,
      "z": 0.8,
      "w": 0.520833125
    },
    "_skyIllum": 20000,
    "_groundAlbedo": {
      "__type__": "cc.Vec4",
      "x": 0.2,
      "y": 0.2,
      "z": 0.2,
      "w": 1
    },
    "_skyColorLDR": {
      "__type__": "cc.Vec4",
      "x": 0.2,
      "y": 0.5019607843137255,
      "z": 0.8,
      "w": 0.520833125
    },
    "_skyColorHDR": {
      "__type__": "cc.Vec4",
      "x": 0.2,
      "y": 0.5019607843137255,
      "z": 0.8,
      "w": 0.520833125
    },
    "_groundAlbedoLDR": {
      "__type__": "cc.Vec4",
      "x": 0.2,
      "y": 0.2,
      "z": 0.2,
      "w": 1
    },
    "_groundAlbedoHDR": {
      "__type__": "cc.Vec4",
      "x": 0.2,
      "y": 0.2,
      "z": 0.2,
      "w": 1
    },
    "_skyIllumLDR": 0.78125,
    "_skyIllumHDR": 20000
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
    "_enabled": false,
    "_useHDR": true,
    "_envmapLDR": null,
    "_envmapHDR": null,
    "_diffuseMapLDR": null,
    "_diffuseMapHDR": null,
    "_envLightingType": 0
  },
  {
    "__type__": "cc.FogInfo",
    "_type": 0,
    "_fogColor": {
      "__type__": "cc.Color",
      "r": 225,
      "g": 225,
      "b": 225,
      "a": 255
    },
    "_enabled": false,
    "_fogDensity": 0.3,
    "_fogStart": 0.5,
    "_fogEnd": 300,
    "_fogAtten": 5,
    "_fogTop": 1.5,
    "_fogRange": 1.2,
    "_accurate": false
  },
  {
    "__type__": "cc.PrefabInfo",
    "fileId": "fc1b7f53-7712-4b8c-bd75-c3f7ec540001"
  },
  {
    "__type__": "cc.Node",
    "_name": "DemoRoot",
    "_objFlags": 0,
    "_parent": {
      "__id__": 2
    },
    "_children": [
      {
        "__id__": 18
      },
      {
        "__id__": 21
      },
      {
        "__id__": 24
      },
      {
        "__id__": 27
      }
    ],
    "_active": true,
    "_components": [
      {
        "__id__": 15
      },
      {
        "__id__": 16
      },
      {
        "__id__": 17
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "demo-root-node-000000000001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 14
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 960,
      "height": 640
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "demo-root-ui-00000000000001"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 14
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
    "_id": "demo-root-widget-000000001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAED",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 14
    },
    "_enabled": true,
    "__prefab": null,
    "headerPanel": {
      "__id__": 20
    },
    "actionPanel": {
      "__id__": 23
    },
    "videoStagePanel": {
      "__id__": 26
    },
    "logPanel": {
      "__id__": 29
    },
    "rtcSessionServiceUuid": "6f0fce55-1000-42b8-8b7b-1aaf80000102",
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000103"
  },
  {
    "__type__": "cc.Node",
    "_name": "HeaderPanel",
    "_objFlags": 0,
    "_parent": {
      "__id__": 14
    },
    "_children": [],
    "_active": false,
    "_components": [
      {
        "__id__": 19
      },
      {
        "__id__": 20
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": -270,
      "y": 250,
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
    "_id": "header-panel-node-00000001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 18
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 680,
      "height": 260
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "header-panel-ui-0000000001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEE",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 18
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000104"
  },
  {
    "__type__": "cc.Node",
    "_name": "ActionPanel",
    "_objFlags": 0,
    "_parent": {
      "__id__": 14
    },
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 22
      },
      {
        "__id__": 23
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": -270,
      "y": -40,
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
    "_id": "action-panel-node-00000001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 21
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 420,
      "height": 620
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "action-panel-ui-0000000001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEF",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 21
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000105"
  },
  {
    "__type__": "cc.Node",
    "_name": "VideoStagePanel",
    "_objFlags": 0,
    "_parent": {
      "__id__": 14
    },
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 25
      },
      {
        "__id__": 26
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 140,
      "y": -20,
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
    "_id": "video-stage-node-000000001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 24
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 820,
      "height": 620
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "video-stage-ui-0000000001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEG",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 24
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000106"
  },
  {
    "__type__": "cc.Node",
    "_name": "LogPanel",
    "_objFlags": 0,
    "_parent": {
      "__id__": 14
    },
    "_children": [],
    "_active": false,
    "_components": [
      {
        "__id__": 28
      },
      {
        "__id__": 29
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "log-panel-node-0000000001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 27
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 960,
      "height": 640
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "log-panel-ui-00000000001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEH",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 27
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000107"
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

if [ ! -f "$PREFABS_DIR/DemoRoot.prefab" ]; then
cat > "$PREFABS_DIR/DemoRoot.prefab" <<'EOF'
[
  {
    "__type__": "cc.Prefab",
    "_name": "DemoRoot",
    "_objFlags": 0,
    "_native": "",
    "data": {
      "__id__": 1
    },
    "optimizationPolicy": 0,
    "persistent": false,
    "asyncLoadAssets": false,
    "readonly": false
  },
  {
    "__type__": "cc.Node",
    "_name": "DemoRoot",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 2
      },
      {
        "__id__": 3
      },
      {
        "__id__": 4
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "demoroot-prefab-node-001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 960,
      "height": 640
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "demoroot-prefab-ui-001"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
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
    "_id": "demoroot-prefab-widget-001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAED",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000103"
  }
]
EOF
fi
write_prefab_meta "$PREFABS_DIR/DemoRoot.prefab" "7f0fce55-1000-42b8-8b7b-1aaf80000200" "DemoRoot"

if [ ! -f "$PREFABS_DIR/HeaderPanel.prefab" ]; then
cat > "$PREFABS_DIR/HeaderPanel.prefab" <<'EOF'
[
  {
    "__type__": "cc.Prefab",
    "_name": "HeaderPanel",
    "_objFlags": 0,
    "_native": "",
    "data": {
      "__id__": 1
    },
    "optimizationPolicy": 0,
    "persistent": false,
    "asyncLoadAssets": false,
    "readonly": false
  },
  {
    "__type__": "cc.Node",
    "_name": "HeaderPanel",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 2
      },
      {
        "__id__": 3
      },
      {
        "__id__": 4
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "headerpanel-prefab-node-001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 360,
      "height": 240
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "headerpanel-prefab-ui-001"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
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
    "_id": "headerpanel-prefab-widget-001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEE",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000104"
  }
]
EOF
fi
write_prefab_meta "$PREFABS_DIR/HeaderPanel.prefab" "7f0fce55-1000-42b8-8b7b-1aaf80000201" "HeaderPanel"

if [ ! -f "$PREFABS_DIR/ActionPanel.prefab" ]; then
cat > "$PREFABS_DIR/ActionPanel.prefab" <<'EOF'
[
  {
    "__type__": "cc.Prefab",
    "_name": "ActionPanel",
    "_objFlags": 0,
    "_native": "",
    "data": {
      "__id__": 1
    },
    "optimizationPolicy": 0,
    "persistent": false,
    "asyncLoadAssets": false,
    "readonly": false
  },
  {
    "__type__": "cc.Node",
    "_name": "ActionPanel",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 2
      },
      {
        "__id__": 3
      },
      {
        "__id__": 4
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "actionpanel-prefab-node-001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 420,
      "height": 620
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "actionpanel-prefab-ui-001"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
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
    "_id": "actionpanel-prefab-widget-001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEF",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000105"
  }
]
EOF
fi
write_prefab_meta "$PREFABS_DIR/ActionPanel.prefab" "7f0fce55-1000-42b8-8b7b-1aaf80000202" "ActionPanel"

if [ ! -f "$PREFABS_DIR/VideoStagePanel.prefab" ]; then
cat > "$PREFABS_DIR/VideoStagePanel.prefab" <<'EOF'
[
  {
    "__type__": "cc.Prefab",
    "_name": "VideoStagePanel",
    "_objFlags": 0,
    "_native": "",
    "data": {
      "__id__": 1
    },
    "optimizationPolicy": 0,
    "persistent": false,
    "asyncLoadAssets": false,
    "readonly": false
  },
  {
    "__type__": "cc.Node",
    "_name": "VideoStagePanel",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 2
      },
      {
        "__id__": 3
      },
      {
        "__id__": 4
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "videostagepanel-prefab-node-001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 820,
      "height": 620
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "videostagepanel-prefab-ui-001"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
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
    "_id": "videostagepanel-prefab-widget-001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEG",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000106"
  }
]
EOF
fi
write_prefab_meta "$PREFABS_DIR/VideoStagePanel.prefab" "7f0fce55-1000-42b8-8b7b-1aaf80000203" "VideoStagePanel"

if [ ! -f "$PREFABS_DIR/LogPanel.prefab" ]; then
cat > "$PREFABS_DIR/LogPanel.prefab" <<'EOF'
[
  {
    "__type__": "cc.Prefab",
    "_name": "LogPanel",
    "_objFlags": 0,
    "_native": "",
    "data": {
      "__id__": 1
    },
    "optimizationPolicy": 0,
    "persistent": false,
    "asyncLoadAssets": false,
    "readonly": false
  },
  {
    "__type__": "cc.Node",
    "_name": "LogPanel",
    "_objFlags": 0,
    "_parent": null,
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 2
      },
      {
        "__id__": 3
      },
      {
        "__id__": 4
      }
    ],
    "_prefab": null,
    "_lpos": {
      "__type__": "cc.Vec3",
      "x": 0,
      "y": 0,
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
    "_id": "logpanel-prefab-node-001"
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 360,
      "height": 240
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_id": "logpanel-prefab-ui-001"
  },
  {
    "__type__": "cc.Widget",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
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
    "_id": "logpanel-prefab-widget-001"
  },
  {
    "__type__": "6f0fc5VEABCuIt7Gq+AAAEH",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 1
    },
    "_enabled": true,
    "__prefab": null,
    "_id": "6f0fce55-1000-42b8-8b7b-1aaf80000107"
  }
]
EOF
fi
write_prefab_meta "$PREFABS_DIR/LogPanel.prefab" "7f0fce55-1000-42b8-8b7b-1aaf80000204" "LogPanel"

write_directory_meta "$SCENE_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200001"
write_directory_meta "$SCRIPTS_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200002"
write_directory_meta "$RESOURCES_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200005"
write_directory_meta "$SCRIPTS_DIR/demo" "2eae89cb-6f8e-4615-ac44-0012f1200100"
write_directory_meta "$SCRIPTS_DIR/demo/panels" "2eae89cb-6f8e-4615-ac44-0012f1200101"
write_directory_meta "$SCRIPTS_DIR/demo/ui" "2eae89cb-6f8e-4615-ac44-0012f1200102"
write_directory_meta "$PREFABS_DIR" "2eae89cb-6f8e-4615-ac44-0012f1200200"

write_typescript_meta "$ROOT_DIR/example/basic-call/assets/scripts/AgoraRtcExampleController.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000001"
write_typescript_meta "$ROOT_DIR/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000005"
write_typescript_meta "$ROOT_DIR/example/basic-call/assets/scripts/agoraRtcConfigOverride.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000006"
write_typescript_meta "$SCRIPTS_DIR/demo/actions.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000100"
write_typescript_meta "$SCRIPTS_DIR/demo/types.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000101"
write_typescript_meta "$SCRIPTS_DIR/demo/RtcSessionService.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000102"
write_typescript_meta "$SCRIPTS_DIR/demo/AgoraRtcDemoRoot.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000103"
write_typescript_meta "$SCRIPTS_DIR/demo/panels/DemoHeaderPanel.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000104"
write_typescript_meta "$SCRIPTS_DIR/demo/panels/DemoActionPanel.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000105"
write_typescript_meta "$SCRIPTS_DIR/demo/panels/VideoStagePanel.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000106"
write_typescript_meta "$SCRIPTS_DIR/demo/panels/LogPanel.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000107"
write_typescript_meta "$SCRIPTS_DIR/demo/ui/uiStyles.ts" \
  "6f0fce55-1000-42b8-8b7b-1aaf80000108"

echo "Linked $SDK_DIR -> $TARGET_LINK"
