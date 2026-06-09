import { _decorator, Component, JsonAsset, Node, resources, UITransform, view } from 'cc';
import {
  resolveAgoraExampleConfig,
  type AgoraExampleRuntimeConfig,
} from '../agoraRtcConfigOverride.ts';
import { DEFAULT_BUTTON_LAYOUT } from './actions.ts';
import { DEMO_CASES, findDemoCase, type DemoCaseDefinition } from './cases/caseRegistry.ts';
import { RtcSessionService } from './RtcSessionService.ts';
import type {
  ActionResult,
  BasicVideoConfigState,
  ChannelProfile,
  DemoSessionState,
  RuntimeConfigState,
  VideoEncoderPresetName,
} from './types.ts';
import { DemoHeaderPanel } from './panels/DemoHeaderPanel.ts';
import { DemoActionPanel } from './panels/DemoActionPanel.ts';
import { VideoStagePanel } from './panels/VideoStagePanel.ts';
import { LogPanel } from './panels/LogPanel.ts';

const { ccclass, property } = _decorator;
const MAX_LOG_LINES = 80;
const LAYOUT_MARGIN = 24;
const PANEL_GAP = 20;
const ACTION_PANEL_WIDTH = 420;
const ACTION_PANEL_HEIGHT = 620;
const MIN_VIDEO_STAGE_WIDTH = 360;

type CocosTestGlobal = typeof globalThis & {
  AGORA_COCOS_TEST_MODE?: string;
};

@ccclass('AgoraRtcDemoRoot')
export class AgoraRtcDemoRoot extends Component {
  @property
  appId = '';

  @property
  token = '';

  @property
  channelId = 'demo';

  @property
  uid = 1001;

  @property
  renderBackend: RuntimeConfigState['renderBackend'] = 'engine-texture';

  @property
  autoPreview = true;

  @property
  autoJoin = false;

  @property
  publishCameraTrack = true;

  @property
  publishMicrophoneTrack = true;

  @property
  autoSubscribeAudio = true;

  @property
  autoSubscribeVideo = true;

  @property
  channelProfile: ChannelProfile = 'communication';

  @property
  videoEncoderPresetName: VideoEncoderPresetName = '360p';

  @property(DemoHeaderPanel)
  headerPanel: DemoHeaderPanel | null = null;

  @property(DemoActionPanel)
  actionPanel: DemoActionPanel | null = null;

  @property(VideoStagePanel)
  videoStagePanel: VideoStagePanel | null = null;

  @property(LogPanel)
  logPanel: LogPanel | null = null;

  private session: RtcSessionService | null = null;
  private statusLines: string[] = [];
  private actionResults = new Map<string, ActionResult>();
  private statusFrozen = false;
  private selectedCase: DemoCaseDefinition | null = null;

  private get selectedCaseName(): string | null {
    return this.selectedCase?.name ?? null;
  }

  onLoad(): void {
    this.resolvePanelBindings();
    view.on('canvas-resize', this.layoutResponsivePanels, this);
    this.videoStagePanel?.initialize();
    this.headerPanel?.initialize({
      onOpenLog: () => this.openStatusLogPage(),
      onApplyConfig: (channelId, uid) => this.applyConfig(channelId, uid),
    });
    this.actionPanel?.initialize({
      onAction: (actionName) => { void this.invokeAction(actionName); },
      onApplyConfig: (config) => this.applyBasicVideoConfig(config),
      onSelectCase: (caseName) => this.selectDemoCase(caseName),
      onBackToCases: () => this.showCaseList(),
    });
    this.logPanel?.initialize({
      onClose: () => this.closeStatusLogPage(),
      onClear: () => { void this.clearStatusLog(); },
      onFreeze: () => { void this.toggleStatusFreeze(); },
    });
    this.layoutResponsivePanels();
    if (this.videoStagePanel) {
      this.videoStagePanel.node.active = false;
    }
  }

