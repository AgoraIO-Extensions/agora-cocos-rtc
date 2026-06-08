import { _decorator, Component, JsonAsset, Node, resources, view } from 'cc';
import {
  resolveAgoraExampleConfig,
  type AgoraExampleRuntimeConfig,
} from '../agoraRtcConfigOverride.ts';
import { DEFAULT_BUTTON_LAYOUT } from './actions.ts';
import { RtcSessionService } from './RtcSessionService.ts';
import type { ActionResult, DemoSessionState, RuntimeConfigState } from './types.ts';
import { DemoHeaderPanel } from './panels/DemoHeaderPanel.ts';
import { DemoActionPanel } from './panels/DemoActionPanel.ts';
import { VideoStagePanel } from './panels/VideoStagePanel.ts';
import { LogPanel } from './panels/LogPanel.ts';

const { ccclass, property } = _decorator;
const MAX_LOG_LINES = 80;

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

  onLoad(): void {
    this.resolvePanelBindings();
    view.on('canvas-resize', this.refreshPanels, this);
    this.videoStagePanel?.initialize();
    this.headerPanel?.initialize({
      onOpenLog: () => this.openStatusLogPage(),
      onApplyConfig: (channelId, uid) => this.applyConfig(channelId, uid),
    });
    this.actionPanel?.initialize((actionName) => {
      void this.invokeAction(actionName);
    });
    this.logPanel?.initialize({
      onClose: () => this.closeStatusLogPage(),
      onClear: () => { void this.clearStatusLog(); },
      onFreeze: () => { void this.toggleStatusFreeze(); },
    });
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
    this.pushStatus('Auto initialize + join enabled');
    try {
      await this.initializeRtc();
      await this.joinRtcChannel();
    } catch (error) {
      this.pushStatus(`Auto join failed: ${String(error)}`);
    }
  }

  onDestroy(): void {
    view.off('canvas-resize', this.refreshPanels, this);
    void this.session?.teardownRtc();
  }

  async initializeRtc(): Promise<void> {
    await this.runSessionAction('Initialize', (session) => session.initializeRtc());
  }

  async joinRtcChannel(): Promise<void> {
    await this.runSessionAction('Join', (session) => session.joinRtcChannel());
  }

  async leaveRtcChannel(): Promise<void> {
    await this.runSessionAction('Leave', (session) => session.leaveRtcChannel());
  }

  async togglePreview(): Promise<void> {
    await this.runSessionAction('Preview', (session) => session.togglePreview());
  }

  async refreshRtcViews(): Promise<void> {
    await this.runSessionAction('Views', (session) => session.refreshRtcViews());
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
    this.headerPanel?.setConfig(this.getRuntimeConfigState());
    this.headerPanel?.setSummary(this.getSessionState());
    this.actionPanel?.refresh();
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
    };
  }

  private getSessionState(): DemoSessionState {
    return this.session?.getState() ?? {
      initialized: false,
      joined: false,
      previewStarted: false,
      activeRemoteUid: null,
      remoteUserUids: [],
      audioEnabled: true,
      localAudioEnabled: true,
      localVideoEnabled: true,
      localAudioMuted: false,
      localVideoMuted: false,
      remoteAudioMuted: false,
      remoteVideoMuted: false,
      allRemoteAudioMuted: false,
      allRemoteVideoMuted: false,
      speakerphoneEnabled: null,
      lastErrorMessage: '-',
      lastRtcStatsSummary: '-',
      lastVolumeSummary: '-',
    };
  }
}
