# API Verification Matrix

Updated: `2026-05-12`

This document records only the verification status backed by current repository evidence. It does not claim theoretical support without local proof.

## Verification Levels

- `Implemented`
  - The JavaScript surface, native bridge, and example call path exist.
- `Automated`
  - Covered by `npm test`.
- `Export / build verified`
  - Backed by a successful Android `./scripts/dev-android.sh` or iOS `./scripts/dev-ios.sh` run.
- `Install / launch verified`
  - Android APK was installed and launched successfully.
- `Real RTC validation`
  - Requires a valid `appId`, token, and `channelId`.
  - This repository does not generate business credentials, so this level must be completed in the user's environment.

## Overall Status

| Area | Android | iOS |
|---|---|---|
| JS public API | Implemented | Implemented |
| Native bridge | Implemented | Implemented |
| Example call path | Implemented | Implemented |
| Automated tests | Automated | Automated |
| Export / build | Export / build verified | Export / build verified |
| Install / launch | Install / launch verified | Simulator build verified |
| Real RTC join | Requires real credentials | Requires real credentials |

## Core API Groups

### Engine / Log

| API | Android | iOS | Notes |
|---|---|---|---|
| `initialize` | Export / build / launch verified | Export / build verified | Real join still depends on valid credentials. |
| `destroy` | Export / build / launch verified | Export / build verified | |
| `getSdkVersion` | Automated | Automated | |
| `getErrorDescription` | Automated | Automated | |
| `setLogFilter` | Automated | Automated | |
| `setLogFile` | Automated | Automated | |

### Channel / Role

| API | Android | iOS | Notes |
|---|---|---|---|
| `setChannelProfile` | Automated | Automated | |
| `setClientRole` | Automated | Automated | |
| `joinChannel` | Export / build / launch flow verified | Export / build flow verified | Real `joinChannelSuccess` requires valid credentials. |
| `leaveChannel` | Automated | Automated | |
| `renewToken` | Implemented | Implemented | Requires business-environment validation. |

### Audio

| API | Android | iOS | Notes |
|---|---|---|---|
| `enableAudio` | Implemented | Implemented | |
| `enableLocalAudio` | Automated | Implemented | |
| `muteLocalAudioStream` | Implemented | Implemented | |
| `muteRemoteAudioStream` | Implemented | Implemented | |
| `muteAllRemoteAudioStreams` | Implemented | Implemented | |
| `setAudioProfile` | Implemented | Implemented | |
| `enableAudioVolumeIndication` | Implemented | Implemented | |
| `setDefaultAudioRouteToSpeakerphone` | Implemented | Implemented | Android bridge calls the native Agora audio route API. |
| `setEnableSpeakerphone` | Implemented | Implemented | |
| `isSpeakerphoneEnabled` | Implemented | Implemented | |
| `adjustPlaybackSignalVolume` | Implemented | Implemented | |
| `adjustUserPlaybackSignalVolume` | Implemented | Implemented | |
| `setAudioSessionOperationRestriction` | `unsupported` | Implemented | Android intentionally returns explicit `unsupported`. |

### Video

| API | Android | iOS | Notes |
|---|---|---|---|
| `enableVideo` | Implemented | Implemented | |
| `enableLocalVideo` | Automated | Implemented | |
| `muteLocalVideoStream` | Implemented | Implemented | |
| `muteRemoteVideoStream` | Implemented | Implemented | |
| `muteAllRemoteVideoStreams` | Implemented | Implemented | |
| `setVideoEncoderConfiguration` | Implemented | Implemented | |
| `startPreview` | Automated | Implemented | |
| `stopPreview` | Implemented | Implemented | |
| `switchCamera` | Automated | Implemented | |
| `setBeautyEffectOptions` | Implemented | Implemented | |
| `enableContentInspect` | Implemented | Implemented | |

### Native View / Render

| API | Android | iOS | Notes |
|---|---|---|---|
| `setRenderBackend` | Implemented | Implemented | Android has real validation for `surface-view`, `texture-view`, and `engine-texture`. |
| `setupLocalVideoView` | Export / build / launch verified | Export / build verified | |
| `setupRemoteVideoView` | Export / build / launch verified | Export / build verified | |
| `updateLocalVideoView` | Implemented | Implemented | |
| `updateRemoteVideoView` | Implemented | Implemented | |
| `removeLocalVideoView` | Implemented | Implemented | |
| `removeRemoteVideoView` | Implemented | Implemented | |

### Mixing / Effect

| API | Android | iOS | Notes |
|---|---|---|---|
| `startAudioMixing` | Automated | Automated | Real playback depends on resource paths and the business environment. |
| `pauseAudioMixing` | Implemented | Implemented | |
| `resumeAudioMixing` | Implemented | Implemented | |
| `stopAudioMixing` | Implemented | Implemented | |
| `getAudioMixingCurrentPosition` | Automated | Implemented | |
| `setAudioMixingPosition` | Implemented | Implemented | |
| `adjustAudioMixingVolume` | Implemented | Implemented | |
| `preloadEffect` | Implemented | Implemented | |
| `playEffect` | Implemented | Implemented | |
| `stopEffect` | Implemented | Implemented | |

### Parameters

| API | Android | iOS | Notes |
|---|---|---|---|
| `setParameters` | Implemented | Implemented | |

## Events

| Event | Android | iOS | Notes |
|---|---|---|---|
| `joinChannelSuccess` | Implemented | Implemented | Real trigger requires valid credentials. |
| `leaveChannel` | Implemented | Implemented | |
| `rejoinChannelSuccess` | Implemented | Implemented | |
| `userJoined` | Implemented | Implemented | |
| `userOffline` | Implemented | Implemented | |
| `connectionInterrupted` | Implemented | Implemented | |
| `connectionStateChanged` | Implemented | Implemented | |
| `remoteVideoStateChanged` | Implemented | Android wired, no extra iOS delegate patch in this iteration | |
| `localVideoStateChanged` | Implemented | Android wired, no extra iOS delegate patch in this iteration | |
| `firstLocalAudioFramePublished` | Android wired | iOS not patched | |
| `audioMixingFinished` | Android wired | iOS not patched | |
| `audioMixingStateChanged` | Android wired | iOS not patched | |
| `volumeIndication` | Wired | Wired | |
| `rtcStats` | Wired | Wired | |
| `contentInspectResult` | Android wired | iOS not patched | |
| `error` | Wired | Wired | |
| `warning` | JavaScript type surface only | JavaScript type surface only | No confirmed native warning callback wiring on either platform. |

## Non-1:1 Items Compared with Unity

- `PreloadEngine / UnloadEngine`
  - The Cocos SDK uses `initialize / destroy` for the same lifecycle level.
- `EnableVideoObserver`
  - This is not public API.
  - In this repository it is an internal implementation detail of the `engine-texture` backend.
- `OnWarning`
  - Only the JavaScript type surface is kept.
  - The SDK does not fake native callbacks that do not exist or have not been confirmed.

## Usage Guidance

- For customer-facing "available" claims, prefer capabilities marked as:
  - `Automated`
  - `Export / build verified`
  - `Install / launch verified`
- For customer-facing "real RTC verified" claims, run another validation pass with:
  - real `appId`, token, and `channelId`
  - Android device
  - iOS device, or simulator with a valid RTC environment
