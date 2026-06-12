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
7. 注册频道、用户、视频、音频、统计和错误事件。
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
5. 如果选择 `engine-texture`，除绑定视图外，还需要监听 `localVideoTextureReady`，并在回调中通过 `getEngineTexture(slotId)` 尝试取得纹理后绑定到 Cocos `Texture2D` / `SpriteFrame`。需要注意，事件触发时纹理槽位可能仍在准备中，`getEngineTexture(slotId)` 可能暂时返回 `null`，业务侧应结合就绪检查或重试逻辑完成绑定；当本地视频状态恢复可用或槽位稍后真正可用时，也可能需要再次执行本地绑定。

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

以下示例展示一个与上述生命周期一致的 `engine-texture` 视频通话接入流程。由于 `engine-texture` 需要把原生纹理绑定到 Cocos 渲染资源，示例中同时包含 `localVideoTextureReady` / `remoteVideoTextureReady` 事件处理，以及 `getEngineTexture(slotId)` 暂时返回 `null` 时的重试绑定逻辑。

```ts
import { createAgoraRtcClient } from '../../extensions/agora-rtc/js/agora.ts';
import type { Texture2D } from 'cc';

const client = createAgoraRtcClient();
const remoteUsers = new Set<number>();
const MAX_TEXTURE_BIND_RETRIES = 600;
const TEXTURE_BIND_RETRY_MS = 100;
const remoteTextureRetryTimers = new Map<number, ReturnType<typeof setTimeout>>();
let localTextureRetryTimer: ReturnType<typeof setTimeout> | null = null;
let localTextureSlotId: number | null = null;
const localSpriteFrame = /* your local SpriteFrame */ {} as { texture: Texture2D | null };

function bindRemoteSpriteFrame(uid: number, texture: Texture2D) {
  // Bind the texture to the SpriteFrame or render target used for this remote uid.
}

function bindLocalTextureWithRetry(slotId: number, retryCount = 0) {
  const texture = client.getEngineTexture(slotId) as Texture2D | null;
  if (!texture) {
    if (retryCount >= MAX_TEXTURE_BIND_RETRIES) {
      console.warn('local engine texture not ready', slotId);
      return;
    }
    localTextureRetryTimer = setTimeout(() => {
      bindLocalTextureWithRetry(slotId, retryCount + 1);
    }, TEXTURE_BIND_RETRY_MS);
    return;
  }
  if (localTextureRetryTimer) {
    clearTimeout(localTextureRetryTimer);
    localTextureRetryTimer = null;
  }
  localSpriteFrame.texture = texture;
}

function bindRemoteTextureWithRetry(uid: number, slotId: number, retryCount = 0) {
  const texture = client.getEngineTexture(slotId) as Texture2D | null;
  if (!texture) {
    if (retryCount >= MAX_TEXTURE_BIND_RETRIES) {
      console.warn('remote engine texture not ready', uid, slotId);
      return;
    }
    const timer = setTimeout(() => {
      bindRemoteTextureWithRetry(uid, slotId, retryCount + 1);
    }, TEXTURE_BIND_RETRY_MS);
    remoteTextureRetryTimers.set(uid, timer);
    return;
  }
  const timer = remoteTextureRetryTimers.get(uid);
  if (timer) {
    clearTimeout(timer);
    remoteTextureRetryTimers.delete(uid);
  }
  bindRemoteSpriteFrame(uid, texture);
}

client.on('joinChannelSuccess', ({ channelId, uid, elapsed }) => {
  console.log('joinChannelSuccess', channelId, uid, elapsed);
});

client.on('localVideoTextureReady', ({ slotId }) => {
  localTextureSlotId = slotId;
  bindLocalTextureWithRetry(slotId);
});

client.on('localVideoStateChanged', ({ state }) => {
  if (state === 1 && localTextureSlotId !== null) {
    // When local video becomes usable again, re-run your local binding if needed.
    bindLocalTextureWithRetry(localTextureSlotId);
  }
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

client.on('remoteVideoTextureReady', ({ uid, slotId }) => {
  bindRemoteTextureWithRetry(uid, slotId);
});

client.on('userOffline', async ({ uid, reason }) => {
  remoteUsers.delete(uid);
  const timer = remoteTextureRetryTimers.get(uid);
  if (timer) {
    clearTimeout(timer);
    remoteTextureRetryTimers.delete(uid);
  }
  await client.removeRemoteVideoView(uid);
  console.log('userOffline', uid, reason);
});

client.on('error', ({ code, message }) => {
  console.error('error', code, message);
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

export async function teardownRtcSession(): Promise<void> {
  // 此示例未调用 startPreview()，因此销毁时不需要 stopPreview()。
  // 如果业务在入会前或通话中开启了本地预览，请先调用 stopPreview() 再执行后续清理。
  if (localTextureRetryTimer) {
    clearTimeout(localTextureRetryTimer);
    localTextureRetryTimer = null;
  }
  localTextureSlotId = null;
  for (const timer of remoteTextureRetryTimers.values()) {
    clearTimeout(timer);
  }
  remoteTextureRetryTimers.clear();
  await client.leaveChannel();
  await client.removeLocalVideoView();
  for (const uid of remoteUsers) {
    await client.removeRemoteVideoView(uid);
  }
  await client.destroy();
}
```

