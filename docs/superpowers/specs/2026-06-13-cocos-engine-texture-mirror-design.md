# Cocos Engine-Texture Mirror Redesign

## Summary

Redesign the Cocos `engine-texture` mirror pipeline so that it matches Flutter `useFlutterTexture` semantics:

- native texture upload keeps raw frame orientation only
- mirror is applied in the SDK display layer, not in texture pixel conversion
- upper layers pass `mirrorMode` only; they do not implement mirror logic

This redesign targets the Agora Cocos SDK package, not the example app. The example remains only a consumer of SDK APIs.

## Context

The current `engine-texture` path mixes display semantics into native frame conversion:

- Android `RawFrameTextureRenderBackend` resolves `mirror`
- iOS `AgoraRtcBridge.swift` resolves `mirror`
- `AgoraEngineTextureSlotBridge` forwards that boolean
- `AgoraEngineTextureBridge.cpp` mirrors pixels while mapping rotated frame coordinates

That behavior differs from Flutter `useFlutterTexture`, where:

- native side only produces the texture
- mirror is handled in the view/display layer
- local and remote views decide display mirroring from their own `mirrorMode`

The current Cocos implementation also leaves final binding and display policy mostly in the example project, which is not acceptable for SDK delivery.

## Problem Statement

We need a single SDK-owned mirror model for `engine-texture` rendering that:

1. removes mirror from native texture pixel conversion
2. keeps mirror logic inside the SDK, not inside the example app
3. lets customers configure local and remote mirror behavior through SDK view setup APIs
4. matches Flutter texture behavior closely enough that mirror semantics remain intuitive across SDKs

## Requirement Baseline

### User-facing requirements

1. Mirror logic must be handled at the SDK layer.
2. Upper layers and example code should only pass values such as `mirrorMode`; they must not implement mirror behavior themselves.
3. `engine-texture` must behave like Flutter texture rendering: view-layer mirror, not texture-layer mirror.
4. Customers must have a supported SDK-level place to set mirror behavior.

### Accepted behavior baseline for this redesign

The request text contains a conflict:

- one sentence says rear camera remote view should be mirrored
- the explicit acceptance test says rear camera remote view must be non-mirrored

This redesign uses the explicit acceptance test as the source of truth:

- front camera local preview: mirrored
- front camera remote view on another device: non-mirrored
- rear camera local preview: non-mirrored
- rear camera remote view on another device: non-mirrored

This is also the only baseline that stays consistent with Flutter texture display mirroring and the rest of the stated acceptance checks.

## Root Cause

The native texture pipeline currently treats `mirrorMode` as frame-content transformation instead of display policy.

Consequences:

- texture pixels differ from Flutter texture semantics
- mirror logic is duplicated across Android and iOS native bridges
- example-side sprite binding becomes the practical display owner
- `auto` cannot be modeled cleanly because camera-facing state and view semantics are split across layers

## Approaches Considered

### Approach A: Keep native mirror, patch logic for `auto`

Rejected.

This preserves the wrong ownership boundary. Even if `auto` were fixed, mirroring would still live in texture conversion rather than display handling.

### Approach B: Move mirror to example sprite/node transforms

Rejected.

This would be easy to ship but violates the SDK delivery requirement. Customers would still need app-side mirror policy.

### Approach C: Add SDK-owned texture display controller and remove native mirror

Accepted.

This matches Flutter texture semantics most closely and gives the SDK a single owner for:

- mirror policy
- camera-facing state for local `auto`
- texture binding lifecycle
- local/remote display consistency

## Design Decision

Adopt Approach C.

The native layer will upload raw oriented frames only. A new SDK-owned JS display/controller layer will:

- track local and remote texture view state
- bind texture slots to Cocos display targets
- compute final display mirror from `mirrorMode`, local/remote identity, source type, and camera-facing state
- apply mirror through view/display transforms only

## Detailed Design

### 1. Native pipeline changes

Remove mirror application from:

- `sdk/agora-rtc/templates/common/Classes/agora/AgoraEngineTextureBridge.cpp`
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java`
- `sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.mm`
- `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`

Expected native behavior after redesign:

- rotation is still handled during texture upload as needed
- render mode and target texture sizing remain intact
- mirror is not used for pixel coordinate mapping or frame conversion

The native layer may still preserve `mirrorMode` in setup payloads if the JS display layer needs it as SDK-owned state, but native upload code must not transform pixels with it.

### 2. SDK-owned display/controller layer

Add a JS-side SDK abstraction for `engine-texture` display ownership in `sdk/agora-rtc/js`.

Responsibilities:

- own local and remote view registrations
- store `mirrorMode`, source type, render target, and identity for each view
- react to `localVideoTextureReady`, `remoteVideoTextureReady`, release events, and camera-switch state changes
- bind `Texture2D` to a `SpriteFrame` or equivalent display target
- apply mirror through display-layer transforms only

The example app should consume this abstraction rather than implementing its own mirror policy.

### 3. Mirror decision model

Mirror is computed in the SDK display layer.

#### Local view

- `mirrorMode = enabled`: mirrored
- `mirrorMode = disabled`: non-mirrored
- `mirrorMode = auto`:
  - front camera: mirrored
  - rear camera: non-mirrored

#### Remote view

- `mirrorMode = enabled`: mirrored
- `mirrorMode = disabled`: non-mirrored
- `mirrorMode = auto`: non-mirrored

#### Screen-like sources

For screen share and transcoded sources, auto must remain non-mirrored, following Flutter texture behavior and existing mirror safety expectations for readable content.

### 4. Camera-facing state

The SDK must own local camera-facing state for `auto`.

Minimum requirement:

- initialize local camera-facing state to primary camera default
- update that state on successful `switchCamera`
- use that state only for local display-mirror decisions

This state must not live in the example app.

### 5. Public SDK surface

The existing setup/update APIs remain the customer-facing mirror control points:

- `setupLocalVideoView`
- `updateLocalVideoView`
- `setupRemoteVideoView`
- `updateRemoteVideoView`

These APIs already carry `mirrorMode`. The redesign keeps that contract and moves behavior behind it into the SDK implementation.

If additional JS display binding helpers are needed, they must be introduced as SDK APIs or SDK-managed helpers rather than example-private logic.

### 6. Example app role after redesign

The example may still:

- provide layout rects
- provide display nodes or sprites
- pass `mirrorMode`
- call SDK setup/update/remove APIs

The example may not:

- infer front/rear auto behavior itself
- decide local or remote mirror semantics
- directly implement mirror transforms as the source of truth

### 7. Customer delivery impact

Because native templates are mirrored into runtime/customer-delivery assets, the redesign must update:

- SDK template sources
- runtime/native copies used by the repo
- customer-delivery mirrored assets if generated from these templates

Tests must continue to guard that mirrored artifacts stay in sync.

## Files Expected To Change

### Native templates and mirrored runtime copies

- `sdk/agora-rtc/templates/common/Classes/agora/AgoraEngineTextureBridge.cpp`
- `sdk/agora-rtc/templates/common/Classes/agora/AgoraEngineTextureBridge.h`
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java`
- `sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.mm`
- `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
- mirrored runtime/customer-delivery copies generated from the templates

### JS SDK layer

- `sdk/agora-rtc/js/agora.ts`
- `sdk/agora-rtc/js/types.ts`
- `sdk/agora-rtc/js/internal/bridge.ts`
- new SDK-owned texture display/controller modules under `sdk/agora-rtc/js/`

### Example consumer updates

- `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
- any example display panel files that must switch to SDK-owned binding behavior

These example edits are integration updates only. They must remove mirror ownership from the example rather than add new mirror policy there.

### Tests and docs

- `tests/agora-client.test.ts`
- `tests/native-templates.test.ts`
- `tests/example-scene.test.ts`
- `tests/cocos-device-test-shard.test.ts`
- any device-test or report-generation scripts needed for evidence capture

## Testing Strategy

### Unit and template tests

1. JS SDK tests for mirror decision rules:
   - local auto front => mirrored
   - local auto rear => non-mirrored
   - remote auto => non-mirrored
   - explicit enabled/disabled override auto

2. JS SDK tests for camera switch state updates:
   - initial local auto state
   - post-`switchCamera` auto flip

3. Native template tests proving mirror is no longer applied during texture upload:
   - no pixel-coordinate mirror mapping in common bridge conversion path
   - no native upload path forwarding mirror as a content transform control

4. Example tests proving example no longer owns mirror policy:
   - example passes `mirrorMode`
   - example uses SDK binding/controller behavior
   - example does not implement mirror transforms as policy

### Device verification

Required scenarios:

1. Android front camera local preview is mirrored.
2. iOS or second Android remote view of that Android front-camera stream is non-mirrored.
3. Android rear camera local preview is non-mirrored.
4. iOS or second Android remote view of that Android rear-camera stream is non-mirrored.

Evidence required:

- screenshots for each scenario
- a written test report stored in the repo

If Android+iOS interoperability is hard to complete in the current environment, dual-Android evidence is acceptable only if it proves the same remote-display behavior.

## Non-goals

- changing Agora encoded stream mirror semantics outside this texture display redesign
- redesigning non-`engine-texture` backends
- introducing customer-side manual mirror workarounds

## Risks

1. The current SDK may not yet have a first-class JS display abstraction for texture binding.
   - Mitigation: add one in the SDK rather than expanding example ownership.

2. Runtime and customer-delivery copies may drift from templates.
   - Mitigation: keep template-sync tests strict and update mirrored assets together.

3. Rear-camera remote mirror expectation in one sentence of the original request conflicts with the explicit acceptance steps.
   - Mitigation: this design locks acceptance to the explicit cross-device test steps documented above.

## Acceptance Criteria

The work is complete only when all of the following are true:

1. Native `engine-texture` upload paths no longer mirror pixel content.
2. SDK JS display layer owns mirror behavior.
3. Example code no longer owns mirror policy.
4. Customers can continue to set mirror behavior through SDK setup/update view APIs.
5. Local auto mirror behaves as front mirrored / rear non-mirrored.
6. Remote auto mirror behaves as non-mirrored.
7. Android front-camera local vs remote behavior is verified with screenshots.
8. Android rear-camera local vs remote behavior is verified with screenshots.
9. A written test report with screenshot evidence is added to the repo.