  async start(): Promise<void> {
    this.pushStatus('Loading config...');
    try {
      await this.loadRuntimeConfig();
    } catch (error) {
      this.pushStatus(`Config load failed: ${String(error)}`);
    }
    this.createSession();
    this.refreshPanels();
    this.pushStatus('Example ready');
    this.pushStatus(`Render backend: ${this.renderBackend}`);
    if (this.isCocosTestMode()) {
      this.pushStatus('Cocos test mode: RTC auto startup skipped');
      return;
    }
    try {
      await this.initializeRtc();
      if (this.autoPreview) {
        this.pushStatus('Auto preview enabled');
        await this.startLocalPreview();
      } else {
        this.pushStatus('Auto preview disabled');
      }
      if (this.autoJoin) {
        this.pushStatus('Auto join enabled');
        await this.joinRtcChannel();
      }
    } catch (error) {
      this.pushStatus(`Auto startup failed: ${String(error)}`);
    }
  }

  onDestroy(): void {
    view.off('canvas-resize', this.layoutResponsivePanels, this);
    void this.session?.teardownRtc();
  }

  async initializeRtc(): Promise<void> {
    await this.runSessionAction('Initialize', (session) => session.initializeRtc());
  }

  async joinRtcChannel(): Promise<void> {
    await this.runSessionAction('JoinChannel', (session) => session.joinRtcChannel());
  }

  async toggleJoinChannel(): Promise<void> {
    const state = this.getSessionState();
    await this.runSessionAction('JoinChannel', (session) =>
      state.joined ? session.leaveRtcChannel() : session.joinRtcChannel(),
    );
  }

  async startLocalPreview(): Promise<void> {
    await this.runSessionAction('StartPreview', (session) => session.startLocalPreview());
  }

  async applySelectedVideoEncoder(): Promise<void> {
    await this.runSessionAction('ApplyEncoder', (session) =>
      session.applyVideoEncoderPreset(this.videoEncoderPresetName),
    );
  }

  async leaveRtcChannel(): Promise<void> {
    await this.runSessionAction('Leave', (session) => session.leaveRtcChannel());
  }

  async togglePreview(): Promise<void> {
    await this.runSessionAction('StartPreview', (session) => session.togglePreview());
  }

  async refreshRtcViews(): Promise<void> {
    await this.runSessionAction('RefreshViews', (session) => session.refreshRtcViews());
  }

  async toggleSpeakerphone(): Promise<void> {
    await this.runSessionAction('Speaker', (session) => session.toggleSpeakerphone());
  }

  async toggleLocalAudio(): Promise<void> {
    await this.runSessionAction('Mic', (session) => session.toggleLocalAudio());
  }

  async toggleLocalVideo(): Promise<void> {
    await this.runSessionAction('Cam', (session) => session.toggleLocalVideo());
  }

  async cycleChannelProfilePreset(): Promise<void> {
    await this.runSessionAction('Profile', (session) => session.cycleChannelProfilePreset());
  }

  async cycleClientRolePreset(): Promise<void> {
    await this.runSessionAction('Role', (session) => session.cycleClientRolePreset());
  }

  async cycleVideoEncoderPreset(): Promise<void> {
    await this.runSessionAction('Encoder', (session) => session.cycleVideoEncoderPreset());
  }

  async toggleEnableAudio(): Promise<void> {
    await this.runSessionAction('EnableAudio', (session) => session.toggleEnableAudio());
  }

  async toggleEnableLocalAudio(): Promise<void> {
    await this.runSessionAction('EnableLocalAudio', (session) => session.toggleEnableLocalAudio());
  }

  async toggleMuteLocalAudio(): Promise<void> {
    await this.runSessionAction('MuteLocalAudio', (session) => session.toggleMuteLocalAudio());
  }

  async toggleMuteRemoteAudio(): Promise<void> {
    await this.runSessionAction('MuteRemoteAudio', (session) => session.toggleMuteRemoteAudio());
  }

  async toggleMuteAllRemoteAudio(): Promise<void> {
    await this.runSessionAction('MuteAllRemoteAudio', (session) => session.toggleMuteAllRemoteAudio());
  }

  async toggleAudioVolumeIndication(): Promise<void> {
    await this.runSessionAction('AudioVolumeIndication', (session) => session.toggleAudioVolumeIndication());
  }