上面的重试参数是示意性的生产级写法，重点是保留足够长的重试窗口，并在本地视频重新可用时触发一次重绑定；项目侧可参考示例工程使用更完整的槽位记录和重绑策略。

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

## API Reference

以下 API 以当前仓库中的 `AgoraRtcClient` 与配套导出函数为准，参数类型详情见后续“参数参考”章节。

### Client Creation and Teardown

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `createAgoraRtcClient` | `createAgoraRtcClient(options?: AgoraRtcClientOptions): AgoraRtcClient` | 创建 RTC 客户端实例并自动准备桥接监听。 | 应用启动通话流程、创建单次会话对应的客户端时使用。 |
| `destroy` | `destroy(): Promise<void>` | 销毁原生引擎并清理 JS 侧待处理请求、事件监听与桥接状态。 | 离会后不再复用该实例，或场景销毁前释放资源时使用。 |

### Initialization and Diagnostics

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `on` | `on<K extends keyof AgoraEventMap>(eventName: K, listener: (payload: AgoraEventMap[K]) => void): () => void` | 注册 SDK 事件监听，并返回一个可直接执行的取消订阅函数。 | 需要监听用户上下线、远端音视频状态、错误或纹理事件时使用。 |
| `off` | `off<K extends keyof AgoraEventMap>(eventName: K, listener: (payload: AgoraEventMap[K]) => void): void` | 按事件名和原始回调移除监听。 | 组件卸载、场景切换或需要手动管理监听生命周期时使用。 |
| `setRenderBackend` | `setRenderBackend(backend: AgoraRenderBackend): Promise<void>` | 设置视频渲染后端，如 `surface-view`、`texture-view` 或 `engine-texture`。 | 需要在初始化前明确渲染路径，匹配项目的视图或纹理接入方案时使用。 |
| `initialize` | `initialize(config: string \| AgoraRtcEngineConfig): Promise<void>` | 初始化 RTC 引擎，支持仅传 `appId` 或传入完整引擎配置。 | 创建客户端后、首次调用入会或媒体能力前使用。 |
| `getSdkVersion` | `getSdkVersion(): Promise<string>` | 获取当前原生 Agora RTC SDK 版本字符串。 | 诊断环境、记录版本信息或做兼容性排查时使用。 |
| `getErrorDescription` | `getErrorDescription(code: number): Promise<string>` | 查询指定错误码在原生 SDK 中的文本描述。 | 需要将错误码转为可读说明，辅助日志或售后排查时使用。 |
| `setLogFilter` | `setLogFilter(level: number): Promise<void>` | 设置原生日志输出级别。 | 调试桥接、音视频接入或线上问题复现时使用。 |
| `setLogFile` | `setLogFile(path: string): Promise<void>` | 设置原生日志文件输出路径。 | 需要把 SDK 日志落盘，便于客户现场收集日志时使用。 |
| `setParameters` | `setParameters(parameters: string \| Record<string, unknown>): Promise<void>` | 透传 JSON 字符串或对象到原生 `setParameters`。 | 官方常规 API 未覆盖、需开启专项参数或排障开关时使用。 |

- `setRenderBackend(...)` 应在 `initialize(...)` 前调用，否则渲染行为可能与预期不一致。

