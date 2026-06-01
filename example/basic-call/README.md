# Basic Call Example

这是一个供 `Cocos Creator 3.8.x` 打开的示例工程骨架。

## 使用方式

1. 在仓库根目录执行 `./scripts/prepare-example.sh`
2. 用 `Cocos Creator 3.8.8` 打开当前目录
3. 创建一个场景并挂载 `assets/scripts/AgoraRtcExampleController.ts`
4. 填入 `appId`、`token`、`channelId`、`uid`
5. 导出到 iOS 或 Android 验证最小 RTC 流程

## Capability Demo

示例场景现在是一个 QA 风格测试面板，保留这些直接入口：

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

`Demo` 会顺序触发分组调用：

- `runChannelRoleDemo()`
- `runAudioControlDemo()`
- `runVideoControlDemo()`
- `runMixingDemo()`
- `runEffectDemo()`
- `runDiagnosticsDemo()`

API 到示例入口的映射：

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

运行时事件日志还会展示：

- `volumeIndication`
- `rtcStats`
- `joinChannelSuccess` / `leaveChannel` / `userJoined` / `userOffline`
- `connectionInterrupted` / `connectionStateChanged`
- `remoteVideoStateChanged` / `localVideoStateChanged`
- `audioMixingFinished` / `audioMixingStateChanged`
- `contentInspectResult`

面板上还会显示结构化状态：

- 当前 backend
- initialized / joined / preview
- 本地音频 / 本地视频 / speakerphone
- remote uid / local view / remote view
- local / remote texture slot
- 最近一次 `rtcStats`
- 最近一次 `volumeIndication`
- 最近一次 `error`

QA 辅助能力：

- backend 直达切换，不再只靠循环切换
- channel profile / client role / video encoder preset 可轮换
- speaker / mic / cam / preview 可单独点测
- 日志支持 `Freeze` 和 `Clear`
- 每个动作按钮会显示最近一次结果态：`OK` / `FAIL`

所有分组调用都会把结果写入状态日志区。当前平台暂未实现的 API 会在日志区显示显式失败，而不是静默成功。
