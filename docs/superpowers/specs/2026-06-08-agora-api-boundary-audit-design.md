# Agora API Boundary Audit Design

## Context

The current Cocos RTC wrapper already exposes a sizable TypeScript API surface through `sdk/agora-rtc/js/agora.ts` and `sdk/agora-rtc/js/types.ts`. The Android and iOS native bridges map those TypeScript requests into Agora native SDK calls.

During the two-emulator demo smoke test, remote video did not appear until Android `joinChannel` was temporarily changed to hardcode `ChannelMediaOptions`:

- `clientRoleType = Constants.CLIENT_ROLE_BROADCASTER`
- `publishCameraTrack = true`
- `publishMicrophoneTrack = true`
- `autoSubscribeAudio = true`
- `autoSubscribeVideo = true`

That proved the missing media options were part of the failure, but the fix is in the wrong layer. Business defaults and call options must be owned by TypeScript/demo code, not silently injected by native bridge code.

The user-provided readme at `/Users/admin/Library/Containers/com.tencent.WeWorkMac/Data/Documents/Profiles/A5A305D32E3FB44F97145C678BE6425B/Caches/Files/2026-05/61165506f25a4a31e419afcb83cc70b1/readme.md` is the required API list for this phase. The native SDK API surface should be verified from local dependency packages, not inferred from online docs.

## Goals

- Build an explicit API contract across TypeScript, Android, iOS, tests, and the demo.
- Implement or correct the APIs required by the user-provided `AgoraVideo.cs` / `AgoraVoice.cs` readme.
- Move `joinChannel` media behavior into TypeScript-level options.
- Make unsupported or platform-specific APIs explicit instead of silently succeeding, silently ignoring parameters, or hardcoding behavior in native code.
- Keep existing public TypeScript calls backward compatible where practical.

## Non-Goals

- Do not implement every Agora RTC native SDK API.
- Do not redesign the demo UI in this pass.
- Do not commit real Agora credentials.
- Do not use native code as the owner of product defaults.
- Do not use stale iOS build artifacts as final proof for the configured SDK version.

## Sources Of Truth

### Phase Requirement Source

The required API list comes from the user-provided readme derived from `AgoraVideo.cs` and `AgoraVoice.cs`.

Required groups:

- engine and logging;
- channel profile, role, join, leave, token renewal;
- audio enable, mute, volume, routing, speakerphone, audio session restriction;
- video enable, mute, encoder config, preview, camera switch;
- beauty effect, content inspect, and raw `SetParameters`;
- audio mixing and audio effects;
- event callbacks such as join, leave, user joined/offline, warnings/errors, stats, volume indication, video state, audio mixing state, and content inspect result.

### Current Cocos Contract Source

The current exposed Cocos API is the TypeScript wrapper:

- `sdk/agora-rtc/js/types.ts`
- `sdk/agora-rtc/js/agora.ts`

The native bridge request names are the `AgoraMethod` union in `types.ts`. That list is the current product API boundary and should be audited against the readme.

### Android Native SDK Source

Android is configured by `sdk/agora-rtc/sdk-config.json` to use:

- `io.agora.rtc:full-sdk:4.5.3`
- `io.agora.rtc:full-screen-sharing:4.5.3`

The local package exists under `example/basic-call/local-maven`. `full-sdk-4.5.3.pom` is an aggregate package; the actual Java RTC API is in:

- `example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar`
- `libs/agora-rtc-sdk.jar` inside that AAR

Use `javap` against that jar to verify exact classes, fields, overloads, and return types.

### iOS Native SDK Source

iOS is configured by `sdk/agora-rtc/sdk-config.json` for `AgoraRtcEngine_iOS` `4.5.3`.

Current old generated iOS build artifacts in the main worktree show `AgoraRtcEngine_iOS 4.5.2`, so they are not acceptable as final proof for this phase. Before final implementation verification, regenerate or install the configured `4.5.3` Pods in the current worktree and verify:

- `AgoraRtcEngineKit.h`
- `AgoraObjects.h`
- `AgoraRtcEngineDelegate.h`
- `AgoraEnumerates.h`

## API Scope

This phase implements the readme-required subset, not full Agora RTC.

### Already Exposed And To Audit

These methods are already in the Cocos TypeScript API and need contract verification against Android/iOS:

- `initialize`, `destroy`, `getSdkVersion`, `getErrorDescription`
- `setLogFilter`, `setLogFile`, `setParameters`
- `setChannelProfile`, `setClientRole`, `joinChannel`, `leaveChannel`, `renewToken`
- `enableAudio`, `enableLocalAudio`, `muteLocalAudioStream`, `muteRemoteAudioStream`, `muteAllRemoteAudioStreams`
- `setAudioProfile`, `enableAudioVolumeIndication`
- `setDefaultAudioRouteToSpeakerphone`, `setEnableSpeakerphone`, `isSpeakerphoneEnabled`
- `adjustPlaybackSignalVolume`, `adjustUserPlaybackSignalVolume`, `setAudioSessionOperationRestriction`
- `enableVideo`, `enableLocalVideo`, `muteLocalVideoStream`, `muteRemoteVideoStream`, `muteAllRemoteVideoStreams`
- `setVideoEncoderConfiguration`, `startPreview`, `stopPreview`, `switchCamera`
- `setBeautyEffectOptions`, `enableContentInspect`
- `startAudioMixing`, `pauseAudioMixing`, `resumeAudioMixing`, `stopAudioMixing`
- `getAudioMixingCurrentPosition`, `setAudioMixingPosition`, `adjustAudioMixingVolume`
- `preloadEffect`, `playEffect`, `stopEffect`

