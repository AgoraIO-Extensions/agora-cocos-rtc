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
9. Event Reference
10. Rendering Modes
11. Platform Notes
12. Error Handling and Troubleshooting
13. 验证边界
14. 参考资料

## 1. 交付内容

标准交付内容如下：

1. `dist/agora-rtc-cocos-plugin.zip`
2. `example/basic-call`
3. 配套说明文档
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

## Parameter Reference

### AgoraRtcEngineConfig

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `appId` | `string` | Yes | Agora 项目的 App ID，初始化 RTC 引擎时必填。 |
| `areaCode` | `number` | No | 区域码，用于限制 SDK 连接的区域范围。 |
| `channelProfile` | `number` | No | 频道场景配置，通常由业务层按通信或直播场景封装。 |
| `license` | `string` | No | 可选的 License 字符串，按项目授权要求传入。 |
| `audioScenario` | `number` | No | 音频场景参数，用于优化不同通话或播放场景的音频策略。 |
| `autoRegisterAgoraExtensions` | `boolean` | No | 是否自动注册 Agora 扩展。 |
| `domainLimit` | `boolean` | No | 是否启用域名限制相关能力。 |
| `threadPriority` | `number` | No | 原生线程优先级设置。 |
| `nativeLibPath` | `string` | No | 原生库路径，适用于需要自定义加载路径的场景。 |
| `extensions` | `string[]` | No | 需要预加载或声明的扩展列表。 |
| `logConfig` | `{ filePath?: string; fileSizeInKB?: number; level?: number; }` | No | 日志配置对象，可指定日志文件路径、大小和级别。 |

### AgoraChannelMediaOptions

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `clientRoleType` | `AgoraClientRole \| number` | No | 用户角色，可传 `'broadcaster'`、`'audience'` 或对应原生枚举值。 |
| `channelProfile` | `AgoraChannelProfile \| number` | No | 频道类型，可传 `'communication'`、`'liveBroadcasting'` 或原生枚举值。 |
| `publishCameraTrack` | `boolean` | No | 是否发布主摄像头视频轨。 |
| `publishSecondaryCameraTrack` | `boolean` | No | 是否发布第二路摄像头视频轨。 |
| `publishThirdCameraTrack` | `boolean` | No | 是否发布第三路摄像头视频轨，仅 Android/C++ 原生侧暴露。 |
| `publishFourthCameraTrack` | `boolean` | No | 是否发布第四路摄像头视频轨，仅 Android/C++ 原生侧暴露。 |
| `publishMicrophoneTrack` | `boolean` | No | 是否发布麦克风音频轨。 |
| `publishScreenCaptureVideo` | `boolean` | No | 是否发布屏幕采集视频轨。 |
| `publishScreenCaptureAudio` | `boolean` | No | 是否发布屏幕采集音频轨。 |
| `publishCustomAudioTrack` | `boolean` | No | 是否发布自定义音频轨。 |
| `publishCustomAudioTrackId` | `number` | No | 自定义音频轨 ID，与 `publishCustomAudioTrack` 配套使用。 |
| `publishCustomVideoTrack` | `boolean` | No | 是否发布自定义视频轨。 |
| `publishEncodedVideoTrack` | `boolean` | No | 是否发布已编码的视频轨。 |
| `publishMediaPlayerAudioTrack` | `boolean` | No | 是否发布媒体播放器音频轨。 |
| `publishMediaPlayerVideoTrack` | `boolean` | No | 是否发布媒体播放器视频轨。 |
| `publishTranscodedVideoTrack` | `boolean` | No | 是否发布转码后的视频轨。 |
| `publishMixedAudioTrack` | `boolean` | No | 是否发布混音后的音频轨。 |
| `publishLipSyncTrack` | `boolean` | No | 是否发布口型同步相关轨道。 |
| `autoSubscribeAudio` | `boolean` | No | 入会后是否自动订阅远端音频。 |
| `autoSubscribeVideo` | `boolean` | No | 入会后是否自动订阅远端视频。 |
| `enableAudioRecordingOrPlayout` | `boolean` | No | 是否启用音频采集或播放链路。 |
| `publishMediaPlayerId` | `number` | No | 要发布的媒体播放器实例 ID。 |
| `audienceLatencyLevel` | `number` | No | 观众延迟等级，常用于直播低延迟场景。 |
| `defaultVideoStreamType` | `number` | No | 默认订阅的视频流类型。 |
| `audioDelayMs` | `number` | No | 音频发布延迟，单位毫秒。 |
| `mediaPlayerAudioDelayMs` | `number` | No | 媒体播放器音频延迟，单位毫秒。 |
| `startPreview` | `boolean` | No | 加入频道前是否先启动本地预览；iOS 当前把它实现为 join 前的 helper 调用，而不是直接写入原生 `mediaOptions.startPreview`。 |
| `sourceType` | `number` | No | iOS bridge 在 `startPreview` 为 `true` 时使用的辅助字段，用于指定 helper 预览使用的视频源类型；Android `ChannelMediaOptions` 不暴露该字段。 |
| `enableBuiltInMediaEncryption` | `boolean` | No | 是否启用内置媒体加密。 |
| `publishRhythmPlayerTrack` | `boolean` | No | 是否发布节奏播放器轨道。 |
| `isInteractiveAudience` | `boolean` | No | 是否以连麦观众身份加入。 |
| `customVideoTrackId` | `number` | No | 自定义视频轨 ID。 |
| `isAudioFilterable` | `boolean` | No | 是否允许音频轨参与可过滤处理。 |
| `enableMultipath` | `boolean` | No | 是否启用多路径网络能力。 |
| `uplinkMultipathMode` | `number` | No | 上行多路径模式。 |
| `downlinkMultipathMode` | `number` | No | 下行多路径模式。 |
| `preferMultipathType` | `number` | No | 多路径网络优先策略。 |
| `token` | `string` | No | 业务侧可保留在统一的 options 对象中做透传或封装；但 JS `joinChannel(...)` / `joinChannelWithUserAccount(...)` 仍以方法参数 `token` 作为主要入参。 |
| `parameters` | `string` | No | 透传给底层原生 SDK 的附加参数字符串。 |

