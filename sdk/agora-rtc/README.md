# Agora RTC Cocos Plugin
*English*

Use Agora RTC SDK in Cocos Creator 3.8.x projects.

This package provides the JavaScript API wrapper, Cocos extension runtime, and native bridge templates required by the example project and customer integrations.

## Package Contents

- `js/`: TypeScript SDK wrapper and public API types.
- `dist/`: Cocos extension runtime and build hooks.
- `sdk-config.json`: Single source of truth for Android and iOS native dependency versions.
- `templates/android`: Android bridge template.
- `templates/ios`: iOS bridge template.
- `cc_plugin.json`: Cocos native plugin manifest.

## Basic Usage

Customer applications pass the App ID from their own app configuration when initializing the RTC engine. The example project's `agora-config.json` is only for the demo app.

```ts
import { createAgoraRtcClient } from '../../extensions/agora-rtc/js/agora.ts';

const client = createAgoraRtcClient();
await client.initialize(appId);
await client.joinChannel(token, channelId, uid);
```

## API Surface

- `initialize`
- `getSdkVersion`
- `getErrorDescription`
- `setLogFilter`
- `setLogFile`
- `setRenderBackend`
- `setChannelProfile`
- `setClientRole`
- `joinChannel`
- `leaveChannel`
- `renewToken`
- `enableAudio`
- `enableLocalAudio`
- `muteLocalAudioStream`
- `muteRemoteAudioStream`
- `muteAllRemoteAudioStreams`
- `setAudioProfile`
- `enableAudioVolumeIndication`
- `setDefaultAudioRouteToSpeakerphone`
- `setEnableSpeakerphone`
- `isSpeakerphoneEnabled`
- `adjustPlaybackSignalVolume`
- `adjustUserPlaybackSignalVolume`
- `setAudioSessionOperationRestriction`
- `enableVideo`
- `enableLocalVideo`
- `muteLocalVideoStream`
- `muteRemoteVideoStream`
- `muteAllRemoteVideoStreams`
- `setVideoEncoderConfiguration`
- `setupLocalVideoView`
- `setupRemoteVideoView`
- `updateLocalVideoView`
- `updateRemoteVideoView`
- `removeLocalVideoView`
- `removeRemoteVideoView`
- `setNativeVideoOverlaySuspended`
- `startPreview`
- `stopPreview`
- `switchCamera`
- `setBeautyEffectOptions`
- `enableContentInspect`
- `startAudioMixing`
- `pauseAudioMixing`
- `resumeAudioMixing`
- `stopAudioMixing`
- `getAudioMixingCurrentPosition`
- `setAudioMixingPosition`
- `adjustAudioMixingVolume`
- `preloadEffect`
- `playEffect`
- `pauseEffect`
- `resumeEffect`
- `setEffectsVolume`
- `adjustAudioMixingPublishVolume`
- `adjustAudioMixingPlayoutVolume`
- `stopEffect`
- `setParameters`
- `destroy`

## Platform Notes

- Android uses `io.agora.rtc:full-sdk:4.5.3` (bundled extensions, aligned with iOS SPM products below).
- iOS SPM links all extension products from `sdk-config.json` `packageProducts` (same capability set as Android `full-sdk`).
- iOS uses `AgoraRtcEngine_iOS 4.5.3`.
- Android supports `setDefaultAudioRouteToSpeakerphone`; Android still returns an explicit `unsupported` response for `setAudioSessionOperationRestriction`.
- Android and iOS 4.5.3 `ChannelMediaOptions` both expose multipath fields; macOS-only screen/camera track fields are not part of the iOS Cocos bridge.
- Android and iOS 4.5.3 content inspect modules both expose `position`.
- `engine-texture` is the main Cocos texture rendering path for video frames.
- `AudioEffectMixing` effect pause/resume and effect volume map to native audio effect APIs; audio mixing publish/playout volume maps to native audio mixing APIs.

## Cocos render helpers

The render backend, video view, engine texture, and native video overlay APIs are Cocos integration helpers rather than one-to-one Agora Native SDK passthroughs. In the current delivery, `engine-texture` is the only supported render backend. `engine-texture` local rendering currently supports only the primary camera source, and Android `engine-texture` supports only a subset of `position` semantics. `playEffect.gain` uses an integer bridge contract on iOS and a numeric bridge contract on Android. `setNativeVideoOverlaySuspended` remains as a compatibility no-op; video frames are uploaded through Cocos texture slots, so there is no visible native overlay to suspend.
