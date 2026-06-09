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

export interface AgoraVideoViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
  renderMode?: 'hidden' | 'fit';
}

export interface AgoraVideoEncoderConfiguration {
  width: number;
  height: number;
  frameRate?: number;
  bitrate?: number;
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

export interface AgoraContentInspectConfig {
  module?: number;
  interval?: number;
  extraInfo?: string;
  serverConfig?: string;
  modules?: Array<{
    type?: number;
    interval?: number;
    /** Android ContentInspectModule only. iOS 4.5.3 exposes type and interval. */
    position?: number;
  }>;
}

export type AgoraClientRole = 'broadcaster' | 'audience';

export interface AgoraClientRoleOptions {
  audienceLatencyLevel?: number;
}

export type AgoraChannelProfile =
  | 'communication'
  | 'liveBroadcasting';

export interface AgoraRtcEngineConfig {
  appId: string;
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
  /** Android ChannelMediaOptions only. iOS exposes preview through startPreview(). */
  startPreview?: boolean;
  enableBuiltInMediaEncryption?: boolean;
  publishRhythmPlayerTrack?: boolean;
  isInteractiveAudience?: boolean;
  customVideoTrackId?: number;
  isAudioFilterable?: boolean;
  /** Android ChannelMediaOptions only. */
  enableMultipath?: boolean;
  /** Android ChannelMediaOptions only. */
  uplinkMultipathMode?: number;
  /** Android ChannelMediaOptions only. */
  downlinkMultipathMode?: number;
  /** Android ChannelMediaOptions only. */
  preferMultipathType?: number;
  token?: string;
  parameters?: string;
}

export interface AgoraAudioMixingConfig {
  path: string;
  loopback?: boolean;
  cycle?: number;
  startPos?: number;
}

export interface AgoraPlayEffectConfig {
  soundId: number;
  path: string;
  loopCount?: number;
  pitch?: number;
  pan?: number;
  gain?: number;
  publish?: boolean;
  startPos?: number;
}

export type AgoraRenderBackend =
  | 'surface-view'
  | 'texture-view'
  | 'engine-texture';

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
  };
}
