# Agora Cocos RTC SDK API Guide

更新日期：`2026-06-12`

## 文档目的

本文档是 `Agora Cocos RTC SDK` 的正式客户交付版 API 与集成指南。
文档说明 SDK 交付内容、在客户 Cocos Creator 项目中的导入方式、初始化与加入频道流程、可用 API、核心对象参数、业务可消费事件，以及集成过程中需要关注的平台差异。

## 目录

1. 交付内容
2. 适用范围
3. 集成前提
4. SDK Import
5. Quick Integration Workflow
6. Recommended Lifecycle
7. API 参考
8. 参数参考
9. 事件参考
10. 渲染模式
11. 平台说明
12. 错误处理
13. 验证边界
14. 参考资料

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

## SDK Import

### Option A: Import the packaged plugin

适用于客户按标准交付包接入的场景。

1. 通过 Cocos Extension Manager 导入 `dist/agora-rtc-cocos-plugin.zip`。
2. 确认目标项目中已生成 `extensions/agora-rtc`。
3. 将目标项目导出为 Android 或 iOS 原生工程。

### Option B: Import the unpacked SDK during development

适用于联调、二次开发或直接查看 SDK 源码的场景。

1. 将 `sdk/agora-rtc` 复制或软链接到目标项目的 `extensions/agora-rtc`。
2. 重新打开 Cocos 项目，确保扩展已被加载。
3. 按照下文的集成步骤继续接入。

## Quick Integration Workflow

建议按以下清单完成接入：

1. 将 SDK 导入目标项目。
2. 准备有效的 Agora `App ID`、`Token`、`channelId`、`uid` 或 `userAccount`。
3. 在业务代码中创建 `AgoraRtcClient` 实例。
4. 调用 `setRenderBackend(...)` 设置渲染后端。
5. 调用 `initialize(...)`。
6. 如果需要视频能力，调用 `enableVideo(true)` 并绑定本地视图。
7. 先注册最基本的频道、用户和错误事件，并按需补充视频、音频和统计事件。
8. 加入频道。
9. 远端用户加入后绑定远端视图。
10. 在页面销毁或业务结束时离开频道并销毁客户端。

## Recommended Lifecycle

以下流程以 `sdk/agora-rtc/js/agora.ts` 中已提供的接口为准，建议业务代码按照生命周期组织接入逻辑。

### Initialization

初始化阶段建议按以下顺序执行：

1. 调用 `createAgoraRtcClient()` 创建客户端实例。
2. 调用 `setRenderBackend('surface-view' | 'texture-view' | 'engine-texture')` 选择渲染后端。
3. 调用 `initialize(appId)` 或 `initialize({ appId, ...config })` 完成引擎初始化。
4. 根据业务需要调用 `setChannelProfile(...)`、`setClientRole(...)`、`setVideoEncoderConfiguration(...)` 等可选配置接口。
5. 在入会前完成事件注册，至少建议监听 `joinChannelSuccess`、`userJoined`、`userOffline`、`error`，并按需补充 `rtcStats`、`remoteVideoStateChanged`、`remoteAudioStateChanged`、`volumeIndication` 等事件。

### Local Preview

如果业务包含视频通话或本地预览，建议在入会前完成本地视频准备：

1. 调用 `enableVideo(true)` 开启视频模块。
2. 调用 `setupLocalVideoView(canvas)` 绑定本地渲染区域。
3. 如需在入会前先展示摄像头预览，可额外调用 `startPreview(sourceType?)`。
4. 如果业务后续需要更新布局，可调用 `updateLocalVideoView(canvas)`。
5. 如果选择 `engine-texture`，除绑定视图外，还需要监听 `localVideoTextureReady`，并在回调中通过 `getEngineTexture(slotId)` 尝试取得纹理后绑定到 Cocos `Texture2D` / `SpriteFrame`。需要注意，事件触发时纹理槽位可能仍在准备中，`getEngineTexture(slotId)` 可能暂时返回 `null`，业务侧应结合就绪检查或重试逻辑完成绑定。

### Channel Join

入会阶段根据业务使用的身份类型选择一种接口：

1. 数值身份场景调用 `joinChannel(token, channelId, uid, options?)`。
2. 字符串账号场景调用 `joinChannelWithUserAccount(token, channelId, userAccount, options?)`。
3. 如需查询字符串账号与数值 UID 的映射结果，可调用 `getUserInfoByUserAccount(userAccount)`。
4. Token 即将过期或需要续期时，调用 `renewToken(token)`。

### Remote User Handling

远端用户生命周期建议围绕事件回调组织：

