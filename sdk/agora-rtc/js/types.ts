export const BRIDGE_REQUEST_EVENT = 'agora:request';
export const BRIDGE_RESPONSE_EVENT = 'agora:response';
export const BRIDGE_CALLBACK_EVENT = 'agora:event';

export const DEFAULT_TIMEOUT_MS = 5000;

export const AgoraErrorCode = {
  BridgeUnavailable: 'bridge_unavailable',
  Timeout: 'timeout',
  NativeFailure: 'native_failure',
  ProtocolError: 'protocol_error',
} as const;

export type AgoraErrorCode =
  (typeof AgoraErrorCode)[keyof typeof AgoraErrorCode];

export type AgoraMethod =
  | 'setRenderBackend'
  | 'initialize'
  | 'getSdkVersion'
  | 'getErrorDescription'
  | 'setLogFilter'
  | 'setLogFile'
  | 'setChannelProfile'
  | 'setClientRole'
  | 'joinChannel'
  | 'joinChannelWithUserAccount'
  | 'getUserInfoByUserAccount'
  | 'leaveChannel'
  | 'renewToken'
  | 'enableAudio'
  | 'enableLocalAudio'
  | 'muteLocalAudioStream'
  | 'muteRemoteAudioStream'
  | 'muteAllRemoteAudioStreams'
  | 'setAudioProfile'
  | 'enableAudioVolumeIndication'
  | 'setDefaultAudioRouteToSpeakerphone'
  | 'setEnableSpeakerphone'
  | 'isSpeakerphoneEnabled'
  | 'adjustPlaybackSignalVolume'
  | 'adjustUserPlaybackSignalVolume'
  | 'setAudioSessionOperationRestriction'
  | 'enableVideo'
  | 'enableLocalVideo'
  | 'muteLocalVideoStream'
  | 'muteRemoteVideoStream'
  | 'muteAllRemoteVideoStreams'
  | 'destroy'
  | 'setVideoEncoderConfiguration'
  | 'setupLocalVideoView'
  | 'setupRemoteVideoView'
  | 'updateLocalVideoView'
  | 'updateRemoteVideoView'
  | 'removeLocalVideoView'
  | 'removeRemoteVideoView'
  | 'setNativeVideoOverlaySuspended'
  | 'startPreview'
  | 'stopPreview'
  | 'switchCamera'
  | 'setBeautyEffectOptions'
  | 'enableContentInspect'
  | 'startAudioMixing'
  | 'pauseAudioMixing'
  | 'resumeAudioMixing'
  | 'stopAudioMixing'
  | 'getAudioMixingCurrentPosition'
  | 'setAudioMixingPosition'
  | 'adjustAudioMixingVolume'
  | 'preloadEffect'
  | 'playEffect'
  | 'pauseEffect'
  | 'resumeEffect'
  | 'setEffectsVolume'
  | 'adjustAudioMixingPublishVolume'
  | 'adjustAudioMixingPlayoutVolume'
  | 'stopEffect'
  | 'setParameters';

/**
 * Video canvas definition for local or remote rendering in the Cocos bridge.
 *
 * This type combines geometric placement, render hints, and Cocos-specific
 * texture binding fields in one payload sent to the native layer.
 */
export interface AgoraRtcVideoCanvas {
  uid?: number;
  subviewUid?: number;
  /** Left position of the target render region. */
  x: number;
  /** Top position of the target render region. */
  y: number;
  /** Width of the target render region. */
  width: number;
  /** Height of the target render region. */
  height: number;
  /** Optional render mode, for example hidden, fit, or adaptive. */
  renderMode?: 'hidden' | 'fit' | 'adaptive';
  mirrorMode?: number;
  setupMode?: number;
  /** Primary camera (`0`) only for local engine-texture rendering. */
  sourceType?: number;
  mediaPlayerId?: number;
  cropArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  backgroundColor?: number;
  enableAlphaMask?: boolean;
  position?: number;
  textureWidth?: number;
  textureHeight?: number;
  /** When set, SDK binds engine texture to this node and applies view mirror. */
  displayNode?: AgoraCocosDisplayNode;
}

export type AgoraCocosDisplayNode = {
  setScale(x: number, y: number, z: number): void;
  getScale(): { x: number; y: number; z: number };
  getComponent?(type: unknown): unknown;
  getChildByName?(name: string): AgoraCocosDisplayNode | null;
  children?: AgoraCocosDisplayNode[];
};

export type AgoraVideoViewRect = AgoraRtcVideoCanvas;

/**
 * Video encoder configuration used by {@link AgoraRtcClient.setVideoEncoderConfiguration}.
 *
 * The available fields reflect the current cross-platform Cocos bridge surface
 * rather than the full native SDK object on every platform.
 */