### Channel and Role Control

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `setChannelProfile` | `setChannelProfile(profile: 'communication' \| 'liveBroadcasting'): Promise<void>` | 设置频道模式为通信或直播。 | 业务需要在通话和直播模式之间切换时使用。 |
| `setClientRole` | `setClientRole(role: 'broadcaster' \| 'audience', options?: AgoraClientRoleOptions): Promise<void>` | 设置用户角色，并可附带观众延迟等级等角色参数。 | 直播场景中区分主播与观众，或切换上下麦状态时使用。 |
| `joinChannel` | `joinChannel(token: string, channelId: string, uid: number, options?: AgoraChannelMediaOptions): Promise<void>` | 使用数值 `uid` 加入频道。 | 业务账号体系已经分配整数 UID，按标准 RTC 入会流程时使用。 |
| `joinChannelWithUserAccount` | `joinChannelWithUserAccount(token: string, channelId: string, userAccount: string, options?: AgoraChannelMediaOptions): Promise<void>` | 使用字符串账号加入频道。 | 业务侧更适合使用字符串用户标识，而不是自行维护整数 UID 时使用。 |
| `getUserInfoByUserAccount` | `getUserInfoByUserAccount(userAccount: string): Promise<AgoraUserInfo>` | 查询字符串账号与 Agora 用户信息映射结果。 | 使用字符串账号入会后，需要补取映射 UID 或核对身份信息时使用。 |
| `leaveChannel` | `leaveChannel(options?: AgoraLeaveChannelOptions): Promise<void>` | 离开当前频道，并可携带停止混音、停止音效等离会选项。 | 用户主动挂断、房间切换或异常恢复前清理频道状态时使用。 |
| `renewToken` | `renewToken(token: string): Promise<void>` | 在不离会的前提下更新频道 Token。 | Token 即将过期或服务端下发新票据时使用。 |

- 普通通话建议使用 `communication`，直播类场景建议使用 `liveBroadcasting` 并配合 `setClientRole(...)`。
- `App ID`、`Token`、`channelId`、`uid` / `userAccount` 应由业务系统动态注入，不应写死在插件层。

### Audio Control

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `enableAudio` | `enableAudio(enabled: boolean): Promise<void>` | 整体启用或关闭音频模块。 | 需要统一开启或关闭音频能力时使用。 |
| `enableLocalAudio` | `enableLocalAudio(enabled: boolean): Promise<void>` | 启用或关闭本地麦克风采集。 | 做静音前置控制，或根据权限与业务流程控制采集时使用。 |
| `muteLocalAudioStream` | `muteLocalAudioStream(muted: boolean): Promise<void>` | 停发或恢复本地音频上行流。 | 已入会但需要临时静音自己时使用。 |
| `muteRemoteAudioStream` | `muteRemoteAudioStream(uid: number, muted: boolean): Promise<void>` | 停收或恢复指定远端用户的音频流。 | 需要对个别远端用户做单独静音控制时使用。 |
| `muteAllRemoteAudioStreams` | `muteAllRemoteAudioStreams(muted: boolean): Promise<void>` | 停收或恢复全部远端音频流。 | 批量静音远端、进入只看不听的场景时使用。 |
| `setAudioProfile` | `setAudioProfile(profile: number, scenario?: number): Promise<void>` | 设置音频编码档位与场景参数。 | 需要在语聊、音乐、直播等不同音频策略间切换时使用。 |
| `enableAudioVolumeIndication` | `enableAudioVolumeIndication(interval: number, smooth?: number, reportVad?: boolean): Promise<void>` | 开启说话人音量与 VAD 回调。 | 需要做音量条、活跃说话人标记或麦位状态展示时使用。 |
| `setDefaultAudioRouteToSpeakerphone` | `setDefaultAudioRouteToSpeakerphone(enabled: boolean): Promise<void>` | 设置默认音频路由是否优先走扬声器。 | 首次入会时就希望控制默认外放/听筒策略时使用。 |
| `setEnableSpeakerphone` | `setEnableSpeakerphone(enabled: boolean): Promise<void>` | 动态切换当前扬声器开关状态。 | 通话中切换外放与听筒时使用。 |
| `isSpeakerphoneEnabled` | `isSpeakerphoneEnabled(): Promise<boolean>` | 查询当前是否处于扬声器外放状态。 | UI 需要回显当前路由状态，或切换前先读取状态时使用。 |
| `adjustPlaybackSignalVolume` | `adjustPlaybackSignalVolume(volume: number): Promise<void>` | 调整本地整体播放音量。 | 需要统一拉高或压低远端播放音量时使用。 |
| `adjustUserPlaybackSignalVolume` | `adjustUserPlaybackSignalVolume(uid: number, volume: number): Promise<void>` | 调整指定远端用户在本地的播放音量。 | 需要单独控制某个远端用户的收听音量时使用。 |
| `setAudioSessionOperationRestriction` | `setAudioSessionOperationRestriction(restriction: number): Promise<void>` | 设置音频会话操作限制。 | iOS 侧需要限制 SDK 对音频会话的管理行为时使用。 |

