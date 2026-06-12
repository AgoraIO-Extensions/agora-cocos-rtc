import {
  native,
  Node,
  SpriteFrame,
  Texture2D,
  UITransform,
  sys,
} from 'cc';

import { createAgoraRtcClient, type AgoraRtcClient } from '../../../extensions/agora-rtc/js/agora.ts';
import type { AgoraRtcVideoCanvas } from '../../../extensions/agora-rtc/js/types.ts';
import type {
  ChannelProfile,
  ClientRole,
  DemoSessionState,
  RuntimeConfigState,
  VideoEncoderPresetName,
} from './types.ts';

const VIDEO_ENCODER_PRESETS: Record<VideoEncoderPresetName, {
  name: VideoEncoderPresetName;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number;
}> = {
  '360p': { name: '360p', width: 640, height: 360, frameRate: 15, bitrate: 0 },
  '540p': { name: '540p', width: 960, height: 540, frameRate: 15, bitrate: 0 },
  '720p': { name: '720p', width: 1280, height: 720, frameRate: 15, bitrate: 0 },
};
const CHANNEL_PROFILE_PRESETS: ChannelProfile[] = ['communication', 'liveBroadcasting'];
const CLIENT_ROLE_PRESETS: ClientRole[] = ['broadcaster', 'audience'];
const VIDEO_ENCODER_PRESET_NAMES: VideoEncoderPresetName[] = ['360p', '540p', '720p'];
const MAX_TEXTURE_BIND_RETRIES = 600;
const TEXTURE_BIND_RETRY_MS = 100;

export interface RtcSessionServiceOptions {
  getConfig(): RuntimeConfigState;
  getLocalVideoNode(): Node | null;
  getRemoteVideoNode(uid: number): Node | null;
  onLog(line: string): void;
  onStateChanged(): void;
  onRemoteUsersChanged(uids: number[], activeUid: number | null): void;
  onLocalTextureReady(texture: Texture2D, spriteFrame: SpriteFrame): void;
  onRemoteTextureReady(uid: number, texture: Texture2D, spriteFrame: SpriteFrame): void;
  onLocalVideoCleared(): void;
  onRemoteVideoCleared(uid: number): void;
}

export class RtcSessionService {
  private client: AgoraRtcClient | null = null;
  private listenersBound = false;
  private initialized = false;
  private joined = false;
  private previewStarted = false;
  private activeRemoteUid: number | null = null;
  private remoteUserUids = new Set<number>();
  private localViewAttached = false;
  private localTextureSlotId: number | null = null;
  private localVideoSpriteFrame: SpriteFrame | null = null;
  private remoteTextureSlotIds = new Map<number, number>();
  private remoteVideoSpriteFrames = new Map<number, SpriteFrame>();
  private textureBindRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private audioEnabled = true;
  private localAudioEnabled = true;
  private localVideoEnabled = true;
  private videoEnabled = true;
  private localAudioMuted = false;
  private remoteAudioMuted = false;
  private allRemoteAudioMuted = false;
  private localVideoMuted = false;
  private remoteVideoMuted = false;
  private allRemoteVideoMuted = false;
  private audioVolumeIndicationEnabled = false;
  private defaultAudioRouteToSpeakerphone = false;
  private beautyEffectEnabled = false;
  private contentInspectEnabled = false;
  private currentAudioProfile = 0;
  private playbackVolume = 100;
  private userPlaybackVolume = 100;
  private speakerphoneEnabled: boolean | null = null;
  private selectedChannelProfile: ChannelProfile = 'communication';
  private selectedClientRole: ClientRole = 'broadcaster';
  private selectedVideoEncoderPresetName: VideoEncoderPresetName = '360p';
  private lastErrorMessage = '-';
  private lastRtcStatsSummary = '-';
  private lastLocalVideoStatsSummary = '-';
  private lastRemoteVideoStatsByUid = new Map<number, string>();
  private lastVolumeSummary = '-';
  private audioEffectPreloaded = false;
  private audioEffectPlaying = false;
  private audioMixingStarted = false;
  private effectsVolume = 100;
  private audioMixingPublishVolume = 100;
  private audioMixingPlayoutVolume = 100;
  private audioMixingVolume = 100;
  private audioMixingPositionMs = 1000;
  private remoteAudioStateSummary = '-';
  private readonly audioEffectSoundId = 1;
  private readonly audioEffectUrl = 'https://webdemo.agora.io/ding.mp3';

  constructor(private readonly options: RtcSessionServiceOptions) {}

