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
- `stopEffect`
- `setParameters`
- `destroy`

## Platform Notes

- Android uses `io.agora.rtc:full-sdk:4.5.3` and `io.agora.rtc:full-screen-sharing:4.5.3`.
- iOS uses `AgoraRtcEngine_iOS 4.5.3`.
- Android currently returns explicit `unsupported` responses for `setDefaultAudioRouteToSpeakerphone` and `setAudioSessionOperationRestriction`.
- `engine-texture` is the main Cocos texture rendering path for video frames.
