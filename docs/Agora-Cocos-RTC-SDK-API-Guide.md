# Agora Cocos RTC SDK API Guide

更新日期：`2026-06-12`

## 文档目的

本文档是 `Agora Cocos RTC SDK` 的正式客户交付版 API 与集成指南。
文档说明 SDK 交付内容、在客户 Cocos Creator 项目中的导入方式、初始化与加入频道流程、可用 API、核心对象参数、业务可消费事件，以及集成过程中需要关注的平台差异。

## 目录

1. 交付内容
2. 适用范围
3. 集成前提
4. SDK 导入
5. 快速集成流程
6. API 参考
7. 参数参考
8. 事件参考
9. 渲染模式
10. 平台说明
11. 错误处理
12. 验证边界
13. 参考资料

## 1. 交付内容

标准交付内容如下：

1. `dist/agora-rtc-cocos-plugin.zip`
2. `example/basic-call`
3. 配套说明文档
   - [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md)
   - [customer-delivery-note.md](customer-delivery-note.md)
   - [customer-architecture-note.md](customer-architecture-note.md)
   - [api-verification-matrix.md](api-verification-matrix.md)

## 2. 适用范围

当前交付支持：

- `Cocos Creator 3.8.8`
- Android / iOS 原生导出工程
- Agora Native SDK `4.5.3`

SDK 提供：

- 统一 JavaScript / TypeScript API
- Android / iOS 原生桥接
- 音频通话、视频通话、设备控制
- 本地/远端视频视图绑定
- `surface-view` / `texture-view` / `engine-texture` 三种渲染后端
- 音频混音、音效、日志和诊断接口

## 3. 集成前提

接入前需要准备：

- `Cocos Creator 3.8.8`
- 有效的 Agora `App ID`
- 业务侧生成的 `Token`
- 业务侧定义的 `channelId`
- 业务侧定义的 `uid` 或 `userAccount`
- Android Studio / Android SDK / JDK 17
- Xcode 15+ / CocoaPods

客户接入时主要参考以下交付物：

- `dist/agora-rtc-cocos-plugin.zip`
  用于通过 Cocos Extension Manager 导入的标准插件包。
- `example/basic-call`
  用于参考初始化、入会、渲染和事件消费方式的示例工程。

## 4. SDK 导入

### 4.1 插件导入

标准导入方式如下：

1. 通过 Cocos Extension Manager 导入 `dist/agora-rtc-cocos-plugin.zip`

导入完成后，应确认目标项目中存在：

```text
extensions/agora-rtc
```

## 5. 快速集成流程

标准集成流程如下：

1. 导入插件
2. 在业务脚本中创建 `AgoraRtcClient`
3. 设置渲染后端 `setRenderBackend`
4. 调用 `initialize`
5. 如需本地预览或视频通话，先绑定本地视频视图
6. 调用 `joinChannel` 或 `joinChannelWithUserAccount`
7. 监听 `userJoined`、`userOffline`、`joinChannelSuccess`、`error` 等事件
8. 远端用户上麦/入会后，绑定远端视频视图
9. 离会时调用 `leaveChannel`
10. 页面销毁或业务退出时调用 `destroy`

### 5.1 最小接入示例

```ts
import { createAgoraRtcClient } from '../../extensions/agora-rtc/js/agora.ts';

const client = createAgoraRtcClient();

client.on('joinChannelSuccess', ({ channelId, uid }) => {
  console.log('joined', channelId, uid);
});

client.on('userJoined', async ({ uid }) => {
  await client.setupRemoteVideoView(uid, {
    x: 0,
    y: 0,
    width: 320,
    height: 180,
    renderMode: 'fit',
    textureWidth: 320,
    textureHeight: 180,
  });
});

client.on('error', ({ message }) => {
  console.error('agora error', message);
});

await client.setRenderBackend('engine-texture');
await client.initialize('YOUR_APP_ID');
await client.enableVideo(true);
await client.setupLocalVideoView({
  x: 0,
  y: 0,
  width: 320,
  height: 180,
  renderMode: 'hidden',
  textureWidth: 320,
  textureHeight: 180,
  uid: 0,
  mirrorMode: 0,
  setupMode: 0,
  sourceType: 0,
});
await client.joinChannel('YOUR_TOKEN', 'test-channel', 1001, {
  clientRoleType: 'broadcaster',
  channelProfile: 'communication',
  publishCameraTrack: true,
  publishMicrophoneTrack: true,
  autoSubscribeAudio: true,
  autoSubscribeVideo: true,
});
```