  getState(): DemoSessionState {
    return {
      initialized: this.initialized,
      joined: this.joined,
      previewStarted: this.previewStarted,
      activeRemoteUid: this.activeRemoteUid,
      remoteUserUids: [...this.remoteUserUids],
      channelProfile: this.selectedChannelProfile,
      clientRole: this.selectedClientRole,
      renderBackend: this.options.getConfig().renderBackend,
      videoEncoderPresetName: this.selectedVideoEncoderPresetName,
      audioEnabled: this.audioEnabled,
      localAudioEnabled: this.localAudioEnabled,
      localVideoEnabled: this.localVideoEnabled,
      videoEnabled: this.videoEnabled,
      localAudioMuted: this.localAudioMuted,
      localVideoMuted: this.localVideoMuted,
      remoteAudioMuted: this.remoteAudioMuted,
      remoteVideoMuted: this.remoteVideoMuted,
      allRemoteAudioMuted: this.allRemoteAudioMuted,
      allRemoteVideoMuted: this.allRemoteVideoMuted,
      speakerphoneEnabled: this.speakerphoneEnabled,
      lastErrorMessage: this.lastErrorMessage,
      lastRtcStatsSummary: this.lastRtcStatsSummary,
      lastLocalVideoStatsSummary: this.lastLocalVideoStatsSummary,
      lastRemoteVideoStatsByUid: Object.fromEntries(this.lastRemoteVideoStatsByUid),
      lastVolumeSummary: this.lastVolumeSummary,
      audioEffectMixing: {
        effectPreloaded: this.audioEffectPreloaded,
        effectPlaying: this.audioEffectPlaying,
        audioMixingStarted: this.audioMixingStarted,
        effectsVolume: this.effectsVolume,
        audioMixingPublishVolume: this.audioMixingPublishVolume,
        audioMixingPlayoutVolume: this.audioMixingPlayoutVolume,
        audioMixingVolume: this.audioMixingVolume,
        audioMixingPositionMs: this.audioMixingPositionMs,
        remoteAudioStateSummary: this.remoteAudioStateSummary,
      },
    };
  }

  async initializeRtc(): Promise<void> {
    if (this.initialized) {
      this.log('RTC already initialized');
      return;
    }
    const config = this.options.getConfig();
    if (!config.appId.trim()) {
      throw new Error('Agora App ID is empty.');
    }
    const client = this.getClient();
    await client.setRenderBackend(config.renderBackend);
    await client.initialize(config.appId.trim());
    await client.enableVideo(true);
    this.initialized = true;
    this.videoEnabled = true;
    this.log('Initialize request sent');
    this.emitState();
  }

  async joinRtcChannel(): Promise<void> {
    if (!this.initialized) {
      await this.initializeRtc();
    }
    if (this.joined) {
      this.log('Already joined');
      return;
    }
    const config = this.options.getConfig();
    if (!config.channelId.trim()) {
      throw new Error('Channel ID is empty.');
    }
    const client = this.getClient();
    if (config.publishCameraTrack) {
      await this.setupLocalVideoView();
    }
    await client.joinChannel(config.token, config.channelId.trim(), config.uid, {
      clientRoleType: this.selectedClientRole,
      channelProfile: this.selectedChannelProfile,
      publishCameraTrack: config.publishCameraTrack,
      publishMicrophoneTrack: config.publishMicrophoneTrack,
      autoSubscribeAudio: config.autoSubscribeAudio,
      autoSubscribeVideo: config.autoSubscribeVideo,
    });
    this.joined = true;
    this.log(`Join request sent: ${config.channelId} (${config.uid})`);
    this.emitState();
  }

  async joinWithUserAccount(userAccount: string): Promise<void> {
    if (!this.initialized) {
      await this.initializeRtc();
    }
    if (this.joined) {
      this.log('Already joined');
      return;
    }
    const config = this.options.getConfig();
    if (!config.channelId.trim()) {
      throw new Error('Channel ID is empty.');
    }
    if (!userAccount.trim()) {
      throw new Error('User account is empty.');
    }
    const client = this.getClient();
    await client.enableVideo(false);
    this.videoEnabled = false;
    await client.joinChannelWithUserAccount(
      config.token,
      config.channelId.trim(),
      userAccount.trim(),
    );
    this.joined = true;
    this.log(`String user account join request sent: ${userAccount.trim()}`);
    this.emitState();
  }

  async getUserInfoByUserAccount(userAccount: string): Promise<void> {
    if (!userAccount.trim()) {
      throw new Error('User account is empty.');
    }
    const info = await this.getClient().getUserInfoByUserAccount(userAccount.trim());
    this.log(`UserInfo ${info.userAccount ?? userAccount.trim()}: ${info.uid ?? '-'}`);
  }

  async leaveRtcChannel(): Promise<void> {
    const client = this.getClient();
    const remoteUids = [...this.remoteUserUids];
    if (this.previewStarted) {
      await client.stopPreview();
    }
    await client.leaveChannel();
    if (this.localViewAttached) {
      await client.removeLocalVideoView();
    }
    for (const uid of remoteUids) {
      await client.removeRemoteVideoView(uid);
    }
    this.clearLocalVideoRenderState();
    this.clearRemoteVideoRenderState(remoteUids);
    this.joined = false;
    this.remoteUserUids.clear();
    this.lastRemoteVideoStatsByUid.clear();
    this.activeRemoteUid = null;
    this.options.onRemoteUsersChanged([], null);
    this.log('Leave request sent');
    this.emitState();
  }

  private async removeRemoteVideoView(uid: number): Promise<void> {
    await this.getClient().removeRemoteVideoView(uid);
    this.remoteTextureSlotIds.delete(uid);
  }

  async startLocalPreview(): Promise<void> {
    if (!this.initialized) {
      await this.initializeRtc();
    }
    if (this.previewStarted) {
      this.log('Preview already started');
      return;
    }
    const config = this.options.getConfig();
    await this.setupLocalVideoView();
    await this.getClient().startPreview(config.previewSourceType);
    this.previewStarted = true;
    this.log('Preview started');
    this.emitState();
  }