推荐视频通话配置示例：

```ts
const mediaOptions: AgoraChannelMediaOptions = {
  clientRoleType: 'broadcaster',
  channelProfile: 'communication',
  publishCameraTrack: true,
  publishMicrophoneTrack: true,
  autoSubscribeAudio: true,
  autoSubscribeVideo: true,
  startPreview: true,
};
```

### AgoraRtcVideoCanvas

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `uid` | `number` | No | 画布对象中可附带的 UID 信息；本地视图通常不必显式传入。远端绑定目标仍以 `setupRemoteVideoView(uid, canvas)` / `updateRemoteVideoView(uid, canvas)` 的方法参数 `uid` 为准。 |
| `subviewUid` | `number` | No | 子视图 UID，用于多路子画面场景。 |
| `x` | `number` | Yes | 渲染区域左上角横坐标。 |
| `y` | `number` | Yes | 渲染区域左上角纵坐标。 |
| `width` | `number` | Yes | 渲染区域宽度。 |
| `height` | `number` | Yes | 渲染区域高度。 |
| `renderMode` | `'hidden' \| 'fit' \| 'adaptive'` | No | 画面缩放模式，控制裁剪、完整显示或自适应策略。 |
| `mirrorMode` | `number` | No | 镜像模式。 |
| `setupMode` | `number` | No | 视图绑定模式。 |
| `sourceType` | `number` | No | 视频源类型，用于区分摄像头、屏幕共享等来源。 |
| `mediaPlayerId` | `number` | No | 媒体播放器 ID，用于播放器视频渲染。 |
| `cropArea` | `{ x: number; y: number; width: number; height: number; }` | No | 裁剪区域配置。 |
| `backgroundColor` | `number` | No | 背景色，通常在留白区域生效。 |
| `enableAlphaMask` | `boolean` | No | 是否启用 alpha mask。 |
| `position` | `number` | No | 位置枚举，某些内容审核或特殊渲染场景会使用。 |
| `textureWidth` | `number` | No | `engine-texture` 模式下上传纹理的宽度。 |
| `textureHeight` | `number` | No | `engine-texture` 模式下上传纹理的高度。 |

