# Agora Cocos RTC API 和回调审计报告

日期：2026-06-09

## 口径

本报告只审计当前 wrapper 已暴露或已声明的 API 与回调：`AgoraMethod`、`AgoraRtcClient`、`AgoraEventMap`、Android/iOS native templates、README API Surface、integration API call cases。Agora Native SDK 4.5.3 存在但 wrapper 没声明的字段不算当前缺陷，只列为候选增强。

审计在隔离 worktree `/Users/admin/agora-cocos-rtc/.worktrees/api-callback-audit` 执行。Android AAR 和 iOS Pods headers 属于 ignored/generated artifacts，隔离 worktree 不包含这些文件；原生 4.5.3 签名验证读取主 checkout 中已有的本地 artifacts：

- `/Users/admin/agora-cocos-rtc/example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar`
- `/Users/admin/agora-cocos-rtc/example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineDelegate.h`

## API 对齐矩阵

静态 inventory 结果：

| 项目 | 数量 | 结论 |
| --- | ---: | --- |
| `AgoraMethod` | 54 | 当前 TS bridge method union |
| `AgoraRtcClient` bridge 方法 | 54 | 与 `AgoraMethod` 对齐 |
| Android native handlers | 54 | 与 `AgoraMethod` 对齐 |
| iOS native handlers | 54 | 与 `AgoraMethod` 对齐 |
| integration API cases | 54 | 与 `AgoraMethod` 对齐 |
| README API Surface | 53 | 少列 1 个方法 |

差异：

- README 少列：`setNativeVideoOverlaySuspended`。
- `AgoraMethod` 没有缺失 client method、Android handler、iOS handler 或 integration case。

证据：

- `sdk/agora-rtc/js/types.ts:17` 定义 `AgoraMethod`，其中 `setNativeVideoOverlaySuspended` 在 `sdk/agora-rtc/js/types.ts:55`。
- `sdk/agora-rtc/js/agora.ts:239` 暴露 `setNativeVideoOverlaySuspended(suspended: boolean)`。
- `sdk/agora-rtc/README.md:29` 到 `sdk/agora-rtc/README.md:83` 是 README API Surface，未列 `setNativeVideoOverlaySuspended`。
- `/tmp/agora-cocos-api-callback-audit-inventory.json` 的 `missingFromReadme` 只有 `setNativeVideoOverlaySuspended`。

## 回调对齐矩阵

静态 inventory 结果：

| 项目 | 数量 | 结论 |
| --- | ---: | --- |
| `AgoraEventMap` | 24 | 当前 TS 声明事件 |
| native templates emitted events | 21 | 少 3 个 TS-only 事件 |

native templates 未发出的 TS 声明事件：

- `localVideoFrame`
- `remoteVideoFrame`
- `warning`

证据：

- `localVideoFrame` 和 `remoteVideoFrame` 声明在 `sdk/agora-rtc/js/types.ts:203` 到 `sdk/agora-rtc/js/types.ts:216`。
- `warning` 声明在 `sdk/agora-rtc/js/types.ts:271` 到 `sdk/agora-rtc/js/types.ts:274`。
- `rg` 检查 `sdk/agora-rtc/templates` 未找到这三个事件的 native emit。
- `localVideoTextureReady`、`remoteVideoTextureReady`、`renderBackendState` 已在 native templates 发出，不属于 TS-only 问题。证据包括 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java:334`、`sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java:349`、`sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java:426`、`sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:229`、`sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1113`。

## 确认漏掉的回调参数

### `joinChannelSuccess.elapsed`

当前 TS payload 没有 `elapsed`：

- `sdk/agora-rtc/js/types.ts:168` 到 `sdk/agora-rtc/js/types.ts:171` 只声明 `channelId` 和 `uid`。

Android/iOS native callback 收到了 `elapsed` 但 dispatch payload 没发：

- Android：`sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:437` 的 `onJoinChannelSuccess(String channel, int uid, int elapsed)` 收到 `elapsed`，但 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:438` 到 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:441` 只发 `channelId` 和 `uid`。
- iOS：`sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1231` 的 `didJoinChannel ... elapsed: Int` 收到 `elapsed`，但 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1232` 到 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1235` 只发 `channelId` 和 `uid`。

Native 4.5.3 签名证据：

- Android `javap` 输出包含 `public void onJoinChannelSuccess(java.lang.String, int, int);`。
- iOS header `AgoraRtcEngineDelegate.h:243` 包含 `didJoinChannel:(NSString * _Nonnull)channel withUid:(NSUInteger)uid elapsed:(NSInteger)elapsed`。

结论：这是当前已暴露回调的确认漏参。

### `userJoined.elapsed`

当前 TS payload 没有 `elapsed`：

- `sdk/agora-rtc/js/types.ts:223` 到 `sdk/agora-rtc/js/types.ts:225` 只声明 `uid`。

Android/iOS native callback 收到了 `elapsed` 但 dispatch payload 没发：

- Android：`sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:445` 的 `onUserJoined(int uid, int elapsed)` 收到 `elapsed`，但 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:446` 只发 `uid`。
- iOS：`sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1269` 的 `didJoinedOfUid uid: UInt, elapsed: Int` 收到 `elapsed`，但 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1270` 到 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1272` 只发 `uid`。

Native 4.5.3 签名证据：

- Android `javap` 输出包含 `public void onUserJoined(int, int);`。
- iOS header `AgoraRtcEngineDelegate.h:497` 包含 `didJoinedOfUid:(NSUInteger)uid elapsed:(NSInteger)elapsed`。

结论：这是当前已暴露回调的确认漏参。

## 文档漏项

- `setNativeVideoOverlaySuspended` 已在 TS method union 和 client wrapper 中暴露，但 README API Surface 没列。
- 证据：`sdk/agora-rtc/js/types.ts:55`、`sdk/agora-rtc/js/agora.ts:239`、`sdk/agora-rtc/README.md:29` 到 `sdk/agora-rtc/README.md:83`。

## 类型声明但 native 当前不发出的事件

- `localVideoFrame`
- `remoteVideoFrame`
- `warning`

证据：`sdk/agora-rtc/js/types.ts:203` 到 `sdk/agora-rtc/js/types.ts:216`、`sdk/agora-rtc/js/types.ts:271` 到 `sdk/agora-rtc/js/types.ts:274`，以及 `rg` 对 `sdk/agora-rtc/templates` 的未命中结果。

影响：这三个事件对 TS 消费者表现为可订阅，但当前 native templates 不会产生对应事件。后续可以选择删除类型、标注保留、或实现 native emit。

## 候选增强，不按 bug 处理

当前审计没有把未暴露的 Agora Native 4.5.3 全量字段列为 bug。若后续要扩大 wrapper 能力，可以另开范围评估：

- `ChannelMediaOptions` 中更多 publish/custom/multipath 字段。
- `VideoEncoderConfiguration` 中 `minBitrate`、`mirrorMode`、`degradationPreference`、`advancedVideoOptions` 等字段。
- `setClientRole` 带 options 的重载。
- `preloadEffect` 带 `startPos` 的重载。

这些候选增强来自本地 4.5.3 AAR/header 签名，但不属于本次“当前 wrapper 已暴露 API/回调”的漏参结论。

## 总结

当前 54 个已暴露 bridge API 在 TypeScript、Android、iOS 和 integration test 之间是对齐的。确认问题集中在 2 个回调漏参、1 个 README API 漏项、3 个 TS-only 事件声明。
