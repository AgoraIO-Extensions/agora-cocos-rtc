# Flutter-Aligned Cocos RTC Example Cases Design

## Context

The current Cocos `example/basic-call` demo is a single prefab-backed control surface. It already exposes many RTC actions through `RtcSessionService`, `DemoActionPanel`, `VideoStagePanel`, and `LogPanel`, and the device API test shard already covers every method in the current `AgoraMethod` union.

The Flutter SDK example under `example/lib` uses a list-driven case model. Its root page combines `basic` and `advanced` registries, renders section rows such as `Basic` and `Advanced`, and opens one page per case. This design adapts that shape to Cocos while staying limited to cases that can be implemented with the current Cocos SDK surface plus the minimum missing APIs needed by Flutter `AudioEffectMixing`.

## Goals

- Add a Flutter-style case list entry point to `example/basic-call`.
- Include only Flutter case names that are currently practical for this Cocos SDK phase.
- Implement the first case set as user-facing examples, not as a raw API test matrix.
- Reuse the existing Cocos demo services and panels where possible.
- Add only the missing SDK API and event surface required by `AudioEffectMixing`.
- Keep the current scene/prefab and package shape compatible with existing tests and scripts.

## Non-Goals

- Do not implement every Flutter example case.
- Do not add placeholder pages for unsupported cases.
- Do not implement unrelated Agora native APIs outside the approved `AudioEffectMixing` scope.
- Do not duplicate RTC client lifecycle code in every case.
- Do not commit real Agora credentials.
- Do not require device integration tests to run as part of local doc or unit verification.

## Flutter-Aligned Case Scope

The first Cocos case list includes these exact Flutter case names.

Basic:

- `JoinChannelAudio`
- `JoinChannelVideo`

Advanced:

- `AudioEffectMixing`
- `SetVideoEncoderConfiguration`
- `SetBeautyEffect`
- `SetContentInspect`

These are intentionally excluded for this phase because the current Cocos public API does not support the underlying feature set:

- `StringUid`
- `FlutterTextureAndroidTest`
- `ChannelMediaRelay`
- `DeviceManager`
- `JoinMultipleChannel`
- `RtmpStreaming`
- `ScreenSharing`
- `SetEncryption`
- `StreamMessage`
- `VoiceChanger`
- `EnableVirtualBackground`
- `MediaPlayer`
- `SendMultiVideoStream`
- `TakeSnapshot`
- `StartDirectCDNStreaming`
- `SendMetadata`
- `AdvancedBeauty`
- `SendMultiCameraStream`
- `StartRhythmPlayer`
- `StartLocalVideoTranscoder`
- `ProcessVideoRawData`
- `ProcessAudioRawData`
- `AudioSpectrum`
- `MediaRecorder`
- `PushVideoFrame`
- `SpatialAudioWithMediaPlayer`
- `PreCallTest`
- `MusicPlayer`
- `PictureInPicture`

## UI Architecture

Keep `main.scene` as the entry scene and keep `DemoRoot` as the primary component host. `AgoraRtcDemoRoot` changes from showing the action console immediately to owning a simple navigation state:

- `caseList`: render the Flutter-style case list.
- `caseDetail`: render the selected case.

The list view renders section headers and case rows:

- `Basic`
- `JoinChannelAudio`
- `JoinChannelVideo`
- `Advanced`
- `AudioEffectMixing`
- `SetVideoEncoderConfiguration`
- `SetBeautyEffect`
- `SetContentInspect`

The detail view contains:

- a compact top row with case title, Back, and Log;
- a case-specific controls area;
- a display area, either video stage or audio state;
- the existing log overlay.

The implementation should prefer a case registry such as `demo/cases/caseRegistry.ts` over hardcoded branching. Each case definition should provide its name, section, display mode, control model, and action bindings.

## Component Boundaries

`RtcSessionService` remains the owner of:

- `AgoraRtcClient` creation and teardown;
- native event listener binding;
- local and remote video view setup;
- engine texture binding;
- common join, leave, preview, audio, video, beauty, content inspect, mixing, and effect actions;
- session state snapshots and log lines.

Case components or case controllers own:

- which controls are visible;
- case-specific default values;
- whether a case uses the video stage or audio state display;
- case-specific action ordering;
- parameter changes such as beauty slider values or mixing volumes.

Panels should call case/root callbacks. They should not call the Agora client directly.

## Case Flows

### JoinChannelAudio

Purpose: audio-only join and controls.

Controls:

- channel id;
- uid;
- Join / Leave;
- EnableAudio;
- EnableLocalAudio;
- MuteLocalAudio;
- MuteRemoteAudio;
- MuteAllRemoteAudio;
- VolumeIndication;
- Speaker.

Flow:

1. Initialize RTC if needed.
2. Enable audio and set broadcaster role.
3. Join with audio publish enabled and camera publish disabled.
4. Show audio status and event logs.
5. Leave clears joined state and remote audio state.

### JoinChannelVideo

Purpose: local preview, video join, and remote video thumbnails.

Controls:

- channel id;
- uid;
- render backend;
- channel profile;
- Start / Stop Preview;
- Join / Leave;
- SwitchCamera;
- EnableLocalVideo;
- MuteLocalVideo;
- MuteAllRemoteVideo;
- RefreshViews.

Flow:

1. Initialize RTC if needed.
2. Enable video and start preview.
3. Join with broadcaster role, camera publish, microphone publish, and auto subscribe.
4. Display local stage and remote thumbnails through `VideoStagePanel`.
5. Leave clears remote users while keeping preview available.

### SetVideoEncoderConfiguration

Purpose: match Flutter's encoder configuration case.

Controls:

- channel id;
- uid;
- Start Preview;
- Join / Leave;
- dimension selector;
- Apply dimensions.

Presets:

- `640x480`
- `480x480`
- `480x240`

Use frame rate `15` and bitrate `0`. Applying a preset calls `setVideoEncoderConfiguration`.

### SetBeautyEffect

Purpose: match Flutter's beauty controls with the simplified Cocos API.

Controls:

- channel id;
- uid;
- Start Preview;
- Join / Leave;
- Enable / Disable beauty;
- `lighteningContrastLevel`;
- `lighteningLevel`;
- `smoothnessLevel`;
- `rednessLevel`;
- `sharpnessLevel`.

Slider or stepper changes call `setBeautyEffectOptions` with the current values when the effect is enabled.

### SetContentInspect

Purpose: match Flutter's content inspect case within the current Cocos config type.

Controls:

- channel id;
- uid;
- Start Preview;
- Join / Leave;
- Start / Stop ContentInspect.

Use `module = 0` and `interval = 2`. `contentInspectResult` events are logged.

### AudioEffectMixing

Purpose: match Flutter's audio effect and audio mixing case.

Controls:

- channel id;
- Join / Leave;
- Preload Audio Effect;
- Play / Stop Effect;
- Pause Effect;
- Resume Effect;
- effect volume;
- loopback;
- cycle;
- start position;
- Start / Stop Audio Mixing;
- set audio mixing position;
- audio mixing publish volume;
- audio mixing playout volume;
- audio mixing overall volume.

Events:

- `audioMixingFinished`
- `audioMixingStateChanged`
- `remoteAudioStateChanged`

Asset behavior:

- audio mixing uses a bundled local asset equivalent to Flutter's `assets/audio_mixing/Agora.io-Interactions.mp3`;
- the case resolves or copies the asset to a native SDK-readable path before calling `startAudioMixing`;
- audio effect uses the Flutter URL `https://webdemo.agora.io/ding.mp3`;
- missing or unreadable local mixing asset fails the action with a clear log line and does not crash the demo.

## Required SDK Additions

Only add the methods and event required by `AudioEffectMixing`.

TypeScript methods:

```ts
pauseEffect(soundId: number): Promise<void>
resumeEffect(soundId: number): Promise<void>
setEffectsVolume(volume: number): Promise<void>
adjustAudioMixingPublishVolume(volume: number): Promise<void>
adjustAudioMixingPlayoutVolume(volume: number): Promise<void>
```

TypeScript event:

```ts
remoteAudioStateChanged: {
  uid: number;
  state: number;
  reason: number;
  elapsed: number;
}
```

Files to update during implementation:

- `sdk/agora-rtc/js/types.ts`
- `sdk/agora-rtc/js/agora.ts`
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
- copied example SDK files under `example/basic-call/assets/agora-rtc-sdk`
- copied native plugin templates under `example/basic-call/native/agora-rtc`
- `sdk/agora-rtc/README.md`

Android behavior:

- effect APIs call `rtcEngine.getAudioEffectManager()`.
- `pauseEffect`, `resumeEffect`, and `setEffectsVolume` return native failure through the existing error path when the native SDK reports a non-zero result.
- publish and playout volume APIs call the corresponding `RtcEngine` audio mixing methods.
- `onRemoteAudioStateChanged` dispatches `remoteAudioStateChanged`.

iOS behavior:

- effect APIs call the corresponding `AgoraRtcEngineKit` methods.
- publish and playout volume APIs call the corresponding `AgoraRtcEngineKit` audio mixing methods.
- remote audio state delegate dispatches `remoteAudioStateChanged`.

## Data Flow

1. Cocos loads `main.scene`.
2. `AgoraRtcDemoRoot` loads runtime config from `agora-config` and `agora-config.build`.
3. Root shows the case list.
4. User selects a case.
5. Root creates or reuses `RtcSessionService`.
6. Case detail registers the needed controls and display mode.
7. User invokes case actions.
8. `RtcSessionService` calls `AgoraRtcClient`.
9. Native bridge responds or emits events.
10. Root refreshes case controls, display state, and logs.
11. Back tears down case-only state, leaving global config intact.

## Error Handling

- Empty app id blocks initialization.
- Empty channel id blocks join.
- Invalid uid is normalized to a finite integer.
- Case actions set their button status to failed when the SDK call rejects.
- Unsupported native results surface as existing `native_failure` errors.
- Audio mixing asset resolution failure logs the missing path and leaves mixing stopped.
- Remote effect URL failures are logged from native error callbacks or request rejection.
- Leaving `AudioEffectMixing` stops audio mixing and stops the active effect if needed.

## Testing

Unit and static tests:

- `agora-client.test.ts` covers the five new wrapper methods and `remoteAudioStateChanged` event dispatch.
- `native-templates.test.ts` covers Android and iOS switch cases, handler calls, and event dispatch.
- `cocos-device-test-shard.test.ts` ensures the device API matrix includes the five new methods.
- `test_shard/integration_test_app/src/api_call_testcases.ts` includes request evidence for the five new methods.
- `example-scene.test.ts` verifies the case registry, exact six Flutter-aligned case names, list entry state, and `AudioEffectMixing` control names.
- package/productization tests include any new case and asset files.

Local verification:

- `npm run typecheck`
- `npm test`

Device verification is not required for writing the spec. During implementation, Android/iOS integration scripts can be run when credentials and device/simulator environment are available.

## Acceptance Criteria

- The first demo screen is a Flutter-style case list with `Basic` and `Advanced` sections.
- The six approved Flutter-aligned case names are present exactly.
- Selecting each case opens a case-specific detail screen with Back and Log.
- Video cases reuse the existing video stage and native texture flow.
- Audio-only cases do not require a video stage.
- `AudioEffectMixing` includes the same required controls as the Flutter case within the approved Cocos API scope.
- The five missing `AudioEffectMixing` methods are exposed through TypeScript and both native bridges.
- `remoteAudioStateChanged` is exposed through TypeScript and both native bridges.
- Local audio mixing asset resolution failure is handled without crashing.
- `npm run typecheck` and `npm test` pass after implementation.