  async toggleDefaultAudioRoute(): Promise<void> {
    await this.runSessionAction('DefaultAudioRoute', (session) => session.toggleDefaultAudioRoute());
  }

  async togglePlaybackVolume(): Promise<void> {
    await this.runSessionAction('PlaybackVolume', (session) => session.togglePlaybackVolume());
  }

  async toggleAudioProfile(): Promise<void> {
    await this.runSessionAction('AudioProfile', (session) => session.toggleAudioProfile());
  }

  async toggleEnableVideo(): Promise<void> {
    await this.runSessionAction('EnableVideo', (session) => session.toggleEnableVideo());
  }

  async toggleMuteLocalVideo(): Promise<void> {
    await this.runSessionAction('MuteLocalVideo', (session) => session.toggleMuteLocalVideo());
  }

  async toggleMuteRemoteVideo(): Promise<void> {
    await this.runSessionAction('MuteRemoteVideo', (session) => session.toggleMuteRemoteVideo());
  }

  async toggleMuteAllRemoteVideo(): Promise<void> {
    await this.runSessionAction('MuteAllRemoteVideo', (session) => session.toggleMuteAllRemoteVideo());
  }

  async triggerSwitchCamera(): Promise<void> {
    await this.runSessionAction('SwitchCamera', (session) => session.triggerSwitchCamera());
  }

  async toggleBeautyEffect(): Promise<void> {
    await this.runSessionAction('BeautyEffect', (session) => session.toggleBeautyEffect());
  }

  async toggleContentInspect(): Promise<void> {
    await this.runSessionAction('ContentInspect', (session) => session.toggleContentInspect());
  }

  async togglePlaybackUserVolume(): Promise<void> {
    await this.runSessionAction('PlaybackUserVolume', (session) => session.togglePlaybackUserVolume());
  }

  async runCapabilityDemo(): Promise<void> {
    await this.runSessionAction('Full Demo', (session) => session.runCapabilityDemo());
  }

  async runChannelRoleDemo(): Promise<void> {
    await this.runSessionAction('Channel', (session) => session.runChannelRoleDemo());
  }

  async runMixingDemo(): Promise<void> {
    await this.runSessionAction('Mixing', (session) => session.runMixingDemo());
  }

  async runEffectDemo(): Promise<void> {
    await this.runSessionAction('Effect', (session) => session.runEffectDemo());
  }

  async preloadAudioEffect(): Promise<void> {
    await this.runSessionAction('PreloadEffect', (session) => session.preloadAudioEffect());
  }

  async togglePlayAudioEffect(): Promise<void> {
    await this.runSessionAction('PlayEffect', (session) => session.togglePlayAudioEffect());
  }

  async pauseAudioEffect(): Promise<void> {
    await this.runSessionAction('PauseEffect', (session) => session.pauseAudioEffect());
  }

  async resumeAudioEffect(): Promise<void> {
    await this.runSessionAction('ResumeEffect', (session) => session.resumeAudioEffect());
  }

  async applyEffectsVolume(): Promise<void> {
    await this.runSessionAction('SetEffectsVolume', (session) => session.applyEffectsVolume());
  }

  async toggleAudioMixing(): Promise<void> {
    await this.runAudioEffectMixingAction('StartAudioMixing', (session, assetPath) =>
      session.toggleAudioMixing(assetPath),
    );
  }

  async applyAudioMixingPosition(): Promise<void> {
    await this.runSessionAction('SetAudioMixingPosition', (session) => session.applyAudioMixingPosition());
  }

  async applyAudioMixingPublishVolume(): Promise<void> {
    await this.runSessionAction('AudioMixingPublishVolume', (session) => session.applyAudioMixingPublishVolume());
  }

  async applyAudioMixingPlayoutVolume(): Promise<void> {
    await this.runSessionAction('AudioMixingPlayoutVolume', (session) => session.applyAudioMixingPlayoutVolume());
  }

  async applyAudioMixingVolume(): Promise<void> {
    await this.runSessionAction('AudioMixingVolume', (session) => session.applyAudioMixingVolume());
  }