export interface AgoraVideoEncoderConfiguration {
  /** Target encoded frame width. */
  width: number;
  /** Target encoded frame height. */
  height: number;
  /** Optional encoded frame rate. */
  frameRate?: number;
  /** Optional target bitrate. */
  bitrate?: number;
  /** Android VideoEncoderConfiguration only. iOS ObjC 4.5.3 does not expose minFrameRate. */
  minFrameRate?: number;
  minBitrate?: number;
  orientationMode?: number;
  mirrorMode?: number;
  degradationPreference?: number;
  codecType?: number;
  advancedVideoOptions?: {
    encodingPreference?: number;
    compressionPreference?: number;
    encodeAlpha?: boolean;
  };
}

export interface AgoraBeautyOptions {
  lighteningContrastLevel?: number;
  lighteningLevel?: number;
  smoothnessLevel?: number;
  rednessLevel?: number;
  sharpnessLevel?: number;
}

/**
 * Content inspection configuration forwarded to the native bridge.
 *
 * Use the shorthand top-level fields for a single inspection module, or use
 * {@link modules} to configure multiple inspection entries explicitly.
 */
export interface AgoraContentInspectConfig {
  module?: number;
  interval?: number;
  position?: number;
  extraInfo?: string;
  serverConfig?: string;
  modules?: Array<{
    type?: number;
    interval?: number;
    position?: number;
  }>;
}

export type AgoraClientRole = 'broadcaster' | 'audience';

/**
 * Optional role settings used together with {@link AgoraRtcClient.setClientRole}.
 */
export interface AgoraClientRoleOptions {
  audienceLatencyLevel?: number;
}

export type AgoraChannelProfile =
  | 'communication'
  | 'liveBroadcasting';

/**
 * Engine initialization config used by {@link AgoraRtcClient.initialize}.
 *
 * This object wraps App ID, log configuration, and advanced bridge/runtime
 * flags that should be established before joining a channel.
 */
export interface AgoraRtcEngineConfig {
  /** Required Agora App ID. */
  appId: string;
  parameters?: string;
  areaCode?: number;
  channelProfile?: number;
  license?: string;
  audioScenario?: number;
  autoRegisterAgoraExtensions?: boolean;
  domainLimit?: boolean;
  threadPriority?: number;
  nativeLibPath?: string;
  extensions?: string[];
  logConfig?: {
    filePath?: string;
    fileSizeInKB?: number;
    level?: number;
  };
}

/**
 * Channel media options used during channel join.
 *
 * This type mirrors the currently exposed bridge surface and includes fields
 * that control publish, subscribe, preview, and track-selection behavior.
 */
export interface AgoraChannelMediaOptions {
  clientRoleType?: AgoraClientRole | number;
  channelProfile?: AgoraChannelProfile | number;
  publishCameraTrack?: boolean;
  publishSecondaryCameraTrack?: boolean;
  /** Android/C++ ChannelMediaOptions only. iOS ObjC 4.5.3 does not expose this field. */
  publishThirdCameraTrack?: boolean;
  /** Android/C++ ChannelMediaOptions only. iOS ObjC 4.5.3 does not expose this field. */
  publishFourthCameraTrack?: boolean;
  publishMicrophoneTrack?: boolean;
  publishScreenCaptureVideo?: boolean;
  publishScreenCaptureAudio?: boolean;
  publishCustomAudioTrack?: boolean;
  publishCustomAudioTrackId?: number;
  publishCustomVideoTrack?: boolean;
  publishEncodedVideoTrack?: boolean;
  publishMediaPlayerAudioTrack?: boolean;
  publishMediaPlayerVideoTrack?: boolean;
  publishTranscodedVideoTrack?: boolean;
  publishMixedAudioTrack?: boolean;
  publishLipSyncTrack?: boolean;
  autoSubscribeAudio?: boolean;
  autoSubscribeVideo?: boolean;
  enableAudioRecordingOrPlayout?: boolean;
  publishMediaPlayerId?: number;
  audienceLatencyLevel?: number;
  defaultVideoStreamType?: number;
  audioDelayMs?: number;
  mediaPlayerAudioDelayMs?: number;
  /** Android ChannelMediaOptions field. On iOS the bridge uses this to call startPreview before join. */
  startPreview?: boolean;
  /** iOS bridge helper for startPreview when startPreview is true. Android ChannelMediaOptions does not expose this field. */
  sourceType?: number;
  enableBuiltInMediaEncryption?: boolean;
  publishRhythmPlayerTrack?: boolean;
  isInteractiveAudience?: boolean;
  customVideoTrackId?: number;
  isAudioFilterable?: boolean;
  enableMultipath?: boolean;
  uplinkMultipathMode?: number;
  downlinkMultipathMode?: number;
  preferMultipathType?: number;
  token?: string;
  parameters?: string;
}

/**
 * Optional cleanup behavior applied when leaving a channel.
 */
export interface AgoraLeaveChannelOptions {
  stopAudioMixing?: boolean;
  stopAllEffect?: boolean;
  unloadAllEffect?: boolean;
  stopMicrophoneRecording?: boolean;
}

/**
 * Audio mixing configuration for local-file playback.
 */
export interface AgoraAudioMixingConfig {
  /** Local audio file path. */
  path: string;
  /** Whether to play only locally without publishing. */
  loopback?: boolean;
  /** Optional loop count. */
  cycle?: number;
  /** Optional start offset in milliseconds. */
  startPos?: number;
}