推荐说明：

- `renderMode` 选择 `'hidden'` 时允许裁剪以铺满区域，`'fit'` 会完整显示画面但可能留边，`'adaptive'` 适合交给底层做自适应处理。
- 在 `setupRemoteVideoView(uid, canvas)` / `updateRemoteVideoView(uid, canvas)` 中，真正决定远端绑定目标的是方法参数 `uid`；不要把 `canvas.uid` 当作唯一或主要的绑定控制入口。
- 使用 `engine-texture` 时，`textureWidth` / `textureHeight` 建议与实际 Cocos 视图尺寸保持一致，这样可减少额外缩放带来的拉伸、模糊和纹理重建成本。

### AgoraVideoEncoderConfiguration

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `width` | `number` | Yes | 编码输出宽度。 |
| `height` | `number` | Yes | 编码输出高度。 |
| `frameRate` | `number` | No | 编码帧率。 |
| `bitrate` | `number` | No | 编码码率。 |
| `minFrameRate` | `number` | No | 最低帧率，仅 Android `VideoEncoderConfiguration` 暴露。 |
| `minBitrate` | `number` | No | 最低码率。 |
| `orientationMode` | `number` | No | 编码方向模式。 |
| `mirrorMode` | `number` | No | 编码镜像模式。 |
| `degradationPreference` | `number` | No | 弱网退化优先策略。 |
| `codecType` | `number` | No | 编码器类型。 |
| `advancedVideoOptions` | `{ encodingPreference?: number; compressionPreference?: number; encodeAlpha?: boolean; }` | No | 高级编码选项，可控制编码偏好、压缩偏好和 alpha 编码。 |

推荐说明：

- 建议业务层封装固定预设，例如 `360p`、`540p`、`720p`，统一管理 `width`、`height`、`frameRate`、`bitrate` 的组合，避免在页面逻辑里散落硬编码参数。

### AgoraBeautyOptions

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `lighteningContrastLevel` | `number` | No | 美白对比度等级。 |
| `lighteningLevel` | `number` | No | 美白强度。 |
| `smoothnessLevel` | `number` | No | 磨皮强度。 |
| `rednessLevel` | `number` | No | 红润强度。 |
| `sharpnessLevel` | `number` | No | 锐化强度。 |

### AgoraContentInspectConfig

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `module` | `number` | No | 单模块配置写法，对应一个内容审核模块类型。 |
| `interval` | `number` | No | 审核采样间隔。 |
| `position` | `number` | No | 审核位置参数；仅 Android 内容审核模块位置有效，iOS 当前忽略该字段。 |
| `extraInfo` | `string` | No | 业务附加信息。 |
| `serverConfig` | `string` | No | 服务端审核配置字符串。 |
| `modules` | `Array<{ type?: number; interval?: number; position?: number; }>` | No | 多模块配置写法，可同时声明多个审核模块；其中每个模块的 `position` 也仅 Android 生效，iOS 当前忽略。 |

补充说明：

- `module` 适合单模块配置，`modules` 适合多模块配置；启用内容审核时，通常应至少提供一条可生效的模块配置路径。

### AgoraLeaveChannelOptions

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `stopAudioMixing` | `boolean` | No | 离会时是否停止背景音乐混音。 |
| `stopAllEffect` | `boolean` | No | 离会时是否停止所有音效播放。 |
| `unloadAllEffect` | `boolean` | No | 离会时是否卸载所有已预加载音效。 |
| `stopMicrophoneRecording` | `boolean` | No | 离会时是否停止麦克风录制。 |

### AgoraAudioMixingConfig

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | `string` | Yes | 混音音频文件路径。 |
| `loopback` | `boolean` | No | 是否只本地播放、不推送到远端。 |
| `cycle` | `number` | No | 循环播放次数。 |
| `startPos` | `number` | No | 开始播放位置，单位毫秒。 |