### 5.2 使用字符串账号入会

如果业务系统使用字符串账号而不是整型 `uid`，可使用：

```ts
await client.joinChannelWithUserAccount(
  'YOUR_TOKEN',
  'test-channel',
  'user-001',
  {
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
  },
);
```

如需查询映射后的用户信息，可调用：

```ts
const userInfo = await client.getUserInfoByUserAccount('user-001');
```

### 5.3 离场清理顺序

建议按以下顺序执行清理：

1. `stopPreview()`
2. `leaveChannel()`
3. `removeLocalVideoView()`
4. `removeRemoteVideoView(uid)`
5. `destroy()`

## 6. API 参考

以下为 SDK 对外公开的主要 API，所有接口均通过 `AgoraRtcClient` 调用。

### 6.1 客户端创建与销毁

| 接口 | 说明 |
| --- | --- |
| `createAgoraRtcClient(options?)` | 创建 RTC 客户端 |
| `destroy()` | 销毁引擎、移除桥接监听 |

Integration note:

- One `AgoraRtcClient` instance should be used for one business session.
- 页面退出或场景销毁前必须调用 `destroy()`。

### 6.2 初始化与基础信息

| 接口 | 参数 | 说明 |
| --- | --- | --- |
| `setRenderBackend(backend)` | `surface-view` / `texture-view` / `engine-texture` | 设置视频渲染后端 |
| `initialize(config)` | `string` 或 `AgoraRtcEngineConfig` | 初始化引擎 |
| `getSdkVersion()` | - | 获取原生 SDK 版本 |
| `getErrorDescription(code)` | `code: number` | 获取错误码描述 |
| `setLogFilter(level)` | `level: number` | 设置日志等级 |
| `setLogFile(path)` | `path: string` | 设置日志输出路径 |
| `setParameters(parameters)` | `string` 或对象 | 透传原生参数 |

Platform note:

- `initialize(appId)` is sufficient for most integrations.
- `AgoraRtcEngineConfig` can be passed when finer initialization control is required.
- `setRenderBackend` 应在 `initialize` 前调用。

### 6.3 频道与角色

| 接口 | 参数 | 说明 |
| --- | --- | --- |
| `setChannelProfile(profile)` | `'communication' \| 'liveBroadcasting'` | 设置频道场景 |
| `setClientRole(role, options?)` | `'broadcaster' \| 'audience'` | 设置角色 |
| `joinChannel(token, channelId, uid, options?)` | 标准整型 UID 入会 | 加入频道 |
| `joinChannelWithUserAccount(token, channelId, userAccount, options?)` | 字符串账号入会 | 加入频道 |
| `getUserInfoByUserAccount(userAccount)` | `userAccount: string` | 查询用户映射信息 |
| `leaveChannel(options?)` | `AgoraLeaveChannelOptions` | 离开频道 |
| `renewToken(token)` | `token: string` | 更新 token |

Integration note:

- 普通通话场景使用 `communication`。
- 直播场景使用 `liveBroadcasting`，并结合 `setClientRole` 设置主播/观众。
- `App ID`、`Token`、`channelId`、`uid` should be injected by the business system rather than hard-coded in the plugin.

### 6.4 音频控制

| 接口 | 说明 |
| --- | --- |
| `enableAudio(enabled)` | 开启/关闭音频模块 |
| `enableLocalAudio(enabled)` | 开启/关闭本地采集 |
| `muteLocalAudioStream(muted)` | 静音本地音频流 |
| `muteRemoteAudioStream(uid, muted)` | 静音指定远端用户音频 |
| `muteAllRemoteAudioStreams(muted)` | 静音全部远端音频 |
| `setAudioProfile(profile, scenario?)` | 设置音频档位 |
| `enableAudioVolumeIndication(interval, smooth?, reportVad?)` | 开启音量回调 |
| `setDefaultAudioRouteToSpeakerphone(enabled)` | 设置默认音频路由 |
| `setEnableSpeakerphone(enabled)` | 开关扬声器 |
| `isSpeakerphoneEnabled()` | 获取扬声器状态 |
| `adjustPlaybackSignalVolume(volume)` | 调整播放音量 |
| `adjustUserPlaybackSignalVolume(uid, volume)` | 调整指定远端用户播放音量 |
| `setAudioSessionOperationRestriction(restriction)` | 设置音频会话限制 |

