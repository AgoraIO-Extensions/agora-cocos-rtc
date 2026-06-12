# Customer Architecture Note

Updated: `2026-05-20`

## Purpose

This document explains the current `Agora Cocos RTC SDK` architecture, responsibilities, video rendering model, and implementation status for readers who are not familiar with Cocos.

For the delivery summary, see:

- [customer-delivery-note.md](customer-delivery-note.md)

For the full API list and verification boundary, see:

- [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md)
- [api-verification-matrix.md](api-verification-matrix.md)

## Architecture Summary

The project can be understood as three cooperating parts:

- **Cocos** owns the page, scene, buttons, status area, and final composition.
- **Agora RTC SDK** provides the real audio and video communication capability.
- **This SDK** connects Agora RTC to Cocos and exposes a unified JavaScript API for business code and the example project.

It does not embed an Agora app inside Cocos. Cocos controls the experience, and Agora provides the RTC engine.

## Layers

### 1. Example / UI Layer

File:

- [AgoraRtcExampleController.ts](../example/basic-call/assets/scripts/AgoraRtcExampleController.ts)

Responsibilities:

- provide the QA test panel
- render buttons, status, and logs
- show local and remote video regions
- call the JavaScript SDK API

This is the user-visible layer.

### 2. JavaScript SDK Layer

Files:

- [agora.ts](../sdk/agora-rtc/js/agora.ts)
- [types.ts](../sdk/agora-rtc/js/types.ts)
- [bridge.ts](../sdk/agora-rtc/js/internal/bridge.ts)

Responsibilities:

- expose the public API
- hide Android and iOS bridge differences
- normalize request, response, and event protocols
- manage timeouts, error codes, and event dispatch

This is the interface layer used by business scripts.

### 3. Platform Bridge Layer

Android:

- [AgoraRtcPlugin.java](../sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java)

iOS:

- [AgoraRtcBridge.swift](../sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift)

Responsibilities:

- receive JavaScript requests
- call native Agora RTC APIs
- send native events back to JavaScript
- manage local and remote video views or textures

This layer translates between JavaScript and the native Agora SDK.

### 4. Video Texture Bridge Layer

Common C++:

- `example/basic-call/native/engine/common/Classes/agora/AgoraEngineTextureBridge.cpp`

iOS ObjC++:

- `example/basic-call/native/engine/ios/agora-rtc/AgoraEngineTextureSlotBridge.mm`

Android raw frame backend:

- [RawFrameTextureRenderBackend.java](../sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java)

Responsibilities:

- create texture slots for local and remote video
- update native `Texture2D` resources
- provide the `slotId -> Texture2D` mapping
- let Cocos render local and remote video inside the scene

This layer turns video frames into Cocos textures.

### 5. Agora Native SDK

Android:

- `io.agora.rtc:full-sdk:4.5.3`

iOS:

- `AgoraRtcEngine_iOS 4.5.3`

Responsibilities:

- real RTC audio and video
- join, leave, events, encoding, capture, decoding, effects, and related native capabilities

This is the underlying RTC engine.

## Request Flow

A business script or the example calls the SDK through this path:

```text
Example / Business Script
-> AgoraRtcClient (TypeScript)
-> jsbBridgeWrapper
-> Android / iOS Bridge
-> Agora Native RTC SDK
-> Native Response / Native Event
-> JS Event / Promise Result
```

Example:

```text
joinChannel()
-> AgoraRtcClient.joinChannel(...)
-> agora:request
-> AgoraRtcPlugin.java / AgoraRtcBridge.swift
-> RtcEngine.joinChannel(...)
-> joinChannelSuccess / userJoined / rtcStats ...
-> agora:event
-> JavaScript listener
-> UI status update
```

## Video Rendering Paths

### Path A: Native View / Surface View

Characteristics:

- Video is displayed by native views.
- A native view is overlaid above the Cocos scene.

Common Android forms:

- `SurfaceView`
- `TextureView`

Common iOS form:

- `UIView + AgoraRtcVideoCanvas`

Benefits:

- direct implementation
- low integration cost with native Agora rendering

Tradeoffs:

- video is not drawn by Cocos itself
- composition behaves more like a native overlay

### Path B: Engine Texture

Characteristics:

- video frames enter native code first
- frames are converted into Cocos `Texture2D`
- Cocos attaches the texture to `SpriteFrame` / `Sprite`

With this path, video becomes a texture inside the Cocos scene instead of a native view over the scene.

Benefits:

- Cocos owns the final composition
- local and remote video can be laid out with Cocos UI
- better fit for games or scene-driven products

Tradeoffs:

- implementation is more complex
- native texture and Cocos renderer wiring must be maintained carefully

## Current Video Status

### Android

The main Android delivery path includes:

- local video display
- remote video display
- working `engine-texture`

Android is not limited to audio join validation; video can enter the Cocos texture system.

### iOS

The main iOS delivery path includes:

- local video display
- remote video display
- connected `engine-texture`

iOS is no longer only a `UIView` overlay placeholder. The architecture target is also to compose video inside the Cocos scene.

## Why the Example Looks Like a Test Bench

The example is not intended to be a final business UI. It is built to:

- cover the main APIs
- support QA and integration debugging
- switch backends and inspect status or events quickly

[AgoraRtcExampleController.ts](../example/basic-call/assets/scripts/AgoraRtcExampleController.ts) is an SDK capability validation console.

## Implemented API Scope

The SDK currently covers:

- Engine / Log
- Channel / Role
- Audio
- Video
- Native View / Render
- Mixing / Effect
- Parameters

For the full list, see:

- [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md)

## Platform Boundaries

### Android

These APIs intentionally return `unsupported`:

- `setDefaultAudioRouteToSpeakerphone`
- `setAudioSessionOperationRestriction`

### iOS

The primary delivery paths are:

- `surface-view`
- `engine-texture`

`texture-view` is not a standalone iOS delivery path.

### Shared

These capabilities are not part of the current public delivery focus:

- native `warning` callback
- `EnableVideoObserver`
- separate public `PreloadEngine / UnloadEngine` names

## Why This Can Enter Delivery

The current repository includes:

- unified JavaScript API
- Android and iOS native bridges
- Android and iOS local and remote video display
- reference example project
- export scripts
- automated tests
- platform validation flows

It is no longer only an integration prototype. It can be used for customer integration evaluation, internal QA, and project debugging.

## Recommended Reading Order

1. [customer-delivery-note.md](customer-delivery-note.md)
2. [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md)
3. [api-verification-matrix.md](api-verification-matrix.md)
4. [architecture.md](architecture.md)

## Summary

The core architecture is: Cocos owns the scene and UI, Agora owns RTC, and the JavaScript SDK plus native bridges connect the two.

The current delivery scope includes Android and iOS unified APIs, local and remote video display, a QA example, and the baseline integration and verification tooling.