- `setAudioSessionOperationRestriction(...)` is unsupported on Android in the current bridge.
- `adjustUserPlaybackSignalVolume(...)` 依赖有效远端 `uid`；在用户未入会或已离会后调用没有业务意义。

### Video Control

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `enableVideo` | `enableVideo(enabled: boolean): Promise<void>` | 整体启用或关闭视频模块。 | 进入视频通话流程，或从纯语音切换到音视频时使用。 |
| `enableLocalVideo` | `enableLocalVideo(enabled: boolean): Promise<void>` | 启用或关闭本地视频采集。 | 控制摄像头采集状态，但保留会话连接时使用。 |
| `muteLocalVideoStream` | `muteLocalVideoStream(muted: boolean): Promise<void>` | 停发或恢复本地视频上行流。 | 已采集但需要临时关闭对外发送时使用。 |
| `muteRemoteVideoStream` | `muteRemoteVideoStream(uid: number, muted: boolean): Promise<void>` | 停收或恢复指定远端视频流。 | 需要对某个远端视频单独做订阅控制时使用。 |
| `muteAllRemoteVideoStreams` | `muteAllRemoteVideoStreams(muted: boolean): Promise<void>` | 停收或恢复全部远端视频流。 | 进入只发不看、节省性能或批量停看远端时使用。 |
| `setVideoEncoderConfiguration` | `setVideoEncoderConfiguration(config: AgoraVideoEncoderConfiguration): Promise<void>` | 设置分辨率、帧率、码率等视频编码参数。 | 需要切换清晰度档位或为不同机型调整编码策略时使用。 |
| `startPreview` | `startPreview(sourceType?: number): Promise<void>` | 启动本地视频预览。 | 入会前展示本地画面，或切换视频源后重新开始预览时使用。 |
| `stopPreview` | `stopPreview(sourceType?: number): Promise<void>` | 停止本地视频预览。 | 退出预览页、停止摄像头预览或切换场景时使用。 |
| `switchCamera` | `switchCamera(): Promise<void>` | 在前后摄像头之间切换。 | 移动端视频通话中切换拍摄方向时使用。 |
| `setBeautyEffectOptions` | `setBeautyEffectOptions(enabled: boolean, options: AgoraBeautyOptions, sourceType?: number): Promise<void>` | 开启或调整美颜效果参数。 | 需要提供磨皮、美白、红润等视频美颜能力时使用。 |
| `enableContentInspect` | `enableContentInspect(enabled: boolean, config?: AgoraContentInspectConfig): Promise<void>` | 启用或关闭视频内容审核能力。 | 需要做内容安全检查、审核运营场景时使用。 |

- 本地预览通常与 `setupLocalVideoView(...)` 配套使用；如走 `engine-texture`，还需配合纹理槽位消费逻辑。

### Video View and Rendering

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `setupLocalVideoView` | `setupLocalVideoView(canvas: AgoraRtcVideoCanvas): Promise<void>` | 绑定本地视频画面到指定视图区域或纹理槽位。 | 首次显示本地视频或为本地预览/上行画面分配渲染区域时使用。 |
| `setupRemoteVideoView` | `setupRemoteVideoView(uid: number, canvas: AgoraRtcVideoCanvas): Promise<void>` | 绑定指定远端用户视频到目标视图区域或纹理槽位。 | 远端用户上视频后，需要为其创建渲染目标时使用。 |
| `updateLocalVideoView` | `updateLocalVideoView(canvas: AgoraRtcVideoCanvas): Promise<void>` | 更新本地视频的渲染位置、尺寸或画布配置。 | UI 布局变化、本地窗口拖拽缩放时使用。 |
| `updateRemoteVideoView` | `updateRemoteVideoView(uid: number, canvas: AgoraRtcVideoCanvas): Promise<void>` | 更新指定远端视频的渲染配置。 | 远端视频宫格布局变化、主辅屏切换时使用。 |
| `removeLocalVideoView` | `removeLocalVideoView(): Promise<void>` | 移除本地视频视图绑定。 | 不再显示本地视频，或在销毁前先解绑渲染目标时使用。 |
| `removeRemoteVideoView` | `removeRemoteVideoView(uid: number): Promise<void>` | 移除指定远端用户的视频视图绑定。 | 远端离会、停止展示远端视频或回收渲染资源时使用。 |
| `setNativeVideoOverlaySuspended` | `setNativeVideoOverlaySuspended(suspended: boolean): Promise<void>` | 暂停或恢复原生视频覆盖层显示。 | 使用原生视图覆盖渲染时，需要在 Cocos 场景切换、遮罩或截图前暂时隐藏原生层时使用。 |
| `getEngineTexture` | `getEngineTexture(slotId: number): unknown \| null` | 读取 `engine-texture` 后端对应槽位的原生纹理对象。 | 自定义材质、脚本或渲染层需要直接消费 Agora 上传的 Cocos 纹理时使用。 |
| `isEngineTextureReady` | `isEngineTextureReady(slotId: number): boolean` | 查询指定 `engine-texture` 槽位是否已经就绪。 | 在首次绑定纹理、轮询渲染资源或避免提前取纹理时报错时使用。 |