### AgoraPlayEffectConfig

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `soundId` | `number` | Yes | 音效 ID，用于后续暂停、恢复或停止指定音效。 |
| `path` | `string` | Yes | 音效文件路径。 |
| `loopCount` | `number` | No | 循环播放次数。 |
| `pitch` | `number` | No | 音调调节值。 |
| `pan` | `number` | No | 声道平衡值。 |
| `gain` | `number` | No | 增益值。 |
| `publish` | `boolean` | No | 是否将音效发布到远端。 |
| `startPos` | `number` | No | 开始播放位置，单位毫秒。 |

### AgoraClientRoleOptions

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `audienceLatencyLevel` | `number` | No | 观众延迟等级，直播场景下用于平衡延迟与稳定性。 |

## 9. Event Reference

本节按当前仓库中的 `AgoraEventMap` 和桥接实现整理客户可消费事件，建议业务层把事件处理拆成会话状态、媒体状态、渲染状态和诊断状态四类。

### Core Session Events

| Event | Payload | Description | Recommended Consumer Action |
| --- | --- | --- | --- |
| `joinChannelSuccess` | `{ channelId: string; uid: number; elapsed: number }` | 本端成功加入频道，返回频道名、实际 `uid` 和耗时。 | 将会话标记为已入会，开始展示通话 UI，并允许后续远端绑定逻辑运行。 |
| `leaveChannel` | `AgoraRtcStatsPayload` | 本端离会完成，同时返回本次会话统计信息。 | 清理本地和远端视图、重置会话状态，并把统计值写入日志。 |
| `rejoinChannelSuccess` | `{ channelId: string; uid: number; elapsed: number }` | 断线重连后重新入会成功。 | 恢复会话状态展示，并重新确认远端订阅与渲染状态。 |
| `connectionInterrupted` | `{}` | 连接链路已中断，通常先于重连或状态变化事件出现。 | 立即提示网络异常，并等待 `connectionStateChanged` 或 `rejoinChannelSuccess` 后再决定是否重试。 |
| `connectionStateChanged` | `{ state: number; reason: number }` | 连接状态或状态原因发生变化。 | 把 `state`/`reason` 记录到诊断日志，用于决定是否显示重连、失败或离线提示。 |
| `userJoined` | `{ uid: number; elapsed: number }` | 有远端用户进入当前频道。 | 为该 `uid` 创建订阅状态和渲染容器；如果是视频场景，立即调用 `setupRemoteVideoView(uid, canvas)`。 |
| `userOffline` | `{ uid: number; reason?: number }` | 远端用户离会或掉线。 | 调用 `removeRemoteVideoView(uid)`，释放与该 `uid` 关联的 UI、纹理和统计状态。 |

### Audio and Video State Events

| Event | Payload | Description | Recommended Consumer Action |
| --- | --- | --- | --- |
| `remoteVideoStateChanged` | `{ uid: number; state: number; reason: number; elapsed: number }` | 指定远端视频流状态变化。 | 按 `uid` 更新视频可用性、订阅状态和占位图；必要时结合 `reason` 判断是否需要重新绑定视图。 |
| `localVideoStateChanged` | `{ sourceType: number; state: number; error: number }` | 本地视频源状态或错误变化。 | 当本地视频恢复可用时重新触发预览或纹理绑定；当 `error` 非零时记录错误并检查摄像头权限与采集状态。 |
| `firstLocalAudioFramePublished` | `{ elapsed: number }` | 首帧本地音频已经成功发布。 | 作为“本地音频已真正上行”的确认点，可用于关闭发布中提示。 |
| `audioMixingFinished` | `{}` | 当前背景音频混音已自然结束。 | 更新混音 UI 状态，并决定是否自动重播、切歌或释放混音资源。 |
| `audioMixingStateChanged` | `{ state: number; reason: number }` | 背景音频混音状态变化。 | 记录 `state`/`reason`，在暂停、恢复、异常中断等场景下同步 UI 和控制按钮状态。 |
| `remoteAudioStateChanged` | `{ uid: number; state: number; reason: number; elapsed: number }` | 指定远端音频状态变化。 | 更新该用户的音频订阅、说话状态或静音标识，并把异常原因写入日志。 |
| `volumeIndication` | `{ speakers: Array<{ uid: number; volume: number; vad: number; voicePitch: number }>; totalVolume: number }` | 周期性返回说话人音量、VAD 和总音量。 | 用于活跃说话人高亮、音量条或麦位状态展示；不要把它当作可靠入会判断事件。 |
| `rtcStats` | `AgoraRtcStatsPayload` | 返回会话级 RTC 统计，包括时长、码率、丢包、CPU、内存等。 | 采样写入调试日志或开发者面板，用于排查卡顿、弱网或设备资源压力。 |
| `contentInspectResult` | `{ result: number }` | 内容审核模块返回检测结果。 | 根据 `result` 更新业务审核状态，并视业务策略决定提示、降级或中断视频。 |

