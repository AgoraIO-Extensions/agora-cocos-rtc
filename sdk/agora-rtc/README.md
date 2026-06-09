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

- Android uses `io.agora.rtc:full-sdk:4.5.3` and `io.agora.rtc:full-screen-sharing:4.5.3`.
- iOS uses `AgoraRtcEngine_iOS 4.5.3`.
- Android supports `setDefaultAudioRouteToSpeakerphone`; Android still returns an explicit `unsupported` response for `setAudioSessionOperationRestriction`.
- Android `ChannelMediaOptions` supports multipath fields. The iOS 4.5.3 `AgoraRtcChannelMediaOptions` headers do not expose multipath fields.
- Android content inspect modules support `position`. The iOS 4.5.3 `AgoraContentInspectModule` header exposes `type` and `interval`.
- `engine-texture` is the main Cocos texture rendering path for video frames.
- `AudioEffectMixing` effect pause/resume and effect volume map to native audio effect APIs; audio mixing publish/playout volume maps to native audio mixing APIs.

## Cocos render helpers

The render backend, video view, engine texture, and native video overlay APIs are Cocos integration helpers rather than one-to-one Agora Native SDK passthroughs. `setNativeVideoOverlaySuspended` hides or restores the native video overlay views used by the native-view render backends. For `engine-texture`, video frames are uploaded through Cocos texture slots, so the native video overlay helper has no visible native view to suspend.