- `setNativeVideoOverlaySuspended(...)` is only meaningful for native overlay rendering backends.

### Audio Mixing and Effects

| Method | Signature | Description | When to Use |
| --- | --- | --- | --- |
| `startAudioMixing` | `startAudioMixing(config: AgoraAudioMixingConfig): Promise<void>` | 开始播放并混入背景音乐。 | 语聊房、K 歌、直播伴奏等需要长音频混音时使用。 |
| `pauseAudioMixing` | `pauseAudioMixing(): Promise<void>` | 暂停当前背景音乐混音。 | 需要临时中断伴奏但保留播放进度时使用。 |
| `resumeAudioMixing` | `resumeAudioMixing(): Promise<void>` | 恢复已暂停的背景音乐混音。 | 从暂停状态继续播放混音时使用。 |
| `stopAudioMixing` | `stopAudioMixing(): Promise<void>` | 停止当前背景音乐混音。 | 结束伴奏、切歌前停止当前音频时使用。 |
| `getAudioMixingCurrentPosition` | `getAudioMixingCurrentPosition(): Promise<number>` | 获取当前混音播放进度，单位为毫秒。 | 需要显示播放进度条或做断点续播时使用。 |
| `setAudioMixingPosition` | `setAudioMixingPosition(positionMs: number): Promise<void>` | 跳转背景音乐混音播放进度。 | 需要拖动进度条或从指定时间点开始播放时使用。 |
| `adjustAudioMixingVolume` | `adjustAudioMixingVolume(volume: number): Promise<void>` | 调整混音总音量。 | 需要统一调整伴奏相对人声的整体大小时使用。 |
| `preloadEffect` | `preloadEffect(soundId: number, path: string, startPos?: number): Promise<void>` | 预加载短音效资源。 | 需要降低点击音、礼物音、提示音的首次播放延迟时使用。 |
| `playEffect` | `playEffect(config: AgoraPlayEffectConfig): Promise<void>` | 播放指定音效。 | 播放按钮音、礼物音、场控音等短音频时使用。 |
| `pauseEffect` | `pauseEffect(soundId: number): Promise<void>` | 暂停指定音效播放。 | 音效需要临时中断并保留继续播放能力时使用。 |
| `resumeEffect` | `resumeEffect(soundId: number): Promise<void>` | 恢复指定音效播放。 | 已暂停音效需要继续播放时使用。 |
| `setEffectsVolume` | `setEffectsVolume(volume: number): Promise<void>` | 设置全部音效的总音量。 | 需要统一调整短音效响度时使用。 |
| `adjustAudioMixingPublishVolume` | `adjustAudioMixingPublishVolume(volume: number): Promise<void>` | 调整混音上行发布音量。 | 需要分别控制本地听到的伴奏和远端听到的伴奏大小时使用。 |
| `adjustAudioMixingPlayoutVolume` | `adjustAudioMixingPlayoutVolume(volume: number): Promise<void>` | 调整混音本地播放音量。 | 希望只改变本地监听到的伴奏音量时使用。 |
| `stopEffect` | `stopEffect(soundId: number): Promise<void>` | 停止指定音效播放。 | 音效结束条件提前满足，或需要强制停止某条短音频时使用。 |

- `startAudioMixing(...)` rejects a `replace` field at the JavaScript layer with `protocol_error`.
- 混音与音效相关 `volume` 参数建议保持在 `0-100` 范围内，避免业务层自行扩展到不一致的区间。

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