### Texture and Render Events

| Event | Payload | Description | Recommended Consumer Action |
| --- | --- | --- | --- |
| `localVideoTextureReady` | `{ slotId: number; width: number; height: number }` | 本地 `engine-texture` 槽位已分配，纹理开始可被业务层消费。 | 调用 `getEngineTexture(slotId)` 尝试取纹理并绑定到 Cocos 资源；若返回 `null`，按示例工程执行重试。 |
| `remoteVideoTextureReady` | `{ uid: number; slotId: number; width: number; height: number }` | 远端 `engine-texture` 槽位已分配。 | 为对应 `uid` 保存 `slotId`，然后执行纹理获取和绑定；绑定失败时保留重试窗口。 |
| `localVideoTextureReleased` | `{ slotId: number }` | 本地 `engine-texture` 槽位已释放。 | 清空本地纹理引用、停止相关重试定时器，并避免继续读取该 `slotId`。 |
| `remoteVideoTextureReleased` | `{ uid: number; slotId: number }` | 指定远端纹理槽位已释放。 | 释放该远端用户的纹理和 `SpriteFrame` 绑定，并删除该 `uid` 的槽位记录。 |
| `renderBackendState` | `{ backend: string; phase: string; result: number; uid: number; fallbackBackend?: string; platform?: string }` | 渲染后端在不同实现阶段上报状态；`phase` 是后端相关的阶段标识，具体取值会随平台和后端实现变化。 | 记录 `backend`、`phase`、`result` 和可选 `fallbackBackend`，用于确认当前是否真的运行在预期渲染模式。 |

### Diagnostics and Error Events

| Event | Payload | Description | Recommended Consumer Action |
| --- | --- | --- | --- |
| `error` | `{ code?: number \| string; message: string }` | SDK、桥接层或事件分发层统一抛出的错误事件。 | 统一记录当前 API、平台、渲染后端、频道信息和错误载荷；如错误可恢复，再按错误码执行重试或降级。 |

建议最少监听以下事件组合作为生产接入基线：`joinChannelSuccess`、`userJoined`、`userOffline`、`connectionStateChanged`、`remoteVideoStateChanged`、`remoteAudioStateChanged`、`renderBackendState`、`rtcStats`、`error`。如果选择 `engine-texture`，还应额外监听 `localVideoTextureReady`、`remoteVideoTextureReady`、`localVideoTextureReleased`、`remoteVideoTextureReleased`。

## 10. Rendering Modes

### surface-view

`surface-view` 通过原生 `SurfaceView`/对应平台的原生视频视图直接渲染视频帧，表现上属于原生覆盖层而不是 Cocos 纹理。它适合快速验证通话、全屏视频页、对 Cocos 场景合成要求不高的客户场景；如果客户能接受视频层级独立于 Cocos UI，这通常是最直接的选择。

### texture-view

`texture-view` 仍然通过原生视图体系渲染视频，但在 Android 上使用 `TextureView` 风格后端，行为仍更接近原生覆盖层，而不是可直接被 Cocos 材质消费的纹理。它适合客户需要原生视频视图、同时希望在 Android 上获得比 `surface-view` 更灵活的原生视图变换能力的场景；需要注意，当前 iOS 桥接会把 `texture-view` 请求回退为 `surface-view`，因此不应把它当作跨平台一致的 Cocos 纹理方案。

