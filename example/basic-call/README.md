# Basic Call Example
*English*

This is a Cocos Creator 3.8.x example project for the Agora RTC Cocos plugin.

## Usage

1. Run `./scripts/prepare-example.sh` from the repository root.
2. Open this directory with Cocos Creator 3.8.8.
3. Configure `assets/resources/agora-config.json`.
4. Export to Android or iOS.
5. Use the built-in QA panel to initialize the engine, join a channel, test audio/video controls, and inspect runtime events.

## Capability Demo

The example scene is a QA console instead of a minimal visual demo. It exposes direct entries for:

- `Initialize`
- `Join`
- `Leave`
- `Surface`
- `Texture`
- `EngineTex`
- `Preview`
- `Views`
- `Speaker`
- `Mic`
- `Cam`
- `Profile`
- `Role`
- `Encoder`
- `Freeze`
- `Clear`
- `Full Demo`
- `Channel`
- `Audio`
- `Video`
- `Mixing`
- `Effect`
- `Diag`

`Full Demo` runs the grouped API probes in sequence:

- `runChannelRoleDemo()`
- `runAudioControlDemo()`
- `runVideoControlDemo()`
- `runMixingDemo()`
- `runEffectDemo()`
- `runDiagnosticsDemo()`

## API Mapping

- `getSdkVersion` / `setChannelProfile` / `setClientRole` / `renewToken`
  - `runChannelRoleDemo()`
- `enableAudio` / `enableLocalAudio` / `muteLocalAudioStream` / `muteAllRemoteAudioStreams`
  - `runAudioControlDemo()`
- `setAudioProfile` / `enableAudioVolumeIndication` / `setDefaultAudioRouteToSpeakerphone` / `setEnableSpeakerphone`
  - `runAudioControlDemo()`
- `isSpeakerphoneEnabled` / `adjustPlaybackSignalVolume` / `adjustUserPlaybackSignalVolume` / `setAudioSessionOperationRestriction`
  - `runAudioControlDemo()`
- `enableVideo` / `enableLocalVideo` / `muteLocalVideoStream` / `muteAllRemoteVideoStreams`
  - `runVideoControlDemo()`
- `setVideoEncoderConfiguration` / `switchCamera` / `setBeautyEffectOptions` / `enableContentInspect`
  - `runVideoControlDemo()`
- `startAudioMixing` / `pauseAudioMixing` / `resumeAudioMixing` / `getAudioMixingCurrentPosition`
  - `runMixingDemo()`
- `setAudioMixingPosition` / `adjustAudioMixingVolume` / `stopAudioMixing`
  - `runMixingDemo()`
- `preloadEffect` / `playEffect` / `stopEffect`
  - `runEffectDemo()`
- `getErrorDescription` / `setLogFilter` / `setLogFile` / `setParameters`
  - `runDiagnosticsDemo()`

## Runtime Events

The event log displays:

- `volumeIndication`
- `rtcStats`
- `joinChannelSuccess` / `leaveChannel` / `userJoined` / `userOffline`
- `connectionInterrupted` / `connectionStateChanged`
- `remoteVideoStateChanged` / `localVideoStateChanged`
- `audioMixingFinished` / `audioMixingStateChanged`
- `contentInspectResult`

## QA Helpers

- Direct backend switching for `surface-view`, `texture-view`, and `engine-texture`.
- Cycling controls for channel profile, client role, and video encoder presets.
- Separate speaker, mic, camera, and preview probes.
- Runtime log controls for `Freeze` and `Clear`.
- Per-action status feedback through `OK` and `FAIL` markers.

All grouped probes write their results into the status log. APIs that are not implemented on a platform report explicit failures instead of silent success.