  async stopLocalPreview(): Promise<void> {
    if (!this.previewStarted) {
      this.log('Preview already stopped');
      return;
    }
    await this.getClient().stopPreview();
    this.clearLocalVideoRenderState();
    this.log('Preview stopped');
    this.emitState();
  }

  async togglePreview(): Promise<void> {
    if (this.previewStarted) {
      await this.stopLocalPreview();
      return;
    }
    await this.startLocalPreview();
  }

  async refreshRtcViews(): Promise<void> {
    await this.setupLocalVideoView();
    await Promise.all([...this.remoteUserUids].map((uid) => this.setupRemoteVideoView(uid)));
    this.log('Video views refreshed');
  }

  async toggleSpeakerphone(): Promise<void> {
    const client = this.getClient();
    const next = !(this.speakerphoneEnabled ?? false);
    await client.setEnableSpeakerphone(next);
    this.speakerphoneEnabled = next;
    this.log(`Speakerphone ${next ? 'enabled' : 'disabled'}`);
    this.emitState();
  }

  async toggleLocalAudio(): Promise<void> {
    await this.toggleEnableLocalAudio();
  }

  async toggleLocalVideo(): Promise<void> {
    await this.toggleEnableLocalVideo();
  }

  async cycleChannelProfilePreset(): Promise<void> {
    const index = CHANNEL_PROFILE_PRESETS.indexOf(this.selectedChannelProfile);
    const next = CHANNEL_PROFILE_PRESETS[(index + 1) % CHANNEL_PROFILE_PRESETS.length];
    await this.applyChannelProfile(next);
  }

  async cycleClientRolePreset(): Promise<void> {
    const index = CLIENT_ROLE_PRESETS.indexOf(this.selectedClientRole);
    this.selectedClientRole = CLIENT_ROLE_PRESETS[(index + 1) % CLIENT_ROLE_PRESETS.length];
    await this.getClient().setClientRole(this.selectedClientRole);
    this.log(`Client role: ${this.selectedClientRole}`);
    this.emitState();
  }

  async applyClientRole(role: ClientRole): Promise<void> {
    this.selectedClientRole = role;
    if (this.initialized) {
      await this.getClient().setClientRole(role);
    }
    this.log(`Client role: ${role}`);
    this.emitState();
  }

  async applyChannelProfile(profile: ChannelProfile): Promise<void> {
    this.selectedChannelProfile = profile;
    if (this.initialized) {
      await this.getClient().setChannelProfile(profile);
    }
    this.log(`Channel profile: ${profile}`);
    this.emitState();
  }

  async applyVideoEncoderPreset(name: VideoEncoderPresetName): Promise<void> {
    this.selectedVideoEncoderPresetName = name;
    const preset = VIDEO_ENCODER_PRESETS[name];
    await this.getClient().setVideoEncoderConfiguration(preset);
    this.log(`Video encoder: ${preset.name}`);
    this.emitState();
  }

  async cycleVideoEncoderPreset(): Promise<void> {
    const index = VIDEO_ENCODER_PRESET_NAMES.indexOf(this.selectedVideoEncoderPresetName);
    const next = VIDEO_ENCODER_PRESET_NAMES[(index + 1) % VIDEO_ENCODER_PRESET_NAMES.length];
    await this.applyVideoEncoderPreset(next);
  }

  async toggleEnableAudio(): Promise<void> {
    const next = !this.audioEnabled;
    await this.getClient().enableAudio(next);
    this.audioEnabled = next;
    this.log(`Enable audio ${next ? 'enabled' : 'disabled'}`);
    this.emitState();
  }

  async toggleEnableLocalAudio(): Promise<void> {
    const next = !this.localAudioEnabled;
    await this.getClient().enableLocalAudio(next);
    this.localAudioEnabled = next;
    this.log(`Enable local audio ${next ? 'enabled' : 'disabled'}`);
    this.emitState();
  }

  async toggleMuteLocalAudio(): Promise<void> {
    const next = !this.localAudioMuted;
    await this.getClient().muteLocalAudioStream(next);
    this.localAudioMuted = next;
    this.log(`Mute local audio ${next ? 'muted' : 'unmuted'}`);
    this.emitState();
  }

  async toggleMuteRemoteAudio(): Promise<void> {
    const next = !this.remoteAudioMuted;
    const uid = this.activeRemoteUid ?? 0;
    await this.getClient().muteRemoteAudioStream(uid, next);
    this.remoteAudioMuted = next;
    this.log(`Mute remote audio for uid ${uid}: ${next ? 'muted' : 'unmuted'}`);
    this.emitState();
  }

  async toggleMuteAllRemoteAudio(): Promise<void> {
    const next = !this.allRemoteAudioMuted;
    await this.getClient().muteAllRemoteAudioStreams(next);
    this.allRemoteAudioMuted = next;
    this.log(`Mute all remote audio: ${next ? 'muted' : 'unmuted'}`);
    this.emitState();
  }

  async toggleAudioVolumeIndication(): Promise<void> {
    const next = !this.audioVolumeIndicationEnabled;
    const config = this.options.getConfig();
    const audioVolumeIndication = config.audioVolumeIndication ?? { interval: 200, smooth: 3, reportVad: true };
    await this.getClient().enableAudioVolumeIndication(
      next ? audioVolumeIndication.interval : 0,
      audioVolumeIndication.smooth,
      audioVolumeIndication.reportVad,
    );
    this.audioVolumeIndicationEnabled = next;
    this.log(`Audio volume indication ${next ? 'enabled' : 'disabled'}`);
  }