### Already Exposed Events To Audit

These events already exist in `AgoraEventMap` and should remain aligned with native callbacks:

- `joinChannelSuccess`, `leaveChannel`, `rejoinChannelSuccess`
- `userJoined`, `userOffline`
- `connectionInterrupted`, `connectionStateChanged`
- `remoteVideoStateChanged`, `localVideoStateChanged`
- `firstLocalAudioFramePublished`
- `audioMixingFinished`, `audioMixingStateChanged`
- `volumeIndication`, `rtcStats`
- `contentInspectResult`
- `warning`, `error`

### Required Additions Or Corrections

The first implementation plan should prioritize:

1. Add TypeScript `AgoraChannelMediaOptions` and optional `joinChannel(..., options?)`.
2. Map `AgoraChannelMediaOptions` to Android `ChannelMediaOptions` and iOS `AgoraRtcChannelMediaOptions`.
3. Update the demo to pass broadcaster/publish/subscribe options from TS when it needs video join behavior.
4. Remove the temporary Android native hardcode and its test expectation.
5. Fix platform support metadata and behavior for APIs that are exposed but unsupported or incorrectly mapped.
6. Audit parameters that are currently exposed in TS but ignored by native code.

## Join Channel Contract

`joinChannel` should stay backward compatible:

```ts
joinChannel(token: string, channelId: string, uid: number, options?: AgoraChannelMediaOptions): Promise<void>
```

Minimum option fields for this phase:

- `clientRoleType?: 'broadcaster' | 'audience' | number`
- `channelProfile?: 'communication' | 'liveBroadcasting' | number`
- `publishCameraTrack?: boolean`
- `publishMicrophoneTrack?: boolean`
- `autoSubscribeAudio?: boolean`
- `autoSubscribeVideo?: boolean`
- `enableAudioRecordingOrPlayout?: boolean`
- `startPreview?: boolean`
- `token?: string`
- `parameters?: string`

Android local SDK 4.5.3 confirms `ChannelMediaOptions` includes these and more. This phase should expose the fields needed by the readme/demo and avoid pretending to support fields that have not been mapped and tested.

The demo may choose defaults such as broadcaster, publish camera, publish microphone, and auto subscribe. The native bridge may only validate and map them.

## Platform Capability Rules

Every exposed API should have one of these states per platform:

- `supported`: maps to a real native SDK method and passes required parameters.
- `unsupported`: rejects with the existing native unsupported error shape.
- `not-applicable`: intentionally available only on one platform because the native SDK itself is platform-specific.
- `deferred`: in the readme but not implemented in this phase, with a reason documented before coding.

Known items to verify:

- Android has `setDefaultAudioRoutetoSpeakerphone(boolean)` in the local SDK, but the current bridge dispatches unsupported. This should be corrected if the method is required by the readme.
- `setAudioSessionOperationRestriction` appears to be iOS-specific in the current bridge. Android should remain explicitly unsupported unless local SDK proof says otherwise.
- `startAudioMixing` exposes `replace?: boolean` in TypeScript, but the Android 4.5.3 local signature uses `startAudioMixing(String, boolean, int, int)` and does not include `replace`. The contract must either remove/deprecate this field or mark it as iOS-only/ignored with tests and docs. Silent ignore is not acceptable.
- `PreloadEngine` / `UnloadEngine` from the Unity readme should not be copied by name blindly. Map them to this repo's lifecycle (`initialize` / `destroy`) or mark them unsupported if there is no native equivalent in the local SDK package.

## Native Bridge Rules

Native bridge code should:

- parse and validate request payloads;
- map TypeScript enums and option names into native SDK constants;
- call exactly one native SDK method per request unless the API contract says otherwise;
- return native failures through the existing response error shape;
- dispatch native callbacks into typed bridge events.

Native bridge code should not:

- decide demo behavior such as broadcaster role or publishing tracks;
- invent defaults that override TypeScript intent;
- silently drop provided parameters;
- report success for unsupported APIs.

## Audit Artifact

Before implementation, create a lightweight contract matrix in the implementation plan or a committed doc/table with columns:

- readme API name;
- Cocos TS method or event;
- Android native method/signature;
- iOS native method/signature;
- status;
- action needed;
- test coverage.

This matrix is the decision record for what gets implemented this phase.

## Testing Strategy

Automated tests should cover:

- TypeScript request payloads for all changed APIs.
- `joinChannel` with and without options.
- Android template mapping from payload fields to `ChannelMediaOptions`.
- iOS template mapping from payload fields to `AgoraRtcChannelMediaOptions` after confirming local iOS 4.5.3 headers.
- Unsupported platform APIs reject consistently.
- No native bridge hardcoded media publish/subscribe defaults remain.
- Exposed parameters are either mapped or explicitly rejected/marked platform-specific.

Manual verification should include:

- `npm run typecheck`
- `npm test`
- Android build/install smoke with the provided proxy when Gradle or dependency access is needed.
- Two-device or two-emulator join-channel smoke verifying local preview and remote user/video.
- iOS compile or at least template-level verification against regenerated 4.5.3 Pods.

## Acceptance Criteria

- The phase-required API list is traceable to the user-provided readme.
- Native API support is verified from local Android/iOS SDK packages.
- `joinChannel` options are controlled from TypeScript.
- Android native hardcoded broadcaster/publish/subscribe behavior is removed.
- Platform-specific and unsupported APIs are explicit and tested.
- No exposed TypeScript parameter is silently ignored without an intentional documented compatibility reason.
- Existing demo join behavior still works after moving media options to TS.