Integration note:

- 如果客户需要说话人音量条，使用 `enableAudioVolumeIndication(...)`。
- `adjustUserPlaybackSignalVolume` 依赖有效远端 `uid`。
- On Android, `setAudioSessionOperationRestriction` currently returns `unsupported` and should not be treated as a primary integration path.

### 6.5 视频控制

| 接口 | 说明 |
| --- | --- |
| `enableVideo(enabled)` | 开启/关闭视频模块 |
| `enableLocalVideo(enabled)` | 开启/关闭本地视频采集 |
| `muteLocalVideoStream(muted)` | 停发本地视频流 |
| `muteRemoteVideoStream(uid, muted)` | 停收指定远端视频 |
| `muteAllRemoteVideoStreams(muted)` | 停收全部远端视频 |
| `setVideoEncoderConfiguration(config)` | 设置编码参数 |
| `startPreview(sourceType?)` | 开启本地预览 |
| `stopPreview(sourceType?)` | 停止本地预览 |
| `switchCamera()` | 前后摄切换 |
| `setBeautyEffectOptions(enabled, options, sourceType?)` | 设置美颜 |
| `enableContentInspect(enabled, config?)` | 开启内容审核 |

Integration note:

- 视频通话前通常先 `enableVideo(true)`。
- 有本地预览需求时，可在入会前先 `setupLocalVideoView()` + `startPreview()`。
- Video encoder parameters are typically wrapped by the business layer into presets such as `360p/540p/720p`.

### 6.6 视频视图与渲染

| 接口 | 说明 |
| --- | --- |
| `setupLocalVideoView(canvas)` | 绑定本地视频区域 |
| `setupRemoteVideoView(uid, canvas)` | 绑定远端视频区域 |
| `updateLocalVideoView(canvas)` | 更新本地视频区域 |
| `updateRemoteVideoView(uid, canvas)` | 更新远端视频区域 |
| `removeLocalVideoView()` | 移除本地视频区域 |
| `removeRemoteVideoView(uid)` | 移除远端视频区域 |
| `setNativeVideoOverlaySuspended(suspended)` | 暂停/恢复原生视频覆盖层 |
| `getEngineTexture(slotId)` | 读取 `engine-texture` 槽位纹理 |
| `isEngineTextureReady(slotId)` | 判断纹理槽位是否就绪 |

### 6.7 音频混音与音效

| 接口 | 说明 |
| --- | --- |
| `startAudioMixing(config)` | 开始音乐混音 |
| `pauseAudioMixing()` | 暂停混音 |
| `resumeAudioMixing()` | 恢复混音 |
| `stopAudioMixing()` | 停止混音 |
| `getAudioMixingCurrentPosition()` | 获取混音进度 |
| `setAudioMixingPosition(positionMs)` | 设置混音进度 |
| `adjustAudioMixingVolume(volume)` | 设置混音总音量 |
| `adjustAudioMixingPublishVolume(volume)` | 设置上行混音音量 |
| `adjustAudioMixingPlayoutVolume(volume)` | 设置本地播放混音音量 |
| `preloadEffect(soundId, path, startPos?)` | 预加载音效 |
| `playEffect(config)` | 播放音效 |
| `pauseEffect(soundId)` | 暂停音效 |
| `resumeEffect(soundId)` | 恢复音效 |
| `setEffectsVolume(volume)` | 设置音效总音量 |
| `stopEffect(soundId)` | 停止音效 |

Platform note:

- `startAudioMixing(config)` 当前不支持 `replace` 字段；若传入会直接在 JS 层返回 `ProtocolError`。
- `volume` 取值范围应保持在 `0-100`。

## 7. Parameter Reference

### 7.1 `AgoraRtcVideoCanvas`

