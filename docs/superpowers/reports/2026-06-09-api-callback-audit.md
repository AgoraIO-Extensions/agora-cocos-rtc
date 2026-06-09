# Agora Cocos RTC API 和回调审计修复报告

日期：2026-06-09

## 口径

本报告覆盖 Jira NMS-30412 和 NMS-30413 附件中列出的 Cocos RTC wrapper API、参数和回调对齐问题。审计对象包括 TypeScript SDK wrapper、Android/iOS native bridge templates、本地 Android native engine 副本、example native 副本、README API Surface 和测试夹具。

`setNativeVideoOverlaySuspended`、render backend、video view 和 engine texture 相关 API 是 Cocos 渲染集成 helper，不是 Agora Native SDK 一对一透传 API。本 PR 将它们作为 wrapper 自有能力记录和测试，不按 native SDK 漏 API 处理。

## 已修复

- `initialize` 支持原有 `initialize(appId)`，并新增 native engine config object 透传：area code、channel profile、license、audio scenario、log config、thread priority、domain limit、Android extension/native lib 配置等。
- `joinChannel.options` 扩展到 native 4.5.3 可用字段。Android 覆盖 multipath/startPreview 等 Android 字段；iOS 覆盖 iOS headers 中存在的字段，并在 `startPreview` 为 true 时调用 `engine.startPreview()`。
- `setClientRole` 支持 `ClientRoleOptions` / `AgoraClientRoleOptions`，目前包括 `audienceLatencyLevel`。
- `setVideoEncoderConfiguration` 支持 min bitrate、mirror mode、degradation preference、codec type 和 advanced video options；Android 额外支持 `minFrameRate`，iOS ObjC 4.5.3 不暴露该字段。Android 按 Agora 4.5.3 raw enum value 映射 degradation/codec/encoding/compression，且未传 `mirrorMode` / `degradationPreference` 时保留 native 默认值；未传 advanced options 时不改写 iOS native 默认值。
- `enableContentInspect` 支持 `extraInfo`、`serverConfig` 和 `modules`，同时保留旧的 `module`/`interval` 兼容入口。
- Android `enableContentInspect.modules[].position` 映射到 `Constants.VideoModulePosition`；iOS 4.5.3 的 `AgoraContentInspectModule` header 没有 `position` 属性，因此不伪造映射。
- `setParameters` 在 JS 层对 object 入参做 JSON 字符串化，string 入参保持不变。
- Android/iOS `joinChannel(options)` 权限判断覆盖 `startPreview` 和多 camera track 字段，避免 expanded options 组合下漏申请 camera。
- Android `enableLocalAudio` 和 `enableLocalVideo` 不再无条件返回 ok：未初始化会返回错误，native 负返回值会按 Agora error 透出。
- iOS `setAudioProfile` 现在传递 `scenario`，`playEffect.gain` 按 `Double` 读取。
- Android/iOS 补齐 error、content inspect、audio/video state、volume、audio mixing 和 stats 相关 callback dispatch；Android 4.5.3 `IRtcEngineEventHandler` 和 iOS 4.5.3 `AgoraRtcEngineDelegate` 都没有 warning callback，因此不伪造 `warning` 事件。
- `joinChannelSuccess` 和 `userJoined` 的 JS payload 补齐 `elapsed`。
- `rtcStats` 和 `leaveChannel` 使用完整 stats payload，包含 audio/video bytes、bitrate、CPU、memory、packet loss、connect time 等字段。
- TypeScript 事件类型中 `leaveChannel` 和 `rtcStats` 共用完整 stats payload，避免 native 已透出字段但 JS public contract 只声明 `duration`。
- iOS stats payload key 已对齐 TS/Android contract，统一使用 `txKBitRate` / `txAudioKBitRate` 等大小写。
- README API Surface 补上 `setNativeVideoOverlaySuspended`，并说明 Cocos render helpers/native video overlay 的边界。
- 移除 `AgoraEventMap` 中 native 不会发出的 `localVideoFrame` / `remoteVideoFrame` 假事件声明；实际帧链路使用 texture slot lifecycle 事件。
- 同步修改 SDK templates、example native 副本和本地 Android native engine 副本，避免打包模板和本地运行时行为不一致。

## 边界说明

- Android 支持 `setDefaultAudioRouteToSpeakerphone`；`setAudioSessionOperationRestriction` 仍是 iOS-only，Android 返回 explicit unsupported。
- `engine-texture` 不发送 Base64 frame payload；它通过 `localVideoTextureReady`、`remoteVideoTextureReady`、`localVideoTextureReleased`、`remoteVideoTextureReleased` 暴露 Cocos texture slot 生命周期。
- iOS `AgoraRtcChannelMediaOptions` 没有 `startPreview` 字段；wrapper 通过 join 前调用 `startPreview()` 实现同等调用意图。
- Android 支持 multipath channel media options；iOS 4.5.3 headers 中不存在 `enableMultipath`、`uplinkMultipathMode`、`downlinkMultipathMode`、`preferMultipathType`，本 PR 不向 iOS 硬塞这些字段。
- Android 支持 content inspect module `position`；iOS 4.5.3 headers 中 `AgoraContentInspectModule` 只有 `type` 和 `interval`。
- Android-only fields 没有硬塞到 iOS bridge；iOS-only 行为也没有伪装成 Android 支持。

## 验证

- `node --test tests/agora-client.test.ts tests/native-templates.test.ts tests/package-sdk.test.ts`：74/74 pass。
- `xcrun swiftc -typecheck ... sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`：exit 0；仅保留 `setAudioProfile(_:scenario:)` deprecated warning，用于修复 `scenario` 漏参。
- iOS delegate header 校验确认本地 Agora 4.5.3 `AgoraRtcEngineDelegate.h` 暴露 `didOccurError`，不暴露 `didOccurWarning` / `warningCode`。
- `npm test`：158/158 pass。