### engine-texture

`engine-texture` 通过桥接把视频帧上传到 Cocos 引擎纹理槽位，再由业务层通过 `getEngineTexture(slotId)` 绑定到 `Texture2D` / `SpriteFrame`，因此它表现为真正的 Cocos 纹理，而不是原生覆盖层。它适合客户需要把视频完全纳入 Cocos 场景编排、裁剪、材质、特效、层级控制或与游戏 UI 深度融合的场景；代价是业务侧必须处理 `localVideoTextureReady` / `remoteVideoTextureReady` 以及纹理暂未就绪时的重试绑定逻辑。

## 11. Platform Notes

### Android

Android 原生依赖坐标以 `sdk/agora-rtc/sdk-config.json` 为准，当前版本为 `io.agora.rtc:full-sdk:4.5.3` 和 `io.agora.rtc:full-screen-sharing:4.5.3`。当前 Android bridge 对 `setAudioSessionOperationRestriction(restriction)` 返回显式 `unsupported` 响应，业务层不应把该接口作为 Android 能力依赖；扬声器路由控制和三种渲染后端选择仍可正常接入，其中 `texture-view` 和 `surface-view` 都属于原生覆盖层路径。

### iOS

iOS 当前以 Swift Package Manager 集成 Agora RTC 依赖，`sdk/agora-rtc/sdk-config.json` 的仓库基线是 `integrationMode: swift-package-manager`，包地址为 `https://github.com/AgoraIO/AgoraRtcEngine_iOS.git`，版本为 `4.5.3`，产品名为 `RtcBasic`。`AgoraRtcEngine_iOS` 仍可作为依赖命名上下文理解，但不应把 CocoaPods 视为当前仓库的默认集成模式。iOS 支持 `setAudioSessionOperationRestriction(restriction)`，但当前桥接对 `texture-view` 的请求会回退到 `surface-view`，因此如果客户目标是 Cocos 纹理渲染，应直接选择 `engine-texture`，不要把 `texture-view` 视为独立的 iOS 纹理模式。

### Shared Constraints

Android 与 iOS 都依赖客户提供有效的 `App ID` 和 `Token` 才能完成真实入会与媒体联调；同时还需要业务侧正确提供 `channelId` 与 `uid` / `userAccount`。`setNativeVideoOverlaySuspended` 只对 `surface-view`、`texture-view` 这类原生覆盖层后端有实际意义，而对 `engine-texture` 没有可见原生层可隐藏；另外，`warning`、`EnableVideoObserver`、`PreloadEngine / UnloadEngine` 都不属于本 SDK 对客户公开承诺的业务接口。

## 12. Error Handling and Troubleshooting

### Error Event Format

`error` 事件主要用于报告事件路径本身的问题，例如原生回调 payload 不是合法 JSON、事件 payload 解析失败，或业务层某个事件监听器抛出了异常。其格式如下：

```ts
{
  code?: number | string;
  message: string;
}
```

与之不同，`bridge_unavailable`、`timeout`、`native_failure`、`protocol_error` 这类请求失败，主要通过调用 API 返回的 Promise rejection 暴露，错误类型为 `AgoraSdkError`，而不是统一依赖 `error` 事件分发。建议业务层同时做好两条错误通路：一条是在每个异步 API 调用处捕获 `AgoraSdkError`，另一条是持续监听 `error` 事件捕获桥接事件链本身的问题。

建议业务日志至少记录：当前调用的 API、平台、渲染后端、`channelId`、`uid` / `userAccount`、Promise rejection 中的 `error.code` / `error.message` 或事件型 `error` 载荷，以及最近一次 `connectionStateChanged` 和 `renderBackendState` 结果。

### JavaScript Error Codes