1. 在 `userJoined` 事件中调用 `setupRemoteVideoView(uid, canvas)` 绑定远端画面。
2. 如需变更远端画面位置或尺寸，可调用 `updateRemoteVideoView(uid, canvas)`。
3. 在 `userOffline` 事件中调用 `removeRemoteVideoView(uid)` 清理远端画面。
4. 可结合 `remoteVideoStateChanged`、`remoteAudioStateChanged`、`rtcStats` 判断订阅状态和通话质量。
5. 如果选择 `engine-texture`，还需要监听 `remoteVideoTextureReady`，并在回调中通过 `getEngineTexture(slotId)` 尝试取得远端纹理，再绑定到对应的 Cocos 渲染资源。与本地纹理相同，远端纹理在事件触发后也可能暂时不可取到，建议配合项目侧重试机制处理。

### Leave and Destroy

退出阶段建议显式清理会话资源，避免原生资源残留：

1. 如果此前开启了本地预览，调用 `stopPreview(sourceType?)`。
2. 调用 `leaveChannel(options?)` 离开频道。
3. 调用 `removeLocalVideoView()` 清理本地画面。
4. 对仍保留的远端用户调用 `removeRemoteVideoView(uid)`。
5. 最后调用 `destroy()` 销毁引擎与桥接监听。

### Lifecycle Example

以下示例展示一个与上述生命周期一致的最小视频通话接入流程。该示例使用 `surface-view`，便于客户先完成最小接通；如果业务改用 `engine-texture`，还需要补充下文所述的纹理就绪事件处理与纹理绑定逻辑。

```ts
import { createAgoraRtcClient } from '../../extensions/agora-rtc/js/agora.ts';

const client = createAgoraRtcClient();
const remoteUsers = new Set<number>();

client.on('joinChannelSuccess', ({ channelId, uid, elapsed }) => {
  console.log('joinChannelSuccess', channelId, uid, elapsed);
});

client.on('userJoined', async ({ uid }) => {
  remoteUsers.add(uid);
  await client.setupRemoteVideoView(uid, {
    x: 360,
    y: 0,
    width: 320,
    height: 180,
    renderMode: 'fit',
    textureWidth: 320,
    textureHeight: 180,
  });
});

client.on('userOffline', async ({ uid, reason }) => {
  remoteUsers.delete(uid);
  await client.removeRemoteVideoView(uid);
  console.log('userOffline', uid, reason);
});

client.on('error', ({ code, message }) => {
  console.error('error', code, message);
});

await client.setRenderBackend('surface-view');
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

export async function teardownRtcSession(): Promise<void> {
  // 此示例未调用 startPreview()，因此销毁时不需要 stopPreview()。
  // 如果业务在入会前或通话中开启了本地预览，请先调用 stopPreview() 再执行后续清理。
  await client.leaveChannel();
  await client.removeLocalVideoView();
  for (const uid of remoteUsers) {
    await client.removeRemoteVideoView(uid);
  }
  await client.destroy();
}
```

如果业务使用 `engine-texture`，请在上述最小流程之外补充纹理绑定逻辑。请不要假设纹理就绪事件一触发就一定能立即取到 `Texture2D`；参考示例工程的处理方式，建议在 `getEngineTexture(slotId)` 返回 `null` 时继续重试绑定。典型处理方式如下：

```ts
function bindLocalTextureWithRetry(slotId: number, retryCount = 0) {
  const texture = client.getEngineTexture(slotId);
  if (!texture) {
    if (retryCount < 10) {
      setTimeout(() => bindLocalTextureWithRetry(slotId, retryCount + 1), 16);
    }
    return;
  }
  localSpriteFrame.texture = texture as Texture2D;
}

function bindRemoteTextureWithRetry(uid: number, slotId: number, retryCount = 0) {
  const texture = client.getEngineTexture(slotId);
  if (!texture) {
    if (retryCount < 10) {
      setTimeout(() => bindRemoteTextureWithRetry(uid, slotId, retryCount + 1), 16);
    }
    return;
  }
  bindRemoteSpriteFrame(uid, texture as Texture2D);
}

client.on('localVideoTextureReady', ({ slotId }) => {
  bindLocalTextureWithRetry(slotId);
});

client.on('remoteVideoTextureReady', ({ uid, slotId }) => {
  bindRemoteTextureWithRetry(uid, slotId);
});
```

### 使用字符串账号入会

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

## 7. API 参考

以下为 SDK 对外公开的主要 API，所有接口均通过 `AgoraRtcClient` 调用。

### 7.1 客户端创建与销毁

| 接口 | 说明 |
| --- | --- |
| `createAgoraRtcClient(options?)` | 创建 RTC 客户端 |
| `destroy()` | 销毁引擎、移除桥接监听 |

集成说明：