  async runDiagnosticsDemo(): Promise<void> {
    await this.runSessionAction('Diag', (session) => session.runDiagnosticsDemo());
  }

  async clearStatusLog(): Promise<void> {
    this.statusLines = [];
    this.refreshLogPanel();
    this.setActionResult('Clear', 'ok');
  }

  async toggleStatusFreeze(): Promise<void> {
    this.statusFrozen = !this.statusFrozen;
    this.setActionResult('Freeze', 'ok');
    if (!this.statusFrozen) {
      this.pushStatus('Status log live');
    }
  }

  openStatusLogPage(): void {
    this.logPanel?.show();
  }

  closeStatusLogPage(): void {
    this.logPanel?.hide();
  }

  showCaseList(): void {
    this.selectedCase = null;
    if (this.videoStagePanel) {
      this.videoStagePanel.node.active = false;
    }
    this.refreshPanels();
  }

  selectDemoCase(caseName: string): void {
    const definition = findDemoCase(caseName);
    if (!definition) {
      this.pushStatus(`Unknown case: ${caseName}`);
      return;
    }
    this.selectedCase = definition;
    if (this.videoStagePanel) {
      this.videoStagePanel.node.active = definition.displayMode === 'video';
    }
    this.pushStatus(`Case selected: ${this.selectedCaseName}`);
    this.refreshPanels();
  }

  private resolvePanelBindings(): void {
    this.headerPanel ??= this.ensurePanel('HeaderPanel', DemoHeaderPanel);
    this.actionPanel ??= this.ensurePanel('ActionPanel', DemoActionPanel);
    this.videoStagePanel ??= this.ensurePanel('VideoStagePanel', VideoStagePanel);
    this.logPanel ??= this.ensurePanel('LogPanel', LogPanel);
  }