  async toggleDefaultAudioRoute(): Promise<void> {
    const next = !this.defaultAudioRouteToSpeakerphone;
    await this.getClient().setDefaultAudioRouteToSpeakerphone(next);
    this.defaultAudioRouteToSpeakerphone = next;
    this.log(`Default audio route: ${next ? 'speaker' : 'earpiece'}`);
  }

  async togglePlaybackVolume(): Promise<void> {
    const next = this.playbackVolume === 100 ? 50 : 100;
    await this.getClient().adjustPlaybackSignalVolume(next);
    this.playbackVolume = next;
    this.log(`Playback volume: ${next}`);
  }

  async toggleAudioProfile(): Promise<void> {
    const next = this.currentAudioProfile === 0 ? 1 : 0;
    const config = this.options.getConfig();
    const audioProfile = config.audioProfile ?? { profile: next };
    await this.getClient().setAudioProfile(audioProfile.profile, audioProfile.scenario);
    this.currentAudioProfile = next;
    this.log(`Audio profile: ${next}`);
  }

  async toggleEnableVideo(): Promise<void> {
    const next = !this.videoEnabled;
    await this.getClient().enableVideo(next);
    this.videoEnabled = next;
    this.log(`Enable video ${next ? 'enabled' : 'disabled'}`);
    this.emitState();
  }

  async toggleEnableLocalVideo(): Promise<void> {
    const next = !this.localVideoEnabled;
    await this.getClient().enableLocalVideo(next);
    this.localVideoEnabled = next;
    this.log(`Enable local video ${next ? 'enabled' : 'disabled'}`);
    this.emitState();
  }

  async toggleMuteLocalVideo(): Promise<void> {
    const next = !this.localVideoMuted;
    await this.getClient().muteLocalVideoStream(next);
    this.localVideoMuted = next;
    this.log(`Mute local video ${next ? 'muted' : 'unmuted'}`);
    this.emitState();
  }

  async toggleMuteRemoteVideo(): Promise<void> {
    const next = !this.remoteVideoMuted;
    const uid = this.activeRemoteUid ?? 0;
    await this.getClient().muteRemoteVideoStream(uid, next);
    this.remoteVideoMuted = next;
    this.log(`Mute remote video for uid ${uid}: ${next ? 'muted' : 'unmuted'}`);
    this.emitState();
  }

  async toggleMuteAllRemoteVideo(): Promise<void> {
    const next = !this.allRemoteVideoMuted;
    await this.getClient().muteAllRemoteVideoStreams(next);
    this.allRemoteVideoMuted = next;
    this.log(`Mute all remote video: ${next ? 'muted' : 'unmuted'}`);
    this.emitState();
  }

  async triggerSwitchCamera(): Promise<void> {
    await this.getClient().switchCamera();
    if (this.localTextureSlotId !== null) {
      this.bindNativeTextureSprite('local', this.localTextureSlotId, undefined, 0);
    }
    this.log('Camera switched');
  }

  async toggleBeautyEffect(): Promise<void> {
    const next = !this.beautyEffectEnabled;
    const config = this.options.getConfig();
    await this.getClient().setBeautyEffectOptions(
      next,
      config.beautyOptions ?? {
        lighteningContrastLevel: next ? 1 : 0,
        lighteningLevel: next ? 0.7 : 0,
        smoothnessLevel: next ? 0.5 : 0,
        rednessLevel: next ? 0.1 : 0,
      },
      config.beautyEffectSourceType,
    );
    this.beautyEffectEnabled = next;
    this.log(`Beauty effect ${next ? 'enabled' : 'disabled'}`);
  }

  async toggleContentInspect(): Promise<void> {
    const next = !this.contentInspectEnabled;
    const config = this.options.getConfig();
    await this.getClient().enableContentInspect(
      next,
      next ? (config.contentInspectConfig ?? { module: 0, interval: 2 }) : undefined,
    );
    this.contentInspectEnabled = next;
    this.log(`Content inspect ${next ? 'enabled' : 'disabled'}`);
  }

  async togglePlaybackUserVolume(): Promise<void> {
    const next = this.userPlaybackVolume === 100 ? 50 : 100;
    const uid = this.activeRemoteUid ?? 0;
    await this.getClient().adjustUserPlaybackSignalVolume(uid, next);
    this.userPlaybackVolume = next;
    this.log(`User ${uid} playback volume: ${next}`);
  }

  async runCapabilityDemo(): Promise<void> {
    if (!this.initialized) {
      await this.initializeRtc();
    }
    await this.runChannelRoleDemo();
    await this.runAudioControlDemo();
    await this.runVideoControlDemo();
    await this.runMixingDemo();
    await this.runEffectDemo();
    await this.runDiagnosticsDemo();
    this.log('Capability demo completed');
  }

  async runChannelRoleDemo(): Promise<void> {
    const client = this.getClient();
    const sdkVersion = await client.getSdkVersion();
    this.log(`SDK version: ${sdkVersion}`);
    await client.setChannelProfile(this.selectedChannelProfile);
    await client.setClientRole(this.selectedClientRole);
    await client.renewToken(this.options.getConfig().token);
    this.log('Channel role demo completed');
  }

