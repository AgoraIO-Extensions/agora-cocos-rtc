import type { Node, Sprite, SpriteFrame, Texture2D } from 'cc';

export type RenderBackend = 'surface-view' | 'texture-view' | 'engine-texture';

export type ActionResult = 'ok' | 'fail' | 'idle';

export interface RuntimeConfigState {
  appId: string;
  token: string;
  channelId: string;
  uid: number;
  renderBackend: RenderBackend;
}

export interface DemoSessionState {
  initialized: boolean;
  joined: boolean;
  previewStarted: boolean;
  activeRemoteUid: number | null;
  remoteUserUids: number[];
  audioEnabled: boolean;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
  localAudioMuted: boolean;
  localVideoMuted: boolean;
  remoteAudioMuted: boolean;
  remoteVideoMuted: boolean;
  allRemoteAudioMuted: boolean;
  allRemoteVideoMuted: boolean;
  speakerphoneEnabled: boolean | null;
  lastErrorMessage: string;
  lastRtcStatsSummary: string;
  lastVolumeSummary: string;
}

export interface VideoTextureBinding {
  node: Node;
  sprite: Sprite;
  texture: Texture2D | null;
  spriteFrame: SpriteFrame | null;
}

export type DemoActionHandler = () => Promise<void> | void;

export interface DemoPanelCallbacks {
  onAction(actionName: string): void;
  onOpenLog(): void;
  onApplyConfig(channelId: string, uid: number): void;
}