- 建议一个业务会话对应一个 `AgoraRtcClient` 实例。
- 页面退出或场景销毁前必须调用 `destroy()`。

### 7.2 初始化与基础信息

| 接口 | 参数 | 说明 |
| --- | --- | --- |
| `setRenderBackend(backend)` | `surface-view` / `texture-view` / `engine-texture` | 设置视频渲染后端 |
| `initialize(config)` | `string` 或 `AgoraRtcEngineConfig` | 初始化引擎 |
| `getSdkVersion()` | - | 获取原生 SDK 版本 |
| `getErrorDescription(code)` | `code: number` | 获取错误码描述 |
| `setLogFilter(level)` | `level: number` | 设置日志等级 |
| `setLogFile(path)` | `path: string` | 设置日志输出路径 |
| `setParameters(parameters)` | `string` 或对象 | 透传原生参数 |

平台说明：

- 大多数接入场景直接使用 `initialize(appId)` 即可。
- 如需更细粒度的初始化控制，可传入 `AgoraRtcEngineConfig`。
- `setRenderBackend` 应在 `initialize` 前调用。

### 7.3 频道与角色

| 接口 | 参数 | 说明 |
| --- | --- | --- |
| `setChannelProfile(profile)` | `'communication' \| 'liveBroadcasting'` | 设置频道场景 |
| `setClientRole(role, options?)` | `'broadcaster' \| 'audience'` | 设置角色 |
| `joinChannel(token, channelId, uid, options?)` | 标准整型 UID 入会 | 加入频道 |
| `joinChannelWithUserAccount(token, channelId, userAccount, options?)` | 字符串账号入会 | 加入频道 |
| `getUserInfoByUserAccount(userAccount)` | `userAccount: string` | 查询用户映射信息 |
| `leaveChannel(options?)` | `AgoraLeaveChannelOptions` | 离开频道 |
| `renewToken(token)` | `token: string` | 更新 token |

集成说明：

- 普通通话场景使用 `communication`。
- 直播场景使用 `liveBroadcasting`，并结合 `setClientRole` 设置主播/观众。
- `App ID`、`Token`、`channelId`、`uid` 应由业务系统注入，不应写死在插件中。

### 7.4 音频控制

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

集成说明：

- 如果客户需要说话人音量条，使用 `enableAudioVolumeIndication(...)`。
- `adjustUserPlaybackSignalVolume` 依赖有效远端 `uid`。
- 在 Android 上，`setAudioSessionOperationRestriction` 当前返回 `unsupported`，不应作为主业务路径依赖。

### 7.5 视频控制

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

集成说明：

- 视频通话前通常先 `enableVideo(true)`。
- 有本地预览需求时，可在入会前先 `setupLocalVideoView()` + `startPreview()`。
- 编码参数通常由业务层封装为 `360p/540p/720p` 等预设档位。

### 7.6 视频视图与渲染

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

### 7.7 音频混音与音效

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

平台说明：

- `startAudioMixing(config)` 当前不支持 `replace` 字段；若传入会直接在 JS 层返回 `ProtocolError`。
- `volume` 取值范围应保持在 `0-100`。

## 8. 参数参考

### 8.1 `AgoraRtcVideoCanvas`

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

### 8.2 `AgoraRtcEngineConfig`

初始化高级参数，常用字段包括：

- `appId`
- `areaCode`
- `audioScenario`
- `logConfig`
- `extensions`

大多数接入场景可使用：

```ts
await client.initialize({
  appId: 'YOUR_APP_ID',
});
```

### 8.3 `AgoraChannelMediaOptions`

入会参数，常用字段包括：

- `clientRoleType`
- `channelProfile`
- `publishCameraTrack`
- `publishMicrophoneTrack`
- `autoSubscribeAudio`
- `autoSubscribeVideo`
- `startPreview`
- `sourceType`
- `token`

典型视频通话配置：

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

### 8.4 `AgoraLeaveChannelOptions`

离会可选参数：

- `stopAudioMixing`
- `stopAllEffect`
- `unloadAllEffect`
- `stopMicrophoneRecording`

如果业务流程需要在离会时主动清理音效与混音，可显式传入这些字段。

### 8.5 `AgoraVideoEncoderConfiguration`

常用字段：

- `width`
- `height`
- `frameRate`
- `bitrate`
- `orientationMode`
- `mirrorMode`
- `degradationPreference`

这些参数通常由业务层封装为预设档位。

## 9. 事件参考

以下为 SDK 对外公开的事件：

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

### 9.1 业务侧重点监听事件

大多数接入场景建议优先监听以下最小事件集，并按需逐步增加更多状态事件：