  async runMixingDemo(): Promise<void> {
    const client = this.getClient();
    const config = this.options.getConfig();
    const audioMixing = config.audioMixing ?? {
      path: 'audio/demo-mix.mp3',
      loopback: false,
      cycle: 1,
      startPos: 0,
    };
    await this.callAndLogFailure('startAudioMixing', () => client.startAudioMixing(audioMixing));
    await this.callAndLogFailure('pauseAudioMixing', () => client.pauseAudioMixing());
    await this.callAndLogFailure('resumeAudioMixing', () => client.resumeAudioMixing());
    await this.callAndLogFailure('getAudioMixingCurrentPosition', async () => {
      const position = await client.getAudioMixingCurrentPosition();
      this.log(`Mixing position: ${position}`);
    });
    await this.callAndLogFailure(
      'setAudioMixingPosition',
      () => client.setAudioMixingPosition(config.audioMixingSeekPositionMs ?? 0),
    );
    await this.callAndLogFailure(
      'adjustAudioMixingVolume',
      () => client.adjustAudioMixingVolume(config.audioMixingVolume ?? 60),
    );
    await this.callAndLogFailure('stopAudioMixing', () => client.stopAudioMixing());
  }

  async runEffectDemo(): Promise<void> {
    const client = this.getClient();
    const config = this.options.getConfig();
    const preloadEffect = config.preloadEffect ?? { soundId: 1, path: 'audio/effect.mp3' };
    const playEffect = config.playEffect ?? {
      soundId: 1,
      path: 'audio/effect.mp3',
      loopCount: 1,
      pitch: 1,
      pan: 0,
      gain: 100,
      publish: false,
      startPos: 0,
    };
    await this.callAndLogFailure(
      'preloadEffect',
      () => client.preloadEffect(preloadEffect.soundId, preloadEffect.path, preloadEffect.startPos),
    );
    await this.callAndLogFailure('playEffect', () => client.playEffect(playEffect));
    await this.callAndLogFailure('stopEffect', () => client.stopEffect(1));
  }

  async preloadAudioEffect(): Promise<void> {
    await this.getClient().preloadEffect(this.audioEffectSoundId, this.audioEffectUrl);
    this.audioEffectPreloaded = true;
    this.log(`Audio effect preloaded: ${this.audioEffectUrl}`);
    this.emitState();
  }

  async togglePlayAudioEffect(): Promise<void> {
    if (this.audioEffectPlaying) {
      await this.getClient().stopEffect(this.audioEffectSoundId);
      this.audioEffectPlaying = false;
      this.log('Audio effect stopped');
      this.emitState();
      return;
    }
    await this.getClient().playEffect({
      soundId: this.audioEffectSoundId,
      path: this.audioEffectUrl,
      loopCount: -1,
      pitch: 1,
      pan: 0,
      gain: 100,
      publish: true,
      startPos: 0,
    });
    this.audioEffectPlaying = true;
    this.log('Audio effect playing');
    this.emitState();
  }

  async pauseAudioEffect(): Promise<void> {
    await this.getClient().pauseEffect(this.audioEffectSoundId);
    this.log('Audio effect paused');
  }

  async resumeAudioEffect(): Promise<void> {
    await this.getClient().resumeEffect(this.audioEffectSoundId);
    this.log('Audio effect resumed');
  }

  async applyEffectsVolume(volume = this.effectsVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().setEffectsVolume(next);
    this.effectsVolume = next;
    this.log(`Effects volume: ${next}`);
    this.emitState();
  }

  async toggleAudioMixing(path: string): Promise<void> {
    if (this.audioMixingStarted) {
      await this.getClient().stopAudioMixing();
      this.audioMixingStarted = false;
      this.log('Audio mixing stopped');
      this.emitState();
      return;
    }
    await this.getClient().startAudioMixing({
      path,
      loopback: false,
      cycle: 1,
      startPos: this.audioMixingPositionMs,
    });
    this.audioMixingStarted = true;
    this.log(`Audio mixing started: ${path}`);
    this.emitState();
  }

  async applyAudioMixingPosition(positionMs = this.audioMixingPositionMs): Promise<void> {
    this.audioMixingPositionMs = Math.max(0, Math.floor(positionMs));
    await this.getClient().setAudioMixingPosition(this.audioMixingPositionMs);
    this.log(`Audio mixing position: ${this.audioMixingPositionMs}`);
    this.emitState();
  }

  async applyAudioMixingPublishVolume(volume = this.audioMixingPublishVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().adjustAudioMixingPublishVolume(next);
    this.audioMixingPublishVolume = next;
    this.log(`Audio mixing publish volume: ${next}`);
    this.emitState();
  }

  async applyAudioMixingPlayoutVolume(volume = this.audioMixingPlayoutVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().adjustAudioMixingPlayoutVolume(next);
    this.audioMixingPlayoutVolume = next;
    this.log(`Audio mixing playout volume: ${next}`);
    this.emitState();
  }

  async applyAudioMixingVolume(volume = this.audioMixingVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().adjustAudioMixingVolume(next);
    this.audioMixingVolume = next;
    this.log(`Audio mixing volume: ${next}`);
    this.emitState();
  }