  private ensurePanel<T extends Component>(name: string, component: new () => T): T {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(this.node);
      node.layer = this.node.layer;
    }
    return node.getComponent(component) ?? node.addComponent(component);
  }

  private createSession(): void {
    if (this.session) {
      return;
    }
    this.session = new RtcSessionService({
      getConfig: () => this.getRuntimeConfigState(),
      getLocalVideoNode: () => this.videoStagePanel?.getLocalVideoNode() ?? null,
      getRemoteVideoNode: (uid) => this.videoStagePanel?.getRemoteVideoNode(uid) ?? null,
      onLog: (line) => this.pushStatus(line),
      onStateChanged: () => this.refreshPanels(),
      onRemoteUsersChanged: (uids, activeUid) => this.videoStagePanel?.setRemoteUsers(uids, activeUid),
      onLocalTextureReady: (texture, spriteFrame) => this.videoStagePanel?.bindLocalSpriteFrame(texture, spriteFrame),
      onRemoteTextureReady: (uid, texture, spriteFrame) => this.videoStagePanel?.bindRemoteSpriteFrame(uid, texture, spriteFrame),
    });
  }

  private async loadRuntimeConfig(): Promise<void> {
    const [baseConfig, buildConfig] = await Promise.all([
      this.loadJsonConfig('agora-config'),
      this.loadJsonConfig('agora-config.build'),
    ]);
    const config = resolveAgoraExampleConfig(baseConfig, buildConfig);
    this.appId = config.appId?.trim() || this.appId;
    this.token = typeof config.token === 'string' ? config.token : this.token;
    this.channelId = config.channelId?.trim() || this.channelId;
    this.uid = typeof config.uid === 'number' ? config.uid : this.uid;
    this.renderBackend = config.renderBackend ?? this.renderBackend;
    this.autoPreview = config.autoPreview ?? this.autoPreview;
    this.autoJoin = config.autoJoin ?? this.autoJoin;
    this.publishCameraTrack = config.publishCameraTrack ?? this.publishCameraTrack;
    this.publishMicrophoneTrack = config.publishMicrophoneTrack ?? this.publishMicrophoneTrack;
    this.autoSubscribeAudio = config.autoSubscribeAudio ?? this.autoSubscribeAudio;
    this.autoSubscribeVideo = config.autoSubscribeVideo ?? this.autoSubscribeVideo;
    if (this.appId || this.channelId) {
      this.pushStatus(`Loaded config for channel: ${this.channelId}`);
    }
  }

  private loadJsonConfig(path: string): Promise<AgoraExampleRuntimeConfig | null> {
    return new Promise<AgoraExampleRuntimeConfig | null>((resolve) => {
      resources.load(path, JsonAsset, (error, asset) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve((asset?.json ?? null) as AgoraExampleRuntimeConfig | null);
      });
    });
  }

  private isCocosTestMode(): boolean {
    return Boolean((globalThis as CocosTestGlobal).AGORA_COCOS_TEST_MODE);
  }

  private async invokeAction(actionName: string): Promise<void> {
    const spec = DEFAULT_BUTTON_LAYOUT.find((item) => item.name === actionName);
    if (!spec) {
      this.pushStatus(`Unknown action: ${actionName}`);
      return;
    }
    const handler = (this as unknown as Record<string, unknown>)[spec.handler];
    if (typeof handler !== 'function') {
      this.pushStatus(`Action not wired: ${actionName}`);
      this.setActionResult(actionName, 'fail');
      return;
    }
    await Promise.resolve(handler.call(this));
  }

  private async runSessionAction(
    actionName: string,
    action: (session: RtcSessionService) => Promise<void>,
  ): Promise<void> {
    this.createSession();
    this.setActionResult(actionName, 'idle');
    try {
      await action(this.session!);
      this.setActionResult(actionName, 'ok');
    } catch (error) {
      this.setActionResult(actionName, 'fail');
      this.pushStatus(`${actionName} failed: ${String(error)}`);
      throw error;
    }
  }

  private async runAudioEffectMixingAction(
    actionName: string,
    action: (session: RtcSessionService, assetPath: string) => Promise<void>,
  ): Promise<void> {
    await this.runSessionAction(actionName, (session) => action(session, 'audio/Agora.io-Interactions.mp3'));
  }

  private setActionResult(actionName: string, result: ActionResult): void {
    this.actionResults.set(actionName, result);
    this.actionPanel?.setActionResult(actionName, result);
  }

  private applyConfig(channelId: string, uid: number): void {
    this.channelId = channelId;
    this.uid = uid;
    this.refreshPanels();
    this.pushStatus(`Config updated: channel ${channelId}, uid ${uid}`);
  }

  private applyBasicVideoConfig(config: Partial<BasicVideoConfigState>): void {
    if (typeof config.channelId === 'string') {
      this.channelId = config.channelId.trim() || this.channelId;
    }
    if (typeof config.uid === 'number' && Number.isFinite(config.uid)) {
      this.uid = Math.max(0, Math.floor(config.uid));
    }
    if (config.renderBackend) {
      this.renderBackend = config.renderBackend;
    }
    if (config.channelProfile) {
      this.channelProfile = config.channelProfile;
      void this.session?.applyChannelProfile(config.channelProfile);
    }
    if (config.videoEncoderPresetName) {
      this.videoEncoderPresetName = config.videoEncoderPresetName;
    }
    this.refreshPanels();
    this.pushStatus(`Config updated: channel ${this.channelId}, uid ${this.uid}`);
  }

  private pushStatus(line: string): void {
    if (this.statusFrozen) {
      return;
    }
    this.statusLines.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    if (this.statusLines.length > MAX_LOG_LINES) {
      this.statusLines.splice(0, this.statusLines.length - MAX_LOG_LINES);
    }
    this.refreshLogPanel();
    this.refreshPanels();
  }

  private refreshPanels(): void {
    this.layoutResponsivePanels();
    const config = this.getBasicVideoConfigState();
    const state = this.getSessionState();
    this.headerPanel?.setConfig(config);
    this.headerPanel?.setSummary(state);
    this.actionPanel?.setCaseState(DEMO_CASES, this.selectedCase);
    this.actionPanel?.setConfig(config);
    this.actionPanel?.setSessionState(state);
    this.actionPanel?.refresh();
    this.videoStagePanel?.setLocalStageState(state);
    this.videoStagePanel?.setStats(state);
  }

  private layoutResponsivePanels(): void {
    const visibleSize = view.getVisibleSize();
    const landscapeWidth = Math.max(visibleSize.width, visibleSize.height);
    const landscapeHeight = Math.min(visibleSize.width, visibleSize.height);
    this.node.getComponent(UITransform)?.setContentSize(landscapeWidth, landscapeHeight);

    const left = -landscapeWidth / 2 + LAYOUT_MARGIN;
    const right = landscapeWidth / 2 - LAYOUT_MARGIN;
    const availableHeight = Math.max(360, landscapeHeight - LAYOUT_MARGIN * 2);
    const actionScale = Math.min(1, availableHeight / ACTION_PANEL_HEIGHT);
    const actionWidth = ACTION_PANEL_WIDTH * actionScale;

    if (this.headerPanel) {
      this.headerPanel.node.active = false;
    }
    if (this.actionPanel) {
      this.actionPanel.node.setScale(actionScale, actionScale, 1);
      this.actionPanel.node.setPosition(left + actionWidth / 2, 0, 0);
    }

    const stageLeft = left + actionWidth + PANEL_GAP;
    const stageWidth = Math.max(MIN_VIDEO_STAGE_WIDTH, right - stageLeft);
    this.videoStagePanel?.applyLayout(stageWidth, availableHeight);
    this.videoStagePanel?.node.setScale(1, 1, 1);
    this.videoStagePanel?.node.setPosition(stageLeft + stageWidth / 2, 0, 0);

    if (this.logPanel) {
      this.logPanel.node.setScale(1, 1, 1);
      this.logPanel.node.setPosition(0, 0, 0);
    }
  }

  private refreshLogPanel(): void {
    this.logPanel?.setLines(this.statusLines);
  }

  private getRuntimeConfigState(): RuntimeConfigState {
    return {
      appId: this.appId,
      token: this.token,
      channelId: this.channelId,
      uid: this.uid,
      renderBackend: this.renderBackend,
      autoPreview: this.autoPreview,
      autoJoin: this.autoJoin,
      publishCameraTrack: this.publishCameraTrack,
      publishMicrophoneTrack: this.publishMicrophoneTrack,
      autoSubscribeAudio: this.autoSubscribeAudio,
      autoSubscribeVideo: this.autoSubscribeVideo,
    };
  }

  private getBasicVideoConfigState(): BasicVideoConfigState {
    return {
      ...this.getRuntimeConfigState(),
      channelProfile: this.channelProfile,
      clientRole: 'broadcaster',
      videoEncoderPresetName: this.videoEncoderPresetName,
    };
  }

  private getSessionState(): DemoSessionState {
    return this.session?.getState() ?? {
      initialized: false,
      joined: false,
      previewStarted: false,
      activeRemoteUid: null,
      remoteUserUids: [],
      channelProfile: this.channelProfile,
      clientRole: 'broadcaster',
      renderBackend: this.renderBackend,
      videoEncoderPresetName: this.videoEncoderPresetName,
      audioEnabled: true,
      localAudioEnabled: true,
      localVideoEnabled: true,
      videoEnabled: true,
      localAudioMuted: false,
      localVideoMuted: false,
      remoteAudioMuted: false,
      remoteVideoMuted: false,
      allRemoteAudioMuted: false,
      allRemoteVideoMuted: false,
      speakerphoneEnabled: null,
      lastErrorMessage: '-',
      lastRtcStatsSummary: '-',
      lastLocalVideoStatsSummary: '-',
      lastRemoteVideoStatsByUid: {},
      lastVolumeSummary: '-',
      audioEffectMixing: {
        effectPreloaded: false,
        effectPlaying: false,
        audioMixingStarted: false,
        effectsVolume: 100,
        audioMixingPublishVolume: 100,
        audioMixingPlayoutVolume: 100,
        audioMixingVolume: 100,
        audioMixingPositionMs: 1000,
        remoteAudioStateSummary: '-',
      },
    };
  }
}
