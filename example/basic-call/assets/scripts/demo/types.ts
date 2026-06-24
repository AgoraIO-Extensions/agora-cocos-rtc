import type { Node, Sprite, SpriteFrame, Texture2D } from 'cc';
import type {
  AgoraAudioMixingConfig,
  AgoraEngineTextureCameraFacing,
  AgoraVideoEncoderConfiguration,
  AgoraBeautyOptions,
  AgoraContentInspectConfig,
  AgoraPlayEffectConfig,
  AgoraRtcVideoCanvas,
} from '../../../extensions/agora-rtc/js/types.ts';

export type RenderBackend = 'engine-texture';
export type ActionResult = 'ok' | 'fail' | 'idle';
export type ChannelProfile = 'communication' | 'liveBroadcasting';
export type ClientRole = 'broadcaster' | 'audience';
export type VideoEncoderPresetName = '360p' | '540p' | '720p';
export type DemoCaseDisplayMode = 'audio' | 'video';
export type DemoNavigationMode = 'caseList' | 'caseDetail';

export interface DemoCaseSelectionState {
  mode: DemoNavigationMode;
  selectedCaseName: string | null;
  displayMode: DemoCaseDisplayMode | null;
}

export interface AudioEffectMixingState {
  effectPreloaded: boolean;
  effectPlaying: boolean;
  audioMixingStarted: boolean;
  effectsVolume: number;
  audioMixingPublishVolume: number;
  audioMixingPlayoutVolume: number;
  audioMixingVolume: number;
  audioMixingPositionMs: number;
  remoteAudioStateSummary: string;
}

export interface RuntimeConfigState {
  appId: string;
  token: string;
  channelId: string;
  uid: number;
  renderBackend: RenderBackend;
  autoPreview: boolean;
  autoJoin: boolean;
  publishCameraTrack: boolean;
  publishMicrophoneTrack: boolean;
  autoSubscribeAudio: boolean;
  autoSubscribeVideo: boolean;
  channelProfile?: ChannelProfile;
  clientRole?: ClientRole;
  initialLocalAudioEnabled?: boolean;
  initialLocalAudioMuted?: boolean;
  previewSourceType?: number;
  localVideoCanvas?: Partial<AgoraRtcVideoCanvas>;
  remoteVideoCanvas?: Partial<AgoraRtcVideoCanvas>;
  beautyEffectSourceType?: number;
  beautyOptions?: AgoraBeautyOptions;
  contentInspectConfig?: AgoraContentInspectConfig;
  audioVolumeIndication?: {
    interval: number;
    smooth?: number;
    reportVad?: boolean;
  };
  audioProfile?: {
    profile: number;
    scenario?: number;
  };
  audioMixing?: AgoraAudioMixingConfig;
  audioMixingSeekPositionMs?: number;
  audioMixingVolume?: number;
  preloadEffect?: {
    soundId: number;
    path: string;
    startPos?: number;
  };
  playEffect?: AgoraPlayEffectConfig;
  logFilter?: number;
  logFilePath?: string;
  debugParameters?: Record<string, unknown>;
  playbackVolume?: number;
  userPlaybackVolume?: number;
  videoEncoderConfiguration?: AgoraVideoEncoderConfiguration;
  /** Skip auto setVideoEncoderConfiguration on preview/join (SetVideoEncoderConfiguration case). */
  deferVideoEncoderConfiguration?: boolean;
  beautyDemoOptions?: AgoraBeautyOptions;
  contentInspectDemoConfig?: AgoraContentInspectConfig;
}

export interface BasicVideoConfigState extends RuntimeConfigState {
  channelProfile: ChannelProfile;
  clientRole: ClientRole;
  videoEncoderPresetName: VideoEncoderPresetName;
}

export interface DemoSessionState {
  initialized: boolean;
  joined: boolean;
  previewStarted: boolean;
  activeRemoteUid: number | null;
  remoteUserUids: number[];
  channelProfile: ChannelProfile;
  clientRole: ClientRole;
  renderBackend: RenderBackend;
  videoEncoderPresetName: VideoEncoderPresetName;
  audioEnabled: boolean;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  videoEnabled: boolean;
  localAudioMuted: boolean;
  localVideoMuted: boolean;
  remoteAudioMuted: boolean;
  remoteVideoMuted: boolean;
  allRemoteAudioMuted: boolean;
  allRemoteVideoMuted: boolean;
  localCameraFacing: AgoraEngineTextureCameraFacing;
  speakerphoneEnabled: boolean | null;
  lastErrorMessage: string;
  lastRtcStatsSummary: string;
  lastLocalVideoStatsSummary: string;
  lastRemoteVideoStatsByUid: Record<number, string>;
  lastVolumeSummary: string;
  audioEffectMixing: AudioEffectMixingState;
  joinLeaveLoopActive: boolean;
}

export interface VideoTextureBinding {
  node: Node;
  sprite: Sprite;
  texture: Texture2D | null;
  spriteFrame: SpriteFrame | null;
}

export interface DisplayMirrorTarget {
  node: Node | null;
  viewId: string;
}

export type DemoActionHandler = () => Promise<void> | void;

export interface DemoPanelCallbacks {
  onAction(actionName: string): void;
  onOpenLog(): void;
  onApplyConfig(channelId: string, uid: number): void;
}
