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

For the full bilingual developer documentation experience, open `docs/zh/index.html` or `docs/en/index.html` from the repository root.

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

- Native dependencies are defined by `sdk-config.json`. The current dev/4.5.3 delivery is voice-only: Android uses `io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1`, and iOS uses `AgoraAudio_iOS` with the `RtcBasic` product.
- Video, rendering, beauty, and content-inspection methods remain in the TypeScript surface for compatibility. When the packaged native dependency does not support one of those methods, the native SDK reports that unsupported call, typically as error code `-4`, through the normal `native_failure` Promise rejection path.
- Android supports `setDefaultAudioRouteToSpeakerphone`; Android still returns an explicit `unsupported` response for `setAudioSessionOperationRestriction`.
- Android and iOS 4.5.3 `ChannelMediaOptions` both expose multipath fields; macOS-only screen/camera track fields are not part of the iOS Cocos bridge.
- Content inspect is available only when the native dependency set includes that product.
- `engine-texture` is the main Cocos texture rendering path for video frames.
- `AudioEffectMixing` effect pause/resume and effect volume map to native audio effect APIs; audio mixing publish/playout volume maps to native audio mixing APIs.

## Cocos render helpers

The render backend, video view, engine texture, and native video overlay APIs are Cocos integration helpers rather than one-to-one Agora Native SDK passthroughs. In the current delivery, `engine-texture` is the only supported render backend. `engine-texture` local rendering currently supports only the primary camera source, and Android `engine-texture` supports only a subset of `position` semantics. `playEffect.gain` uses an integer bridge contract on iOS and a numeric bridge contract on Android. `setNativeVideoOverlaySuspended` remains as a compatibility no-op; video frames are uploaded through Cocos texture slots, so there is no visible native overlay to suspend.
