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

The Cocos build integration is registered through `package.json` `contributions.builder`, not a native plugin autoload manifest.

## Basic Usage

Customer applications pass the App ID from their own app configuration when initializing the RTC engine. The example project's `agora-config.json` is only for the demo app.

For the full bilingual developer documentation experience, open `docs/zh/index.html` or `docs/en/index.html` from the repository root.

```ts
import { createAgoraRtcClient } from '../../extensions/agora-rtc/js/agora.ts';

const client = createAgoraRtcClient();
await client.initialize(appId);
await client.joinChannel(token, channelId, uid);
```

## Android Gradle Dependency

When the plugin is installed as a Cocos project extension and the project is exported through Cocos Build for Android or Google Play, the Cocos build hook attempts to add the required Agora dependency to the exported module `app/build.gradle`.

If you integrate the SDK manually, reuse an already exported Android project, build directly from Android Studio, or find that the Cocos build hook did not run, add the dependency yourself in the app module:

```gradle
dependencies {
    implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'
}
```

The plugin does not rewrite the customer's root `build.gradle`, Android Gradle Plugin version, or Gradle Wrapper version.

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

- Android dependencies are listed in `sdk-config.json`; the current Android artifact is `io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1`.
- iOS SPM links the products listed in `sdk-config.json` `packageProducts`.
- iOS uses the package URL and version listed in `sdk-config.json`.
- The current Android artifact is the special voice package, not the full video package; validate video and `engine-texture` paths only after switching to an Agora artifact that includes the required video capabilities.
- Android supports `setDefaultAudioRouteToSpeakerphone`; Android still returns an explicit `unsupported` response for `setAudioSessionOperationRestriction`.
- Android 4.5.3 and iOS `4.5.3-a1` `ChannelMediaOptions` both expose multipath fields; macOS-only screen/camera track fields are not part of the iOS Cocos bridge.
- Android 4.5.3 and iOS `4.5.3-a1` content inspect modules both expose `position`.
- `engine-texture` is the main Cocos texture rendering path for video frames.
- `AudioEffectMixing` effect pause/resume and effect volume map to native audio effect APIs; audio mixing publish/playout volume maps to native audio mixing APIs.

## Cocos render helpers

The render backend, video view, engine texture, and native video overlay APIs are Cocos integration helpers rather than one-to-one Agora Native SDK passthroughs. In the current delivery, `engine-texture` is the only supported render backend. `engine-texture` local rendering currently supports only the primary camera source, and Android `engine-texture` supports only a subset of `position` semantics. `playEffect.gain` uses an integer bridge contract on iOS and a numeric bridge contract on Android. `setNativeVideoOverlaySuspended` remains as a compatibility no-op; video frames are uploaded through Cocos texture slots, so there is no visible native overlay to suspend.