| 字段 | 说明 |
| --- | --- |
| `x`, `y`, `width`, `height` | 视频区域矩形 |
| `renderMode` | `'hidden'` / `'fit'` / `'adaptive'` |
| `uid` | 用户 ID，本地视图通常为 `0` |
| `mirrorMode` | 镜像模式 |
| `setupMode` | 视图绑定模式 |
| `sourceType` | 视频源类型 |
| `textureWidth`, `textureHeight` | `engine-texture` 模式下应同步设置 |
| `cropArea` | 裁剪区域 |
| `backgroundColor` | 背景色 |
| `position` | 内容审核等能力会使用 |

### 7.2 `AgoraRtcEngineConfig`

Advanced initialization parameters. Common fields include:

- `appId`
- `areaCode`
- `audioScenario`
- `logConfig`
- `extensions`

For most integrations:

```ts
await client.initialize({
  appId: 'YOUR_APP_ID',
});
```

### 7.3 `AgoraChannelMediaOptions`

Channel join parameters. Common fields include:

- `clientRoleType`
- `channelProfile`
- `publishCameraTrack`
- `publishMicrophoneTrack`
- `autoSubscribeAudio`
- `autoSubscribeVideo`
- `startPreview`
- `sourceType`
- `token`

Typical video call configuration:

```ts
{
  clientRoleType: 'broadcaster',
  channelProfile: 'communication',
  publishCameraTrack: true,
  publishMicrophoneTrack: true,
  autoSubscribeAudio: true,
  autoSubscribeVideo: true,
}
```

### 7.4 `AgoraLeaveChannelOptions`

Optional leave-channel parameters:

- `stopAudioMixing`
- `stopAllEffect`
- `unloadAllEffect`
- `stopMicrophoneRecording`

If the business flow requires explicit cleanup of effects and mixing on leave, pass these fields explicitly.

### 7.5 `AgoraVideoEncoderConfiguration`

Common fields:

- `width`
- `height`
- `frameRate`
- `bitrate`
- `orientationMode`
- `mirrorMode`
- `degradationPreference`

These parameters are typically wrapped into business-level presets.

## 8. Event Reference

The following events are publicly exposed by the SDK:

| 事件名 | 说明 |
| --- | --- |
| `joinChannelSuccess` | 入会成功 |
| `leaveChannel` | 离会回调 |
| `rejoinChannelSuccess` | 重连成功 |
| `connectionInterrupted` | 连接中断 |
| `connectionStateChanged` | 连接状态变化 |
| `userJoined` | 远端用户加入 |
| `userOffline` | 远端用户离开 |
| `remoteVideoStateChanged` | 远端视频状态变化 |
| `localVideoStateChanged` | 本地视频状态变化 |
| `remoteAudioStateChanged` | 远端音频状态变化 |
| `firstLocalAudioFramePublished` | 首帧本地音频发布 |
| `volumeIndication` | 音量指示 |
| `rtcStats` | RTC 统计信息 |
| `audioMixingFinished` | 混音结束 |
| `audioMixingStateChanged` | 混音状态变化 |
| `contentInspectResult` | 内容审核结果 |
| `localVideoTextureReady` | 本地纹理准备完成 |
| `remoteVideoTextureReady` | 远端纹理准备完成 |
| `localVideoTextureReleased` | 本地纹理释放 |
| `remoteVideoTextureReleased` | 远端纹理释放 |
| `renderBackendState` | 渲染后端状态变化 |
| `error` | SDK/桥接错误 |

### 8.1 Core events for business integration

The following events should be consumed in most integrations:

- `joinChannelSuccess`
- `userJoined`
- `userOffline`
- `connectionStateChanged`
- `remoteVideoStateChanged`
- `remoteAudioStateChanged`
- `rtcStats`
- `error`

### 8.2 `engine-texture` event note

If `engine-texture` is used, also consume:

- `localVideoTextureReady`
- `remoteVideoTextureReady`

After the texture-ready event is received, `getEngineTexture(slotId)` can be used to fetch the texture and bind it to a Cocos `SpriteFrame`.

## 9. 渲染模式

### 9.1 渲染后端选择

- `surface-view` / `texture-view` 适合快速接通和原生视图覆盖。
- `engine-texture` 适合将视频作为 Cocos `Texture2D` 接入场景渲染。
- 如果视频需要完全纳入 Cocos 场景编排，优先使用 `engine-texture`。

