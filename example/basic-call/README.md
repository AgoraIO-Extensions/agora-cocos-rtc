# Basic Call Example
*English*

This is a Cocos Creator 3.8.x example project for the Agora RTC Cocos plugin.

## Usage

1. Run `./scripts/prepare-example.sh` from the repository root.
2. Open this directory with Cocos Creator 3.8.8.
3. Configure the example App ID with one of these options:
   - Edit `assets/resources/agora-config.json` locally.
   - Pass build-time values when exporting from scripts, for example:
     `APP_ID=<YOUR_APP_ID> CHANNEL_ID=testapi npm run build:all-platforms -- android`.
   - `agora-config.json` is the checked-in base template for minimal runtime values.
   - `scripts/write-example-build-config.mjs` generates `assets/resources/agora-config.build.json` as a temporary build/smoke override file; the demo loads it after `agora-config.json`.
4. Export to Android or iOS.
5. Use the built-in QA panel to initialize the engine, join a channel, test audio/video controls, and inspect runtime events.

Customer applications should pass their App ID from their own app configuration when calling `initialize(appId)`. The example configuration files are only for this demo project.

### Smoke Automation

`scripts/write-example-build-config.mjs` accepts optional runtime overrides for automated demo builds:

- `TEST_UID`
- `AUTO_PREVIEW`
- `AUTO_JOIN`
- `PUBLISH_CAMERA_TRACK`
- `PUBLISH_MICROPHONE_TRACK`
- `AUTO_SUBSCRIBE_AUDIO`
- `AUTO_SUBSCRIBE_VIDEO`

Use `TEST_UID` instead of `UID` in zsh shells, where `UID` is a reserved readonly variable. For iOS simulator smoke tests, run the iOS side as a subscriber with `AUTO_PREVIEW=false`, `AUTO_JOIN=true`, `PUBLISH_CAMERA_TRACK=false`, and `PUBLISH_MICROPHONE_TRACK=false`; publish camera video from Android or a real iOS device.

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