/**
 * Effect playback configuration.
 */
export interface AgoraPlayEffectConfig {
  /** Caller-defined effect ID. */
  soundId: number;
  /** Local effect file path. */
  path: string;
  loopCount?: number;
  pitch?: number;
  pan?: number;
  gain?: number;
  publish?: boolean;
  startPos?: number;
}

/**
 * User information returned from account lookup helpers.
 */
export interface AgoraUserInfo {
  uid?: number;
  userAccount?: string;
}

export type AgoraRenderBackend =
  'engine-texture';

export type AgoraEngineTextureCameraFacing =
  'front'
  | 'rear';

export interface AgoraBridgeRequest {
  requestId: string;
  method: AgoraMethod;
  params: Record<string, unknown>;
}

export interface AgoraBridgeResponse {
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: {
    code: AgoraErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface AgoraBridgeEvent {
  eventName: keyof AgoraEventMap | string;
  payload?: unknown;
}

/**
 * RTC statistics payload emitted by stats-related callbacks.
 *
 * These fields are reported by the native SDK and may be partially populated
 * depending on platform state, publish state, and callback timing.
 */
export interface AgoraRtcStatsPayload {
  duration: number;
  txBytes?: number;
  rxBytes?: number;
  txKBitRate?: number;
  rxKBitRate?: number;
  txAudioBytes?: number;
  rxAudioBytes?: number;
  txVideoBytes?: number;
  rxVideoBytes?: number;
  txAudioKBitRate?: number;
  rxAudioKBitRate?: number;
  txVideoKBitRate?: number;
  rxVideoKBitRate?: number;
  lastmileDelay?: number;
  cpuTotalUsage?: number;
  gatewayRtt?: number;
  cpuAppUsage?: number;
  users?: number;
  connectTimeMs?: number;
  txPacketLossRate?: number;
  rxPacketLossRate?: number;
  memoryAppUsageRatio?: number;
  memoryTotalUsageRatio?: number;
  memoryAppUsageInKbytes?: number;
}

/**
 * Public event payload map consumed by {@link AgoraRtcClient.on}.
 *
 * Each key is an event name and each value is the payload shape delivered to
 * the listener for that event.
 */
export interface AgoraEventMap {
  joinChannelSuccess: {
    channelId: string;
    uid: number;
    elapsed: number;
  };
  leaveChannel: AgoraRtcStatsPayload;
  rejoinChannelSuccess: {
    channelId: string;
    uid: number;
    elapsed: number;
  };
  connectionInterrupted: Record<string, never>;
  connectionStateChanged: {
    state: number;
    reason: number;
  };
  localVideoTextureReady: {
    slotId: number;
    width: number;
    height: number;
  };
  remoteVideoTextureReady: {
    uid: number;
    slotId: number;
    width: number;
    height: number;
  };
  localVideoTextureReleased: {
    slotId: number;
  };
  remoteVideoTextureReleased: {
    uid: number;
    slotId: number;
  };
  renderBackendState: {
    backend: string;
    phase: string;
    result: number;
    uid: number;
    fallbackBackend?: string;
    platform?: string;
  };
  userJoined: {
    uid: number;
    elapsed: number;
  };
  userOffline: {
    uid: number;
    reason?: number;
  };
  remoteVideoStateChanged: {
    uid: number;
    state: number;
    reason: number;
    elapsed: number;
  };
  localVideoStateChanged: {
    sourceType: number;
    state: number;
    error: number;
  };
  firstLocalAudioFramePublished: {
    elapsed: number;
  };
  audioMixingFinished: Record<string, never>;
  audioMixingStateChanged: {
    state: number;
    reason: number;
  };
  remoteAudioStateChanged: {
    uid: number;
    state: number;
    reason: number;
    elapsed: number;
  };
  volumeIndication: {
    speakers: Array<{
      uid: number;
      volume: number;
      vad: number;
      voicePitch: number;
    }>;
    totalVolume: number;
  };
  rtcStats: AgoraRtcStatsPayload;
  contentInspectResult: {
    result: number;
  };
  error: {
    code?: number | string;
    message: string;
  };
}

export interface CocosJsbBridgeTransport {
  dispatchEventToNative?(eventName: string, payload: string): void;
  addNativeEventListener?(eventName: string, listener: (payload: string) => void): void;
  removeNativeEventListener?(eventName: string, listener: (payload: string) => void): void;
  dispatchEventToScript?(eventName: string, payload: string): void;
  addScriptEventListener?(eventName: string, listener: (payload: string) => void): void;
  removeScriptEventListener?(eventName: string, listener: (payload: string) => void): void;
}

export interface CocosEngineTextureBridge {
  getTexture(slotId: number): unknown | null;
  isSlotReady?(slotId: number): boolean;
}

export interface CocosBridgeRuntime {
  native?: {
    jsbBridgeWrapper?: CocosJsbBridgeTransport;
    agoraEngineTexture?: CocosEngineTextureBridge;
  };
  sys?: {
    isNative?: boolean;
    platform?: string | number;
  };
}