  async runDiagnosticsDemo(): Promise<void> {
    const client = this.getClient();
    const config = this.options.getConfig();
    const errorDescription = await client.getErrorDescription(0);
    this.log(`getErrorDescription(0): ${errorDescription}`);
    await client.setLogFilter(config.logFilter ?? 0);
    await client.setLogFile(config.logFilePath ?? '/tmp/agora-cocos.log');
    await this.callAndLogFailure('isSpeakerphoneEnabled', async () => {
      this.speakerphoneEnabled = await client.isSpeakerphoneEnabled();
      this.log(`Speakerphone enabled: ${this.speakerphoneEnabled}`);
    });
    await client.setParameters(config.debugParameters ?? { 'rtc.debug': true });
  }

  async applyParameterPreset(parameters: Record<string, unknown>): Promise<void> {
    if (!this.initialized) {
      await this.initializeRtc();
    }
    await this.getClient().setParameters(parameters);
    this.log(`Parameters applied: ${JSON.stringify(parameters)}`);
  }

  async teardownRtc(): Promise<void> {
    if (!this.client) {
      return;
    }
    const client = this.client;
    try {
      if (this.joined) {
        await this.teardownRtcStep('leaveChannel', () => client.leaveChannel());
      }
      if (this.previewStarted) {
        await this.teardownRtcStep('stopPreview', () => client.stopPreview());
      }
      if (this.localViewAttached) {
        await this.teardownRtcStep('removeLocalVideoView', () => client.removeLocalVideoView());
      }
      for (const uid of this.remoteUserUids) {
        await this.teardownRtcStep(`removeRemoteVideoView:${uid}`, () =>
          client.removeRemoteVideoView(uid),
        );
      }
      await this.teardownRtcStep('destroy', () => client.destroy());
    } finally {
      const remoteUids = [...this.remoteUserUids];
      this.client = null;
      this.listenersBound = false;
      this.initialized = false;
      this.joined = false;
      this.previewStarted = false;
      this.activeRemoteUid = null;
      this.audioEffectPreloaded = false;
      this.audioEffectPlaying = false;
      this.audioMixingStarted = false;
      this.remoteUserUids.clear();
      this.localViewAttached = false;
      this.localTextureSlotId = null;
      this.clearLocalVideoRenderState();
      this.clearRemoteVideoRenderState(remoteUids);
      this.lastRemoteVideoStatsByUid.clear();
      this.options.onRemoteUsersChanged([], null);
      this.emitState();
    }
  }

  private getClient(): AgoraRtcClient {
    if (!this.client) {
      this.client = createAgoraRtcClient({
        bridgeRuntime: {
          native,
          sys,
        },
      });
    }
    this.bindRtcEventListeners();
    return this.client;
  }

  private bindRtcEventListeners(): void {
    if (!this.client || this.listenersBound) {
      return;
    }
    this.client.on('joinChannelSuccess', ({ channelId, uid }) => {
      this.joined = true;
      this.log(`Joined channel: ${channelId} (${uid})`);
      this.emitState();
    });
    this.client.on('userJoined', ({ uid }) => {
      this.remoteUserUids.add(uid);
      if (this.activeRemoteUid === null) {
        this.activeRemoteUid = uid;
      }
      this.options.onRemoteUsersChanged([...this.remoteUserUids], this.activeRemoteUid);
      void this.setupRemoteVideoView(uid).catch((error) => {
        this.recordAsyncError('Remote view setup failed', error);
      });
      this.log(`Remote user joined: ${uid}`);
      this.emitState();
    });
    this.client.on('userOffline', ({ uid, reason }) => {
      this.remoteUserUids.delete(uid);
      if (this.activeRemoteUid === uid) {
        this.activeRemoteUid = this.remoteUserUids.values().next().value ?? null;
      }
      this.lastRemoteVideoStatsByUid.delete(uid);
      this.clearRemoteVideoRenderState([uid]);
      this.options.onRemoteUsersChanged([...this.remoteUserUids], this.activeRemoteUid);
      void this.removeRemoteVideoView(uid).catch((error) => {
        this.recordAsyncError(`Remote view cleanup failed for uid ${uid}`, error);
      });
      this.log(`Remote user offline: ${uid} (${reason ?? 'unknown'})`);
      this.emitState();
    });
    this.client.on('leaveChannel', ({ duration }) => {
      this.log(`Leave channel callback: duration ${duration}`);
    });
    this.client.on('volumeIndication', ({ speakers, totalVolume }) => {
      this.lastVolumeSummary = `${totalVolume}/${speakers.length}`;
      this.log(`Volume indication: ${totalVolume} (${speakers.length} speakers)`);
      this.emitState();
    });
    this.client.on('rtcStats', ({ duration, users }) => {
      this.lastRtcStatsSummary = `${duration}s/${users ?? 0}u`;
      this.log(`RTC stats: duration ${duration}s users ${users ?? 0}`);
      this.emitState();
    });
    this.client.on('localVideoStateChanged', ({ state, error }) => {
      this.lastLocalVideoStatsSummary = `state ${state}/err ${error}`;
      this.log(`Local video state: ${state} error ${error}`);
      if (state === 1 && this.localTextureSlotId !== null) {
        this.bindNativeTextureSprite('local', this.localTextureSlotId, undefined, 0);
      }
      this.emitState();
    });
    this.client.on('remoteVideoStateChanged', ({ uid, state, reason }) => {
      this.lastRemoteVideoStatsByUid.set(uid, `state ${state}/reason ${reason}`);
      this.log(`Remote video state: ${uid} state ${state} reason ${reason}`);
      this.emitState();
    });
    this.client.on('remoteAudioStateChanged', ({ uid, state, reason, elapsed }) => {
      this.remoteAudioStateSummary = `${uid}: state ${state}/reason ${reason}/${elapsed}ms`;
      this.log(`Remote audio state: ${this.remoteAudioStateSummary}`);
      this.emitState();
    });
    this.client.on('localVideoTextureReady', ({ slotId, width, height }) => {
      this.log(`Local texture ready: ${width}x${height}`);
      this.bindNativeTextureSprite('local', slotId, undefined, 0);
    });
    this.client.on('remoteVideoTextureReady', ({ uid, slotId, width, height }) => {
      this.activeRemoteUid = uid;
      this.remoteUserUids.add(uid);
      this.options.onRemoteUsersChanged([...this.remoteUserUids], this.activeRemoteUid);
      this.log(`Remote texture ready: ${uid} ${width}x${height}`);
      this.bindNativeTextureSprite('remote', slotId, uid, 0);
      this.emitState();
    });
    this.client.on('renderBackendState', (payload) => {
      this.log(`Backend[${payload.backend}] ${payload.phase}: ${payload.result}`);
    });
    this.client.on('error', ({ message }) => {
      this.lastErrorMessage = message;
      this.log(`Native error: ${message}`);
      this.emitState();
    });
    this.listenersBound = true;
  }