- `joinChannelSuccess`
- `userJoined`
- `userOffline`
- `connectionStateChanged`
- `remoteVideoStateChanged`
- `remoteAudioStateChanged`
- `rtcStats`
- `error`

### 9.2 `engine-texture` 事件说明

如果使用 `engine-texture`，还应监听：

- `localVideoTextureReady`
- `remoteVideoTextureReady`

收到纹理就绪事件后，可通过 `getEngineTexture(slotId)` 尝试获取纹理，并绑定到 Cocos `SpriteFrame`。需要注意，事件回调触发时 `getEngineTexture(slotId)` 仍可能暂时返回 `null`；建议结合项目侧重试逻辑、定时轮询或可用性检查后再完成绑定。

## 10. 渲染模式

### 10.1 渲染后端选择

- `surface-view` / `texture-view` 适合快速接通和原生视图覆盖。
- `engine-texture` 适合将视频作为 Cocos `Texture2D` 接入场景渲染。
- 如果视频需要完全纳入 Cocos 场景编排，优先使用 `engine-texture`。

### 10.2 推荐视频接入路径

典型实时音视频场景可按以下优先级选择渲染模式：

1. 需要快速接入、接受原生覆盖层：
   `surface-view`
2. 需要视频纳入 Cocos 场景渲染：
   `engine-texture`

## 11. 平台说明

以下平台说明属于集成边界的一部分。

### 11.1 Android

- 原生依赖：
  - `io.agora.rtc:full-sdk:4.5.3`
  - `io.agora.rtc:full-screen-sharing:4.5.3`
- `setAudioSessionOperationRestriction` 当前返回 `unsupported`。
- `setDefaultAudioRouteToSpeakerphone` 可在 Android 侧使用。
- `engine-texture` 可作为标准渲染模式使用。

### 11.2 iOS

- 原生依赖：
  - `AgoraRtcEngine_iOS 4.5.3`
- 依赖集成方式：
  - `CocoaPods`
- `setAudioSessionOperationRestriction` 可在 iOS 侧使用。
- `setDefaultAudioRouteToSpeakerphone` 可在 iOS 侧使用。
- `engine-texture` 可作为标准渲染模式使用。

### 11.3 通用平台说明

以下说明适用于 Android 与 iOS：

- `warning` 不在当前对外事件清单中，不应按该事件建立业务依赖。
- `EnableVideoObserver` 属于内部实现，不是客户公开 API。
- `PreloadEngine / UnloadEngine` 不属于客户公开调用路径，生命周期控制应使用 `initialize / destroy`。
- `setNativeVideoOverlaySuspended` 仅对原生视图覆盖型渲染后端有实际意义；`engine-texture` 模式下没有可见原生覆盖层。
- `joinChannel`、远端媒体、首帧渲染等真实效果验证，仍依赖业务侧有效 `App ID`、`Token`、`channelId`。

## 12. 错误处理

### 12.1 `error` 事件

SDK 通过 `error` 事件向上报告运行时错误和桥接错误，事件载荷格式如下：

```ts
{
  code?: number | string;
  message: string;
}
```

建议在错误日志中统一记录以下字段：

- 当前调用的 API 名称
- 当前频道号 / 用户号
- `error.code`
- `error.message`
- 当前平台和渲染后端

### 12.2 JS 层统一错误码

JS SDK 对外暴露以下统一错误码：

| 错误码 | 说明 | 常见原因 |
| --- | --- | --- |
| `bridge_unavailable` | 原生桥不可用 | 非原生运行时、桥接未注入、插件未正确导入 |
| `timeout` | 原生请求超时 | 原生层未响应、线程阻塞、桥接链路异常 |
| `native_failure` | 原生调用失败 | 原生 SDK 返回负值错误码 |
| `protocol_error` | JS 入参不符合桥接约束 | 传入不支持的字段，例如 `startAudioMixing.replace` |

### 12.3 推荐排查顺序

出现集成问题时，建议按以下顺序排查：

1. 确认运行环境是否为原生环境，而不是 Web 预览环境
2. 确认 `extensions/agora-rtc` 已正确导入
3. 确认已先调用 `setRenderBackend()` 和 `initialize()`
4. 确认 `App ID`、`Token`、`channelId`、`uid` 是否有效
5. 确认本地视频视图是否在 `joinChannel()` 前完成绑定
6. 确认监听了 `error`、`joinChannelSuccess`、`userJoined`、`renderBackendState`
7. 确认平台特有接口是否在当前平台受支持

## 13. 验证边界

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

## 14. 参考资料

- [customer-delivery-note.md](customer-delivery-note.md)
- [customer-architecture-note.md](customer-architecture-note.md)
- [Basic Call README](../example/basic-call/README.md)
