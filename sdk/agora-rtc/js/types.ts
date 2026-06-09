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
  orientationMode?: number;
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
}

export type AgoraClientRole = 'broadcaster' | 'audience';

export type AgoraChannelProfile =
  | 'communication'
  | 'liveBroadcasting';

export interface AgoraChannelMediaOptions {
  clientRoleType?: AgoraClientRole | number;
  channelProfile?: AgoraChannelProfile | number;
  publishCameraTrack?: boolean;
  publishMicrophoneTrack?: boolean;
  autoSubscribeAudio?: boolean;
  autoSubscribeVideo?: boolean;
  enableAudioRecordingOrPlayout?: boolean;
  /** Android ChannelMediaOptions only. iOS exposes preview through startPreview(). */
  startPreview?: boolean;
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

export interface AgoraEventMap {
  joinChannelSuccess: {
    channelId: string;
    uid: number;
  };
  leaveChannel: {
    duration: number;
  };
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
  localVideoFrame: {
    uid: number;
    width: number;
    height: number;
    format: 'rgba8888';
    dataBase64: string;
  };
  remoteVideoFrame: {
    uid: number;
    width: number;
    height: number;
    format: 'rgba8888';
    dataBase64: string;
  };
  renderBackendState: {
    backend: string;
    phase: string;
    result: number;
    uid: number;
  };
  userJoined: {
    uid: number;
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
  volumeIndication: {
    speakers: Array<{
      uid: number;
      volume: number;
      vad: number;
      voicePitch: number;
    }>;
    totalVolume: number;
  };
  rtcStats: {
    duration: number;
    txBytes?: number;
    rxBytes?: number;
    txKBitRate?: number;
    rxKBitRate?: number;
    users?: number;
    txPacketLossRate?: number;
    rxPacketLossRate?: number;
  };
  contentInspectResult: {
    result: number;
  };
  warning: {
    code?: number | string;
    message: string;
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