| Code | Meaning | Typical Trigger | Recommended Handling |
| --- | --- | --- | --- |
| `bridge_unavailable` | JS 层无法找到有效原生桥。 | Web 预览环境运行、插件未导入、原生桥未注入。 | 该错误会作为 API Promise rejection 的 `AgoraSdkError` 抛出；应立即停止后续 RTC 调用，先确认是否运行在原生导出应用中，并检查 `extensions/agora-rtc` 是否已正确集成。 |
| `timeout` | JS 请求在 `timeoutMs` 内没有收到原生响应。 | 原生线程阻塞、桥接监听未接通、调用卡死。 | 该错误会作为 API Promise rejection 抛出；记录超时 API 名称并结合原生日志排查，不要无限重试同一请求。 |
| `native_failure` | 原生层显式返回失败。 | 原生 SDK 返回错误码、参数不满足平台约束、底层调用异常。 | 该错误会作为 API Promise rejection 抛出；读取 `error.message`，必要时结合 `getErrorDescription(code)` 和原生日志定位真实失败原因。 |
| `protocol_error` | JS 层请求参数或请求/响应协议不符合桥接约束。 | 传入不支持字段，例如 `startAudioMixing.replace`，或请求/响应结构不满足桥接要求。 | 该错误以 `AgoraSdkError` rejection 为主；优先检查调用参数和桥接数据结构，如果是客户扩展代码改动导致，先恢复到仓库基线行为。 |

### Recommended Debug Signals

排查问题时，优先把以下信号放到同一条时间线中分析：

- `error`
- `connectionStateChanged`
- `renderBackendState`
- `joinChannelSuccess` / `rejoinChannelSuccess` / `leaveChannel`
- `localVideoStateChanged`
- `remoteVideoStateChanged`
- `remoteAudioStateChanged`
- `localVideoTextureReady` / `remoteVideoTextureReady`
- `rtcStats`

如果是 `engine-texture` 问题，还应额外记录 `slotId`、`width`、`height`、`getEngineTexture(slotId)` 首次成功时间，以及纹理重试次数。

### Step-by-Step Troubleshooting

1. 先确认运行环境。`bridge_unavailable` 基本都说明当前不是可用的原生运行时，或者插件没有正确导入到 `extensions/agora-rtc`。
2. 再确认前置凭据。真实入会、远端用户事件和媒体流都依赖有效的客户 `App ID` 和 `Token`；`channelId`、`uid` / `userAccount` 也必须与业务服务端发放逻辑一致。
3. 检查调用顺序。若客户需要拿到 `renderBackendState`、`error` 等关键诊断信号，应先注册关键事件监听，再执行 `setRenderBackend(...)` 和 `initialize(...)`，最后再进入 `joinChannel(...)` 或 `joinChannelWithUserAccount(...)`。
4. 检查平台边界。如果 Android 上调用 `setAudioSessionOperationRestriction(...)`，当前 bridge 会返回 `unsupported`，这属于已知平台限制，不应误判为 SDK 故障。
5. 检查渲染模式是否符合预期。收到 `renderBackendState` 后确认最终 `backend`；在 iOS 上请求 `texture-view` 时，要预期可能实际运行成 `surface-view`。
6. 检查媒体事件链。入会成功后如果没有画面，先看是否收到 `userJoined`、`remoteVideoStateChanged`、`localVideoStateChanged`，不要只盯着 UI 层。
7. 如果是 `engine-texture` 黑屏或偶发无画面，检查是否收到 `localVideoTextureReady` / `remoteVideoTextureReady`，以及 `getEngineTexture(slotId)` 是否在首次回调时暂时返回 `null`；按示例工程策略增加有限重试，而不是假设事件触发即纹理可立即取到。
8. 如果某个 API Promise 以 `timeout` reject，结合原生日志确认请求是否真的发到 bridge 和原生层；若多次超时集中在单一 API，优先排查该 API 对应的原生实现。
9. 如果某个 API Promise 以 `native_failure` reject，记录原生返回的 `code` 与 `message`，必要时通过 `getErrorDescription(code)` 辅助解释，并核对当前参数是否超出平台支持范围。
10. 如果某个 API Promise 以 `protocol_error` reject，优先检查自定义封装是否向 SDK 传入了未支持字段，例如 `startAudioMixing` 的 `replace`；如果是 `error` 事件里出现 `Invalid response payload`、`Invalid event payload` 或事件监听器失败，再转向排查桥接回调数据和业务事件处理代码。

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