  private async setupLocalVideoView(): Promise<void> {
    const node = this.options.getLocalVideoNode();
    const config = this.options.getConfig();
    await this.getClient().setupLocalVideoView({
      ...this.resolveNodeRect(node, 'hidden'),
      ...config.localVideoCanvas,
      uid: 0,
      mirrorMode: 0,
      setupMode: 0,
      sourceType: 0,
    });
    this.localViewAttached = true;
  }

  private async setupRemoteVideoView(uid: number): Promise<void> {
    const node = this.options.getRemoteVideoNode(uid);
    const config = this.options.getConfig();
    await this.getClient().setupRemoteVideoView(uid, {
      ...this.resolveNodeRect(node, 'fit'),
      ...config.remoteVideoCanvas,
      uid,
      mirrorMode: 2,
      setupMode: 0,
      sourceType: 0,
    });
  }

  private bindNativeTextureSprite(
    kind: 'local' | 'remote',
    slotId: number,
    uid?: number,
    retryCount = 0,
  ): void {
    if (this.options.getConfig().renderBackend !== 'engine-texture') {
      return;
    }
    const texture = this.client?.getEngineTexture(slotId) as Texture2D | null;
    if (!texture) {
      this.scheduleTextureBindRetry(kind, slotId, uid, retryCount);
      return;
    }
    this.clearTextureBindRetry(kind, slotId, uid);
    texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    texture.setMipFilter(Texture2D.Filter.NONE);
    texture.setWrapMode(
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
    );
    const spriteFrame = kind === 'local'
      ? (this.localVideoSpriteFrame ??= new SpriteFrame())
      : this.ensureRemoteSpriteFrame(uid ?? 0);
    spriteFrame.texture = texture;
    if (kind === 'local') {
      this.localTextureSlotId = slotId;
      this.options.onLocalTextureReady(texture, spriteFrame);
    } else if (uid !== undefined) {
      this.remoteTextureSlotIds.set(uid, slotId);
      this.options.onRemoteTextureReady(uid, texture, spriteFrame);
    }
    this.log(`Bound ${kind} engine texture slot ${slotId}`);
  }

  private scheduleTextureBindRetry(
    kind: 'local' | 'remote',
    slotId: number,
    uid: number | undefined,
    retryCount: number,
  ): void {
    const key = this.textureBindRetryKey(kind, slotId, uid);
    if (this.textureBindRetryTimers.has(key)) {
      return;
    }
    if (retryCount >= MAX_TEXTURE_BIND_RETRIES) {
      this.log(`Engine texture slot ${slotId} is not ready after ${retryCount} retries`);
      return;
    }
    if (retryCount === 0) {
      this.log(`Engine texture slot ${slotId} is not ready; retrying`);
    }
    const timer = setTimeout(() => {
      this.textureBindRetryTimers.delete(key);
      this.bindNativeTextureSprite(kind, slotId, uid, retryCount + 1);
    }, TEXTURE_BIND_RETRY_MS);
    this.textureBindRetryTimers.set(key, timer);
  }

  private clearTextureBindRetry(kind: 'local' | 'remote', slotId: number, uid?: number): void {
    const key = this.textureBindRetryKey(kind, slotId, uid);
    const timer = this.textureBindRetryTimers.get(key);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.textureBindRetryTimers.delete(key);
  }

  private clearTextureBindRetries(): void {
    for (const timer of this.textureBindRetryTimers.values()) {
      clearTimeout(timer);
    }
    this.textureBindRetryTimers.clear();
  }

  private clearTextureBindRetriesByKind(kind: 'local' | 'remote'): void {
    for (const [key, timer] of this.textureBindRetryTimers.entries()) {
      if (!key.startsWith(`${kind}:`)) {
        continue;
      }
      clearTimeout(timer);
      this.textureBindRetryTimers.delete(key);
    }
  }

  private textureBindRetryKey(kind: 'local' | 'remote', slotId: number, uid?: number): string {
    return `${kind}:${slotId}:${uid ?? 'local'}`;
  }

