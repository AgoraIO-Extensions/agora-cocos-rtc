import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const agoraTs = readFileSync(path.join(root, 'sdk/agora-rtc/js/agora.ts'), 'utf8');
const typesTs = readFileSync(path.join(root, 'sdk/agora-rtc/js/types.ts'), 'utf8');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function humanize(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

function parseExports() {
  return [...agoraTs.matchAll(/^export function ([A-Za-z0-9_]+)\(/gm)].map((match) => match[1]);
}

function parseMethods() {
  const start = agoraTs.indexOf('export class AgoraRtcClient {');
  const end = agoraTs.indexOf('export function createAgoraRtcClient');
  const classBlock = agoraTs.slice(start, end);
  const pattern = /^  (?:async )?([A-Za-z0-9_]+)(?:<[^>]+>)?\(([\s\S]*?)\): ([^\n{]+) \{$/gm;
  const methods = [];

  methods.push({
    name: 'on',
    params: 'eventName: K, listener: (payload: AgoraEventMap[K]) => void',
    returnType: '() => void',
  });

  for (const match of classBlock.matchAll(pattern)) {
    const name = match[1];
    if (name === 'constructor' || name.startsWith('#')) continue;
    const params = match[2]
      .split('\n')
      .map((line) => line.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/,\s*$/, '');
    methods.push({ name, params, returnType: match[3].trim() });
  }

  return methods;
}

function parseStatsFields() {
  const block = typesTs
    .split('export interface AgoraRtcStatsPayload {')[1]
    .split('export interface AgoraEventMap {')[0];
  const fields = [];
  for (const line of block.split('\n')) {
    const match = line.match(/^\s{2}([A-Za-z0-9_?]+):\s*([^;]+);/);
    if (match) fields.push({ name: match[1], type: match[2].trim() });
  }
  return fields;
}

function parseEvents() {
  const statsFields = parseStatsFields();
  const block = typesTs
    .split('export interface AgoraEventMap {')[1]
    .split('export interface CocosJsbBridgeTransport')[0];
  const lines = block.split('\n');
  const events = [];

  for (let i = 0; i < lines.length;) {
    const header = lines[i].match(/^\s{2}([A-Za-z0-9_]+):\s*(.*)$/);
    if (!header) {
      i += 1;
      continue;
    }

    const name = header[1];
    const rest = header[2].trim();

    if (rest.startsWith('Record<string, never>;')) {
      events.push({ name, fields: [] });
      i += 1;
      continue;
    }

    if (rest.startsWith('AgoraRtcStatsPayload;')) {
      events.push({ name, fields: statsFields });
      i += 1;
      continue;
    }

    if (rest.endsWith('{')) {
      const fields = [];
      i += 1;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        const line = lines[i];
        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;
        const match = line.match(/^\s{4}([A-Za-z0-9_?]+):\s*([^;{]+(?:\{[^}]+\})?[^;]*);?/);
        if (match && depth >= 1) fields.push({ name: match[1], type: match[2].trim() });
        i += 1;
      }
      events.push({ name, fields });
      continue;
    }

    i += 1;
  }

  return events;
}

const exportDescriptions = {
  en: {
    createAgoraRtcClient: 'Create the main RTC client instance for almost every integration flow.',
    createAgoraEngineTextureViewManager: 'Create an engine-texture view manager for texture slot and display-node binding workflows.',
    createAgoraEngineTextureViewController: 'Create an engine-texture view controller for local and remote view registration flows.',
    getAgoraEngineTextureBridge: 'Read the active engine texture bridge from the current runtime.',
  },
  zh: {
    createAgoraRtcClient: '创建 RTC 客户端实例，是大多数接入流程的入口。',
    createAgoraEngineTextureViewManager: '创建 engine-texture 视图管理器，用于处理纹理槽和显示节点绑定。',
    createAgoraEngineTextureViewController: '创建 engine-texture 视图控制器，适合封装本地/远端视图注册逻辑。',
    getAgoraEngineTextureBridge: '读取当前运行时中可用的引擎纹理桥，适合排查纹理槽状态。',
  },
};

const exportSignatures = {
  createAgoraRtcClient: 'createAgoraRtcClient(options?: AgoraRtcClientOptions)',
  createAgoraEngineTextureViewManager: 'createAgoraEngineTextureViewManager(client: AgoraRtcClient, bridgeRuntime?: CocosBridgeRuntime)',
  createAgoraEngineTextureViewController: 'createAgoraEngineTextureViewController(client: AgoraRtcClient)',
  getAgoraEngineTextureBridge: 'getAgoraEngineTextureBridge(runtime?: CocosBridgeRuntime)',
};

const exportReturns = {
  createAgoraRtcClient: 'AgoraRtcClient',
  createAgoraEngineTextureViewManager: 'Promise<AgoraEngineTextureViewManager>',
  createAgoraEngineTextureViewController: 'AgoraEngineTextureViewController',
  getAgoraEngineTextureBridge: 'CocosEngineTextureBridge | null',
};

const exportParamDetails = {
  createAgoraRtcClient: {
    en: [
      '<code>options.bridgeRuntime</code>: optional custom bridge runtime.',
      '<code>options.timeoutMs</code>: optional native request timeout in milliseconds. Default is 5000.',
      '<code>options.transport</code>: optional explicit bridge transport.',
    ],
    zh: [
      '<code>options.bridgeRuntime</code>：可选，自定义桥运行时。',
      '<code>options.timeoutMs</code>：可选，原生请求超时时间，默认 5000ms。',
      '<code>options.transport</code>：可选，直接传入桥传输对象。',
    ],
  },
  createAgoraEngineTextureViewManager: {
    en: [
      '<code>client</code>: required RTC client instance.',
      '<code>bridgeRuntime</code>: optional explicit bridge runtime context.',
    ],
    zh: [
      '<code>client</code>：必填，已经创建好的 RTC 客户端。',
      '<code>bridgeRuntime</code>：可选，自定义运行时桥上下文。',
    ],
  },
  createAgoraEngineTextureViewController: {
    en: ['<code>client</code>: required RTC client instance.'],
    zh: ['<code>client</code>：必填，RTC 客户端实例。'],
  },
  getAgoraEngineTextureBridge: {
    en: ['<code>runtime</code>: optional explicit runtime object.'],
    zh: ['<code>runtime</code>：可选，显式传入运行时对象。'],
  },
};

const exportReturnNotes = {
  en: {
    createAgoraRtcClient: 'Returns an <code>AgoraRtcClient</code> instance for later RTC calls.',
    createAgoraEngineTextureViewManager: 'Returns a Promise that resolves to <code>AgoraEngineTextureViewManager</code>.',
    createAgoraEngineTextureViewController: 'Returns an <code>AgoraEngineTextureViewController</code> instance.',
    getAgoraEngineTextureBridge: 'Returns the bridge object, or <code>null</code> when unavailable.',
  },
  zh: {
    createAgoraRtcClient: '返回一个 <code>AgoraRtcClient</code> 实例，后续通过它调用 RTC API。',
    createAgoraEngineTextureViewManager: '返回 Promise，resolve 为 <code>AgoraEngineTextureViewManager</code>。',
    createAgoraEngineTextureViewController: '返回 <code>AgoraEngineTextureViewController</code> 实例。',
    getAgoraEngineTextureBridge: '返回桥对象；若当前环境没有桥，则返回 <code>null</code>。',
  },
};

const methodDescriptions = {
  en: {
    on: 'Subscribe to SDK events.',
    off: 'Remove an SDK event listener.',
    initialize: 'Initialize the RTC engine. You can pass only the App ID or the full config object.',
    getSdkVersion: 'Read the current native SDK version string.',
    getErrorDescription: 'Resolve a native error code into a readable description.',
    setLogFilter: 'Set the native SDK log filter level.',
    setLogFile: 'Set the native SDK log output file path.',
    setChannelProfile: 'Set the channel profile before joining.',
    setClientRole: 'Set broadcaster or audience role for live-broadcasting flows.',
    setRenderBackend: 'Set the render backend. The current public backend value is <code>engine-texture</code>.',
    joinChannel: 'Join with a numeric UID. This is the most common channel-entry method.',
    joinChannelWithUserAccount: 'Join with a string-based user account.',
    getUserInfoByUserAccount: 'Resolve a string account into public Agora user info.',
    leaveChannel: 'Leave the current channel.',
    renewToken: 'Renew the active channel token.',
    enableAudio: 'Enable or disable the audio module.',
    enableLocalAudio: 'Enable or disable local audio capture.',
    muteLocalAudioStream: 'Mute or unmute the local published audio stream.',
    muteRemoteAudioStream: 'Mute or unmute a specific remote audio stream.',
    muteAllRemoteAudioStreams: 'Mute or unmute all remote audio streams.',
    setAudioProfile: 'Set audio profile and scenario.',
    enableAudioVolumeIndication: 'Enable periodic volume indication callbacks.',
    setDefaultAudioRouteToSpeakerphone: 'Set the default route to speakerphone.',
    setEnableSpeakerphone: 'Force speakerphone on or off.',
    isSpeakerphoneEnabled: 'Query whether speakerphone is enabled.',
    adjustPlaybackSignalVolume: 'Adjust overall playback signal volume.',
    adjustUserPlaybackSignalVolume: 'Adjust playback volume for one remote user.',
    setAudioSessionOperationRestriction: 'Set audio session restriction flags.',
    enableVideo: 'Enable or disable the video module.',
    enableLocalVideo: 'Enable or disable local video capture.',
    muteLocalVideoStream: 'Mute or unmute the local published video stream.',
    muteRemoteVideoStream: 'Mute or unmute a specific remote video stream.',
    muteAllRemoteVideoStreams: 'Mute or unmute all remote video streams.',
    setVideoEncoderConfiguration: 'Set video encoder configuration including resolution, bitrate, frame rate, and mirror options.',
    applyVideoEncoderMirrorConfiguration: 'Apply derived mirror configuration to encoder settings.',
    getEngineTextureViewManager: 'Read the cached engine texture view manager instance.',
    takeCachedLocalTextureSlot: 'Consume the cached local texture slot summary.',
    takeCachedRemoteTextureSlot: 'Consume the cached remote texture slot summary for one remote user.',
    setupLocalVideoView: 'Bind a local video view, usually with <code>displayNode</code> or a texture slot.',
    setupRemoteVideoView: 'Bind a remote video view.',
    updateLocalVideoView: 'Update the existing local video view configuration.',
    updateRemoteVideoView: 'Update the existing remote video view configuration.',
    removeLocalVideoView: 'Remove the current local video view binding.',
    removeRemoteVideoView: 'Remove one remote video view binding.',
    setNativeVideoOverlaySuspended: 'Suspend or resume the compatibility native overlay surface.',
    startPreview: 'Start local preview.',
    stopPreview: 'Stop local preview.',
    switchCamera: 'Switch the active camera between front and rear.',
    setBeautyEffectOptions: 'Enable beauty effects and update their options.',
    enableContentInspect: 'Enable or disable content inspection.',
    startAudioMixing: 'Start audio mixing for background music or local-file accompaniment.',
    pauseAudioMixing: 'Pause the current audio mixing playback.',
    resumeAudioMixing: 'Resume paused audio mixing.',
    stopAudioMixing: 'Stop current audio mixing playback.',
    getAudioMixingCurrentPosition: 'Read the current audio mixing position.',
    setAudioMixingPosition: 'Seek audio mixing to a new position.',
    adjustAudioMixingVolume: 'Adjust overall audio mixing volume.',
    preloadEffect: 'Preload an effect sound into memory.',
    playEffect: 'Play a short effect sound.',
    pauseEffect: 'Pause a playing effect sound.',
    resumeEffect: 'Resume a paused effect sound.',
    setEffectsVolume: 'Set the global effects volume.',
    adjustAudioMixingPublishVolume: 'Adjust the published audio mixing volume.',
    adjustAudioMixingPlayoutVolume: 'Adjust the local audio mixing playout volume.',
    stopEffect: 'Stop a playing effect sound.',
    setParameters: 'Set extended bridge parameters for private capabilities or compatibility flags.',
    getEngineTexture: 'Read a cached engine texture object.',
    isEngineTextureReady: 'Check whether a texture slot is ready.',
    destroy: 'Destroy the client and tear down listeners and pending requests.',
  },
  zh: {
    on: '订阅 SDK 事件。',
    off: '取消订阅某个事件监听器。',
    initialize: '初始化 RTC 引擎。可以只传 App ID，也可以传完整配置对象。',
    getSdkVersion: '读取当前原生 SDK 版本字符串。',
    getErrorDescription: '把原生错误码转换为可读描述。',
    setLogFilter: '设置原生日志过滤级别。',
    setLogFile: '设置原生日志输出文件路径。',
    setChannelProfile: '在入会前设置频道 profile。',
    setClientRole: '在直播场景中设置主播或观众角色。',
    setRenderBackend: '设置渲染后端。当前公开支持的值只有 <code>engine-texture</code>。',
    joinChannel: '使用数字 UID 加入频道，是最常见的入会入口。',
    joinChannelWithUserAccount: '使用字符串用户账号加入频道，适合业务层已有稳定账号体系的场景。',
    getUserInfoByUserAccount: '根据字符串账号查询对应的 Agora 用户信息。',
    leaveChannel: '离开当前频道。',
    renewToken: '更新当前频道 token。',
    enableAudio: '开启或关闭音频模块。',
    enableLocalAudio: '开启或关闭本地音频采集。',
    muteLocalAudioStream: '静音或取消静音本地发布音频流。',
    muteRemoteAudioStream: '静音或取消静音指定远端音频流。',
    muteAllRemoteAudioStreams: '静音或取消静音全部远端音频流。',
    setAudioProfile: '设置音频 profile 和 scenario。',
    enableAudioVolumeIndication: '开启周期性音量指示回调。',
    setDefaultAudioRouteToSpeakerphone: '设置默认音频路由到扬声器。',
    setEnableSpeakerphone: '强制打开或关闭扬声器。',
    isSpeakerphoneEnabled: '查询扬声器当前是否开启。',
    adjustPlaybackSignalVolume: '调整整体播放音量。',
    adjustUserPlaybackSignalVolume: '调整指定远端用户播放音量。',
    setAudioSessionOperationRestriction: '设置音频会话限制标志。',
    enableVideo: '开启或关闭视频模块。',
    enableLocalVideo: '开启或关闭本地视频采集。',
    muteLocalVideoStream: '静音或取消静音本地发布视频流。',
    muteRemoteVideoStream: '静音或取消静音指定远端视频流。',
    muteAllRemoteVideoStreams: '静音或取消静音全部远端视频流。',
    setVideoEncoderConfiguration: '设置视频编码参数，影响分辨率、码率、帧率和镜像配置。',
    applyVideoEncoderMirrorConfiguration: '把推导出的镜像配置应用到编码设置。',
    getEngineTextureViewManager: '读取缓存的 engine texture view manager。',
    takeCachedLocalTextureSlot: '取出缓存的本地纹理槽摘要。',
    takeCachedRemoteTextureSlot: '取出指定远端用户的缓存纹理槽摘要。',
    setupLocalVideoView: '建立本地视频视图，通常和 <code>displayNode</code> 或纹理槽一起使用。',
    setupRemoteVideoView: '建立远端视频视图。',
    updateLocalVideoView: '更新已有本地视频视图配置。',
    updateRemoteVideoView: '更新已有远端视频视图配置。',
    removeLocalVideoView: '移除当前本地视频视图绑定。',
    removeRemoteVideoView: '移除指定远端视频视图绑定。',
    setNativeVideoOverlaySuspended: '暂停或恢复兼容性的原生覆盖层接口。',
    startPreview: '开始本地预览。',
    stopPreview: '停止本地预览。',
    switchCamera: '切换前后摄像头。',
    setBeautyEffectOptions: '启用美颜并更新参数。',
    enableContentInspect: '启用或关闭内容审核。',
    startAudioMixing: '开始音频混音，适合背景音乐或本地文件伴奏场景。',
    pauseAudioMixing: '暂停当前音频混音。',
    resumeAudioMixing: '恢复已暂停的音频混音。',
    stopAudioMixing: '停止当前音频混音。',
    getAudioMixingCurrentPosition: '读取当前音频混音进度。',
    setAudioMixingPosition: '把音频混音跳转到新的位置。',
    adjustAudioMixingVolume: '调整整体混音音量。',
    preloadEffect: '预加载一个音效文件。',
    playEffect: '播放音效。',
    pauseEffect: '暂停正在播放的音效。',
    resumeEffect: '恢复已暂停的音效。',
    setEffectsVolume: '设置全局音效音量。',
    adjustAudioMixingPublishVolume: '调整发布出去的混音音量。',
    adjustAudioMixingPlayoutVolume: '调整本地播放的混音音量。',
    stopEffect: '停止正在播放的音效。',
    setParameters: '设置扩展参数，适合透传私有能力或兼容性开关。',
    getEngineTexture: '读取缓存的引擎纹理对象。',
    isEngineTextureReady: '判断纹理槽是否已经 ready。',
    destroy: '销毁客户端并清理事件与待处理请求。',
  },
};

const eventDescriptions = {
  en: {
    joinChannelSuccess: 'Fires when the channel join succeeds.',
    leaveChannel: 'Stats callback after leaving the channel.',
    rejoinChannelSuccess: 'Fires when the client rejoins the channel successfully.',
    connectionInterrupted: 'Fires when connection interruption is detected.',
    connectionStateChanged: 'Fires when connection state changes.',
    localVideoTextureReady: 'Fires when the local texture slot becomes ready.',
    remoteVideoTextureReady: 'Fires when a remote texture slot becomes ready.',
    localVideoTextureReleased: 'Fires when the local texture slot is released.',
    remoteVideoTextureReleased: 'Fires when a remote texture slot is released.',
    renderBackendState: 'Fires when backend state changes or a fallback occurs.',
    userJoined: 'Fires when a remote user joins.',
    userOffline: 'Fires when a remote user goes offline.',
    remoteVideoStateChanged: 'Fires when remote video state changes.',
    localVideoStateChanged: 'Fires when local video state changes.',
    firstLocalAudioFramePublished: 'Fires when the first local audio frame is published.',
    audioMixingFinished: 'Fires when audio mixing finishes.',
    audioMixingStateChanged: 'Fires when audio mixing state changes.',
    remoteAudioStateChanged: 'Fires when remote audio state changes.',
    volumeIndication: 'Periodic speaker volume indication callback.',
    rtcStats: 'Periodic RTC statistics payload.',
    contentInspectResult: 'Fires when content inspection returns a result.',
    error: 'Unified error outlet for bridge, event parsing, and listener failures.',
  },
  zh: {
    joinChannelSuccess: '加入频道成功后触发。',
    leaveChannel: '离开频道后的统计回调。',
    rejoinChannelSuccess: '重新加入频道成功时触发。',
    connectionInterrupted: '连接中断时触发。',
    connectionStateChanged: '连接状态变化时触发。',
    localVideoTextureReady: '本地纹理槽已准备完成时触发。',
    remoteVideoTextureReady: '远端纹理槽已准备完成时触发。',
    localVideoTextureReleased: '本地纹理槽释放时触发。',
    remoteVideoTextureReleased: '远端纹理槽释放时触发。',
    renderBackendState: '渲染后端状态变化或回退时触发。',
    userJoined: '远端用户加入时触发。',
    userOffline: '远端用户离线时触发。',
    remoteVideoStateChanged: '远端视频状态变化时触发。',
    localVideoStateChanged: '本地视频状态变化时触发。',
    firstLocalAudioFramePublished: '首帧本地音频发布时触发。',
    audioMixingFinished: '音频混音结束时触发。',
    audioMixingStateChanged: '音频混音状态变化时触发。',
    remoteAudioStateChanged: '远端音频状态变化时触发。',
    volumeIndication: '周期性说话人音量指示回调。',
    rtcStats: '周期性 RTC 统计信息。',
    contentInspectResult: '内容审核返回结果时触发。',
    error: '统一错误出口，用于桥异常、事件解析异常或监听器异常。',
  },
};

function returnNote(locale, returnType, name) {
  const table = {
    en: {
      'Promise<void>': 'Returns a Promise that resolves when the native request succeeds.',
      'Promise<string>': 'Returns a Promise that resolves to a string result.',
      'Promise<boolean>': 'Returns a Promise that resolves to a boolean result.',
      'Promise<number>': 'Returns a Promise that resolves to a numeric result.',
      'Promise<AgoraUserInfo>': 'Returns a Promise that resolves to Agora user info.',
      'unknown | null': 'Returns the cached value or null when unavailable.',
      'boolean': 'Returns a boolean status value immediately.',
      'TextureReadySlotCache | null': 'Returns the cached slot summary or null when no cached slot exists.',
      'InstanceType<AgoraEngineTextureViewManager> | null': 'Returns the cached manager instance or null when not created yet.',
    },
    zh: {
      'Promise<void>': '返回 Promise，请求成功后 resolve。',
      'Promise<string>': '返回 Promise，resolve 为字符串结果。',
      'Promise<boolean>': '返回 Promise，resolve 为布尔结果。',
      'Promise<number>': '返回 Promise，resolve 为数字结果。',
      'Promise<AgoraUserInfo>': '返回 Promise，resolve 为 Agora 用户信息。',
      'unknown | null': '返回缓存值；不可用时返回 null。',
      'boolean': '立即返回布尔状态值。',
      'TextureReadySlotCache | null': '返回缓存的纹理槽摘要；没有缓存时返回 null。',
      'InstanceType<AgoraEngineTextureViewManager> | null': '返回缓存的 manager 实例；未创建时返回 null。',
    },
  };

  if (name === 'joinChannel') {
    return locale === 'en'
      ? 'Returns a Promise. Actual join success is signaled through <a href="#event-joinChannelSuccess">joinChannelSuccess</a>.'
      : '返回 Promise；真正入会成功信号通过 <a href="#event-joinChannelSuccess">joinChannelSuccess</a> 事件体现。';
  }

  if (name === 'leaveChannel') {
    return locale === 'en'
      ? 'Returns a Promise. Final session stats are delivered through <a href="#event-leaveChannel">leaveChannel</a>.'
      : '返回 Promise；最终统计信息通过 <a href="#event-leaveChannel">leaveChannel</a> 事件体现。';
  }

  return table[locale][returnType] ?? (locale === 'en' ? `Returns ${escapeHtml(returnType)}.` : `返回 ${escapeHtml(returnType)}。`);
}

function describeParam(locale, name, methodName) {
  const overrides = {
    en: {
      options: {
        setClientRole: 'optional role options such as audience latency.',
        joinChannel: 'optional media behavior such as publish or subscribe flags.',
        joinChannelWithUserAccount: 'optional media behavior such as publish or subscribe flags.',
        leaveChannel: 'optional leave behavior such as stopping mixing or effects.',
        default: 'optional options object.',
      },
      config: {
        initialize: 'required config object or App ID wrapper.',
        setVideoEncoderConfiguration: 'required encoder config object.',
        startAudioMixing: 'required audio mixing config object.',
        playEffect: 'required effect playback config object.',
        enableContentInspect: 'optional content inspection config object.',
        applyVideoEncoderMirrorConfiguration: 'required partial video encoder config with width and height.',
        default: 'required config object.',
      },
      canvas: {
        setupLocalVideoView: 'required local video canvas config.',
        setupRemoteVideoView: 'required remote video canvas config.',
        updateLocalVideoView: 'required updated local canvas config.',
        updateRemoteVideoView: 'required updated remote canvas config.',
        default: 'required video canvas config.',
      },
      enabled: 'required boolean switch.',
      muted: 'required mute state.',
      uid: 'required numeric user ID.',
      volume: 'required numeric volume value.',
      token: 'required channel token.',
      channelId: 'required channel name.',
      userAccount: 'required string user account.',
      level: 'required log filter value.',
      path: 'required local file path.',
      profile: 'required profile value.',
      role: 'required client role.',
      scenario: 'optional scenario value.',
      interval: 'required interval in milliseconds.',
      smooth: 'optional smoothing factor.',
      reportVad: 'optional voice activity flag.',
      backend: 'required backend value.',
      slotId: 'required texture slot ID.',
      sourceType: 'optional source type value.',
      soundId: 'required effect ID.',
      startPos: 'optional start position in milliseconds.',
      positionMs: 'required target position in milliseconds.',
      restriction: 'required restriction value.',
      code: 'required numeric error code.',
      suspended: 'required suspended state.',
    },
    zh: {
      options: {
        setClientRole: '可选，角色附加选项，例如观众延迟级别。',
        joinChannel: '可选，发布/订阅行为，例如发布轨道或自动订阅标志。',
        joinChannelWithUserAccount: '可选，发布/订阅行为，例如发布轨道或自动订阅标志。',
        leaveChannel: '可选，离会行为，例如停止混音或音效。',
        default: '可选，附加选项对象。',
      },
      config: {
        initialize: '必填，配置对象或 App ID 包装值。',
        setVideoEncoderConfiguration: '必填，编码配置对象。',
        startAudioMixing: '必填，音频混音配置对象。',
        playEffect: '必填，音效播放配置对象。',
        enableContentInspect: '可选，内容审核配置对象。',
        applyVideoEncoderMirrorConfiguration: '必填，带宽高字段的局部编码配置。',
        default: '必填，配置对象。',
      },
      canvas: {
        setupLocalVideoView: '必填，本地视频画布配置。',
        setupRemoteVideoView: '必填，远端视频画布配置。',
        updateLocalVideoView: '必填，更新后的本地画布配置。',
        updateRemoteVideoView: '必填，更新后的远端画布配置。',
        default: '必填，视频画布配置。',
      },
      enabled: '必填，布尔开关。',
      muted: '必填，静音状态。',
      uid: '必填，数字 UID。',
      volume: '必填，音量值。',
      token: '必填，频道 token。',
      channelId: '必填，频道名。',
      userAccount: '必填，字符串账号。',
      level: '必填，日志级别值。',
      path: '必填，本地文件路径。',
      profile: '必填，profile 值。',
      role: '必填，角色值。',
      scenario: '可选，scenario 值。',
      interval: '必填，毫秒级间隔。',
      smooth: '可选，平滑系数。',
      reportVad: '可选，语音活动标志。',
      backend: '必填，后端值。',
      slotId: '必填，纹理槽 ID。',
      sourceType: '可选，源类型值。',
      soundId: '必填，音效 ID。',
      startPos: '可选，起始毫秒位置。',
      positionMs: '必填，目标毫秒位置。',
      restriction: '必填，限制值。',
      code: '必填，数字错误码。',
      suspended: '必填，暂停状态。',
    },
  };

  const localeMap = overrides[locale];
  const entry = localeMap[name];
  if (!entry) return locale === 'en' ? 'See the source type definition.' : '请结合源码类型定义理解。';
  if (typeof entry === 'string') return entry;
  return entry[methodName] ?? entry.default;
}

function methodParamItems(locale, method) {
  if (!method.params) return [locale === 'en' ? 'No parameters.' : '无参数。'];

  const params = [];
  let current = '';
  let depthAngle = 0;
  let depthParen = 0;
  let depthBrace = 0;

  for (const char of method.params) {
    if (char === '<') depthAngle += 1;
    if (char === '>') depthAngle = Math.max(0, depthAngle - 1);
    if (char === '(') depthParen += 1;
    if (char === ')') depthParen = Math.max(0, depthParen - 1);
    if (char === '{') depthBrace += 1;
    if (char === '}') depthBrace = Math.max(0, depthBrace - 1);

    if (char === ',' && depthAngle === 0 && depthParen === 0 && depthBrace === 0) {
      if (current.trim()) params.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) params.push(current.trim());

  return params.map((item) => {
    const name = item.split(':', 1)[0].replaceAll('?', '').trim();
    return `<code>${escapeHtml(name)}</code>${locale === 'en' ? ': ' : '：'}${describeParam(locale, name, method.name)}`;
  });
}

function renderMethodArticle(locale, method) {
  const signature = `${method.name}(${method.params})`;
  const paramsTitle = locale === 'en' ? 'Parameters' : '参数说明';
  const returnTitle = locale === 'en' ? 'Returns' : '返回值';
  const items = methodParamItems(locale, method).map((item) => `<li>${item}</li>`).join('');
  const description = methodDescriptions[locale][method.name]
    ?? (locale === 'en' ? `${humanize(method.name)} API reference entry.` : `${method.name} API 参考条目。`);

  return `          <article id="method-${method.name}" data-signature="${escapeHtml(signature)}">
            <h3>${method.name}</h3>
            <p>${description}</p>
            <code class="signature">${escapeHtml(signature)}: ${escapeHtml(method.returnType)}</code>
            <div class="param-list"><strong>${paramsTitle}</strong><ul>${items}</ul></div>
            <div class="return-note"><strong>${returnTitle}</strong><ul><li>${returnNote(locale, method.returnType, method.name)}</li></ul></div>
          </article>`;
}

function describeEventField(locale, eventName, field) {
  const fieldName = typeof field === 'string' ? field : field.name;
  const details = {
    en: {
      channelId: 'joined or affected channel name.',
      uid: 'numeric user ID.',
      elapsed: 'elapsed time for the related transition.',
      state: 'state value reported by the native SDK.',
      reason: 'reason code reported by the native SDK.',
      slotId: 'engine-texture slot ID.',
      width: 'frame or texture width.',
      height: 'frame or texture height.',
      backend: 'active render backend name.',
      phase: 'backend state phase.',
      result: 'native result code.',
      'fallbackBackend?': 'optional fallback backend name.',
      'platform?': 'optional platform identifier.',
      sourceType: 'video source type.',
      error: 'native error code for the local video state change.',
      speakers: 'array of speaker entries including uid, volume, vad, and voicePitch.',
      totalVolume: 'aggregate total volume value.',
      'reason?': 'optional offline reason code.',
      AgoraRtcStatsPayload: 'stats object containing duration, traffic, bitrate, CPU, and memory fields.',
      code: 'optional numeric or string error code.',
      'code?': 'optional numeric or string error code.',
      message: 'error message text.',
    },
    zh: {
      channelId: '关联的频道名。',
      uid: '数字用户 UID。',
      elapsed: '相关状态切换的耗时。',
      state: '原生 SDK 返回的状态值。',
      reason: '原生 SDK 返回的原因码。',
      slotId: 'engine-texture 纹理槽 ID。',
      width: '帧或纹理宽度。',
      height: '帧或纹理高度。',
      backend: '当前渲染后端名称。',
      phase: '后端状态阶段。',
      result: '原生结果码。',
      'fallbackBackend?': '可选，回退后的后端名称。',
      'platform?': '可选，平台标识。',
      sourceType: '视频源类型。',
      error: '本地视频状态变化时的错误码。',
      speakers: '说话人数组，元素中包含 uid、volume、vad、voicePitch。',
      totalVolume: '聚合后的总音量值。',
      'reason?': '可选，离线原因码。',
      AgoraRtcStatsPayload: '统计对象，包含 duration、流量、码率、CPU、内存等字段。',
      code: '可选，数字或字符串错误码。',
      'code?': '可选，数字或字符串错误码。',
      message: '错误消息文本。',
    },
  };

  return details[locale][fieldName] ?? (locale === 'en' ? 'Field meaning depends on the native callback contract.' : '字段含义取决于原生回调约定。');
}

function renderEventArticle(locale, event) {
  const title = locale === 'en' ? 'Payload fields' : 'payload 字段';
  const listenerTitle = locale === 'en' ? 'Listener signature' : '监听签名';
  const listenerText = `on('${event.name}', (payload: AgoraEventMap['${event.name}']) => void)`;
  const items = (event.fields.length === 0
    ? [locale === 'en' ? 'No payload fields.' : '无 payload 字段。']
    : event.fields.map((field) => {
      const fieldName = typeof field === 'string' ? field : field.name;
      const fieldType = typeof field === 'string' ? 'unknown' : field.type;
      return `<code>${escapeHtml(fieldName)}</code>${locale === 'en' ? ': ' : '：'}<code>${escapeHtml(fieldType)}</code>${locale === 'en' ? ' — ' : '，'}${describeEventField(locale, event.name, field)}`;
    }))
    .map((item) => `<li>${item}</li>`)
    .join('');

  return `          <article id="event-${event.name}">
            <h3>${event.name}</h3>
            <p>${eventDescriptions[locale][event.name]}</p>
            <code class="signature">${escapeHtml(listenerText)}</code>
            <div class="return-note"><strong>${listenerTitle}</strong><ul><li>${locale === 'en' ? 'Register this event through the client listener API.' : '通过客户端事件监听接口订阅这个事件。'}</li></ul></div>
            <div class="param-list"><strong>${title}</strong><ul>${items}</ul></div>
          </article>`;
}

function renderApiReference(locale) {
  const lang = locale === 'zh' ? 'zh-CN' : 'en';
  const localeButtonZh = locale === 'zh' ? ' aria-current="true"' : '';
  const localeButtonEn = locale === 'en' ? ' aria-current="true"' : '';
  const pageTitle = locale === 'zh' ? 'Agora Cocos RTC 文档' : 'Agora Cocos RTC Docs';
  const skip = locale === 'zh' ? '跳到正文' : 'Skip to main content';
  const hero = locale === 'zh'
    ? '这一页是精确查阅入口。条目必须和当前公开导出保持一致，并给出稳定锚点。'
    : 'This page is the exact lookup surface. Entries must stay aligned with the current public exports and expose stable anchors.';
  const sections = {
    overview: 'Overview',
    quickstart: 'Quickstart',
    coreApis: 'Core APIs',
    rendering: 'Rendering',
    example: 'Example',
    platformNotes: 'Platform Notes',
    apiReference: 'API Reference',
  };
  const exportTitle = locale === 'zh' ? 'Top-level exports' : 'Top-level exports';
  const methodTitle = locale === 'zh' ? 'AgoraRtcClient' : 'AgoraRtcClient';
  const eventTitle = locale === 'zh' ? 'Priority events' : 'Priority events';

  const exportArticles = parseExports().map((name) => {
    const signature = exportSignatures[name];
    const returnType = exportReturns[name];
    const paramsTitle = locale === 'en' ? 'Parameters' : '参数说明';
    const returnTitle = locale === 'en' ? 'Returns' : '返回值';
    const items = exportParamDetails[name][locale].map((item) => `<li>${item}</li>`).join('');
    return `          <article id="export-${name}" data-signature="${escapeHtml(signature)}">
            <h3>${name}</h3>
            <p>${exportDescriptions[locale][name]}</p>
            <code class="signature">${escapeHtml(signature)}: ${escapeHtml(returnType)}</code>
            <div class="param-list"><strong>${paramsTitle}</strong><ul>${items}</ul></div>
            <div class="return-note"><strong>${returnTitle}</strong><ul><li>${exportReturnNotes[locale][name]}</li></ul></div>
          </article>`;
  }).join('\n');

  const methodArticles = parseMethods().map((method) => renderMethodArticle(locale, method)).join('\n');
  const eventArticles = parseEvents().map((event) => renderEventArticle(locale, event)).join('\n');

  return `<!doctype html>
<html lang="${lang}" data-locale="${locale}" data-page="api-reference">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle}</title>
    <link rel="stylesheet" href="../assets/app.css" />
    <script src="../assets/app.js" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#main-content">${skip}</a>
    <div class="doc-shell">
      <header class="doc-header">
        <div>
          <div class="mono">Agora Cocos RTC</div>
          <strong>Developer Docs</strong>
        </div>
        <div class="locale-switch" aria-label="Language switch">
          <button type="button"${localeButtonZh} data-locale-target="zh">中文</button>
          <button type="button"${localeButtonEn} data-locale-target="en">English</button>
          <button id="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">Menu</button>
        </div>
      </header>
      <nav id="primary-nav" class="doc-nav" aria-label="Primary">
        <a href="./index.html">${sections.overview}</a>
        <a href="./quickstart.html">${sections.quickstart}</a>
        <a href="./core-apis.html">${sections.coreApis}</a>
        <a href="./rendering.html">${sections.rendering}</a>
        <a href="./example.html">${sections.example}</a>
        <a href="./platform-notes.html">${sections.platformNotes}</a>
        <a href="./api-reference.html" aria-current="page">${sections.apiReference}</a>
      </nav>
      <main id="main-content" class="doc-main">
        <section class="hero">
          <h1>API Reference</h1>
          <p>${hero}</p>
        </section>
        <section class="card">
          <h2 id="exports">${exportTitle}</h2>
${exportArticles}
        </section>
        <section class="card">
          <h2 id="client-methods">${methodTitle}</h2>
${methodArticles}
        </section>
        <section class="card">
          <h2 id="events">${eventTitle}</h2>
${eventArticles}
        </section>
      </main>
      <aside class="doc-toc" aria-label="On this page">
        <strong>On this page</strong>
        <div id="page-toc"></div>
      </aside>
    </div>
  </body>
</html>
`;
}

writeFileSync(path.join(root, 'docs/en/api-reference.html'), renderApiReference('en'));
writeFileSync(path.join(root, 'docs/zh/api-reference.html'), renderApiReference('zh'));
console.log('Generated docs/en/api-reference.html and docs/zh/api-reference.html');