### 9.2 推荐视频接入路径

典型实时音视频场景可按以下优先级选择渲染模式：

1. 需要快速接入、接受原生覆盖层：
   `surface-view`
2. 需要视频纳入 Cocos 场景渲染：
   `engine-texture`

## 10. 平台说明

以下平台说明属于集成边界的一部分。

### 10.1 Android

- 原生依赖：
  - `io.agora.rtc:full-sdk:4.5.3`
  - `io.agora.rtc:full-screen-sharing:4.5.3`
- `setAudioSessionOperationRestriction` 当前返回 `unsupported`。
- `setDefaultAudioRouteToSpeakerphone` 可在 Android 侧使用。
- `engine-texture` 可作为标准渲染模式使用。

### 10.2 iOS

- 原生依赖：
  - `AgoraRtcEngine_iOS 4.5.3`
- 依赖集成方式：
  - `CocoaPods`
- `setAudioSessionOperationRestriction` 可在 iOS 侧使用。
- `setDefaultAudioRouteToSpeakerphone` 可在 iOS 侧使用。
- `engine-texture` 可作为标准渲染模式使用。

### 10.3 通用平台说明

以下说明适用于 Android 与 iOS：

- `warning` 不在当前对外事件清单中，不应按该事件建立业务依赖。
- `EnableVideoObserver` 属于内部实现，不是客户公开 API。
- `PreloadEngine / UnloadEngine` 不属于客户公开调用路径，生命周期控制应使用 `initialize / destroy`。
- `setNativeVideoOverlaySuspended` 仅对原生视图覆盖型渲染后端有实际意义；`engine-texture` 模式下没有可见原生覆盖层。
- `joinChannel`、远端媒体、首帧渲染等真实效果验证，仍依赖业务侧有效 `App ID`、`Token`、`channelId`。

## 11. 错误处理

### 11.1 `error` 事件

The SDK reports runtime and bridge errors through the `error` event. The event payload format is:

```ts
{
  code?: number | string;
  message: string;
}
```

The following fields should be captured in error logs:

- 当前调用的 API 名称
- 当前频道号 / 用户号
- `error.code`
- `error.message`
- 当前平台和渲染后端

### 11.2 JS 层统一错误码

The JS SDK exposes the following unified error codes:

| 错误码 | 说明 | 常见原因 |
| --- | --- | --- |
| `bridge_unavailable` | 原生桥不可用 | 非原生运行时、桥接未注入、插件未正确导入 |
| `timeout` | 原生请求超时 | 原生层未响应、线程阻塞、桥接链路异常 |
| `native_failure` | 原生调用失败 | 原生 SDK 返回负值错误码 |
| `protocol_error` | JS 入参不符合桥接约束 | 传入不支持的字段，例如 `startAudioMixing.replace` |

### 11.3 推荐排查顺序

出现集成问题时，建议按以下顺序排查：

1. 确认运行环境是否为原生环境，而不是 Web 预览环境
2. 确认 `extensions/agora-rtc` 已正确导入
3. 确认已先调用 `setRenderBackend()` 和 `initialize()`
4. 确认 `App ID`、`Token`、`channelId`、`uid` 是否有效
5. 确认本地视频视图是否在 `joinChannel()` 前完成绑定
6. 确认监听了 `error`、`joinChannelSuccess`、`userJoined`、`renderBackendState`
7. 确认平台特有接口是否在当前平台受支持

## 12. 验证边界

当前交付范围内可提供的验证包括：

- `npm test`
  覆盖 JS 请求结构、模板桥接、示例调用链和文档一致性检查。
- Android 导出、构建、安装、启动验证。
- iOS 导出、构建、签名、安装、启动验证。

以下验证仍需由接入方自行完成：

- 使用真实 `App ID` / `Token` 进行入会联调
- 真实网络环境下的音视频质量验证
- 业务 UI 与场景集成验证
- 多端互通验证

## 13. 参考资料

- [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md)
- [customer-delivery-note.md](customer-delivery-note.md)
- [customer-architecture-note.md](customer-architecture-note.md)
- [Basic Call README](../example/basic-call/README.md)