  private ensureRemoteSpriteFrame(uid: number): SpriteFrame {
    let spriteFrame = this.remoteVideoSpriteFrames.get(uid);
    if (!spriteFrame) {
      spriteFrame = new SpriteFrame();
      this.remoteVideoSpriteFrames.set(uid, spriteFrame);
    }
    return spriteFrame;
  }

  private resolveNodeRect(node: Node | null, renderMode: 'hidden' | 'fit' | 'adaptive'): AgoraRtcVideoCanvas {
    const size = node?.getComponent(UITransform)?.contentSize;
    const width = Math.max(1, Math.round(size?.width ?? 320));
    const height = Math.max(1, Math.round(size?.height ?? 180));
    return {
      x: 0,
      y: 0,
      width,
      height,
      renderMode,
      textureWidth: width,
      textureHeight: height,
    };
  }

  private clearLocalVideoRenderState(): void {
    this.previewStarted = false;
    this.localViewAttached = false;
    this.localTextureSlotId = null;
    if (this.localVideoSpriteFrame) {
      this.localVideoSpriteFrame.texture = null;
    }
    this.clearTextureBindRetriesByKind('local');
    this.options.onLocalVideoCleared();
  }

  private clearRemoteVideoRenderState(uids: number[] = [...this.remoteUserUids]): void {
    for (const uid of uids) {
      const spriteFrame = this.remoteVideoSpriteFrames.get(uid);
      if (spriteFrame) {
        spriteFrame.texture = null;
      }
      this.remoteTextureSlotIds.delete(uid);
      this.remoteVideoSpriteFrames.delete(uid);
      this.options.onRemoteVideoCleared(uid);
    }
    if (uids.length === 0 || uids.length === this.remoteUserUids.size) {
      this.clearTextureBindRetriesByKind('remote');
      return;
    }
    for (const [key, timer] of this.textureBindRetryTimers.entries()) {
      if (!key.startsWith('remote:')) {
        continue;
      }
      const [, , uidToken] = key.split(':');
      const retryUid = Number(uidToken);
      if (!uids.includes(retryUid)) {
        continue;
      }
      clearTimeout(timer);
      this.textureBindRetryTimers.delete(key);
    }
  }

  private async runAudioControlDemo(): Promise<void> {
    const config = this.options.getConfig();
    const audioProfile = config.audioProfile ?? { profile: 0, scenario: 0 };
    const audioVolumeIndication = config.audioVolumeIndication ?? { interval: 300, smooth: 3, reportVad: false };
    const playbackVolume = config.playbackVolume ?? 100;
    const userPlaybackVolume = config.userPlaybackVolume ?? 100;
    await this.getClient().enableAudio(true);
    this.audioEnabled = true;
    await this.getClient().enableLocalAudio(true);
    this.localAudioEnabled = true;
    await this.getClient().muteLocalAudioStream(false);
    await this.getClient().muteAllRemoteAudioStreams(false);
    await this.getClient().setAudioProfile(audioProfile.profile, audioProfile.scenario);
    await this.getClient().enableAudioVolumeIndication(
      audioVolumeIndication.interval,
      audioVolumeIndication.smooth,
      audioVolumeIndication.reportVad,
    );
    await this.getClient().setDefaultAudioRouteToSpeakerphone(true);
    await this.getClient().setEnableSpeakerphone(true);
    this.speakerphoneEnabled = true;
    await this.getClient().adjustPlaybackSignalVolume(playbackVolume);
    await this.getClient().adjustUserPlaybackSignalVolume(this.activeRemoteUid ?? 0, userPlaybackVolume);
    await this.callAndLogFailure('setAudioSessionOperationRestriction', () =>
      this.getClient().setAudioSessionOperationRestriction(0),
    );
  }

  private async runVideoControlDemo(): Promise<void> {
    const config = this.options.getConfig();
    await this.getClient().enableVideo(true);
    await this.getClient().enableLocalVideo(true);
    await this.getClient().muteLocalVideoStream(false);
    await this.getClient().muteAllRemoteVideoStreams(false);
    await this.callAndLogFailure('setVideoEncoderConfiguration', () =>
      this.getClient().setVideoEncoderConfiguration(
        config.videoEncoderConfiguration ?? VIDEO_ENCODER_PRESETS[this.selectedVideoEncoderPresetName],
      ),
    );
    await this.getClient().switchCamera();
    await this.callAndLogFailure('setBeautyEffectOptions', () =>
      this.getClient().setBeautyEffectOptions(true, config.beautyDemoOptions ?? { smoothnessLevel: 0.5 }),
    );
    await this.callAndLogFailure('enableContentInspect', () =>
      this.getClient().enableContentInspect(true, config.contentInspectDemoConfig ?? { module: 0, interval: 0 }),
    );
  }

  private clampVolume(volume: number): number {
    return Math.max(0, Math.min(100, Math.floor(volume)));
  }

  private async callAndLogFailure(label: string, action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this.log(`Demo success: ${label}`);
    } catch (error) {
      this.log(`Demo result: ${label} -> ${String(error)}`);
    }
  }

  private async teardownRtcStep(label: string, action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.recordAsyncError(`Teardown ${label}`, error);
    }
  }

  private log(line: string): void {
    this.options.onLog(line);
  }

  private recordAsyncError(label: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.lastErrorMessage = message;
    this.log(`${label}: ${message}`);
    this.emitState();
  }

  private emitState(): void {
    this.options.onStateChanged();
  }
}
