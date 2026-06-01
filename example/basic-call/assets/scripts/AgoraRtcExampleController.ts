import {
  _decorator,
  BlockInputEvents,
  Button,
  Color,
  Component,
  EditBox,
  EventTouch,
  Graphics,
  Input,
  input,
  instantiate,
  Vec2,
  Vec3,
  HorizontalTextAlignment,
  JsonAsset,
  Label,
  Layout,
  Mask,
  Node,
  PageView,
  Size,
  ScrollView,
  Sprite,
  SpriteFrame,
  Texture2D,
  tween,
  UITransform,
  VerticalTextAlignment,
  native,
  resources,
  sys,
  view,
} from 'cc';

import { createAgoraRtcClient, type AgoraRtcClient } from '../agora-rtc-sdk/agora.ts';
import { worldRectToNativeOverlayRect } from './agoraRtcHudLayout.ts';

const { ccclass, property } = _decorator;

const STATUS_NODE_NAME = '__example_status';
const STATUS_SCROLL_NODE_NAME = '__example_status_scroll';
const STATUS_CONTENT_NODE_NAME = '__example_status_content';
const SUMMARY_NODE_NAME = '__example_summary';
const TITLE_NODE_NAME = '__example_title';
const CONFIG_NODE_NAME = '__example_config';
const CONFIG_INPUTS_NODE_NAME = '__example_config_inputs';
const QA_UI_OVERLAY_NODE_NAME = '__qa_ui_overlay';
const QA_LEFT_PANE_NODE_NAME = '__qa_left_pane';
const QA_RIGHT_PANE_NODE_NAME = '__qa_right_pane';
const QA_LEFT_HEADER_NODE_NAME = '__qa_left_header';
const HEADER_SCROLL_NODE_NAME = '__example_header_scroll';
const SCROLL_VIEWPORT_NODE_NAME = '__scroll_viewport';
const SESSION_QUICK_BAR_NODE_NAME = '__session_quick_bar';
const SCROLL_CLIP_INSET = 10;
const PANEL_BG_NODE_NAME = '__panel_bg';
const EDIT_TEXT_LABEL_NAME = 'TEXT_LABEL';
const EDIT_PLACEHOLDER_LABEL_NAME = 'PLACEHOLDER_LABEL';
const STATUS_TITLE_NODE_NAME = '__example_status_title';
const LOG_FLOAT_BTN_NODE_NAME = '__log_float_btn';
const LOG_FLOAT_BTN_WIDTH = 110;
const LOG_FLOAT_BTN_HEIGHT = 40;
const LOG_PAGE_NODE_NAME = '__qa_log_page';
const LOG_PAGE_PANEL_NAME = '__log_page_panel';
const LOG_PAGE_HEADER_NAME = '__log_page_header';
const LOG_PAGE_BODY_NODE_NAME = '__log_page_body';
const LOG_BODY_VIEWPORT_NODE_NAME = '__log_body_viewport';
const LOG_BODY_CLIP_NODE_NAME = '__log_body_clip';
const LOG_PAGE_CONTENT_NAME = '__log_page_content';
const MAX_LOG_LINES = 80; // 限制行数，防止单 Label 纹理高度超过移动端 GPU 纹理上限(2048/4096)导致被强制压缩和拉伸
const MAIN_LOG_PREVIEW_LINES = 2;
const LOG_LINE_HEIGHT = 18;
const LOG_BODY_PAD = 10;
const SETTINGS_PANEL_NODE_NAME = '__example_settings_panel';
const SETTINGS_GRID_NODE_NAME = '__example_settings_grid';
const CHANNEL_INPUT_NODE_NAME = '__example_channel_input';
const UID_INPUT_NODE_NAME = '__example_uid_input';
const APPLY_CONFIG_BUTTON_NODE_NAME = '__example_apply_config';
const LOG_CONFIG_BUTTON_NODE_NAME = '__log_open_config';
const BUTTON_PANEL_NODE_NAME = '__example_button_panel';
const BUTTON_GRID_NODE_NAME = '__example_button_grid';
const BUTTON_SECTION_PREFIX = '__example_section_';
const REMOTE_HINT_NODE_NAME = '__video_remote';
const LOCAL_HINT_NODE_NAME = '__video_local';
const REMOTE_TITLE_NODE_NAME = '__video_remote_title';
const LOCAL_TITLE_NODE_NAME = '__video_local_title';
const REMOTE_TEXTURE_NODE_NAME = '__video_remote_texture';
const LOCAL_TEXTURE_NODE_NAME = '__video_local_texture';
const REMOTE_CARD_NODE_NAME = '__video_remote_card';
const LOCAL_CARD_NODE_NAME = '__video_local_card';
const VIDEO_TITLE_HEIGHT = 22;
const VIDEO_TITLE_GAP = 4;
const VIDEO_CARD_PAD = 2;
const VIDEO_STACK_GAP = 8;
const LOCAL_PIP_WIDTH_RATIO = 0.28;
const LOCAL_PIP_MIN_WIDTH = 168;
const LOCAL_PIP_MAX_WIDTH = 280;
const LOCAL_PIP_EDGE_PAD = 10;
const REMOTE_PAGE_SCROLL_DURATION = 0.35;
const VIDEO_CARD_BG_NODE_NAME = '__card_bg';
const LEFT_PANE_EDGE_PAD = 12;
const LEFT_SECTION_GAP = 6;
const QA_SCREEN_EDGE_PAD = 4;
const QA_SCREEN_EDGE_LEFT_PAD = 60;
const QA_PANE_GAP = 10;
const VIDEO_PANE_LEFT_INSET = 6;
const QA_LANDSCAPE_LEFT_MAX_WIDTH = 420;
const QA_LANDSCAPE_LEFT_MIN_WIDTH = 320;
const QA_LANDSCAPE_LEFT_WIDTH_RATIO = 0.42;
const QA_LANDSCAPE_RIGHT_MIN_WIDTH = 260;
const QA_PANE_HORIZONTAL_INSET = 4;
const QA_CONTENT_HORIZONTAL_INSET = 0;
const HEADER_VIEWPORT_INSET = 2;
const HEADER_SCROLL_CLIP_INSET = 2;
const HEADER_CONFIG_TEXT_HEIGHT = 72;
const VIDEO_EDGE_PAD = 4;
const CONFIG_INPUT_LABEL_WIDTH = 42;
const CONFIG_INPUT_LEFT_PAD = 6;
const CONFIG_PRESET_BUTTON_WIDTH = 52;
const CONFIG_CHANNEL_FIELD_MAX_WIDTH = 108;
const CONFIG_UID_FIELD_MAX_WIDTH = 72;
const CONFIG_INPUT_ROW_HEIGHT = 34;
const CONFIG_INPUTS_BLOCK_HEIGHT = CONFIG_INPUT_ROW_HEIGHT * 2 + 8;
const SESSION_QUICK_BAR_HEIGHT = 42;
const SESSION_QUICK_BUTTON_HEIGHT = 36;
const QA_GRID_BUTTON_HEIGHT = 36;
const QA_GRID_BUTTON_GAP_Y = 8;
const QA_GRID_SECTION_HEADER_HEIGHT = 24;
const BUTTON_COLUMNS = 3;
const BUTTON_ROW_PREFIX = '__example_button_row_';
const VIDEO_ENCODER_PRESETS = [
  { name: '360p', width: 640, height: 360, frameRate: 15, bitrate: 0 },
  { name: '540p', width: 960, height: 540, frameRate: 15, bitrate: 0 },
  { name: '720p', width: 1280, height: 720, frameRate: 15, bitrate: 0 },
] as const;
const CHANNEL_PROFILE_PRESETS = ['communication', 'liveBroadcasting'] as const;
const CLIENT_ROLE_PRESETS = ['broadcaster', 'audience'] as const;
const DEFAULT_BUTTON_LAYOUT = [
  { name: 'Initialize', handler: 'initializeRtc', x: -220, y: -70 },
  { name: 'Join', handler: 'joinRtcChannel', x: 0, y: -70 },
  { name: 'Leave', handler: 'leaveRtcChannel', x: 220, y: -70 },
  { name: 'Preview', handler: 'togglePreview', x: -220, y: -210 },
  { name: 'Views', handler: 'refreshRtcViews', x: 0, y: -210 },
  { name: 'Speaker', handler: 'toggleSpeakerphone', x: 220, y: -210 },
  { name: 'Mic', handler: 'toggleLocalAudio', x: -220, y: -280 },
  { name: 'Cam', handler: 'toggleLocalVideo', x: 0, y: -280 },
  { name: 'Full Demo', handler: 'runCapabilityDemo', x: 220, y: -280 },
  { name: 'Channel', handler: 'runChannelRoleDemo', x: -220, y: -350 },
  { name: 'Mixing', handler: 'runMixingDemo', x: -220, y: -420 },
  { name: 'Effect', handler: 'runEffectDemo', x: 0, y: -420 },
  { name: 'Diag', handler: 'runDiagnosticsDemo', x: 220, y: -420 },
  { name: 'Profile', handler: 'cycleChannelProfilePreset', x: -220, y: -490 },
  { name: 'Role', handler: 'cycleClientRolePreset', x: 0, y: -490 },
  { name: 'Encoder', handler: 'cycleVideoEncoderPreset', x: 220, y: -490 },
  { name: 'Freeze', handler: 'toggleStatusFreeze', x: -220, y: -560 },
  { name: 'Clear', handler: 'clearStatusLog', x: 0, y: -560 },

  // Audio API Buttons
  { name: 'EnableAudio', handler: 'toggleEnableAudio', x: 0, y: 0 },
  { name: 'EnableLocalAudio', handler: 'toggleEnableLocalAudio', x: 0, y: 0 },
  { name: 'MuteLocalAudio', handler: 'toggleMuteLocalAudio', x: 0, y: 0 },
  { name: 'MuteRemoteAudio', handler: 'toggleMuteRemoteAudio', x: 0, y: 0 },
  { name: 'MuteAllRemoteAudio', handler: 'toggleMuteAllRemoteAudio', x: 0, y: 0 },
  { name: 'AudioVolumeIndication', handler: 'toggleAudioVolumeIndication', x: 0, y: 0 },
  { name: 'DefaultAudioRoute', handler: 'toggleDefaultAudioRoute', x: 0, y: 0 },
  { name: 'PlaybackVolume', handler: 'togglePlaybackVolume', x: 0, y: 0 },
  { name: 'AudioProfile', handler: 'toggleAudioProfile', x: 0, y: 0 },

  // Video API Buttons
  { name: 'EnableVideo', handler: 'toggleEnableVideo', x: 0, y: 0 },
  { name: 'MuteLocalVideo', handler: 'toggleMuteLocalVideo', x: 0, y: 0 },
  { name: 'MuteRemoteVideo', handler: 'toggleMuteRemoteVideo', x: 0, y: 0 },
  { name: 'MuteAllRemoteVideo', handler: 'toggleMuteAllRemoteVideo', x: 0, y: 0 },
  { name: 'SwitchCamera', handler: 'triggerSwitchCamera', x: 0, y: 0 },
  { name: 'BeautyEffect', handler: 'toggleBeautyEffect', x: 0, y: 0 },
  { name: 'ContentInspect', handler: 'toggleContentInspect', x: 0, y: 0 },
  { name: 'PlaybackUserVolume', handler: 'togglePlaybackUserVolume', x: 0, y: 0 },
] as const;
const SESSION_QUICK_BUTTONS = ['Initialize', 'Join', 'Leave'] as const;
const BUTTON_SECTION_LAYOUT = [
  { title: 'Session', buttons: ['Preview', 'Views', 'Full Demo'] },
  { title: 'Render', buttons: ['Speaker', 'Mic', 'Cam'] },
  { title: 'Audio API', buttons: [
    'EnableAudio',
    'EnableLocalAudio',
    'MuteLocalAudio',
    'MuteRemoteAudio',
    'MuteAllRemoteAudio',
    'AudioVolumeIndication',
    'DefaultAudioRoute',
    'PlaybackVolume',
    'AudioProfile'
  ] },
  { title: 'Video API', buttons: [
    'EnableVideo',
    'MuteLocalVideo',
    'MuteRemoteVideo',
    'MuteAllRemoteVideo',
    'SwitchCamera',
    'BeautyEffect',
    'ContentInspect',
    'PlaybackUserVolume'
  ] },
  { title: 'Mixer', buttons: ['Mixing', 'Effect', 'Diag'] },
  { title: 'Tools', buttons: ['Freeze', 'Clear'] },
] as const;
const CHANNEL_PRESETS = ['demo', 'XPZ123', 'test-room'] as const;
const SETTINGS_ROWS = [
  { key: 'Profile', action: 'cycleChannelProfilePreset' },
  { key: 'Role', action: 'cycleClientRolePreset' },
  { key: 'Encoder', action: 'cycleVideoEncoderPreset' },
] as const;
const BUTTON_BG_NODE_NAME = '__btn_bg';
const BUTTON_LABEL_NODE_NAME = '__btn_label';
const SETTING_LABEL_ZH: Record<string, string> = {
  Backend: '渲染',
  Profile: '场景',
  Role: '角色',
  Encoder: '编码',
};
const ACTION_LABEL_ZH: Record<string, string> = {
  Initialize: '初始化',
  Join: '加入',
  Leave: '离开',
  Preview: '预览',
  Views: '刷新画面',
  Speaker: '扬声器',
  Mic: '麦克风',
  Cam: '摄像头',
  'Full Demo': '完整演示',
  Mixing: '混音',
  Effect: '音效',
  Diag: '诊断',
  Freeze: '冻结日志',
  Clear: '清空日志',
  Channel: '频道演示',
  Profile: '场景',
  Role: '角色',
  Encoder: '编码',
  EnableAudio: '启用音频',
  EnableLocalAudio: '启用本地音频',
  MuteLocalAudio: '禁麦本地',
  MuteRemoteAudio: '静音指定远端',
  MuteAllRemoteAudio: '静音远端',
  AudioVolumeIndication: '音量提示',
  DefaultAudioRoute: '默认路由',
  PlaybackVolume: '播放音量',
  AudioProfile: '音频配置',
  EnableVideo: '启用视频',
  MuteLocalVideo: '禁用本地视频',
  MuteRemoteVideo: '静视频远端',
  MuteAllRemoteVideo: '静视频所有远端',
  SwitchCamera: '切换相机',
  BeautyEffect: '美颜效果',
  ContentInspect: '视频鉴黄',
  PlaybackUserVolume: '远端播放音量',
};

type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'chip' | 'toggleOn' | 'toggleOff' | 'settingsPill';

type AgoraRuntimeConfig = {
  appId?: string;
  token?: string;
  channelId?: string;
  uid?: number;
  renderBackend?: 'surface-view' | 'texture-view' | 'engine-texture';
};

@ccclass('AgoraRtcExampleController')
export class AgoraRtcExampleController extends Component {
  @property
  appId = '';

  @property
  token = '';

  @property
  channelId = 'demo';

  @property
  uid = 1001;

  @property
  renderBackend: 'surface-view' | 'texture-view' | 'engine-texture' = 'engine-texture';

  private client: AgoraRtcClient | null = null;
  private listenersBound = false;
  private initialized = false;
  private joined = false;
  private previewStarted = false;
  private activeRemoteUid: number | null = null;
  private remoteUserUids = new Set<number>();
  private localViewAttached = false;
  private localTextureReadySeen = false;
  private remoteTextureReadySeen = false;
  private localTextureSlotId: number | null = null;
  private remoteTextureSlotIds = new Map<number, number>();
  private statusLabel: Label | null = null;
  private summaryLabel: Label | null = null;
  private configLabel: Label | null = null;
  private settingsPanel: Node | null = null;
  private channelInput: EditBox | null = null;
  private channelValueLabel: Label | null = null;
  private uidInput: EditBox | null = null;
  private channelPresetIndex = 0;
  private settingsValueLabels = new Map<string, Label>();
  private remoteHintLabels = new Map<number, Label>();
  private remoteVideoSprites = new Map<number, Sprite>();
  private remoteVideoTextures = new Map<number, Texture2D>();
  private remoteVideoSpriteFrames = new Map<number, SpriteFrame>();
  private remoteVideoNodes = new Map<number, Node>();
  private localHintLabel: Label | null = null;
  private localVideoSprite: Sprite | null = null;
  private localVideoTexture: Texture2D | null = null;
  private localVideoSpriteFrame: SpriteFrame | null = null;
  private statusScrollView: ScrollView | null = null;
  private headerScrollView: ScrollView | null = null;
  private buttonScrollView: ScrollView | null = null;
  private logPageScrollView: ScrollView | null = null;
  private statusContentNode: Node | null = null;
  private logPageNode: Node | null = null;
  private logPageBodyLabel: Label | null = null;
  private logBodyViewportNode: Node | null = null;
  private logBodyViewportHeight = 0;
  private logBodyContentHeight = 0;
  private logBodyScrollOffset = 0;
  private logBodyMaxScroll = 0;
  private logBodyPanLastY = 0;
  private logBodyPendingScrollToBottom = false;
  private logBodyUserHasScrolled = false;
  private logFloatButtonNode: Node | null = null;
  private logPageVisible = false;
  private logPageVideoSuspended = false;
  private logPageBuilt = false;
  private logConfigButtonNode: Node | null = null;
  private logUiGlobalTouchBound = false;
  private lastLogUiOpenMs = 0;
  private logUiHudLine = 'UI: 等待点击';
  private logFloatWorldRect: { x: number; y: number; w: number; h: number } | null = null;
  private statusLines: string[] = [];
  private actionButtons = new Map<string, Label>();

  // 17 APIs State properties
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
  private buttonNodes = new Map<string, Node>();
  private actionResults = new Map<string, 'ok' | 'fail' | 'idle'>();
  private audioEnabled = true;
  private localAudioEnabled = true;
  private localVideoEnabled = true;
  private speakerphoneEnabled: boolean | null = null;
  private lastErrorMessage = '-';
  private lastRtcStatsSummary = '-';
  private lastVolumeSummary = '-';
  private statusFrozen = false;
  private uiInitialized = false;
  private selectedChannelProfile: typeof CHANNEL_PROFILE_PRESETS[number] = 'communication';
  private selectedClientRole: typeof CLIENT_ROLE_PRESETS[number] = 'broadcaster';
  private selectedVideoEncoderPresetIndex = 0;

  onLoad() {
    console.log('[agora-rtc] controller onLoad');
    this.logPageVisible = false;
    this.bindLogUiGlobalTouchFallback();
    this.initializeUi();
    this.setLogUiHud('UI: 已就绪，请点「日志」或右上角');
    this.scheduleOnce(() => this.refreshConfigLabel(), 0);
    view.on('canvas-resize', this.resizeCanvasToVisibleArea, this);
  }

  initializeUi() {
    const leftPane = this.getLeftPane();
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME);
    if (this.uiInitialized && leftPane && rightPane) {
      this.layoutConsole();
      this.ensureConfigLogButton();
      this.ensureLogFloatButton();
      return;
    }
    this.uiInitialized = true;
    try {
      this.ensureUi();
      this.cleanupSceneEmbeddedHud();
      console.log('[agora-rtc] controller ui children', this.node.children.map((child) => child.name));
    } catch (error) {
      console.error('[agora-rtc] initializeUi failed', error);
      this.uiInitialized = false;
    }
  }

  async start() {
    console.log('[agora-rtc] controller start');
    this.resizeCanvasToVisibleArea();
    this.initializeUi();
    this.pushStatus('正在加载配置…');
    try {
      await this.loadRuntimeConfig();
    } catch (error) {
      console.error('[agora-rtc] config load failed', error);
      this.pushStatus(`Config load failed: ${String(error)}`);
    }
    this.refreshConfigLabel();
    this.pushStatus('Example ready');
    this.pushStatus(`Render backend: ${this.renderBackend}`);
    this.pushStatus('Auto initialize + join enabled');
    try {
      await this.initializeRtc();
      await this.joinRtcChannel();
    } catch (error) {
      console.error('[agora-rtc] auto join failed', error);
      this.pushStatus(`Auto join failed: ${String(error)}`);
    }
    console.log('[agora-rtc] controller start completed');
  }

  onDestroy() {
    view.off('canvas-resize', this.resizeCanvasToVisibleArea, this);
    void this.teardownRtc();
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

    if (!this.listenersBound) {
      this.client.on('joinChannelSuccess', ({ channelId, uid }) => {
        this.joined = true;
        this.pushStatus(`Joined channel: ${channelId} (${uid})`);
      });
      this.client.on('userJoined', ({ uid }) => {
        this.remoteUserUids.add(uid);
        if (this.activeRemoteUid === null) {
          this.activeRemoteUid = uid;
        }
        this.pushStatus(`Remote user joined: ${uid}`);
        this.addRemoteUserPage(uid);
        this.refreshSummary();
      });
      this.client.on('userOffline', ({ uid, reason }) => {
        this.remoteUserUids.delete(uid);
        this.pushStatus(`Remote user offline: ${uid} (${reason ?? 'unknown'})`);
        if (this.activeRemoteUid === uid) {
          this.activeRemoteUid = this.remoteUserUids.values().next().value ?? null;
        }
        this.removeRemoteUserPage(uid);
        this.refreshSummary();
      });
      this.client.on('leaveChannel', ({ duration }) => {
        this.pushStatus(`Leave channel callback: duration ${duration}`);
      });
      this.client.on('rejoinChannelSuccess', ({ channelId, uid, elapsed }) => {
        this.pushStatus(`Rejoined channel: ${channelId} (${uid}) in ${elapsed}ms`);
      });
      this.client.on('connectionInterrupted', () => {
        this.pushStatus('Connection interrupted');
      });
      this.client.on('connectionStateChanged', ({ state, reason }) => {
        this.pushStatus(`Connection state changed: ${state}/${reason}`);
      });
      this.client.on('remoteVideoStateChanged', ({ uid, state, reason, elapsed }) => {
        this.pushStatus(`Remote video state: uid ${uid} ${state}/${reason} (${elapsed}ms)`);
      });
      this.client.on('localVideoStateChanged', ({ sourceType, state, error }) => {
        this.pushStatus(`Local video state: source ${sourceType} ${state}/${error}`);
      });
      this.client.on('firstLocalAudioFramePublished', ({ elapsed }) => {
        this.pushStatus(`First local audio published in ${elapsed}ms`);
      });
      this.client.on('audioMixingFinished', () => {
        this.pushStatus('Audio mixing finished');
      });
      this.client.on('audioMixingStateChanged', ({ state, reason }) => {
        this.pushStatus(`Audio mixing state: ${state}/${reason}`);
      });
      this.client.on('volumeIndication', ({ speakers, totalVolume }) => {
        this.lastVolumeSummary = `${totalVolume}/${speakers.length}`;
        this.pushStatus(`Volume indication: ${totalVolume} (${speakers.length} speakers)`);
      });
      this.client.on('rtcStats', ({ duration, users }) => {
        this.lastRtcStatsSummary = `${duration}s/${users ?? 0}u`;
        this.pushStatus(`RTC stats: duration ${duration}s users ${users ?? 0}`);
      });
      this.client.on('contentInspectResult', ({ result }) => {
        this.pushStatus(`Content inspect result: ${result}`);
      });
      this.client.on('localVideoTextureReady', (payload) => {
        if (!this.localTextureReadySeen) {
          this.localTextureReadySeen = true;
          this.pushStatus(`Local texture ready: ${payload.width}x${payload.height}`);
        }
        console.log('[agora-rtc] local texture ready', payload.slotId, payload.width, payload.height);
        const bind = () => this.bindNativeTextureSprite('local', payload.slotId);
        if (sys.os === sys.OS.IOS) {
          this.scheduleOnce(bind, 0.2);
        } else {
          bind();
        }
      });
      this.client.on('remoteVideoTextureReady', (payload) => {
        this.activeRemoteUid = payload.uid;
        this.refreshVideoHints();
        if (!this.remoteTextureReadySeen) {
          this.remoteTextureReadySeen = true;
          this.pushStatus(`Remote texture ready: ${payload.width}x${payload.height}`);
        }
        console.log('[agora-rtc] remote texture ready', payload.slotId, payload.uid, payload.width, payload.height);
        const bind = () => {
          this.bindNativeTextureSprite('remote', payload.slotId, payload.uid);
          this.syncEngineTextureSpriteNodes();
        };
        if (sys.os === sys.OS.IOS) {
          this.scheduleOnce(bind, 0);
        } else {
          bind();
        }
        this.scheduleOnce(() => {
          this.layoutConsole();
          void this.refreshRemoteVideoSurface(payload.uid);
        }, 0);
      });
      this.client.on('localVideoTextureReleased', ({ slotId }) => {
        this.clearNativeTextureSprite('local', slotId);
      });
      this.client.on('remoteVideoTextureReleased', ({ uid, slotId }) => {
        this.clearNativeTextureSprite('remote', slotId);
      });
      this.client.on('renderBackendState', (payload) => {
        if (payload.phase === 'fallback' && typeof (payload as { fallbackBackend?: unknown }).fallbackBackend === 'string') {
          this.applyEffectiveRenderBackend((payload as { fallbackBackend: 'surface-view' | 'texture-view' | 'engine-texture' }).fallbackBackend);
        }
        this.pushStatus(`Backend[${payload.backend}] ${payload.phase}: ${payload.result}`);
      });
      this.client.on('error', ({ message }) => {
        console.error('[agora-rtc] native error', message);
        this.lastErrorMessage = message;
        this.pushStatus(`Native error: ${message}`);
      });
      this.listenersBound = true;
    }

    return this.client;
  }

  private async loadRuntimeConfig(): Promise<void> {
    if (this.appId.trim() && this.channelId.trim()) {
      return;
    }

    const config = await new Promise<AgoraRuntimeConfig | null>((resolve) => {
      resources.load('agora-config', JsonAsset, (error, asset) => {
        if (error) {
          resolve(null);
          return;
        }

        resolve((asset?.json ?? null) as AgoraRuntimeConfig | null);
      });
    });

    if (!config) {
      this.pushStatus('Config file not found: assets/resources/agora-config.json');
      return;
    }

    this.appId = config.appId?.trim() || this.appId;
    this.token = typeof config.token === 'string' ? config.token : this.token;
    this.channelId = config.channelId?.trim() || this.channelId;
    this.uid = typeof config.uid === 'number' ? config.uid : this.uid;
    this.renderBackend =
      config.renderBackend === 'texture-view' || config.renderBackend === 'engine-texture'
        ? config.renderBackend
        : 'surface-view';
    this.pushStatus(`Loaded config for channel: ${this.channelId}`);
    this.layoutConsole();
  }

  private cleanupSceneEmbeddedHud() {
    const destroyNames = new Set([
      TITLE_NODE_NAME,
      CONFIG_NODE_NAME,
      STATUS_NODE_NAME,
      STATUS_SCROLL_NODE_NAME,
      STATUS_CONTENT_NODE_NAME,
      SUMMARY_NODE_NAME,
      ...DEFAULT_BUTTON_LAYOUT.map((item) => `__simple_${item.name}`),
    ]);
    for (const child of [...this.node.children]) {
      if (destroyNames.has(child.name) || child.name.startsWith('__simple_')) {
        child.destroy();
      }
    }
  }

  private ensureUi() {
    this.cleanupSceneEmbeddedHud();
    const hasQaShell =
      this.getLeftPane()
      && this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME);
    if (!hasQaShell) {
      this.cleanupDynamicHudNodes();
    }
    this.ensureTitleLabel();
    this.ensureQaPanes();
    this.destroyConfigBarIfPresent();
    this.ensureLeftHeaderPane();
    this.ensureHeaderConfigSection();
    this.ensureSettingsPanel();
    this.ensureConfigLogButton();
    this.ensureLogFloatButton();
    this.bindLogUiGlobalTouchFallback();
    this.ensureVideoCards();
    this.ensureVideoHints();
    this.ensureVideoTitles();
    this.ensureVideoSprites();
    this.ensureButtonPanel();

    this.layoutConsole();
    this.refreshButtonLabels();
    this.refreshLogPageContent();
  }

  private cleanupDynamicHudNodes() {
    for (const child of [...this.node.children]) {
      if (
        child.name.startsWith('__qa_')
        || child.name.startsWith('__video_')
        || child.name === TITLE_NODE_NAME
        || child.name === LOG_PAGE_NODE_NAME
        || child.name === QA_UI_OVERLAY_NODE_NAME
      ) {
        child.destroy();
      }
    }
    this.node.getChildByName(QA_UI_OVERLAY_NODE_NAME)?.destroy();

    this.actionButtons.clear();
    this.buttonNodes.clear();
    this.statusScrollView = null;
    this.headerScrollView = null;
    this.buttonScrollView = null;
    this.logPageScrollView = null;
    this.statusContentNode = null;
    this.logPageNode = null;
    this.logPageBodyLabel = null;
    this.logFloatButtonNode = null;
    this.logPageVisible = false;
    this.logPageBuilt = false;
    this.logConfigButtonNode = null;
    this.statusLabel = null;
    this.summaryLabel = null;
    this.configLabel = null;
    this.settingsPanel = null;
    this.channelInput = null;
    this.uidInput = null;
    this.settingsValueLabels.clear();
  }

  private ensureQaPanes() {
    let leftPane = this.node.getChildByName(QA_LEFT_PANE_NODE_NAME);
    if (!leftPane) {
      leftPane = new Node(QA_LEFT_PANE_NODE_NAME);
      leftPane.setParent(this.node);
    }
    leftPane.layer = this.node.layer;
    leftPane.active = true;
    const leftTransform = leftPane.getComponent(UITransform) ?? leftPane.addComponent(UITransform);
    leftTransform.setContentSize(560, 420);
    leftPane.getComponent(Layout)?.destroy();

    let rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME);
    if (!rightPane) {
      rightPane = new Node(QA_RIGHT_PANE_NODE_NAME);
      rightPane.setParent(this.node);
    }
    rightPane.layer = this.node.layer;
    rightPane.active = true;
    const rightTransform = rightPane.getComponent(UITransform) ?? rightPane.addComponent(UITransform);
    rightTransform.setContentSize(420, 260);
  }

  private getLeftPane(): Node | null {
    return this.node.getChildByName(QA_LEFT_PANE_NODE_NAME);
  }

  private getHeaderScrollNode(): Node | null {
    return this.getLeftPane()?.getChildByName(HEADER_SCROLL_NODE_NAME) ?? null;
  }

  private getHeaderViewport(): Node | null {
    return this.getHeaderScrollNode()?.getChildByName(SCROLL_VIEWPORT_NODE_NAME) ?? null;
  }

  private getHeaderContentNode(): Node {
    const viewport = this.getHeaderViewport();
    let headerPane = viewport?.getChildByName(QA_LEFT_HEADER_NODE_NAME) ?? null;
    if (!headerPane && viewport) {
      headerPane = new Node(QA_LEFT_HEADER_NODE_NAME);
      headerPane.setParent(viewport);
    }
    return headerPane ?? this.node;
  }

  private ensurePanelBorder(panelNode: Node, width: number, height: number) {
    let bgNode = panelNode.getChildByName(PANEL_BG_NODE_NAME);
    if (!bgNode) {
      bgNode = new Node(PANEL_BG_NODE_NAME);
      bgNode.setParent(panelNode);
    }
    bgNode.layer = this.node.layer;
    bgNode.active = true;
    bgNode.setSiblingIndex(0);
    bgNode.setPosition(0, 0, 0);
    const bgTransform = bgNode.getComponent(UITransform) ?? bgNode.addComponent(UITransform);
    bgTransform.setContentSize(width, height);
    const graphics = bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics);
    this.drawSectionCard(graphics, width, height, 'panel');
    panelNode.getComponent(Graphics)?.destroy();
  }

  private ensureScrollViewport(
    panelNode: Node,
    width: number,
    height: number,
    options?: { panelHeight?: number; offsetY?: number; clipInset?: number },
  ): { viewport: Node; content: Node; scrollView: ScrollView } {
    const clipInset = options?.clipInset ?? SCROLL_CLIP_INSET;
    const panelHeight = options?.panelHeight ?? height;
    panelNode.getComponent(UITransform)?.setContentSize(width, panelHeight);
    this.ensurePanelBorder(panelNode, width, panelHeight);

    let viewport = panelNode.getChildByName(SCROLL_VIEWPORT_NODE_NAME);
    if (!viewport) {
      viewport = new Node(SCROLL_VIEWPORT_NODE_NAME);
      viewport.setParent(panelNode);
    }
    viewport.layer = this.node.layer;
    viewport.active = true;
    viewport.setSiblingIndex(2);
    const viewportWidth = Math.max(40, width - clipInset * 2);
    const viewportHeight = Math.max(40, height - clipInset * 2);
    const viewportTransform = viewport.getComponent(UITransform) ?? viewport.addComponent(UITransform);
    viewportTransform.setContentSize(viewportWidth, viewportHeight);
    viewport.setPosition(0, options?.offsetY ?? 0, 0);

    const mask = viewport.getComponent(Mask) ?? viewport.addComponent(Mask);
    mask.type = Mask.Type.RECT;
    mask.inverted = false;

    const scrollView = viewport.getComponent(ScrollView) ?? viewport.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.elastic = false;

    return { viewport, content: viewport, scrollView };
  }

  private ensureSessionQuickBar(panelNode: Node, width: number) {
    let quickBar = panelNode.getChildByName(SESSION_QUICK_BAR_NODE_NAME);
    if (!quickBar) {
      quickBar = new Node(SESSION_QUICK_BAR_NODE_NAME);
      quickBar.setParent(panelNode);
    }
    quickBar.layer = this.node.layer;
    quickBar.active = true;
    quickBar.setSiblingIndex(1);
    const barHeight = SESSION_QUICK_BAR_HEIGHT;
    const barTransform = quickBar.getComponent(UITransform) ?? quickBar.addComponent(UITransform);
    barTransform.setContentSize(Math.max(120, width - 16), barHeight);

    const rowLayout = quickBar.getComponent(Layout) ?? quickBar.addComponent(Layout);
    rowLayout.type = Layout.Type.HORIZONTAL;
    rowLayout.resizeMode = Layout.ResizeMode.CONTAINER;
    rowLayout.spacingX = 10;
    rowLayout.paddingLeft = 8;
    rowLayout.paddingRight = 8;

    const buttonWidth = Math.floor((width - 20 - 20) / SESSION_QUICK_BUTTONS.length);
    SESSION_QUICK_BUTTONS.forEach((buttonName) => {
      const buttonSpec = DEFAULT_BUTTON_LAYOUT.find((item) => item.name === buttonName);
      if (!buttonSpec) {
        return;
      }
      const buttonNodeName = `__simple_${buttonSpec.name}`;
      let buttonNode = quickBar.getChildByName(buttonNodeName);
      if (!buttonNode) {
        buttonNode = new Node(buttonNodeName);
        buttonNode.setParent(quickBar);
      }
      buttonNode.layer = this.node.layer;
      buttonNode.active = true;
      this.configureActionButton(buttonNode, buttonSpec.name, buttonWidth, SESSION_QUICK_BUTTON_HEIGHT);
      this.bindAppButtonClick(buttonNode, () => {
        const handler = this[buttonSpec.handler];
        if (typeof handler === 'function') {
          void handler.call(this).catch((error: unknown) => {
            console.error('[agora-rtc] action failed', error);
            this.pushStatus(`Action failed: ${String(error)}`);
          });
        }
      });
    });
    rowLayout.updateLayout(true);
  }

  private getScrollViewport(panelNode: Node | null): Node | null {
    return panelNode?.getChildByName(SCROLL_VIEWPORT_NODE_NAME) ?? null;
  }

  private attachScrollContent(
    viewport: Node,
    scrollView: ScrollView,
    contentNode: Node,
    contentWidth: number,
    contentHeight: number,
  ) {
    contentNode.setParent(viewport);
    contentNode.layer = this.node.layer;
    contentNode.active = true;
    const contentTransform = contentNode.getComponent(UITransform) ?? contentNode.addComponent(UITransform);
    contentTransform.setAnchorPoint(0.5, 1);
    contentTransform.setContentSize(contentWidth, contentHeight);
    const viewportHeight = viewport.getComponent(UITransform)?.contentSize.height ?? contentHeight;
    contentNode.setPosition(0, viewportHeight / 2, 0);
    scrollView.content = contentNode;
  }

  private destroyConfigBarIfPresent() {
    const leftPane = this.getLeftPane();
    const legacyBar = leftPane?.getChildByName('__example_config_bar');
    if (legacyBar) {
      legacyBar.destroy();
    }
  }

  private ensureLeftHeaderPane() {
    const leftPane = this.getLeftPane() ?? this.node;
    let headerScroll = leftPane.getChildByName(HEADER_SCROLL_NODE_NAME);
    if (!headerScroll) {
      headerScroll = new Node(HEADER_SCROLL_NODE_NAME);
      headerScroll.setParent(leftPane);
    }
    headerScroll.layer = this.node.layer;
    headerScroll.active = true;
    headerScroll.getComponent(ScrollView)?.destroy();

    const { viewport, scrollView } = this.ensureScrollViewport(headerScroll, 560, 148, {
      clipInset: HEADER_SCROLL_CLIP_INSET,
    });
    this.headerScrollView = scrollView;

    let headerPane = viewport.getChildByName(QA_LEFT_HEADER_NODE_NAME);
    if (!headerPane) {
      headerPane = new Node(QA_LEFT_HEADER_NODE_NAME);
    }
    this.attachScrollContent(viewport, scrollView, headerPane, 540, 260);

    const layout = headerPane.getComponent(Layout) ?? headerPane.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;
    layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
    layout.spacingY = 6;
    layout.paddingTop = 8;
    layout.paddingBottom = 6;
    layout.paddingLeft = 6;
    layout.paddingRight = 6;
    layout.updateLayout(true);
  }

  private ensureHeaderConfigSection() {
    const headerPane = this.getHeaderContentNode();
    let configNode = headerPane.getChildByName(CONFIG_NODE_NAME);
    if (!configNode) {
      configNode = new Node(CONFIG_NODE_NAME);
      configNode.setParent(headerPane);
      configNode.setSiblingIndex(0);
    }
    configNode.layer = this.node.layer;
    configNode.active = true;
    const configTransform = configNode.getComponent(UITransform) ?? configNode.addComponent(UITransform);
    configTransform.setContentSize(520, 40);
    this.configLabel = configNode.getComponent(Label) ?? configNode.addComponent(Label);
    this.configLabel.fontSize = 15;
    this.configLabel.lineHeight = 18;
    this.configLabel.useSystemFont = true;
    this.configLabel.fontFamily = 'Arial';
    this.configLabel.color = new Color(214, 226, 240, 255);
    this.configLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.configLabel.verticalAlign = VerticalTextAlignment.TOP;
    this.configLabel.overflow = Label.Overflow.CLAMP;
    this.configLabel.enableWrapText = true;

    const inputsRow = this.ensureConfigInputsRow(headerPane);
    inputsRow.setSiblingIndex(1);
    inputsRow.layer = this.node.layer;
    inputsRow.active = true;
    this.getLeftPane()?.getChildByName('__example_config_inputs_strip')?.destroy();
    this.refreshConfigLabel();
  }

  private raiseConfigInputChrome(rowNode: Node) {
    const drawOrder = [
      '__channel_value',
      '__uid_value',
      '__channel_title',
      '__uid_title',
      '__channel_cycle',
    ];
    drawOrder.forEach((nodeName, index) => {
      const node = rowNode.getChildByName(nodeName);
      if (node) {
        node.setSiblingIndex(index);
      }
    });
  }

  private ensureVideoCards() {
    this.ensureRemotePageView();
    this.ensureVideoCardNode(LOCAL_CARD_NODE_NAME);
  }

  private ensureRemotePageView() {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME) ?? this.node;
    let cardNode = rightPane.getChildByName(REMOTE_CARD_NODE_NAME);
    if (!cardNode) {
      cardNode = new Node(REMOTE_CARD_NODE_NAME);
      cardNode.setParent(rightPane);

      let bgNode = new Node(VIDEO_CARD_BG_NODE_NAME);
      bgNode.setParent(cardNode);
      bgNode.setSiblingIndex(0);
      bgNode.layer = this.node.layer;

      const viewNode = new Node('view');
      viewNode.setParent(cardNode);
      viewNode.setSiblingIndex(1);
      viewNode.layer = this.node.layer;
      const mask = viewNode.addComponent(Mask);
      mask.type = Mask.Type.RECT;

      const contentNode = new Node('content');
      contentNode.setParent(viewNode);
      contentNode.layer = this.node.layer;
      const contentTransform = contentNode.addComponent(UITransform);
      contentTransform.setAnchorPoint(0, 0.5);

      const scrollView = cardNode.addComponent(ScrollView);
      scrollView.vertical = false;
      scrollView.horizontal = true;
      scrollView.content = contentNode;
      scrollView.bounceDuration = REMOTE_PAGE_SCROLL_DURATION;
      scrollView.inertia = true;
      scrollView.brake = 0.7;
      scrollView.elastic = true;

      cardNode.on(ScrollView.EventType.SCROLLING, this.onRemoteScrolling, this);
    }
    cardNode.layer = this.node.layer;
    cardNode.active = true;
    const transform = cardNode.getComponent(UITransform) ?? cardNode.addComponent(UITransform);
    transform.setContentSize(320, 180);
    cardNode.getComponent(Graphics)?.destroy();
    const bgNode = cardNode.getChildByName(VIDEO_CARD_BG_NODE_NAME)
      ?? (() => {
        const node = new Node(VIDEO_CARD_BG_NODE_NAME);
        node.setParent(cardNode);
        node.setSiblingIndex(0);
        return node;
      })();
    bgNode.layer = this.node.layer;
    bgNode.active = true;
    bgNode.setPosition(0, 0, 0);
    const bgGraphics = bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics);
    this.drawSectionCard(bgGraphics, transform.contentSize.width, transform.contentSize.height, 'video');

    const viewNode = cardNode.getChildByName('view');
    viewNode?.setSiblingIndex(1);
    viewNode?.getComponent(UITransform)?.setContentSize(transform.contentSize);
    viewNode?.setPosition(0, 0, 0);

    const contentNode = viewNode?.getChildByName('content');
    const contentTransform = contentNode?.getComponent(UITransform);
    contentTransform?.setAnchorPoint(0, 0.5);
    contentNode?.setPosition(-transform.contentSize.width / 2, 0, 0);
  }

  private onRemoteScrolling(scrollView: ScrollView) {
    if (this.remoteUserUids.size === 0) return;
    const uids = Array.from(this.remoteUserUids);
    const contentNode = scrollView.content;
    const viewNode = scrollView.node.getChildByName('view');
    const viewWidth = viewNode?.getComponent(UITransform)?.contentSize.width ?? 1;
    
    // offset is usually negative or zero
    const scrollOffset = contentNode ? Math.abs(contentNode.position.x) : 0;
    // Calculate index by dividing the absolute offset by the page width (viewWidth)
    let index = Math.round(scrollOffset / viewWidth);
    index = Math.max(0, Math.min(index, uids.length - 1));

    if (index >= 0 && index < uids.length) {
      const nextUid = uids[index];
      if (this.activeRemoteUid !== nextUid) {
        this.activeRemoteUid = nextUid;
        this.pushStatus(`Switched remote view to uid: ${this.activeRemoteUid}`);
        this.refreshSummary();
        this.refreshVideoHints();
        void this.refreshActiveRemoteVideoSurface();
      }
    }
  }

  private addRemoteUserPage(uid: number) {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME);
    const remoteCard = rightPane?.getChildByName(REMOTE_CARD_NODE_NAME);
    const contentNode = remoteCard?.getChildByName('view')?.getChildByName('content');
    if (!contentNode || !remoteCard) return;

    if (this.remoteVideoNodes.has(uid)) {
      this.scheduleOnce(() => {
        this.layoutConsole();
        void this.refreshRemoteVideoSurface(uid);
      }, 0);
      return;
    }

    const pageNode = new Node(`page_${uid}`);
    pageNode.layer = this.node.layer;

    const pageTransform = pageNode.addComponent(UITransform);
    const cardTransform = remoteCard.getComponent(UITransform);
    if (cardTransform) {
      pageTransform.setContentSize(cardTransform.contentSize);
    }

    const pageView = remoteCard.getComponent(PageView);
    if (pageView) {
      pageView.addPage(pageNode);
    } else {
      pageNode.setParent(contentNode);
    }

    const spriteNode = new Node(REMOTE_TEXTURE_NODE_NAME);
    spriteNode.setParent(pageNode);
    spriteNode.layer = this.node.layer;
    const spriteTransform = spriteNode.addComponent(UITransform);
    if (cardTransform) spriteTransform.setContentSize(cardTransform.contentSize);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.node.active = false;
    spriteNode.setSiblingIndex(20);
    this.remoteVideoSprites.set(uid, sprite);

    const titleNode = new Node(REMOTE_TITLE_NODE_NAME);
    titleNode.setParent(pageNode);
    titleNode.layer = this.node.layer;
    const titleTransform = titleNode.addComponent(UITransform);
    if (cardTransform) titleTransform.setContentSize(cardTransform.contentSize.width, 32);
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = `Remote: ${uid}`;
    titleLabel.fontSize = 18;
    titleLabel.lineHeight = 18;
    titleLabel.useSystemFont = true;
    titleLabel.fontFamily = 'Arial';
    titleLabel.color = new Color(220, 235, 255, 255);
    titleLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    titleLabel.verticalAlign = VerticalTextAlignment.CENTER;
    titleNode.setPosition(0, (cardTransform?.contentSize.height ?? 180) / 2 - 20, 0);

    const hintNode = new Node(REMOTE_HINT_NODE_NAME);
    hintNode.setParent(pageNode);
    hintNode.layer = this.node.layer;
    const hintTransform = hintNode.addComponent(UITransform);
    if (cardTransform) hintTransform.setContentSize(cardTransform.contentSize.width, 48);
    const hintLabel = hintNode.addComponent(Label);
    hintLabel.string = `uid ${uid}`;
    hintLabel.fontSize = 15;
    hintLabel.lineHeight = 18;
    hintLabel.useSystemFont = true;
    hintLabel.fontFamily = 'Arial';
    hintLabel.color = new Color(120, 220, 255, 255);
    hintLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    hintLabel.verticalAlign = VerticalTextAlignment.CENTER;
    this.remoteHintLabels.set(uid, hintLabel);

    this.remoteVideoNodes.set(uid, pageNode);
    
    // We defer the setup slightly so the node layout updates to the world rect correctly
    this.scheduleOnce(() => {
      this.layoutConsole();
      void this.refreshRemoteVideoSurface(uid);
    }, 0);
  }

  private removeRemoteUserPage(uid: number) {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME);
    const remoteCard = rightPane?.getChildByName(REMOTE_CARD_NODE_NAME);

    const pageNode = this.remoteVideoNodes.get(uid);
    if (pageNode) {
      const pageView = remoteCard?.getComponent(PageView);
      if (pageView) {
        pageView.removePage(pageNode);
      } else {
        pageNode.destroy();
      }
      this.remoteVideoNodes.delete(uid);
    }
    this.remoteVideoSprites.delete(uid);
    this.remoteVideoTextures.delete(uid);
    this.remoteVideoSpriteFrames.delete(uid);
    this.remoteHintLabels.delete(uid);
    this.remoteTextureSlotIds.delete(uid);
    
    if (this.client) {
        this.client.removeRemoteVideoView(uid).catch(() => {});
    }
    this.scheduleOnce(() => this.layoutConsole(), 0);
  }

  private ensureVideoCardNode(name: string): Node {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME) ?? this.node;
    let cardNode = rightPane.getChildByName(name);
    if (!cardNode) {
      cardNode = new Node(name);
      cardNode.setParent(rightPane);
      const bgNode = new Node(VIDEO_CARD_BG_NODE_NAME);
      bgNode.setParent(cardNode);
      bgNode.setSiblingIndex(0);
    }
    cardNode.layer = this.node.layer;
    cardNode.active = true;
    const transform = cardNode.getComponent(UITransform) ?? cardNode.addComponent(UITransform);
    transform.setContentSize(320, 180);
    cardNode.getComponent(Graphics)?.destroy();
    const bgNode = cardNode.getChildByName(VIDEO_CARD_BG_NODE_NAME)
      ?? (() => {
        const node = new Node(VIDEO_CARD_BG_NODE_NAME);
        node.setParent(cardNode);
        node.setSiblingIndex(0);
        return node;
      })();
    bgNode.layer = this.node.layer;
    bgNode.active = true;
    bgNode.setPosition(0, 0, 0);
    const bgGraphics = bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics);
    this.drawSectionCard(bgGraphics, transform.contentSize.width, transform.contentSize.height, 'video');
    return cardNode;
  }

  private drawSectionCard(graphics: Graphics, width: number, height: number, variant: 'panel' | 'video') {
    graphics.clear();
    graphics.fillColor = variant === 'video'
      ? new Color(10, 16, 24, 255)
      : new Color(8, 20, 32, 255);
    graphics.strokeColor = variant === 'video'
      ? new Color(62, 96, 128, 255)
      : new Color(42, 76, 102, 255);
    graphics.lineWidth = 2;
    graphics.roundRect(-width / 2, -height / 2, width, height, 14);
    graphics.fill();
    graphics.roundRect(-width / 2, -height / 2, width, height, 14);
    graphics.stroke();
  }

  private getAppButtonTheme(variant: AppButtonVariant) {
    switch (variant) {
      case 'primary':
        return {
          fill: new Color(32, 118, 210, 255),
          stroke: new Color(56, 148, 238, 255),
          text: new Color(255, 255, 255, 255),
        };
      case 'danger':
        return {
          fill: new Color(178, 56, 56, 255),
          stroke: new Color(210, 82, 82, 255),
          text: new Color(255, 248, 248, 255),
        };
      case 'toggleOn':
        return {
          fill: new Color(28, 108, 88, 255),
          stroke: new Color(48, 142, 118, 255),
          text: new Color(224, 255, 240, 255),
        };
      case 'chip':
        return {
          fill: new Color(28, 58, 88, 255),
          stroke: new Color(72, 128, 188, 255),
          text: new Color(196, 228, 255, 255),
        };
      case 'settingsPill':
        return {
          fill: new Color(22, 38, 56, 255),
          stroke: new Color(58, 92, 128, 255),
          text: new Color(220, 236, 252, 255),
        };
      case 'toggleOff':
      case 'ghost':
        return {
          fill: new Color(24, 34, 48, 255),
          stroke: new Color(52, 72, 96, 255),
          text: new Color(210, 222, 236, 255),
        };
      case 'secondary':
      default:
        return {
          fill: new Color(30, 44, 62, 255),
          stroke: new Color(58, 88, 118, 255),
          text: new Color(232, 240, 250, 255),
        };
    }
  }

  private getAppButtonLabel(buttonNode: Node): Label {
    let labelNode = buttonNode.getChildByName(BUTTON_LABEL_NODE_NAME);
    if (!labelNode) {
      const legacyLabel = buttonNode.getComponent(Label);
      if (legacyLabel) {
        labelNode = new Node(BUTTON_LABEL_NODE_NAME);
        labelNode.setParent(buttonNode);
        const text = legacyLabel.string;
        const fontSize = legacyLabel.fontSize;
        const color = legacyLabel.color.clone();
        buttonNode.removeComponent(Label);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
      } else {
        labelNode = new Node(BUTTON_LABEL_NODE_NAME);
        labelNode.setParent(buttonNode);
        const label = labelNode.addComponent(Label);
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.fontSize = 15;
        label.lineHeight = 18;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
      }
    }
    const transform = labelNode.getComponent(UITransform) ?? labelNode.addComponent(UITransform);
    const parentTransform = buttonNode.getComponent(UITransform);
    if (parentTransform) {
      transform.setContentSize(
        Math.max(20, parentTransform.contentSize.width - 12),
        Math.max(18, parentTransform.contentSize.height - 8),
      );
    }
    return labelNode.getComponent(Label)!;
  }

  private applyAppButtonChrome(buttonNode: Node, width: number, height: number, variant: AppButtonVariant) {
    const theme = this.getAppButtonTheme(variant);
    let bgNode = buttonNode.getChildByName(BUTTON_BG_NODE_NAME);
    if (!bgNode) {
      bgNode = new Node(BUTTON_BG_NODE_NAME);
      bgNode.setParent(buttonNode);
      bgNode.setSiblingIndex(0);
    }
    bgNode.layer = buttonNode.layer;
    bgNode.active = true;
    bgNode.setPosition(0, 0, 0);
    const bgTransform = bgNode.getComponent(UITransform) ?? bgNode.addComponent(UITransform);
    bgTransform.setContentSize(width, height);
    const graphics = bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics);
    graphics.clear();
    graphics.fillColor = theme.fill;
    graphics.strokeColor = theme.stroke;
    graphics.lineWidth = variant === 'settingsPill' ? 1 : 1.5;
    const radius = Math.min(12, Math.floor(height / 2));
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.fill();
    graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    graphics.stroke();

    const label = this.getAppButtonLabel(buttonNode);
    label.color = theme.text;
    label.fontSize = variant === 'chip' || variant === 'settingsPill' ? 13 : 15;
    label.lineHeight = label.fontSize + 3;

    const button = buttonNode.getComponent(Button) ?? buttonNode.addComponent(Button);
    button.transition = Button.Transition.NONE;
    button.interactable = true;
  }

  private logUi(step: string, detail?: string | Record<string, unknown>) {
    const payload = typeof detail === 'string' ? detail : JSON.stringify(detail ?? {});
    console.log(`[agora-rtc][log-ui] ${step} ${payload}`);
  }

  private setLogUiHud(text: string) {
    this.logUiHudLine = text;
    this.refreshConfigLabel();
  }

  private touchPointsFromEvent(event: EventTouch): Vec2[] {
    const ui = event.getUILocation();
    const loc = event.getLocation();
    const viewLoc = event.getLocationInView();
    return [
      new Vec2(ui.x, ui.y),
      new Vec2(loc.x, loc.y),
      new Vec2(viewLoc.x, viewLoc.y),
    ];
  }

  private pointInNodeWorldBox(node: Node | null, worldPoint: Vec2, pad = 0): boolean {
    const transform = node?.getComponent(UITransform);
    if (!node?.active || !transform) {
      return false;
    }
    const rect = transform.getBoundingBoxToWorld();
    return (
      worldPoint.x >= rect.x - pad
      && worldPoint.x <= rect.x + rect.width + pad
      && worldPoint.y >= rect.y - pad
      && worldPoint.y <= rect.y + rect.height + pad
    );
  }

  private pointInFloatButton(worldPoint: Vec2): boolean {
    const pad = 24;
    if (this.logFloatWorldRect) {
      const r = this.logFloatWorldRect;
      return (
        worldPoint.x >= r.x - pad
        && worldPoint.x <= r.x + r.w + pad
        && worldPoint.y >= r.y - pad
        && worldPoint.y <= r.y + r.h + pad
      );
    }
    return this.pointInNodeWorldBox(this.logFloatButtonNode, worldPoint, pad);
  }

  private nodeHitByTouch(node: Node | null, event: EventTouch, pad = 12): boolean {
    const points = this.touchPointsFromEvent(event);
    for (const point of points) {
      if (this.pointInNodeWorldBox(node, point, pad)) {
        return true;
      }
      if (this.hitUiNode(node, point, event.windowId ?? 0)) {
        return true;
      }
    }
    return false;
  }

  private bindLogUiGlobalTouchFallback() {
    if (this.logUiGlobalTouchBound) {
      return;
    }
    this.logUiGlobalTouchBound = true;
    input.off(Input.EventType.TOUCH_END, this.onLogUiGlobalTouchEnd, this);
    input.on(Input.EventType.TOUCH_END, this.onLogUiGlobalTouchEnd, this);
    this.logUi('global-touch-bound', { ok: true });
  }

  private onLogUiGlobalTouchEnd(event: EventTouch) {
    const points = this.touchPointsFromEvent(event);
    const p0 = points[0];
    const hitFloat = points.some((point) => this.pointInFloatButton(point));
    const hitConfigLog = this.nodeHitByTouch(this.logConfigButtonNode, event, 20);
    if (hitFloat) {
      this.requestOpenLogPage('float-touch');
    } else if (hitConfigLog) {
      this.requestOpenLogPage('config-touch');
    }
    const pageOpen = this.logPageVisible && (this.logPageNode?.active ?? false);
    this.setLogUiHud(
      `触摸(${Math.round(p0.x)},${Math.round(p0.y)}) 浮:${hitFloat ? 'Y' : 'n'} 配:${hitConfigLog ? 'Y' : 'n'} 页:${pageOpen ? '开' : '关'}`,
    );
    this.logUi('touch-end', {
      ui: { x: Math.round(p0.x), y: Math.round(p0.y) },
      hitFloat,
      hitConfigLog,
      logPageVisible: this.logPageVisible,
      pageActive: this.logPageNode?.active ?? false,
      floatRect: this.logFloatWorldRect,
    });
  }

  /** 只打开、不切换，避免同一次点击被 Button + 全局触摸连触成「开→关」 */
  private requestOpenLogPage(source: string) {
    if (this.logPageVisible && this.logPageNode?.active) {
      return;
    }
    const now = Date.now();
    if (now - this.lastLogUiOpenMs < 250) {
      this.logUi('open-debounced', { source });
      return;
    }
    this.lastLogUiOpenMs = now;
    this.logUi('open-request', { source });
    this.setLogUiHud(`UI: 正在打开… (${source})`);
    try {
      this.openStatusLogPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logUi('open-error', { source, message });
      this.setLogUiHud(`UI: 打开失败 ${message}`);
    }
  }

  /** overlay 根节点 ignoreUiHitTest 会导致子按钮收不到触摸，必须在按钮节点上直接监听 */
  private wireLogOpenOnTouchEnd(buttonNode: Node, source: string) {
    const open = () => {
      this.logUi('log-touch-end', { source });
      this.requestOpenLogPage(source);
    };
    const bindNode = (node: Node) => {
      node.off(Node.EventType.TOUCH_END);
      node.on(Node.EventType.TOUCH_END, open, this);
    };
    bindNode(buttonNode);
    buttonNode.children.forEach(bindNode);
  }

  private hitUiNode(node: Node | null, screenPoint: Vec2, windowId = 0): boolean {
    if (!node?.active) {
      return false;
    }
    const transform = node.getComponent(UITransform);
    return transform?.hitTest(screenPoint, windowId) ?? false;
  }

  private resetLogPageConstruction() {
    this.logPageBuilt = false;
    this.logPageScrollView = null;
    this.logPageBodyLabel = null;
    this.logBodyViewportNode = null;
    this.logBodyScrollOffset = 0;
    this.logBodyMaxScroll = 0;
    this.logBodyContentHeight = 0;
    this.logBodyPendingScrollToBottom = false;
    this.logBodyUserHasScrolled = false;
    this.logPageNode?.destroy();
    this.logPageNode = null;
    this.node.getChildByName(QA_UI_OVERLAY_NODE_NAME)?.getChildByName(LOG_PAGE_NODE_NAME)?.destroy();
    this.node.getChildByName(LOG_PAGE_NODE_NAME)?.destroy();
  }

  private bindLogConfigButtonClick(buttonNode: Node) {
    const transform = buttonNode.getComponent(UITransform) ?? buttonNode.addComponent(UITransform);
    if (transform.contentSize.width < 8 || transform.contentSize.height < 8) {
      transform.setContentSize(88, 32);
    }
    buttonNode.getComponent(BlockInputEvents) ?? buttonNode.addComponent(BlockInputEvents);
    const button = buttonNode.getComponent(Button) ?? buttonNode.addComponent(Button);
    button.interactable = true;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    buttonNode.children.forEach((child) => {
      this.ignoreUiHitTest(child);
    });
    const onClick = () => {
      if (this.logPageVisible && this.logPageNode?.active) {
        this.closeStatusLogPage();
        return;
      }
      this.requestOpenLogPage('config-btn');
    };
    buttonNode.off(Button.EventType.CLICK);
    buttonNode.on(Button.EventType.CLICK, onClick);
    this.wireLogOpenOnTouchEnd(buttonNode, 'config-btn-touch');
  }

  private bindLogEntryButtonClick(buttonNode: Node, source: string) {
    const transform = buttonNode.getComponent(UITransform) ?? buttonNode.addComponent(UITransform);
    if (transform.contentSize.width < 8 || transform.contentSize.height < 8) {
      transform.setContentSize(88, 32);
    }
    buttonNode.getComponent(BlockInputEvents) ?? buttonNode.addComponent(BlockInputEvents);
    const button = buttonNode.getComponent(Button) ?? buttonNode.addComponent(Button);
    button.interactable = true;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    buttonNode.children.forEach((child) => {
      this.ignoreUiHitTest(child);
    });
    const open = () => {
      this.logUi('log-entry-click', { source });
      this.requestOpenLogPage(source);
    };
    buttonNode.off(Button.EventType.CLICK);
    buttonNode.on(Button.EventType.CLICK, open);
    this.wireLogOpenOnTouchEnd(buttonNode, `${source}-touch`);
  }

  private ignoreUiHitTest(node: Node) {
    const transform = node.getComponent(UITransform);
    if (transform) {
      transform.hitTest = () => false;
    }
  }

  private bindAppButtonClick(buttonNode: Node, handler: () => void) {
    const transform = buttonNode.getComponent(UITransform) ?? buttonNode.addComponent(UITransform);
    if (transform.contentSize.width < 8 || transform.contentSize.height < 8) {
      transform.setContentSize(88, 32);
    }
    buttonNode.getComponent(BlockInputEvents) ?? buttonNode.addComponent(BlockInputEvents);
    const button = buttonNode.getComponent(Button) ?? buttonNode.addComponent(Button);
    button.interactable = true;
    button.transition = Button.Transition.SCALE;
    button.zoomScale = 0.96;
    buttonNode.children.forEach((child) => {
      this.ignoreUiHitTest(child);
    });
    const trigger = () => {
      handler();
    };
    buttonNode.off(Button.EventType.CLICK);
    buttonNode.on(Button.EventType.CLICK, trigger);
    this.bindNodeTap(buttonNode, trigger);
    buttonNode.children.forEach((child) => {
      child.getComponent(BlockInputEvents) ?? child.addComponent(BlockInputEvents);
      this.bindNodeTap(child, trigger);
    });
  }

  private ensureUiOverlayRoot(): Node {
    let overlay = this.node.getChildByName(QA_UI_OVERLAY_NODE_NAME);
    if (!overlay) {
      overlay = new Node(QA_UI_OVERLAY_NODE_NAME);
      overlay.setParent(this.node);
    }
    overlay.layer = this.node.layer;
    overlay.active = true;
    const visibleSize = view.getVisibleSize();
    const transform = overlay.getComponent(UITransform) ?? overlay.addComponent(UITransform);
    transform.setAnchorPoint(0.5, 0.5);
    transform.setContentSize(visibleSize.width, visibleSize.height);
    overlay.setPosition(0, 0, 0);
    overlay.setSiblingIndex(this.node.children.length - 1);
    return overlay;
  }

  private raiseUiOverlay(focus: 'log-button' | 'log-page') {
    const overlay = this.ensureUiOverlayRoot();
    overlay.setSiblingIndex(this.node.children.length - 1);
    if (focus === 'log-page' && this.logPageNode?.isValid) {
      this.logPageNode.setSiblingIndex(overlay.children.length - 1);
      return;
    }
    if (this.logFloatButtonNode?.isValid) {
      this.logFloatButtonNode.setSiblingIndex(overlay.children.length - 1);
    }
  }

  private bindNodeTap(node: Node, handler: () => void) {
    let pressed = false;
    node.off(Node.EventType.TOUCH_START);
    node.off(Node.EventType.TOUCH_END);
    node.off(Node.EventType.TOUCH_CANCEL);
    node.on(Node.EventType.TOUCH_START, () => {
      pressed = true;
    });
    node.on(Node.EventType.TOUCH_END, () => {
      if (pressed) {
        handler();
      }
      pressed = false;
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => {
      pressed = false;
    });
  }

  private resolveActionButtonVariant(name: string): AppButtonVariant {
    if (name === 'Initialize' || name === 'Join') {
      return 'primary';
    }
    if (name === 'Leave') {
      return 'danger';
    }
    return 'secondary';
  }

  private resolveToggleButtonVariant(name: string, enabled: boolean): AppButtonVariant {
    return enabled ? 'toggleOn' : 'toggleOff';
  }

  private configureActionButton(
    buttonNode: Node,
    actionName: string,
    width: number,
    height: number,
    variant?: AppButtonVariant,
  ) {
    const transform = buttonNode.getComponent(UITransform) ?? buttonNode.addComponent(UITransform);
    transform.setContentSize(width, height);
    const displayName = ACTION_LABEL_ZH[actionName] ?? actionName;
    const v = variant ?? this.resolveActionButtonVariant(actionName);
    this.applyAppButtonChrome(buttonNode, width, height, v);
    const label = this.getAppButtonLabel(buttonNode);
    label.string = displayName;
    this.actionButtons.set(actionName, label);
    this.buttonNodes.set(actionName, buttonNode);
    if (!this.actionResults.has(actionName)) {
      this.actionResults.set(actionName, 'idle');
    }
  }

  private styleConfigActionButton(buttonNode: Node, width: number, height: number, text: string, variant: AppButtonVariant) {
    const transform = buttonNode.getComponent(UITransform) ?? buttonNode.addComponent(UITransform);
    transform.setContentSize(width, height);
    this.applyAppButtonChrome(buttonNode, width, height, variant);
    const label = this.getAppButtonLabel(buttonNode);
    label.string = text;
  }

  private ensureButtonPanel() {
    const leftPane = this.node.getChildByName(QA_LEFT_PANE_NODE_NAME) ?? this.node;
    let buttonPanel = leftPane.getChildByName(BUTTON_PANEL_NODE_NAME);
    if (!buttonPanel) {
      buttonPanel = new Node(BUTTON_PANEL_NODE_NAME);
      buttonPanel.setParent(leftPane);
    }
    buttonPanel.layer = this.node.layer;
    buttonPanel.active = true;

    const panelTransform = buttonPanel.getComponent(UITransform) ?? buttonPanel.addComponent(UITransform);
    panelTransform.setContentSize(1000, 320);
    this.ensurePanelBorder(buttonPanel, panelTransform.contentSize.width, panelTransform.contentSize.height);
    buttonPanel.getComponent(ScrollView)?.destroy();
    buttonPanel.getComponent(Layout)?.destroy();

    this.ensureSessionQuickBar(buttonPanel, panelTransform.contentSize.width);

    const panelHeight = panelTransform.contentSize.height;
    const scrollAreaHeight = Math.max(80, panelHeight - SESSION_QUICK_BAR_HEIGHT - 10);
    const { viewport, scrollView } = this.ensureScrollViewport(
      buttonPanel,
      panelTransform.contentSize.width,
      scrollAreaHeight,
      { panelHeight },
    );
    this.layoutButtonPanelInternals(buttonPanel, panelTransform.contentSize.width, panelHeight);
    this.buttonScrollView = scrollView;

    let buttonGrid = viewport.getChildByName(BUTTON_GRID_NODE_NAME);
    if (!buttonGrid) {
      buttonGrid = new Node(BUTTON_GRID_NODE_NAME);
    }
    buttonGrid.layer = this.node.layer;
    buttonGrid.active = true;
    const gridTransform = buttonGrid.getComponent(UITransform) ?? buttonGrid.addComponent(UITransform);
    gridTransform.setContentSize(1000, 280);
    this.attachScrollContent(viewport, scrollView, buttonGrid, 1000, 280);

    const layout = buttonGrid.getComponent(Layout) ?? buttonGrid.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;
    layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
    layout.spacingY = 10;
    layout.paddingTop = 6;
    layout.paddingBottom = 6;
    layout.paddingLeft = 8;
    layout.paddingRight = 8;
    layout.enabled = true;

    BUTTON_SECTION_LAYOUT.forEach((section) => {
      let sectionNode = buttonGrid!.getChildByName(`${BUTTON_SECTION_PREFIX}${section.title}`);
      if (!sectionNode) {
        sectionNode = new Node(`${BUTTON_SECTION_PREFIX}${section.title}`);
        sectionNode.setParent(buttonGrid);
      }
      sectionNode.layer = this.node.layer;
      sectionNode.active = true;
      const sectionTransform = sectionNode.getComponent(UITransform) ?? sectionNode.addComponent(UITransform);
      sectionTransform.setContentSize(320, 36);
      const sectionLayout = sectionNode.getComponent(Layout) ?? sectionNode.addComponent(Layout);
      sectionLayout.type = Layout.Type.VERTICAL;
      sectionLayout.resizeMode = Layout.ResizeMode.CONTAINER;
      sectionLayout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
      sectionLayout.spacingY = 6;
      sectionLayout.paddingTop = 0;
      sectionLayout.paddingBottom = 0;
      sectionLayout.paddingLeft = 0;
      sectionLayout.paddingRight = 0;

      let sectionLabelNode = sectionNode.getChildByName('__section_title');
      if (!sectionLabelNode) {
        sectionLabelNode = new Node('__section_title');
        sectionLabelNode.setParent(sectionNode);
      }
      sectionLabelNode.layer = this.node.layer;
      sectionLabelNode.active = true;
      const sectionLabelTransform = sectionLabelNode.getComponent(UITransform)
        ?? sectionLabelNode.addComponent(UITransform);
      sectionLabelTransform.setContentSize(320, 28);
      const sectionLabel = sectionLabelNode.getComponent(Label) ?? sectionLabelNode.addComponent(Label);
      sectionLabel.string = section.title;
      sectionLabel.fontSize = 17;
      sectionLabel.lineHeight = 20;
      sectionLabel.useSystemFont = true;
      sectionLabel.fontFamily = 'Arial';
      sectionLabel.color = new Color(108, 194, 230, 255);
      sectionLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
      sectionLabel.verticalAlign = VerticalTextAlignment.CENTER;

      const rowCount = Math.ceil(section.buttons.length / BUTTON_COLUMNS);
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const rowName = `${BUTTON_ROW_PREFIX}${section.title}_${rowIndex}`;
        let rowNode = sectionNode.getChildByName(rowName);
        if (!rowNode) {
          rowNode = new Node(rowName);
          rowNode.setParent(sectionNode);
        }
        rowNode.layer = this.node.layer;
        rowNode.active = true;
        const rowTransform = rowNode.getComponent(UITransform) ?? rowNode.addComponent(UITransform);
        rowTransform.setContentSize(320, QA_GRID_BUTTON_HEIGHT + 4);
        const rowLayout = rowNode.getComponent(Layout) ?? rowNode.addComponent(Layout);
        rowLayout.type = Layout.Type.HORIZONTAL;
        rowLayout.resizeMode = Layout.ResizeMode.CONTAINER;
        rowLayout.spacingX = 10;
        rowLayout.paddingTop = 0;
        rowLayout.paddingBottom = 0;
        rowLayout.paddingLeft = 0;
        rowLayout.paddingRight = 0;

        const rowButtons = section.buttons.slice(
          rowIndex * BUTTON_COLUMNS,
          rowIndex * BUTTON_COLUMNS + BUTTON_COLUMNS,
        );
        rowButtons.forEach((buttonName) => {
          const buttonSpec = DEFAULT_BUTTON_LAYOUT.find((item) => item.name === buttonName);
          if (!buttonSpec) {
            return;
          }
          const buttonNodeName = `__simple_${buttonSpec.name}`;
          let buttonNode = rowNode!.getChildByName(buttonNodeName);
          if (!buttonNode) {
            const legacyNode = this.node.getChildByName(buttonNodeName)
              ?? buttonGrid!.getChildByName(buttonNodeName);
            if (legacyNode) {
              legacyNode.removeFromParent();
            }
            buttonNode = new Node(buttonNodeName);
            buttonNode.setParent(rowNode);
          }

          buttonNode.layer = this.node.layer;
          buttonNode.active = true;
          this.configureActionButton(buttonNode, buttonSpec.name, 120, QA_GRID_BUTTON_HEIGHT);
          this.actionResults.set(buttonSpec.name, 'idle');
          this.bindAppButtonClick(buttonNode, () => {
            const handler = this[buttonSpec.handler];
            if (typeof handler === 'function') {
              void handler.call(this).catch((error: unknown) => {
                console.error('[agora-rtc] action failed', error);
                this.pushStatus(`Action failed: ${String(error)}`);
              });
            }
          });
        });
      }
    });
  }

  private ensureSettingsPanel() {
    const headerPane = this.getHeaderContentNode();
    let settingsPanel = headerPane.getChildByName(SETTINGS_PANEL_NODE_NAME);
    if (!settingsPanel) {
      settingsPanel = new Node(SETTINGS_PANEL_NODE_NAME);
      settingsPanel.setParent(headerPane);
    }
    settingsPanel.setSiblingIndex(2);
    settingsPanel.layer = this.node.layer;
    settingsPanel.active = true;
    const panelTransform = settingsPanel.getComponent(UITransform) ?? settingsPanel.addComponent(UITransform);
    panelTransform.setContentSize(920, 150);
    const layout = settingsPanel.getComponent(Layout) ?? settingsPanel.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.NONE;
    layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
    layout.spacingY = 8;
    layout.paddingTop = 8;
    layout.paddingBottom = 8;
    layout.paddingLeft = 8;
    layout.paddingRight = 8;

    let settingsGrid = settingsPanel.getChildByName(SETTINGS_GRID_NODE_NAME);
    if (!settingsGrid) {
      settingsGrid = new Node(SETTINGS_GRID_NODE_NAME);
      settingsGrid.setParent(settingsPanel);
    }
    settingsGrid.layer = this.node.layer;
    settingsGrid.active = true;
    const gridTransform = settingsGrid.getComponent(UITransform) ?? settingsGrid.addComponent(UITransform);
    gridTransform.setContentSize(900, 140);
    const gridLayout = settingsGrid.getComponent(Layout) ?? settingsGrid.addComponent(Layout);
    gridLayout.type = Layout.Type.VERTICAL;
    gridLayout.resizeMode = Layout.ResizeMode.CONTAINER;
    gridLayout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
    gridLayout.spacingY = 6;
    gridLayout.paddingTop = 0;
    gridLayout.paddingBottom = 0;
    gridLayout.paddingLeft = 0;
    gridLayout.paddingRight = 0;

    SETTINGS_ROWS.forEach((row) => {
      const rowNode = this.ensureSettingsRow(settingsGrid!, row.key, row.action);
      rowNode.layer = this.node.layer;
      rowNode.active = true;
    });

    this.settingsPanel = settingsPanel;
    gridLayout.updateLayout(true);
  }

  private ensureSettingsRow(parent: Node, key: string, actionName: string): Node {
    const nodeName = `__example_setting_${key.toLowerCase()}`;
    let rowNode = parent.getChildByName(nodeName);
    if (!rowNode) {
      rowNode = new Node(nodeName);
      rowNode.setParent(parent);
    }
    const rowTransform = rowNode.getComponent(UITransform) ?? rowNode.addComponent(UITransform);
    rowTransform.setContentSize(900, 28);

    let nameNode = rowNode.getChildByName('__label');
    if (!nameNode) {
      nameNode = new Node('__label');
      nameNode.setParent(rowNode);
    }
    nameNode.setPosition(-330, 0, 0);
    const nameTransform = nameNode.getComponent(UITransform) ?? nameNode.addComponent(UITransform);
    nameTransform.setContentSize(110, 28);
    const nameLabel = nameNode.getComponent(Label) ?? nameNode.addComponent(Label);
    nameLabel.string = SETTING_LABEL_ZH[key] ?? key;
    nameLabel.fontSize = 14;
    nameLabel.lineHeight = 18;
    nameLabel.useSystemFont = true;
    nameLabel.fontFamily = 'Arial';
    nameLabel.color = new Color(180, 200, 220, 255);
    nameLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    nameLabel.verticalAlign = VerticalTextAlignment.CENTER;

    let valueNode = rowNode.getChildByName('__value');
    if (!valueNode) {
      valueNode = new Node('__value');
      valueNode.setParent(rowNode);
    }
    valueNode.setPosition(-60, 0, 0);
    const valueTransform = valueNode.getComponent(UITransform) ?? valueNode.addComponent(UITransform);
    valueTransform.setContentSize(330, 28);
    const valueLabel = valueNode.getComponent(Label) ?? valueNode.addComponent(Label);
    valueLabel.fontSize = 15;
    valueLabel.lineHeight = 18;
    valueLabel.useSystemFont = true;
    valueLabel.fontFamily = 'Arial';
    valueLabel.color = new Color(226, 234, 242, 255);
    valueLabel.horizontalAlign = HorizontalTextAlignment.RIGHT;
    valueLabel.verticalAlign = VerticalTextAlignment.CENTER;
    valueLabel.overflow = Label.Overflow.SHRINK;

    rowNode.getChildByName('__action')?.destroy();

    let chevronNode = valueNode.getChildByName('__chevron');
    if (!chevronNode) {
      chevronNode = new Node('__chevron');
      chevronNode.setParent(valueNode);
    }
    chevronNode.setPosition(valueTransform.contentSize.width / 2 - 10, 0, 0);
    const chevronTransform = chevronNode.getComponent(UITransform) ?? chevronNode.addComponent(UITransform);
    chevronTransform.setContentSize(16, 24);
    const chevronLabel = chevronNode.getComponent(Label) ?? chevronNode.addComponent(Label);
    chevronLabel.string = '›';
    chevronLabel.fontSize = 18;
    chevronLabel.color = new Color(140, 180, 220, 255);
    chevronLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    chevronLabel.verticalAlign = VerticalTextAlignment.CENTER;

    this.applyAppButtonChrome(valueNode, valueTransform.contentSize.width, 30, 'settingsPill');
    this.settingsValueLabels.set(key, this.getAppButtonLabel(valueNode));
    this.bindAppButtonClick(valueNode, () => {
      const handler = this[actionName];
      if (typeof handler === 'function') {
        void handler.call(this).catch((error: unknown) => {
          console.error('[agora-rtc] setting action failed', error);
          this.pushStatus(`Setting action failed: ${String(error)}`);
        });
      }
    });

    return rowNode;
  }

  private ensureConfigInputsRow(parent: Node): Node {
    let rowNode = parent.getChildByName(CONFIG_INPUTS_NODE_NAME);
    if (!rowNode) {
      rowNode = new Node(CONFIG_INPUTS_NODE_NAME);
      rowNode.setParent(parent);
    }
    rowNode.layer = this.node.layer;
    rowNode.active = true;
    const rowTransform = rowNode.getComponent(UITransform) ?? rowNode.addComponent(UITransform);
    rowTransform.setContentSize(520, CONFIG_INPUTS_BLOCK_HEIGHT);

    this.ensureConfigFieldRow(rowNode, '频道', 'channel', '__channel_value', () => {
      void this.cycleChannelPreset();
    }, 0);
    this.ensureConfigFieldRow(rowNode, 'UID', 'uid', '__uid_value', null, 1);
    this.channelInput = this.ensureEditBox(
      rowNode.getChildByName('__channel_value')!,
      CHANNEL_INPUT_NODE_NAME,
      'channel',
      this.channelId,
      160,
    );
    this.uidInput = this.ensureEditBox(
      rowNode.getChildByName('__uid_value')!,
      UID_INPUT_NODE_NAME,
      'uid',
      String(this.uid),
      88,
      true,
    );

    let applyNode = rowNode.getChildByName(APPLY_CONFIG_BUTTON_NODE_NAME);
    if (applyNode) {
      applyNode.destroy();
    }

    let logBtn = rowNode.getChildByName(LOG_CONFIG_BUTTON_NODE_NAME);
    if (logBtn) {
      logBtn.destroy();
    }
    this.logConfigButtonNode = null;

    if (this.channelInput) {
      this.channelInput.node.off(EditBox.EventType.EDITING_DID_ENDED);
      this.channelInput.node.on(EditBox.EventType.EDITING_DID_ENDED, () => {
        void this.applyConfigInputs();
      });
      this.channelInput.node.off(EditBox.EventType.TEXT_CHANGED);
      this.channelInput.node.on(EditBox.EventType.TEXT_CHANGED, () => {
        this.applyConfigInputsSilent();
      });
    }
    if (this.uidInput) {
      this.uidInput.node.off(EditBox.EventType.EDITING_DID_ENDED);
      this.uidInput.node.on(EditBox.EventType.EDITING_DID_ENDED, () => {
        void this.applyConfigInputs();
      });
      this.uidInput.node.off(EditBox.EventType.TEXT_CHANGED);
      this.uidInput.node.on(EditBox.EventType.TEXT_CHANGED, () => {
        this.applyConfigInputsSilent();
      });
    }

    return rowNode;
  }

  private ensureConfigFieldRow(
    parent: Node,
    title: string,
    key: string,
    valueNodeName: string,
    cycleHandler: (() => void) | null,
    rowIndex: number,
  ) {
    const rowY = CONFIG_INPUTS_BLOCK_HEIGHT / 2 - CONFIG_INPUT_ROW_HEIGHT / 2 - rowIndex * CONFIG_INPUT_ROW_HEIGHT;
    let titleNode = parent.getChildByName(`__${key}_title`);
    if (!titleNode) {
      titleNode = new Node(`__${key}_title`);
      titleNode.setParent(parent);
    }
    const titleTransform = titleNode.getComponent(UITransform) ?? titleNode.addComponent(UITransform);
    titleTransform.setAnchorPoint(0, 0.5);
    titleTransform.setContentSize(CONFIG_INPUT_LABEL_WIDTH, CONFIG_INPUT_ROW_HEIGHT);
    const titleLabel = titleNode.getComponent(Label) ?? titleNode.addComponent(Label);
    titleLabel.string = title;
    titleLabel.fontSize = 14;
    titleLabel.lineHeight = 18;
    titleLabel.color = new Color(214, 230, 245, 255);
    titleLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    titleLabel.verticalAlign = VerticalTextAlignment.CENTER;
    titleLabel.overflow = Label.Overflow.CLAMP;

    let valueNode = parent.getChildByName(valueNodeName);
    if (!valueNode) {
      valueNode = new Node(valueNodeName);
      valueNode.setParent(parent);
    }
    valueNode.setPosition(0, rowY, 0);
    const valueTransform = valueNode.getComponent(UITransform) ?? valueNode.addComponent(UITransform);
    valueTransform.setContentSize(key === 'channel' ? CONFIG_CHANNEL_FIELD_MAX_WIDTH : CONFIG_UID_FIELD_MAX_WIDTH, CONFIG_INPUT_ROW_HEIGHT - 4);

    if (cycleHandler) {
      let cycleNode = parent.getChildByName(`__${key}_cycle`);
      if (!cycleNode) {
        cycleNode = new Node(`__${key}_cycle`);
        cycleNode.setParent(parent);
      }
      this.styleConfigActionButton(cycleNode, CONFIG_PRESET_BUTTON_WIDTH, CONFIG_INPUT_ROW_HEIGHT - 4, '预设', 'chip');
      this.bindAppButtonClick(cycleNode, cycleHandler);
    }
  }

  private layoutConfigInputsRow(rowNode: Node, rowWidth: number) {
    const rowTransform = rowNode.getComponent(UITransform);
    rowTransform?.setAnchorPoint(0.5, 0.5);

    const labelW = CONFIG_INPUT_LABEL_WIDTH;
    const actionW = CONFIG_PRESET_BUTTON_WIDTH;
    const pad = CONFIG_INPUT_LEFT_PAD;
    const half = rowWidth / 2;
    const left = -half + pad;
    const inner = Math.max(120, rowWidth - pad * 2);
    const row0Y = CONFIG_INPUTS_BLOCK_HEIGHT / 2 - CONFIG_INPUT_ROW_HEIGHT / 2;
    const row1Y = row0Y - CONFIG_INPUT_ROW_HEIGHT;
    const channelFieldW = Math.max(
      48,
      Math.min(CONFIG_CHANNEL_FIELD_MAX_WIDTH, inner - labelW - actionW - 4),
    );
    const uidFieldW = Math.max(40, Math.min(CONFIG_UID_FIELD_MAX_WIDTH, inner - labelW - 4));

    const place = (node: Node | null, x: number, y: number, w: number, h: number, anchorX = 0.5) => {
      if (!node) {
        return;
      }
      const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
      transform.setAnchorPoint(anchorX, 0.5);
      node.setPosition(x, y, 0);
      transform.setContentSize(w, h);
    };

    const channelContainer = rowNode.getChildByName('__channel_value');
    place(rowNode.getChildByName('__channel_title'), left, row0Y, labelW, CONFIG_INPUT_ROW_HEIGHT, 0);
    place(channelContainer, left + labelW + channelFieldW / 2, row0Y, channelFieldW, CONFIG_INPUT_ROW_HEIGHT - 4);
    if (channelContainer && this.channelInput) {
      this.channelInput.node.getComponent(UITransform)?.setContentSize(channelFieldW, CONFIG_INPUT_ROW_HEIGHT - 4);
      this.syncEditBoxPresentation(this.channelInput);
    }

    const cycleNode = rowNode.getChildByName('__channel_cycle');
    place(cycleNode, half - pad - actionW / 2, row0Y, actionW, CONFIG_INPUT_ROW_HEIGHT - 4);
    if (cycleNode) {
      cycleNode.active = true;
      cycleNode.layer = this.node.layer;
    }

    const uidContainer = rowNode.getChildByName('__uid_value');
    place(rowNode.getChildByName('__uid_title'), left, row1Y, labelW, CONFIG_INPUT_ROW_HEIGHT, 0);
    place(uidContainer, left + labelW + uidFieldW / 2, row1Y, uidFieldW, CONFIG_INPUT_ROW_HEIGHT - 4);
    if (uidContainer && this.uidInput) {
      this.uidInput.node.getComponent(UITransform)?.setContentSize(uidFieldW, CONFIG_INPUT_ROW_HEIGHT - 4);
      this.syncEditBoxPresentation(this.uidInput);
    }
  }

  private measureHeaderContentHeight(_contentWidth: number): number {
    const settingsHeight = SETTINGS_ROWS.length * CONFIG_INPUT_ROW_HEIGHT + 16;
    return HEADER_CONFIG_TEXT_HEIGHT + CONFIG_INPUTS_BLOCK_HEIGHT + settingsHeight + 16;
  }

  private resolveHeaderScrollHeight(paneHeight: number, headerContentHeight: number): number {
    const maxByPane = Math.floor(paneHeight * 0.55);
    return Math.min(headerContentHeight + 12, maxByPane);
  }

  private layoutLeftPaneStack(
    leftPane: Node,
    paneHeight: number,
    headerHeight: number,
    buttonHeight: number,
  ) {
    const header = leftPane.getChildByName(HEADER_SCROLL_NODE_NAME);
    const buttons = leftPane.getChildByName(BUTTON_PANEL_NODE_NAME);
    const gap = LEFT_SECTION_GAP;
    const totalNeeded = headerHeight + buttonHeight + gap;
    let h = headerHeight;
    let b = buttonHeight;
    if (totalNeeded > paneHeight - 8) {
      const ratio = (paneHeight - 8) / totalNeeded;
      h = Math.floor(h * ratio);
      b = Math.floor(b * ratio);
    }

    let cursorY = paneHeight / 2 - 2;
    const stack: Array<{ node: Node | null; height: number; width?: number }> = [
      { node: header, height: h },
      { node: buttons, height: b },
    ];
    stack.forEach(({ node, height }) => {
      if (!node) {
        return;
      }
      const transform = node.getComponent(UITransform);
      if (transform) {
        const width = transform.contentSize.width;
        transform.setContentSize(width, height);
        this.ensurePanelBorder(node, width, height);
      }
      cursorY -= height / 2;
      node.setPosition(0, cursorY, 0);
      cursorY -= height / 2 + gap;
    });
  }

  private layoutButtonPanelInternals(panelNode: Node, width: number, height: number) {
    const quickBar = panelNode.getChildByName(SESSION_QUICK_BAR_NODE_NAME);
    const viewport = this.getScrollViewport(panelNode);
    const gap = 6;
    const scrollH = Math.max(72, height - SESSION_QUICK_BAR_HEIGHT - gap);
    quickBar?.setPosition(0, height / 2 - SESSION_QUICK_BAR_HEIGHT / 2 - 2, 0);
    quickBar?.getComponent(UITransform)?.setContentSize(Math.max(120, width - 16), SESSION_QUICK_BAR_HEIGHT);
    if (viewport) {
      viewport.setPosition(0, height / 2 - SESSION_QUICK_BAR_HEIGHT - gap - scrollH / 2, 0);
      viewport.getComponent(UITransform)?.setContentSize(
        Math.max(40, width - SCROLL_CLIP_INSET * 2),
        Math.max(40, scrollH - SCROLL_CLIP_INSET * 2),
      );
      const buttonGrid = viewport.getChildByName(BUTTON_GRID_NODE_NAME);
      if (buttonGrid) {
        const viewportHeight = viewport.getComponent(UITransform)?.contentSize.height ?? scrollH;
        buttonGrid.setPosition(0, viewportHeight / 2, 0);
      }
    }
  }

  async cycleChannelPreset() {
    this.channelPresetIndex = (this.channelPresetIndex + 1) % CHANNEL_PRESETS.length;
    this.channelId = CHANNEL_PRESETS[this.channelPresetIndex];
    if (this.channelInput) {
      this.channelInput.string = this.channelId;
      this.syncEditBoxPresentation(this.channelInput);
    }
    this.refreshConfigLabel();
    this.pushStatus(`Channel preset: ${this.channelId}`);
  }

  private ensureEditBox(
    parent: Node,
    nodeName: string,
    placeholder: string,
    value: string,
    width: number,
    numeric = false,
  ): EditBox {
    let inputNode = parent.getChildByName(nodeName);
    if (!inputNode) {
      inputNode = new Node(nodeName);
      inputNode.setParent(parent);
    }
    inputNode.layer = this.node.layer;
    inputNode.active = true;
    const transform = inputNode.getComponent(UITransform) ?? inputNode.addComponent(UITransform);
    transform.setContentSize(width, 32);

    let bgNode = inputNode.getChildByName('__edit_bg');
    if (!bgNode) {
      bgNode = new Node('__edit_bg');
      bgNode.setParent(inputNode);
    }
    bgNode.setSiblingIndex(0);
    bgNode.layer = this.node.layer;
    const bgTransform = bgNode.getComponent(UITransform) ?? bgNode.addComponent(UITransform);
    bgTransform.setContentSize(width, 32);
    const bgGraphics = bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics);
    bgGraphics.clear();
    bgGraphics.fillColor = new Color(12, 28, 44, 255);
    bgGraphics.strokeColor = new Color(58, 96, 128, 255);
    bgGraphics.lineWidth = 1;
    bgGraphics.roundRect(-width / 2, -16, width, 32, 6);
    bgGraphics.fill();
    bgGraphics.stroke();

    const textLabel = this.ensureEditBoxLabel(inputNode, EDIT_TEXT_LABEL_NAME, '', 15);
    const placeholderLabel = this.ensureEditBoxLabel(inputNode, EDIT_PLACEHOLDER_LABEL_NAME, placeholder, 14);
    placeholderLabel.color = new Color(120, 150, 180, 255);

    const editBox = inputNode.getComponent(EditBox) ?? inputNode.addComponent(EditBox);
    editBox.textLabel = textLabel;
    editBox.placeholderLabel = placeholderLabel;
    editBox.inputMode = numeric ? EditBox.InputMode.NUMERIC : EditBox.InputMode.SINGLE_LINE;
    editBox.maxLength = numeric ? 10 : 32;
    editBox.placeholder = placeholder;
    editBox.string = value;
    this.syncEditBoxPresentation(editBox);
    return editBox;
  }

  private ensureEditBoxLabel(parent: Node, nodeName: string, text: string, fontSize: number): Label {
    let labelNode = parent.getChildByName(nodeName);
    if (!labelNode) {
      labelNode = new Node(nodeName);
      labelNode.setParent(parent);
    }
    labelNode.layer = this.node.layer;
    labelNode.setSiblingIndex(1);
    const labelTransform = labelNode.getComponent(UITransform) ?? labelNode.addComponent(UITransform);
    labelTransform.setAnchorPoint(0, 0.5);
    const parentSize = parent.getComponent(UITransform)?.contentSize ?? new Size(120, 32);
    labelTransform.setContentSize(Math.max(20, parentSize.width - 12), parentSize.height);
    labelNode.setPosition(-parentSize.width / 2 + 6, 0, 0);
    const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 4;
    label.useSystemFont = true;
    label.fontFamily = 'Arial';
    label.color = new Color(236, 244, 252, 255);
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.overflow = Label.Overflow.CLAMP;
    label.enableWrapText = false;
    return label;
  }

  private syncEditBoxPresentation(editBox: EditBox | null) {
    if (!editBox) {
      return;
    }
    const transform = editBox.node.getComponent(UITransform);
    if (!transform) {
      return;
    }
    const width = transform.contentSize.width;
    const height = transform.contentSize.height;
    const bgNode = editBox.node.getChildByName('__edit_bg');
    bgNode?.getComponent(UITransform)?.setContentSize(width, height);
    const bgGraphics = bgNode?.getComponent(Graphics);
    if (bgGraphics) {
      bgGraphics.clear();
      bgGraphics.fillColor = new Color(12, 28, 44, 255);
      bgGraphics.strokeColor = new Color(58, 96, 128, 255);
      bgGraphics.lineWidth = 1;
      bgGraphics.roundRect(-width / 2, -height / 2, width, height, 6);
      bgGraphics.fill();
      bgGraphics.stroke();
    }
    if (editBox.textLabel) {
      const textTransform = editBox.textLabel.node.getComponent(UITransform)
        ?? editBox.textLabel.node.addComponent(UITransform);
      textTransform.setAnchorPoint(0, 0.5);
      textTransform.setContentSize(Math.max(20, width - 12), height);
      editBox.textLabel.node.setPosition(-width / 2 + 6, 0, 0);
      editBox.textLabel.fontSize = 15;
      editBox.textLabel.lineHeight = 18;
      editBox.textLabel.overflow = Label.Overflow.CLAMP;
      editBox.textLabel.string = editBox.string;
    }
    if (editBox.placeholderLabel) {
      const placeholderTransform = editBox.placeholderLabel.node.getComponent(UITransform)
        ?? editBox.placeholderLabel.node.addComponent(UITransform);
      placeholderTransform.setAnchorPoint(0, 0.5);
      placeholderTransform.setContentSize(Math.max(20, width - 12), height);
      editBox.placeholderLabel.node.setPosition(-width / 2 + 6, 0, 0);
      editBox.placeholderLabel.fontSize = 14;
      editBox.placeholderLabel.lineHeight = 18;
      editBox.placeholderLabel.overflow = Label.Overflow.CLAMP;
      editBox.placeholderLabel.string = editBox.placeholder;
    }
  }

  private ensureTitleLabel() {
    let titleNode = this.node.getChildByName(TITLE_NODE_NAME);
    if (!titleNode) {
      titleNode = new Node(TITLE_NODE_NAME);
      titleNode.setParent(this.node);
    }

    titleNode.layer = this.node.layer;
    titleNode.active = false;
    titleNode.setPosition(0, 180, 0);

    const transform = titleNode.getComponent(UITransform) ?? titleNode.addComponent(UITransform);
    transform.setContentSize(760, 48);

    const label = titleNode.getComponent(Label) ?? titleNode.addComponent(Label);
    label.string = 'Agora RTC QA Console';
    label.fontSize = 22;
    label.lineHeight = 26;
    label.useSystemFont = true;
    label.fontFamily = 'Arial';
    label.color = new Color(88, 160, 205, 140);
  }

  private ensureSummaryLabel() {
    const legacySummary = this.getHeaderContentNode().getChildByName(SUMMARY_NODE_NAME);
    if (legacySummary) {
      legacySummary.removeFromParent();
    }

    const contentNode = this.statusContentNode ?? this.node;
    let summaryNode = contentNode.getChildByName(SUMMARY_NODE_NAME);
    if (!summaryNode) {
      summaryNode = new Node(SUMMARY_NODE_NAME);
      summaryNode.setParent(contentNode);
    }

    summaryNode.layer = this.node.layer;
    summaryNode.active = true;
    summaryNode.setSiblingIndex(0);

    const transform = summaryNode.getComponent(UITransform) ?? summaryNode.addComponent(UITransform);
    transform.setContentSize(940, 72);

    this.summaryLabel = summaryNode.getComponent(Label) ?? summaryNode.addComponent(Label);
    this.summaryLabel.fontSize = 15;
    this.summaryLabel.lineHeight = 18;
    this.summaryLabel.useSystemFont = true;
    this.summaryLabel.fontFamily = 'Arial';
    this.summaryLabel.color = new Color(170, 210, 188, 255);
    this.summaryLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.summaryLabel.verticalAlign = VerticalTextAlignment.TOP;
    this.applyWrappingLabel(this.summaryLabel, 940, 72);
    this.refreshSummary();
  }

  private ensureLogFloatButton() {
    this.getLeftPane()?.getChildByName('__log_entry_bar')?.destroy();
    this.getLeftPane()?.getChildByName(STATUS_SCROLL_NODE_NAME)?.destroy();
    this.ensureUiOverlayRoot().getChildByName(LOG_FLOAT_BTN_NODE_NAME)?.destroy();

    let btnNode = this.node.getChildByName(LOG_FLOAT_BTN_NODE_NAME);
    if (!btnNode) {
      btnNode = new Node(LOG_FLOAT_BTN_NODE_NAME);
      btnNode.setParent(this.node);
    }
    this.logFloatButtonNode = btnNode;
    btnNode.layer = this.node.layer;
    btnNode.active = !this.logPageVisible;

    const transform = btnNode.getComponent(UITransform) ?? btnNode.addComponent(UITransform);
    transform.setContentSize(LOG_FLOAT_BTN_WIDTH, LOG_FLOAT_BTN_HEIGHT);
    this.applyAppButtonChrome(btnNode, LOG_FLOAT_BTN_WIDTH, LOG_FLOAT_BTN_HEIGHT, 'chip');
    const label = this.getAppButtonLabel(btnNode);
    label.string = this.statusLines.length > 0 ? `日志 ${this.statusLines.length}` : '全部日志';
    label.fontSize = 13;
    this.bindLogEntryButtonClick(btnNode, 'float-btn');

    this.layoutLogFloatButton();
    this.logUi('float-btn-ready', {
      pos: btnNode.position.clone(),
      size: transform.contentSize,
      sibling: btnNode.getSiblingIndex(),
      canvasChildren: this.node.children.length,
    });
  }

  private layoutLogFloatButton() {
    const btnNode = this.logFloatButtonNode ?? this.node.getChildByName(LOG_FLOAT_BTN_NODE_NAME);
    if (!btnNode) {
      return;
    }
    const visibleSize = view.getVisibleSize();
    const margin = 14;
    const topRightX = visibleSize.width / 2 - margin - LOG_FLOAT_BTN_WIDTH / 2;
    const topRightY = visibleSize.height / 2 - margin - LOG_FLOAT_BTN_HEIGHT / 2;
    btnNode.setPosition(topRightX, topRightY, 0);
    btnNode.getComponent(UITransform)?.setContentSize(LOG_FLOAT_BTN_WIDTH, LOG_FLOAT_BTN_HEIGHT);
    if (!this.logPageVisible) {
      btnNode.active = true;
      btnNode.setSiblingIndex(this.node.children.length - 1);
    }
    const box = btnNode.getComponent(UITransform)?.getBoundingBoxToWorld();
    if (box) {
      this.logFloatWorldRect = { x: box.x, y: box.y, w: box.width, h: box.height };
    }
    this.logUi('float-btn-layout', {
      localPos: { x: topRightX, y: topRightY },
      worldBox: this.logFloatWorldRect,
    });
  }

  private ensureConfigLogButton() {
    const headerPane = this.getHeaderContentNode();
    const rowNode = headerPane.getChildByName(CONFIG_INPUTS_NODE_NAME);
    if (rowNode) {
      const contentWidth = rowNode.getComponent(UITransform)?.contentSize.width ?? 520;
      this.layoutConfigInputsRow(rowNode, contentWidth);
      this.raiseConfigInputChrome(rowNode);
    }
    this.refreshLogConfigButtonLabel();
  }

  private refreshLogConfigButtonLabel() {
    const btn = this.logConfigButtonNode
      ?? this.getHeaderContentNode().getChildByName(CONFIG_INPUTS_NODE_NAME)
        ?.getChildByName(LOG_CONFIG_BUTTON_NODE_NAME);
    if (!btn) {
      return;
    }
    const label = this.getAppButtonLabel(btn);
    const count = this.statusLines.length;
    label.string = this.logPageVisible
      ? `收起${count > 0 ? `(${count})` : ''}`
      : `日志${count > 0 ? `(${count})` : ''}`;
  }

  private toggleStatusLogPage() {
    if (this.logPageVisible && this.logPageNode?.active) {
      this.closeStatusLogPage();
      return;
    }
    this.requestOpenLogPage('toggle');
  }

  private ensureLogPage() {
    if (this.logPageBuilt && this.logPageNode?.isValid) {
      return;
    }
    this.resetLogPageConstruction();

    const logPage = new Node(LOG_PAGE_NODE_NAME);
    logPage.setParent(this.node);
    this.logPageNode = logPage;
    logPage.layer = this.node.layer;
    logPage.active = false;

    const visibleSize = view.getVisibleSize();
    const pageTransform = logPage.getComponent(UITransform) ?? logPage.addComponent(UITransform);
    pageTransform.setAnchorPoint(0.5, 0.5);
    pageTransform.setContentSize(visibleSize.width, visibleSize.height);
    logPage.setPosition(0, 0, 0);

    const dimBg = new Node('__log_page_dim');
    dimBg.setParent(logPage);
    dimBg.layer = logPage.layer;
    dimBg.setSiblingIndex(0);
    const dimTransform = dimBg.getComponent(UITransform) ?? dimBg.addComponent(UITransform);
    dimTransform.setContentSize(visibleSize.width + 20, visibleSize.height + 20);
    const dimGraphics = dimBg.addComponent(Graphics);
    dimGraphics.fillColor = new Color(8, 16, 32, 245);
    dimGraphics.rect(
      -(visibleSize.width + 20) / 2,
      -(visibleSize.height + 20) / 2,
      visibleSize.width + 20,
      visibleSize.height + 20,
    );
    dimGraphics.fill();
    this.ignoreUiHitTest(dimBg);

    const panelWidth = Math.min(visibleSize.width - 40, 920);
    const panelHeight = Math.min(visibleSize.height - 40, visibleSize.height - 24);
    const headerHeight = 48;

    const panel = new Node(LOG_PAGE_PANEL_NAME);
    panel.setParent(logPage);
    panel.layer = logPage.layer;
    panel.setSiblingIndex(2);
    panel.setPosition(0, 0, 0);
    const panelTransform = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
    panelTransform.setContentSize(panelWidth, panelHeight);
    panel.getComponent(BlockInputEvents) ?? panel.addComponent(BlockInputEvents);
    this.ensurePanelBorder(panel, panelWidth, panelHeight);

    const header = new Node(LOG_PAGE_HEADER_NAME);
    header.setParent(panel);
    header.layer = panel.layer;
    header.setPosition(0, panelHeight / 2 - headerHeight / 2 - 4, 0);
    const headerTransform = header.getComponent(UITransform) ?? header.addComponent(UITransform);
    headerTransform.setContentSize(panelWidth - 16, headerHeight);

    const addHeaderBtn = (name: string, text: string, variant: AppButtonVariant, x: number, handler: () => void) => {
      const btn = new Node(name);
      btn.setParent(header);
      btn.layer = panel.layer;
      btn.setPosition(x, 0, 0);
      this.styleConfigActionButton(btn, 88, 36, text, variant);
      this.bindAppButtonClick(btn, handler);
    };
    addHeaderBtn('__log_back', '返回', 'secondary', -panelWidth / 2 + 60, () => this.closeStatusLogPage());
    addHeaderBtn('__log_clear', '清空', 'ghost', -panelWidth / 2 + 160, () => {
      void this.clearStatusLog();
    });
    addHeaderBtn('__log_freeze', '冻结', 'ghost', -panelWidth / 2 + 260, () => {
      void this.toggleStatusFreeze();
    });

    const titleNode = new Node('__log_page_title');
    titleNode.setParent(header);
    titleNode.setPosition(-panelWidth / 2 + 380, 0, 0);
    const titleTransform = titleNode.getComponent(UITransform) ?? titleNode.addComponent(UITransform);
    titleTransform.setContentSize(280, 36);
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.string = '运行日志';
    titleLabel.fontSize = 18;
    titleLabel.lineHeight = 22;
    titleLabel.enableWrapText = false;
    titleLabel.overflow = Label.Overflow.CLAMP;
    titleLabel.color = new Color(120, 200, 240, 255);

    panel.getChildByName(SCROLL_VIEWPORT_NODE_NAME)?.destroy();
    this.buildLogPageBody(panel, panelWidth, panelHeight, headerHeight);

    this.logPageBuilt = true;
    this.logUi('log-page-built', { panelWidth, panelHeight });
    this.refreshLogPageContent();
  }

  private getLogBodyLayout(panelWidth: number, panelHeight: number, headerHeight: number) {
    const marginX = 18;
    const marginBottom = 14;
    const gapBelowHeader = 10;
    const bodyWidth = panelWidth - marginX * 2;
    const bodyHeight = Math.max(100, panelHeight - headerHeight - gapBelowHeader - marginBottom);
    const topLeftX = -panelWidth / 2 + marginX;
    const topLeftY = panelHeight / 2 - headerHeight - gapBelowHeader;
    const textWidth = bodyWidth - LOG_BODY_PAD * 2;
    return { bodyWidth, bodyHeight, topLeftX, topLeftY, textWidth };
  }

  private paintLogBodyClipBg(clipBg: Node, bodyWidth: number, bodyHeight: number) {
    const clipTransform = clipBg.getComponent(UITransform) ?? clipBg.addComponent(UITransform);
    clipTransform.setAnchorPoint(0, 1);
    clipTransform.setContentSize(bodyWidth, bodyHeight);
    clipBg.setPosition(0, 0, 0);
    const clipGraphics = clipBg.getComponent(Graphics) ?? clipBg.addComponent(Graphics);
    clipGraphics.clear();
    clipGraphics.fillColor = new Color(12, 22, 38, 255);
    clipGraphics.rect(0, -bodyHeight, bodyWidth, bodyHeight);
    clipGraphics.fill();
  }

  /** 清理 viewport 上误挂的 Mask（会导致 native 打开日志页 stencilStage 崩溃） */
  private stripLogViewportStencilComponents(viewport: Node) {
    viewport.getComponent(Mask)?.destroy();
    const graphics = viewport.getComponent(Graphics);
    if (graphics) {
      graphics.destroy();
    }
  }

  private getLogBodyClipRoot(viewport: Node): Node | null {
    return viewport.getChildByName(LOG_BODY_CLIP_NODE_NAME);
  }

  /** Mask 与 Graphics 同节点；仅在日志页已激活后调用 */
  private ensureLogBodyViewportMask(clipRoot: Node, bodyWidth: number, bodyHeight: number) {
    const maskGraphics = clipRoot.getComponent(Graphics) ?? clipRoot.addComponent(Graphics);
    maskGraphics.clear();
    maskGraphics.fillColor = new Color(255, 255, 255, 255);
    maskGraphics.rect(0, -bodyHeight, bodyWidth, bodyHeight);
    maskGraphics.fill();

    const mask = clipRoot.getComponent(Mask) ?? clipRoot.addComponent(Mask);
    mask.type = Mask.Type.RECT;
    mask.inverted = false;
    mask.enabled = true;
  }

  private disableLogBodyViewportMask() {
    const clipRoot = this.logBodyViewportNode ? this.getLogBodyClipRoot(this.logBodyViewportNode) : null;
    const mask = clipRoot?.getComponent(Mask);
    if (mask) {
      mask.enabled = false;
    }
  }

  private queueLogBodyViewportMask() {
    const viewport = this.logBodyViewportNode;
    if (!viewport?.isValid || !this.logPageVisible || !this.logPageNode?.active) {
      return;
    }
    const clipRoot = this.getLogBodyClipRoot(viewport);
    const clipTransform = clipRoot?.getComponent(UITransform);
    if (!clipRoot || !clipTransform) {
      return;
    }
    const { width, height } = clipTransform.contentSize;
    this.scheduleOnce(() => {
      if (!this.logPageVisible || !clipRoot.isValid || !this.logPageNode?.active) {
        return;
      }
      try {
        this.ensureLogBodyViewportMask(clipRoot, width, height);
      } catch (error) {
        console.warn('[agora-rtc][log-ui] mask skipped', error);
        clipRoot.getComponent(Mask)?.destroy();
        clipRoot.getComponent(Graphics)?.destroy();
      }
    }, 0);
  }

  private buildLogPageBody(panel: Node, panelWidth: number, panelHeight: number, headerHeight: number) {
    const { bodyWidth, bodyHeight, topLeftX, topLeftY, textWidth } = this.getLogBodyLayout(
      panelWidth,
      panelHeight,
      headerHeight,
    );

    let viewport = panel.getChildByName(LOG_BODY_VIEWPORT_NODE_NAME);
    if (!viewport) {
      viewport = new Node(LOG_BODY_VIEWPORT_NODE_NAME);
      viewport.setParent(panel);
    }
    viewport.layer = panel.layer;
    viewport.active = true;
    viewport.setSiblingIndex(1);
    viewport.setPosition(topLeftX, topLeftY, 0);
    const viewportTransform = viewport.getComponent(UITransform) ?? viewport.addComponent(UITransform);
    viewportTransform.setAnchorPoint(0, 1);
    viewportTransform.setContentSize(bodyWidth, bodyHeight);
    this.logBodyViewportNode = viewport;
    this.logBodyViewportHeight = bodyHeight;
    this.stripLogViewportStencilComponents(viewport);

    let clipRoot = this.getLogBodyClipRoot(viewport);
    if (!clipRoot) {
      clipRoot = new Node(LOG_BODY_CLIP_NODE_NAME);
      clipRoot.setParent(viewport);
    }
    clipRoot.layer = panel.layer;
    clipRoot.active = true;
    clipRoot.setSiblingIndex(0);
    clipRoot.setPosition(0, 0, 0);
    const clipTransform = clipRoot.getComponent(UITransform) ?? clipRoot.addComponent(UITransform);
    clipTransform.setAnchorPoint(0, 1);
    clipTransform.setContentSize(bodyWidth, bodyHeight);

    const reparentToClip = (name: string) => {
      const node = viewport.getChildByName(name);
      if (node && node.parent !== clipRoot) {
        node.setParent(clipRoot);
      }
      return node;
    };

    let clipBg = clipRoot.getChildByName('__log_body_clip_bg') ?? reparentToClip('__log_body_clip_bg');
    if (!clipBg) {
      clipBg = new Node('__log_body_clip_bg');
      clipBg.setParent(clipRoot);
      clipBg.setSiblingIndex(0);
    }
    clipBg.layer = panel.layer;
    this.paintLogBodyClipBg(clipBg, bodyWidth, bodyHeight);

    let bodyNode = clipRoot.getChildByName(LOG_PAGE_BODY_NODE_NAME) ?? reparentToClip(LOG_PAGE_BODY_NODE_NAME);
    if (!bodyNode) {
      bodyNode = new Node(LOG_PAGE_BODY_NODE_NAME);
      bodyNode.setParent(clipRoot);
    }
    bodyNode.layer = panel.layer;
    bodyNode.active = true;
    bodyNode.setSiblingIndex(1);
    const bodyTransform = bodyNode.getComponent(UITransform) ?? bodyNode.addComponent(UITransform);
    bodyTransform.setAnchorPoint(0, 1);
    bodyTransform.setContentSize(textWidth, bodyHeight);

    const label = bodyNode.getComponent(Label) ?? bodyNode.addComponent(Label);
    this.logPageBodyLabel = label;
    label.fontSize = 14;
    label.lineHeight = LOG_LINE_HEIGHT;
    label.useSystemFont = true;
    label.fontFamily = 'Menlo';
    label.color = new Color(210, 220, 235, 255);
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.enableWrapText = true;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;

    this.logPageScrollView = null;
    this.applyLogBodyScrollPosition(bodyNode);
    viewport.getComponent(BlockInputEvents) ?? viewport.addComponent(BlockInputEvents);
    this.bindLogBodyPanScroll(viewport, bodyNode);
  }

  private estimateLogBodyContentHeight(contentWidth: number, fullText: string): number {
    const charsPerLine = Math.max(28, Math.floor(contentWidth / 7.2));
    let rows = 0;
    for (const line of fullText.split('\n')) {
      rows += Math.max(1, Math.ceil(line.length / charsPerLine));
    }
    return Math.max(LOG_LINE_HEIGHT + 8, rows * LOG_LINE_HEIGHT + 16);
  }

  /** 用 Label 实测高度，避免估算偏大导致底对齐后可视区落在空白段 */
  private measureLogBodyContentHeight(bodyNode: Node, contentWidth: number, fullText: string): number {
    const label = bodyNode.getComponent(Label);
    const ut = bodyNode.getComponent(UITransform);
    if (!label || !ut) {
      return this.estimateLogBodyContentHeight(contentWidth, fullText);
    }
    label.string = fullText;
    ut.setContentSize(contentWidth, 0);
    const labelWithRender = label as Label & { updateRenderData?: (enable?: boolean) => void };
    labelWithRender.updateRenderData?.(true);
    const measured = ut.contentSize.height;
    if (measured > LOG_LINE_HEIGHT) {
      return measured;
    }
    return this.estimateLogBodyContentHeight(contentWidth, fullText);
  }

  private updateLogBodyScrollRange(scrollToBottom = false) {
    const bodyNode = this.logPageBodyLabel?.node;
    if (!bodyNode) {
      return;
    }
    const overflow = this.logBodyContentHeight - this.logBodyViewportHeight;
    this.logBodyMaxScroll = overflow > 8 ? overflow : 0;
    if (scrollToBottom) {
      this.logBodyScrollOffset = 0;
    } else {
      this.logBodyScrollOffset = Math.min(this.logBodyMaxScroll, Math.max(0, this.logBodyScrollOffset));
    }
    this.applyLogBodyScrollPosition(bodyNode);
  }

  /**
   * 左上锚点 + 顶对齐 Label：
   * offset=0 → 内容底边贴在深蓝区底边（默认看到最新日志）
   * offset=max → 内容顶边贴在深蓝区顶边（看到最旧日志）
   * 手势：手指上滑 → offset 减小 → 正文随手指上移（与列表自然滚动一致）
   */
  private applyLogBodyScrollPosition(bodyNode: Node) {
    const viewH = this.logBodyViewportHeight;
    const contentH = this.logBodyContentHeight;
    bodyNode.setPosition(LOG_BODY_PAD, -viewH + contentH - this.logBodyScrollOffset, 0);
  }

  private bindLogBodyPanScroll(viewport: Node, bodyNode: Node) {
    const stopBubble = (event: EventTouch) => {
      event.propagationStopped = true;
    };
    const onStart = (event: EventTouch) => {
      stopBubble(event);
      this.logBodyPanLastY = event.getUILocation().y;
    };
    const onMove = (event: EventTouch) => {
      stopBubble(event);
      this.logBodyUserHasScrolled = true;
      const y = event.getUILocation().y;
      const delta = y - this.logBodyPanLastY;
      this.logBodyPanLastY = y;
      this.logBodyScrollOffset = Math.min(
        this.logBodyMaxScroll,
        Math.max(0, this.logBodyScrollOffset - delta),
      );
      this.applyLogBodyScrollPosition(bodyNode);
    };
    const onEnd = (event: EventTouch) => {
      stopBubble(event);
    };
    viewport.off(Node.EventType.TOUCH_START);
    viewport.off(Node.EventType.TOUCH_MOVE);
    viewport.off(Node.EventType.TOUCH_END);
    viewport.off(Node.EventType.TOUCH_CANCEL);
    viewport.on(Node.EventType.TOUCH_START, onStart, this);
    viewport.on(Node.EventType.TOUCH_MOVE, onMove, this);
    viewport.on(Node.EventType.TOUCH_END, onEnd, this);
    viewport.on(Node.EventType.TOUCH_CANCEL, onEnd, this);
  }

  private getFullLogText(): string {
    if (this.statusLines.length === 0) {
      return '（暂无日志）';
    }
    return this.statusLines.join('\n');
  }

  private refreshLogPageContent() {
    this.refreshLogConfigButtonLabel();

    if (this.logPageBodyLabel) {
      const fullText = this.getFullLogText();
      const bodyNode = this.logPageBodyLabel.node;
      const panel = this.logPageNode?.getChildByName(LOG_PAGE_PANEL_NAME);
      const panelWidth = panel?.getComponent(UITransform)?.contentSize.width ?? 740;
      const panelHeight = panel?.getComponent(UITransform)?.contentSize.height ?? 400;
      const headerHeight = 48;
      const { textWidth } = this.getLogBodyLayout(panelWidth, panelHeight, headerHeight);
      const contentWidth = textWidth;
      const prevOffset = this.logBodyScrollOffset;
      const wasAtBottom = this.logBodyMaxScroll <= 0 || prevOffset <= 24;
      this.logBodyContentHeight = this.measureLogBodyContentHeight(bodyNode, contentWidth, fullText);
      const overflow = this.logBodyContentHeight - this.logBodyViewportHeight;
      this.logBodyMaxScroll = overflow > 8 ? overflow : 0;
      if (this.logBodyPendingScrollToBottom) {
        this.logBodyPendingScrollToBottom = false;
        this.logBodyScrollOffset = 0;
      } else if (wasAtBottom && !this.logBodyUserHasScrolled) {
        this.logBodyScrollOffset = 0;
      } else {
        this.logBodyScrollOffset = Math.min(this.logBodyMaxScroll, Math.max(0, prevOffset));
      }
      this.applyLogBodyScrollPosition(bodyNode);
    }
    const freezeBtn = this.logPageNode
      ?.getChildByName(LOG_PAGE_PANEL_NAME)
      ?.getChildByName(LOG_PAGE_HEADER_NAME)
      ?.getChildByName('__log_freeze');
    const freezeLabel = freezeBtn ? this.getAppButtonLabel(freezeBtn) : null;
    if (freezeLabel) {
      freezeLabel.string = this.statusFrozen ? '已冻结' : '冻结';
    }
  }

  private layoutStatusLogPage() {
    if (!this.logPageNode) {
      return;
    }
    const visibleSize = view.getVisibleSize();

    // 抵消 Canvas 父节点的缩放，防止发生非等比拉伸
    const canvasScale = this.node.scale;
    this.logPageNode.setScale(1 / canvasScale.x, 1 / canvasScale.y, 1);

    // Canvas 子节点坐标以中心为原点，勿再用 visibleSize/2 偏移（会把整页挪到屏幕外）
    this.logPageNode.setPosition(0, 0, 0);
    this.logPageNode.getComponent(UITransform)?.setContentSize(visibleSize.width, visibleSize.height);

    const panel = this.logPageNode.getChildByName(LOG_PAGE_PANEL_NAME);
    const panelWidth = Math.min(visibleSize.width - 48, 920);
    const panelHeight = Math.min(visibleSize.height - 48, visibleSize.height - 32);
    const headerHeight = 48;
    panel?.getComponent(UITransform)?.setContentSize(panelWidth, panelHeight);
    if (panel) {
      this.ensurePanelBorder(panel, panelWidth, panelHeight);
    }
    const header = panel?.getChildByName(LOG_PAGE_HEADER_NAME);
    header?.setPosition(0, panelHeight / 2 - headerHeight / 2 - 4, 0);
    header?.getComponent(UITransform)?.setContentSize(panelWidth - 16, headerHeight);
    header?.getChildByName('__log_back')?.setPosition(-panelWidth / 2 + 60, 0, 0);
    header?.getChildByName('__log_clear')?.setPosition(-panelWidth / 2 + 160, 0, 0);
    header?.getChildByName('__log_freeze')?.setPosition(-panelWidth / 2 + 260, 0, 0);
    header?.getChildByName('__log_page_title')?.setPosition(-panelWidth / 2 + 380, 0, 0);
    header?.setSiblingIndex(10);

    if (panel) {
      panel.getChildByName(SCROLL_VIEWPORT_NODE_NAME)?.destroy();
      if (this.logBodyViewportNode?.isValid && this.logPageBodyLabel?.isValid) {
        this.resizeLogPageBodyLayout(panel, panelWidth, panelHeight, headerHeight);
      } else {
        this.buildLogPageBody(panel, panelWidth, panelHeight, headerHeight);
      }
    }
    this.refreshLogPageContent();
  }

  private resizeLogPageBodyLayout(panel: Node, panelWidth: number, panelHeight: number, headerHeight: number) {
    const viewport = this.logBodyViewportNode;
    if (!viewport?.isValid) {
      return;
    }
    const { bodyWidth, bodyHeight, topLeftX, topLeftY, textWidth } = this.getLogBodyLayout(
      panelWidth,
      panelHeight,
      headerHeight,
    );
    viewport.setPosition(topLeftX, topLeftY, 0);
    viewport.getComponent(UITransform)?.setAnchorPoint(0, 1);
    viewport.getComponent(UITransform)?.setContentSize(bodyWidth, bodyHeight);
    this.logBodyViewportHeight = bodyHeight;
    this.stripLogViewportStencilComponents(viewport);
    const clipRoot = this.getLogBodyClipRoot(viewport);
    if (clipRoot) {
      clipRoot.setPosition(0, 0, 0);
      clipRoot.getComponent(UITransform)?.setAnchorPoint(0, 1);
      clipRoot.getComponent(UITransform)?.setContentSize(bodyWidth, bodyHeight);
    }
    const clipBg = clipRoot?.getChildByName('__log_body_clip_bg');
    if (clipBg) {
      this.paintLogBodyClipBg(clipBg, bodyWidth, bodyHeight);
    }
    if (this.logPageBodyLabel) {
      const fullText = this.getFullLogText();
      this.logBodyContentHeight = this.measureLogBodyContentHeight(
        this.logPageBodyLabel.node,
        textWidth,
        fullText,
      );
    }
    this.logBodyMaxScroll = Math.max(0, this.logBodyContentHeight - this.logBodyViewportHeight);
    if (!this.logBodyUserHasScrolled) {
      this.logBodyScrollOffset = 0;
    } else {
      this.logBodyScrollOffset = Math.min(this.logBodyMaxScroll, Math.max(0, this.logBodyScrollOffset));
    }
    if (this.logPageBodyLabel?.node) {
      this.applyLogBodyScrollPosition(this.logPageBodyLabel.node);
    }
  }

  private openStatusLogPage() {
    this.logUi('open-enter', { logPageVisible: this.logPageVisible, pageActive: this.logPageNode?.active ?? false });
    if (this.logPageVisible && this.logPageNode?.active) {
      this.logUi('open-skip', 'already-visible');
      return;
    }
    if (!this.logPageBuilt || !this.logPageNode?.isValid) {
      this.ensureLogPage();
    }
    if (!this.logPageNode) {
      this.logUi('open-fail', 'no-logPageNode');
      this.setLogUiHud('UI: 打开失败(无节点)');
      return;
    }
    this.logPageVisible = true;
    this.logBodyUserHasScrolled = false;
    this.logBodyPendingScrollToBottom = true;
    if (this.logFloatButtonNode) {
      this.logFloatButtonNode.active = false;
    }
    this.logPageNode.setParent(this.node);
    this.logPageNode.active = true;
    this.logPageNode.setSiblingIndex(this.node.children.length - 1);
    this.layoutStatusLogPage();
    this.refreshLogPageContent();
    this.scheduleOnce(() => {
      if (this.logPageVisible) {
        this.refreshLogPageContent();
        this.queueLogBodyViewportMask();
      }
    }, 0);
    this.queueLogBodyViewportMask();
    this.refreshLogConfigButtonLabel();
    this.logUi('open-done', {
      active: this.logPageNode.active,
      sibling: this.logPageNode.getSiblingIndex(),
      parent: this.logPageNode.parent?.name ?? 'none',
    });
    this.setLogUiHud(`UI: 页:开 条数:${this.statusLines.length}`);
    this.syncMainHudForLogPageOverlay();
  }

  private async suspendVideoOverlayForLogPage() {
    if (this.logPageVideoSuspended) {
      return;
    }
    // engine-texture 走 Cocos Sprite，无需隐藏；日志层盖在上面即可，避免关掉日志后远端黑屏
    if (this.renderBackend === 'engine-texture') {
      return;
    }
    try {
      await this.client?.setNativeVideoOverlaySuspended(true);
      this.logPageVideoSuspended = true;
    } catch (error) {
      console.warn('[agora-rtc] suspend video overlay for log page failed', error);
    }
  }

  private restoreEngineTextureSpritesAfterLogPage() {
    if (this.renderBackend !== 'engine-texture') {
      return;
    }
    if (this.localTextureSlotId !== null) {
      this.bindNativeTextureSprite('local', this.localTextureSlotId);
    }
    this.remoteTextureSlotIds.forEach((slotId, uid) => {
      this.bindNativeTextureSprite('remote', slotId, uid);
    });
    this.syncEngineTextureSpriteNodes();
    this.refreshVideoHints();
  }

  private async restoreVideoOverlayAfterLogPage() {
    if (this.renderBackend === 'engine-texture') {
      this.restoreEngineTextureSpritesAfterLogPage();
      return;
    }
    if (!this.logPageVideoSuspended) {
      return;
    }
    this.logPageVideoSuspended = false;
    try {
      await this.client?.setNativeVideoOverlaySuspended(false);
      if (this.localViewAttached) {
        await this.client?.updateLocalVideoView(this.getLocalVideoRect());
      }
      for (const uid of this.remoteUserUids) {
        await this.client?.updateRemoteVideoView(uid, this.getRemoteVideoRectForUid(uid));
      }
    } catch (error) {
      console.warn('[agora-rtc] restore video overlay after log page failed', error);
    }
    this.refreshVideoHints();
  }

  private closeStatusLogPage() {
    this.logUi('close-enter', { logPageVisible: this.logPageVisible });
    this.logPageVisible = false;
    this.logBodyUserHasScrolled = false;
    this.logBodyPendingScrollToBottom = false;
    this.disableLogBodyViewportMask();
    if (this.logPageNode?.isValid) {
      this.logPageNode.active = false;
    }
    this.layoutLogFloatButton();
    this.refreshLogConfigButtonLabel();
    this.logUi('close-done', { floatActive: this.logFloatButtonNode?.active ?? false });
    this.setLogUiHud('UI: 日志页已关闭');
    this.syncMainHudForLogPageOverlay();
    this.refreshSummary();
    void this.restoreVideoOverlayAfterLogPage();
  }

  private ensureVideoHints() {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME) ?? this.node;

    const localCard = rightPane.getChildByName(LOCAL_CARD_NODE_NAME) ?? rightPane;
    let localNode = localCard.getChildByName(LOCAL_HINT_NODE_NAME);
    if (!localNode) {
      localNode = new Node(LOCAL_HINT_NODE_NAME);
      localNode.setParent(localCard);
    }
    localNode.layer = this.node.layer;
    localNode.active = true;
    localNode.setPosition(0, 0, 0);
    const localTransform = localNode.getComponent(UITransform) ?? localNode.addComponent(UITransform);
    localTransform.setContentSize(320, 48);
    this.localHintLabel = localNode.getComponent(Label) ?? localNode.addComponent(Label);
    this.localHintLabel.fontSize = 15;
    this.localHintLabel.lineHeight = 18;
    this.localHintLabel.useSystemFont = true;
    this.localHintLabel.fontFamily = 'Arial';
    this.localHintLabel.color = new Color(160, 255, 190, 255);
    this.localHintLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
    this.localHintLabel.verticalAlign = VerticalTextAlignment.CENTER;
    this.applyWrappingLabel(this.localHintLabel, 240, 44);
    this.refreshVideoHints();
  }

  private ensureVideoTitles() {
    this.ensureVideoTitleNode(LOCAL_CARD_NODE_NAME, LOCAL_TITLE_NODE_NAME, 'Local');
  }

  private ensureVideoTitleNode(cardName: string, name: string, text: string) {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME) ?? this.node;
    const cardNode = rightPane.getChildByName(cardName) ?? rightPane;
    let titleNode = cardNode.getChildByName(name);
    if (!titleNode) {
      titleNode = new Node(name);
      titleNode.setParent(cardNode);
    }
    titleNode.layer = this.node.layer;
    titleNode.active = true;

    const transform = titleNode.getComponent(UITransform) ?? titleNode.addComponent(UITransform);
    transform.setContentSize(260, 32);

    const label = titleNode.getComponent(Label) ?? titleNode.addComponent(Label);
    label.string = text;
    label.fontSize = 18;
    label.lineHeight = 18;
    label.useSystemFont = true;
    label.fontFamily = 'Arial';
    label.color = new Color(220, 235, 255, 255);
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    label.overflow = Label.Overflow.CLAMP;
    label.enableWrapText = false;
  }

  private applyWrappingLabel(label: Label, width: number, minHeight: number) {
    const transform = label.node.getComponent(UITransform) ?? label.node.addComponent(UITransform);
    transform.setContentSize(width, minHeight);
    label.enableWrapText = true;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
  }

  private ensureScrollClip(scrollNode: Node) {
    const transform = scrollNode.getComponent(UITransform);
    if (!transform) {
      return;
    }
    const mask = scrollNode.getComponent(Mask) ?? scrollNode.addComponent(Mask);
    mask.type = Mask.Type.RECT;
    mask.inverted = false;
    scrollNode.getComponent(Graphics)?.destroy();
  }

  private reorderLeftPaneChildren(leftPane: Node | null) {
    if (!leftPane) {
      return;
    }
    const order = [HEADER_SCROLL_NODE_NAME, BUTTON_PANEL_NODE_NAME];
    order.forEach((nodeName, index) => {
      const child = leftPane.getChildByName(nodeName);
      if (child) {
        child.setSiblingIndex(index);
      }
    });
  }

  private updateHeaderScrollLayout(contentWidth: number) {
    const headerScroll = this.getHeaderScrollNode();
    const headerPane = this.getHeaderContentNode();
    if (!headerScroll || !headerPane) {
      return;
    }

    const settingsPanel = headerPane.getChildByName(SETTINGS_PANEL_NODE_NAME);
    const configInputs = headerPane.getChildByName(CONFIG_INPUTS_NODE_NAME);
    const configHeight = HEADER_CONFIG_TEXT_HEIGHT;
    const configInputsHeight = CONFIG_INPUTS_BLOCK_HEIGHT;
    const settingsHeight = SETTINGS_ROWS.length * CONFIG_INPUT_ROW_HEIGHT + 16;
    const contentHeight = configHeight + configInputsHeight + settingsHeight + 12;

    headerPane.getChildByName(CONFIG_NODE_NAME)?.getComponent(UITransform)?.setContentSize(contentWidth, configHeight);
    configInputs?.getComponent(UITransform)?.setContentSize(contentWidth, configInputsHeight);
    settingsPanel?.getComponent(UITransform)?.setContentSize(contentWidth, settingsHeight);
    headerPane.getComponent(UITransform)?.setContentSize(contentWidth, contentHeight);
    const viewport = this.getHeaderViewport();
    const viewportHeight = headerScroll.getComponent(UITransform)?.contentSize.height ?? 0;
    headerPane.setPosition(0, viewport?.getComponent(UITransform)?.contentSize.height ?? viewportHeight / 2, 0);
    headerPane.getComponent(Layout)?.updateLayout(true);
    settingsPanel?.getComponent(Layout)?.updateLayout(true);
    this.headerScrollView?.scrollToTop(0, false);
  }

  private layoutSplitVideoStack(
    paneWidth: number,
    paneHeight: number,
    remoteCard: Node | null,
    localCard: Node | null,
    localNode: Node | null,
    localTitle: Node | null,
    localHint: Node | null,
  ) {
    const edgePad = VIDEO_EDGE_PAD;
    const titleBlock = VIDEO_TITLE_HEIGHT + VIDEO_TITLE_GAP;
    const innerW = Math.max(120, paneWidth - edgePad * 2);
    const innerH = Math.max(180, paneHeight - edgePad * 2);

    let remoteVideoHeight = Math.max(88, innerH - titleBlock - VIDEO_CARD_PAD * 2);
    let remoteVideoWidth = Math.floor(remoteVideoHeight * 16 / 9);
    if (remoteVideoWidth > innerW) {
      remoteVideoWidth = innerW;
      remoteVideoHeight = Math.floor(remoteVideoWidth * 9 / 16);
    }
    remoteVideoWidth = Math.max(128, remoteVideoWidth);
    remoteVideoHeight = Math.max(88, remoteVideoHeight);

    const remoteBlockSpan = titleBlock + remoteVideoHeight + VIDEO_CARD_PAD * 2;
    const remoteCenterY = paneHeight / 2 - edgePad - remoteBlockSpan / 2;
    const remoteCenterX = -paneWidth / 2 + edgePad + VIDEO_PANE_LEFT_INSET + remoteVideoWidth / 2;

    let pipWidth = Math.floor(innerW * LOCAL_PIP_WIDTH_RATIO);
    pipWidth = Math.max(LOCAL_PIP_MIN_WIDTH, Math.min(LOCAL_PIP_MAX_WIDTH, pipWidth));
    let pipHeight = Math.floor(pipWidth * 9 / 16);
    pipHeight = Math.max(72, Math.min(pipHeight, Math.floor(innerH * 0.38)));
    pipWidth = Math.floor(pipHeight * 16 / 9);

    const pipCenterX = paneWidth / 2 - edgePad - LOCAL_PIP_EDGE_PAD - pipWidth / 2;
    const pipCenterY = -paneHeight / 2 + edgePad + LOCAL_PIP_EDGE_PAD + pipHeight / 2 + VIDEO_TITLE_HEIGHT;

    this.layoutRemotePageView(remoteCard, remoteCenterX, remoteCenterY, remoteVideoWidth, remoteVideoHeight);
    this.positionVideoFrame(localCard, localNode, localTitle, localHint, pipCenterX, pipCenterY, pipWidth, pipHeight);
    if (localCard) {
      localCard.setSiblingIndex((remoteCard?.getSiblingIndex() ?? 0) + 1);
    }
    this.syncEngineTextureSpriteNodes();
    this.refreshAllRemoteVideoSurfaces();
  }

  private syncEngineTextureSpriteNodes() {
    if (this.renderBackend !== 'engine-texture') {
      return;
    }
    if (this.localVideoSprite) {
      this.localVideoSprite.node.active = this.localVideoSprite.spriteFrame !== null || this.localTextureSlotId !== null;
    }
    this.remoteVideoSprites.forEach((sprite, uid) => {
      const slotId = this.remoteTextureSlotIds.get(uid) ?? null;
      sprite.node.active = sprite.spriteFrame !== null || slotId !== null;
    });
  }

  private positionVideoFrame(
    cardNode: Node | null,
    videoNode: Node | null,
    titleNode: Node | null,
    hintNode: Node | null,
    centerX: number,
    centerY: number,
    videoWidth: number,
    videoHeight: number,
  ) {
    const cardWidth = videoWidth + VIDEO_CARD_PAD * 2;
    const cardHeight = videoHeight + VIDEO_CARD_PAD * 2;
    cardNode?.setPosition(centerX, centerY, 0);
    cardNode?.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
    const bgNode = cardNode?.getChildByName(VIDEO_CARD_BG_NODE_NAME);
    bgNode?.setPosition(0, 0, 0);
    bgNode?.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
    const bgGraphics = bgNode?.getComponent(Graphics);
    if (bgGraphics) {
      this.drawSectionCard(bgGraphics, cardWidth, cardHeight, 'video');
    }
    videoNode?.setPosition(0, 0, 0);
    videoNode?.getComponent(UITransform)?.setContentSize(videoWidth, videoHeight);
    const titleOffsetY = videoHeight / 2 + VIDEO_CARD_PAD + VIDEO_TITLE_GAP + VIDEO_TITLE_HEIGHT / 2;
    titleNode?.setPosition(0, titleOffsetY, 0);
    titleNode?.getComponent(UITransform)?.setContentSize(cardWidth, VIDEO_TITLE_HEIGHT);
    hintNode?.setPosition(0, 0, 0);
    const hintWidth = Math.max(80, cardWidth - 16);
    const hintHeight = Math.max(36, Math.min(72, cardHeight - 8));
    hintNode?.getComponent(UITransform)?.setContentSize(hintWidth, hintHeight);
    const hintLabel = hintNode?.getComponent(Label);
    if (hintLabel) {
      hintLabel.fontSize = Math.min(16, Math.max(12, Math.floor(videoHeight * 0.08)));
      hintLabel.lineHeight = hintLabel.fontSize + 4;
      hintLabel.horizontalAlign = HorizontalTextAlignment.CENTER;
      hintLabel.verticalAlign = VerticalTextAlignment.CENTER;
      hintLabel.enableWrapText = true;
      hintLabel.overflow = Label.Overflow.CLAMP;
      hintLabel.node.getComponent(UITransform)?.setContentSize(hintWidth, hintHeight);
    }
    this.refreshVideoHints();
  }

  private layoutRemotePageView(
    cardNode: Node | null,
    centerX: number,
    centerY: number,
    videoWidth: number,
    videoHeight: number,
  ) {
    if (!cardNode) return;
    const cardWidth = videoWidth + VIDEO_CARD_PAD * 2;
    const cardHeight = videoHeight + VIDEO_CARD_PAD * 2;
    const titleYOffset = videoHeight / 2 + VIDEO_CARD_PAD + VIDEO_TITLE_GAP + VIDEO_TITLE_HEIGHT / 2;

    cardNode.setPosition(centerX, centerY, 0);
    cardNode.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
    const bgNode = cardNode.getChildByName(VIDEO_CARD_BG_NODE_NAME);
    bgNode?.setPosition(0, 0, 0);
    bgNode?.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
    const bgGraphics = bgNode?.getComponent(Graphics);
    if (bgGraphics) {
      this.drawSectionCard(bgGraphics, cardWidth, cardHeight, 'video');
    }

    const viewNode = cardNode.getChildByName('view');
    viewNode?.setSiblingIndex(1);
    viewNode?.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
    viewNode?.setPosition(0, 0, 0);
    const contentNode = viewNode?.getChildByName('content');
    const contentTransform = contentNode?.getComponent(UITransform);
    const pageNodes = Array.from(this.remoteVideoNodes.values());
    const pageCount = Math.max(1, pageNodes.length);
    const totalWidth = cardWidth * pageCount;
    contentTransform?.setAnchorPoint(0, 0.5);
    contentTransform?.setContentSize(totalWidth, cardHeight);
    contentNode?.setPosition(-cardWidth / 2, 0, 0);

    pageNodes.forEach((pageNode, index) => {
      pageNode.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
      pageNode.setPosition(cardWidth * index + cardWidth / 2, 0, 0);
      const videoNode = pageNode.getChildByName(REMOTE_TEXTURE_NODE_NAME);
      videoNode?.setPosition(0, 0, 0);
      videoNode?.getComponent(UITransform)?.setContentSize(videoWidth, videoHeight);

      const titleNode = pageNode.getChildByName(REMOTE_TITLE_NODE_NAME);
      titleNode?.setPosition(0, titleYOffset, 0);
      titleNode?.getComponent(UITransform)?.setContentSize(cardWidth, VIDEO_TITLE_HEIGHT);

      const hintNode = pageNode.getChildByName(REMOTE_HINT_NODE_NAME);
      const hintWidth = Math.max(80, cardWidth - 16);
      const hintHeight = Math.max(36, Math.min(72, cardHeight - 8));
      hintNode?.setPosition(0, 0, 0);
      hintNode?.getComponent(UITransform)?.setContentSize(hintWidth, hintHeight);
      const hintLabel = hintNode?.getComponent(Label);
      if (hintLabel) {
        hintLabel.fontSize = Math.min(16, Math.max(12, Math.floor(videoHeight * 0.08)));
        hintLabel.lineHeight = hintLabel.fontSize + 4;
        hintLabel.node.getComponent(UITransform)?.setContentSize(hintWidth, hintHeight);
      }
    });
  }

  private async refreshRemoteVideoSurface(uid: number) {
    if (!this.client || !this.remoteVideoNodes.has(uid)) {
      return;
    }
    try {
      await this.client.setupRemoteVideoView(uid, this.getRemoteVideoRectForUid(uid));
    } catch (error) {
      console.error('[agora-rtc] remote video attach failed', uid, error);
      return;
    }
    if (this.renderBackend === 'engine-texture') {
      const slotId = this.remoteTextureSlotIds.get(uid);
      if (slotId !== undefined) {
        this.bindNativeTextureSprite('remote', slotId, uid);
        this.syncEngineTextureSpriteNodes();
      }
    }
  }

  private async refreshActiveRemoteVideoSurface() {
    if (this.activeRemoteUid === null) {
      return;
    }
    await this.refreshRemoteVideoSurface(this.activeRemoteUid);
  }

  private refreshAllRemoteVideoSurfaces() {
    for (const uid of this.remoteUserUids) {
      void this.refreshRemoteVideoSurface(uid);
    }
    if (this.localViewAttached && this.renderBackend === 'engine-texture' && this.localTextureSlotId !== null) {
      this.bindNativeTextureSprite('local', this.localTextureSlotId);
    }
  }

  private raiseVideoChrome(rightPane: Node | null) {
    if (!rightPane) {
      return;
    }
    const drawOrder = [
      REMOTE_CARD_NODE_NAME,
      LOCAL_CARD_NODE_NAME,
    ];
    drawOrder.forEach((nodeName, index) => {
      const node = rightPane.getChildByName(nodeName);
      if (node) {
        node.setSiblingIndex(index);
      }
    });
  }

  private updateButtonGridLayout(contentWidth: number) {
    const buttonPanel = this.node.getChildByName(QA_LEFT_PANE_NODE_NAME)?.getChildByName(BUTTON_PANEL_NODE_NAME);
    const buttonGrid = this.getScrollViewport(buttonPanel ?? null)?.getChildByName(BUTTON_GRID_NODE_NAME);
    if (!buttonPanel || !buttonGrid) {
      return;
    }

    const columns = BUTTON_COLUMNS;
    const gapX = 10;
    const gapY = QA_GRID_BUTTON_GAP_Y;
    const sectionGap = 12;
    const sectionHeaderHeight = QA_GRID_SECTION_HEADER_HEIGHT;
    const buttonWidth = Math.floor((contentWidth - gapX * (columns - 1) - 16) / columns);
    const buttonHeight = QA_GRID_BUTTON_HEIGHT;
    let totalHeight = 16;

    buttonGrid.children.forEach((sectionNode) => {
      if (!sectionNode.name.startsWith(BUTTON_SECTION_PREFIX)) {
        return;
      }
      const sectionTransform = sectionNode.getComponent(UITransform);
      if (sectionTransform) {
        sectionTransform.setContentSize(contentWidth, sectionHeaderHeight);
      }
      const sectionLabel = sectionNode.getChildByName('__section_title')?.getComponent(Label);
      if (sectionLabel) {
        sectionLabel.fontSize = 15;
        sectionLabel.lineHeight = 18;
        sectionLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
      }
      totalHeight += sectionHeaderHeight + 6;

      const rowNodes = sectionNode.children.filter((child) => child.name.startsWith(BUTTON_ROW_PREFIX));
      rowNodes.forEach((rowNode) => {
        const rowTransform = rowNode.getComponent(UITransform);
        if (rowTransform) {
          rowTransform.setContentSize(contentWidth, buttonHeight);
        }
        rowNode.children.forEach((buttonNode) => {
          const transform = buttonNode.getComponent(UITransform);
          if (!transform) {
            return;
          }
          transform.setContentSize(buttonWidth, buttonHeight);
          const actionName = buttonNode.name.replace('__simple_', '');
          const variant = this.actionResults.get(actionName) === 'fail'
            ? 'danger'
            : this.resolveActionButtonVariant(actionName);
          this.applyAppButtonChrome(buttonNode, buttonWidth, buttonHeight, variant);
          const label = this.actionButtons.get(actionName) ?? this.getAppButtonLabel(buttonNode);
          label.overflow = Label.Overflow.SHRINK;
          label.enableWrapText = false;
          label.fontSize = 13;
          label.lineHeight = 16;
        });
        rowNode.getComponent(Layout)?.updateLayout(true);
        totalHeight += buttonHeight + gapY;
      });
      sectionNode.getComponent(Layout)?.updateLayout(true);
      totalHeight += sectionGap;
    });

    const gridTransform = buttonGrid.getComponent(UITransform);
    if (gridTransform) {
      gridTransform.setContentSize(contentWidth, Math.max(totalHeight, 120));
    }
    buttonGrid.getComponent(Layout)?.updateLayout(true);
    buttonGrid.getComponent(Layout)?.updateLayout(true);
    const panelHeight = buttonPanel.getComponent(UITransform)?.contentSize.height ?? 200;
    const buttonViewport = this.getScrollViewport(buttonPanel);
    const viewportHeight = buttonViewport?.getComponent(UITransform)?.contentSize.height ?? panelHeight;
    buttonGrid.setPosition(0, viewportHeight / 2, 0);
    this.buttonScrollView?.scrollToTop(0, false);
  }

  private updateLeftTextLayout(contentWidth: number, headerScrollHeight: number) {
    const headerScroll = this.getHeaderScrollNode();
    const headerPane = this.getHeaderContentNode();
    const textWidth = Math.max(240, contentWidth);
    const panelWidth = textWidth;

    if (this.configLabel) {
      this.applyWrappingLabel(this.configLabel, textWidth, HEADER_CONFIG_TEXT_HEIGHT);
    }
    const inputsRow = headerPane.getChildByName(CONFIG_INPUTS_NODE_NAME);
    if (inputsRow) {
      inputsRow.getComponent(UITransform)?.setContentSize(textWidth, CONFIG_INPUTS_BLOCK_HEIGHT);
      this.layoutConfigInputsRow(inputsRow, textWidth);
      this.raiseConfigInputChrome(inputsRow);
    }
    headerPane.getChildByName(CONFIG_NODE_NAME)?.getComponent(UITransform)?.setContentSize(textWidth, HEADER_CONFIG_TEXT_HEIGHT);
    headerPane.getChildByName(SETTINGS_PANEL_NODE_NAME)?.getComponent(UITransform)?.setContentSize(
      textWidth,
      SETTINGS_ROWS.length * CONFIG_INPUT_ROW_HEIGHT + 16,
    );

    if (headerScroll) {
      headerScroll.getComponent(UITransform)?.setContentSize(panelWidth, headerScrollHeight);
      this.ensurePanelBorder(headerScroll, panelWidth, headerScrollHeight);
      const headerViewport = this.getHeaderViewport();
      headerViewport?.getComponent(UITransform)?.setContentSize(
        Math.max(40, panelWidth - HEADER_VIEWPORT_INSET * 2),
        Math.max(40, headerScrollHeight - HEADER_VIEWPORT_INSET * 2),
      );
      const viewportHeight = headerViewport?.getComponent(UITransform)?.contentSize.height ?? headerScrollHeight;
      headerPane.setPosition(0, viewportHeight / 2, 0);
    }
    this.updateHeaderScrollLayout(contentWidth);
    const headerContentHeight = headerPane.getComponent(UITransform)?.contentSize.height ?? 0;
    const headerViewport = this.getHeaderViewport();
    if (headerViewport && this.headerScrollView && headerContentHeight > 0) {
      headerPane.getComponent(UITransform)?.setContentSize(textWidth, headerContentHeight);
      const viewportHeight = headerViewport.getComponent(UITransform)?.contentSize.height ?? headerScrollHeight;
      headerPane.setPosition(0, viewportHeight / 2, 0);
      this.headerScrollView.content = headerPane;
      this.headerScrollView.scrollToTop(0, false);
    }
    this.refreshLogPageContent();

    const settingsGrid = headerPane.getChildByName(SETTINGS_PANEL_NODE_NAME)?.getChildByName(SETTINGS_GRID_NODE_NAME);
    if (settingsGrid) {
      const rowWidth = textWidth;
      const nameWidth = 56;
      const valueWidth = Math.max(96, rowWidth - nameWidth - 12);
      settingsGrid.getComponent(UITransform)?.setContentSize(rowWidth, SETTINGS_ROWS.length * 30 + 8);
      settingsGrid.children.forEach((rowNode) => {
        rowNode.getComponent(UITransform)?.setContentSize(rowWidth, 30);
        const nameNode = rowNode.getChildByName('__label');
        const valueNode = rowNode.getChildByName('__value');
        nameNode?.setPosition(-rowWidth / 2 + nameWidth / 2 + 4, 0, 0);
        nameNode?.getComponent(UITransform)?.setContentSize(nameWidth, 30);
        valueNode?.setPosition(rowWidth / 2 - valueWidth / 2 - 4, 0, 0);
        valueNode?.getComponent(UITransform)?.setContentSize(valueWidth, 30);
        const valueLabel = valueNode?.getComponent(Label);
        if (valueLabel) {
          valueLabel.overflow = Label.Overflow.SHRINK;
          valueLabel.horizontalAlign = HorizontalTextAlignment.RIGHT;
        }
        if (valueNode) {
          this.applyAppButtonChrome(valueNode, valueWidth, 30, 'settingsPill');
          const chevron = valueNode.getChildByName('__chevron');
          chevron?.setPosition(valueWidth / 2 - 10, 0, 0);
        }
      });
    }

    const buttonPanel = this.getLeftPane()?.getChildByName(BUTTON_PANEL_NODE_NAME);
    if (buttonPanel) {
      const panelHeight = buttonPanel.getComponent(UITransform)?.contentSize.height ?? 200;
      const scrollAreaHeight = Math.max(80, panelHeight - SESSION_QUICK_BAR_HEIGHT - 10);
      this.ensureSessionQuickBar(buttonPanel, panelWidth);
      this.ensureScrollViewport(buttonPanel, panelWidth, scrollAreaHeight, { panelHeight });
      this.layoutButtonPanelInternals(buttonPanel, panelWidth, panelHeight);
    }
  }

  private ensureVideoSprites() {
    const localNode = this.ensureVideoSpriteNode(LOCAL_CARD_NODE_NAME, LOCAL_TEXTURE_NODE_NAME, 0, 0, 220, 124);
    this.localVideoSprite = localNode.getComponent(Sprite) ?? localNode.addComponent(Sprite);
    this.localVideoSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.localVideoSprite.node.active = false;
  }

  private ensureVideoSpriteNode(cardName: string, name: string, x: number, y: number, width: number, height: number): Node {
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME) ?? this.node;
    const cardNode = rightPane.getChildByName(cardName) ?? rightPane;
    let spriteNode = cardNode.getChildByName(name);
    if (!spriteNode) {
      spriteNode = new Node(name);
      spriteNode.setParent(cardNode);
    }
    spriteNode.layer = this.node.layer;
    spriteNode.active = true;
    spriteNode.setPosition(0, 0, 0);
    const transform = spriteNode.getComponent(UITransform) ?? spriteNode.addComponent(UITransform);
    transform.setContentSize(width, height);
    return spriteNode;
  }

  private resolveStatusY(): number {
    return -600;
  }

  private layoutConsole() {
    const visibleSize = view.getVisibleSize();
    const halfWidth = visibleSize.width / 2;
    const halfHeight = visibleSize.height / 2;
    const isLandscape = visibleSize.width >= visibleSize.height;
    const useLandscapeNative =
      isLandscape && (sys.os === sys.OS.IOS || sys.os === sys.OS.ANDROID);
    const useLandscapeSplitVideo = useLandscapeNative;
    const useSplitTextureLayout =
      this.renderBackend === 'engine-texture'
      && (sys.os === sys.OS.IOS || sys.os === sys.OS.ANDROID);

    const titleNode = this.node.getChildByName(TITLE_NODE_NAME);
    const leftPane = this.node.getChildByName(QA_LEFT_PANE_NODE_NAME);
    const rightPane = this.node.getChildByName(QA_RIGHT_PANE_NODE_NAME);
    const headerPane = this.getHeaderContentNode();
    const buttonPanel = leftPane?.getChildByName(BUTTON_PANEL_NODE_NAME) ?? null;
    const buttonGrid = this.getScrollViewport(buttonPanel ?? null)?.getChildByName(BUTTON_GRID_NODE_NAME) ?? null;
    const remoteCard = rightPane?.getChildByName(REMOTE_CARD_NODE_NAME) ?? null;
    const localCard = rightPane?.getChildByName(LOCAL_CARD_NODE_NAME) ?? null;
    const localNode = localCard?.getChildByName(LOCAL_TEXTURE_NODE_NAME) ?? null;
    const localHintNode = localCard?.getChildByName(LOCAL_HINT_NODE_NAME) ?? null;
    const localTitleNode = localCard?.getChildByName(LOCAL_TITLE_NODE_NAME) ?? null;

    const titleY = halfHeight - 40;
    titleNode?.setPosition(0, titleY, 0);
    titleNode?.getComponent(UITransform)?.setContentSize(Math.min(visibleSize.width - 140, 760), 48);

    if (isLandscape) {
      const edge = QA_SCREEN_EDGE_PAD;
      const edgeLeft = QA_SCREEN_EDGE_LEFT_PAD;
      const paneGap = QA_PANE_GAP;
      const availableWidth = visibleSize.width - edgeLeft - edge - paneGap;
      let leftWidth = Math.min(
        QA_LANDSCAPE_LEFT_MAX_WIDTH,
        Math.max(QA_LANDSCAPE_LEFT_MIN_WIDTH, Math.floor(visibleSize.width * QA_LANDSCAPE_LEFT_WIDTH_RATIO)),
      );
      let rightWidth = availableWidth - leftWidth;
      if (rightWidth < QA_LANDSCAPE_RIGHT_MIN_WIDTH) {
        rightWidth = QA_LANDSCAPE_RIGHT_MIN_WIDTH;
        leftWidth = Math.max(QA_LANDSCAPE_LEFT_MIN_WIDTH, availableWidth - rightWidth);
      }
      const leftCenterX = -halfWidth + edgeLeft + leftWidth / 2;
      const rightCenterX = leftCenterX + leftWidth / 2 + paneGap + rightWidth / 2;
      const paneHeight = visibleSize.height - edge * 2;
      const panelInnerWidth = leftWidth - QA_PANE_HORIZONTAL_INSET;
      const contentWidth = panelInnerWidth - QA_CONTENT_HORIZONTAL_INSET;
      const headerContentHeight = this.measureHeaderContentHeight(contentWidth);
      const headerScrollHeight = this.resolveHeaderScrollHeight(paneHeight, headerContentHeight);
      const buttonHeight = Math.max(
        140,
        paneHeight - headerScrollHeight - LEFT_SECTION_GAP,
      );
      const headerScrollNode = leftPane?.getChildByName(HEADER_SCROLL_NODE_NAME) ?? null;

      leftPane?.setPosition(leftCenterX, 0, 0);
      leftPane?.getComponent(UITransform)?.setContentSize(leftWidth, paneHeight);
      headerScrollNode?.getComponent(UITransform)?.setContentSize(panelInnerWidth, headerScrollHeight);
      rightPane?.setPosition(rightCenterX, 0, 0);
      rightPane?.getComponent(UITransform)?.setContentSize(rightWidth, paneHeight);

      buttonPanel?.getComponent(UITransform)?.setContentSize(panelInnerWidth, buttonHeight);
      this.ensurePanelBorder(buttonPanel!, panelInnerWidth, buttonHeight);

      this.updateLeftTextLayout(contentWidth, headerScrollHeight);
      this.updateButtonGridLayout(contentWidth);
      this.reorderLeftPaneChildren(leftPane);
      this.layoutLeftPaneStack(leftPane!, paneHeight, headerScrollHeight, buttonHeight);
      this.layoutButtonPanelInternals(buttonPanel!, panelInnerWidth, buttonHeight);

      if (useLandscapeSplitVideo) {
        this.layoutSplitVideoStack(
          rightWidth,
          paneHeight,
          remoteCard,
          localCard,
          localNode,
          localTitleNode,
          localHintNode,
        );
      } else {
        const videoWidth = rightWidth - VIDEO_EDGE_PAD * 2;
        const videoHeight = Math.floor(videoWidth * 9 / 16);
        const videoCenterX = -rightWidth / 2 + VIDEO_EDGE_PAD + VIDEO_PANE_LEFT_INSET + videoWidth / 2;
        const remoteY = paneHeight / 2 - VIDEO_EDGE_PAD - videoHeight / 2 - VIDEO_TITLE_HEIGHT;
        this.layoutRemotePageView(
          rightPane?.getChildByName(REMOTE_CARD_NODE_NAME) ?? null,
          videoCenterX,
          remoteY,
          videoWidth,
          videoHeight,
        );
        const localWidth = Math.min(300, videoWidth * 0.45);
        const localHeight = Math.floor(localWidth * 9 / 16);
        const localCenterX = -rightWidth / 2 + VIDEO_EDGE_PAD + VIDEO_PANE_LEFT_INSET + localWidth / 2;
        const localY = -paneHeight / 2 + VIDEO_EDGE_PAD + localHeight / 2 + VIDEO_TITLE_HEIGHT;
        this.positionVideoFrame(
          rightPane?.getChildByName(LOCAL_CARD_NODE_NAME) ?? null,
          localNode,
          localTitleNode,
          localHintNode,
          localCenterX,
          localY,
          localWidth,
          localHeight,
        );
        this.syncEngineTextureSpriteNodes();
      }
      [REMOTE_CARD_NODE_NAME, LOCAL_CARD_NODE_NAME].forEach((cardName) => {
        const card = rightPane?.getChildByName(cardName);
        const transform = card?.getComponent(UITransform);
        const graphics = card?.getComponent(Graphics);
        if (transform && graphics) {
          this.drawSectionCard(graphics, transform.contentSize.width, transform.contentSize.height, 'video');
        }
      });
      this.raiseVideoChrome(rightPane);
      this.getHeaderContentNode().getComponent(Layout)?.updateLayout(true);
      buttonGrid?.getComponent(Layout)?.updateLayout(true);
      this.buttonScrollView?.scrollToTop(0, false);
      this.syncEngineTextureSpriteNodes();
    } else {
      const edge = QA_SCREEN_EDGE_PAD;
      const paneWidth = visibleSize.width - edge * 2;
      const paneHeight = visibleSize.height - edge * 2;
      const leftHeight = Math.floor(paneHeight * 0.5);
      const contentWidth = paneWidth - QA_CONTENT_HORIZONTAL_INSET;
      const headerContentHeight = this.measureHeaderContentHeight(contentWidth);
      const headerScrollHeight = this.resolveHeaderScrollHeight(leftHeight, headerContentHeight);
      const buttonHeight = Math.max(
        140,
        leftHeight - headerScrollHeight - LEFT_SECTION_GAP,
      );
      const headerScrollNode = leftPane?.getChildByName(HEADER_SCROLL_NODE_NAME) ?? null;
      const rightWidth = paneWidth;
      const rightHeight = paneHeight - leftHeight - QA_PANE_GAP;

      leftPane?.setPosition(0, -paneHeight / 2 + leftHeight / 2, 0);
      leftPane?.getComponent(UITransform)?.setContentSize(paneWidth, leftHeight);
      headerScrollNode?.getComponent(UITransform)?.setContentSize(paneWidth - QA_PANE_HORIZONTAL_INSET, headerScrollHeight);
      rightPane?.setPosition(0, paneHeight / 2 - rightHeight / 2, 0);
      rightPane?.getComponent(UITransform)?.setContentSize(rightWidth, rightHeight);

      buttonPanel?.getComponent(UITransform)?.setContentSize(paneWidth - QA_PANE_HORIZONTAL_INSET, buttonHeight);
      this.ensurePanelBorder(buttonPanel!, paneWidth - QA_PANE_HORIZONTAL_INSET, buttonHeight);

      this.updateLeftTextLayout(contentWidth, headerScrollHeight);
      this.updateButtonGridLayout(contentWidth);
      this.reorderLeftPaneChildren(leftPane);
      this.layoutLeftPaneStack(leftPane!, leftHeight, headerScrollHeight, buttonHeight);
      this.layoutButtonPanelInternals(buttonPanel!, paneWidth - QA_PANE_HORIZONTAL_INSET, buttonHeight);

      if (useSplitTextureLayout) {
        this.layoutSplitVideoStack(
          rightWidth,
          rightHeight,
          remoteCard,
          localCard,
          localNode,
          localTitleNode,
          localHintNode,
        );
      } else {
        const videoWidth = rightWidth - VIDEO_EDGE_PAD * 2;
        const videoHeight = Math.floor(videoWidth * 9 / 16);
        const videoCenterX = -rightWidth / 2 + VIDEO_EDGE_PAD + VIDEO_PANE_LEFT_INSET + videoWidth / 2;
        const remoteY = rightHeight / 2 - VIDEO_EDGE_PAD - videoHeight / 2 - VIDEO_TITLE_HEIGHT;
        this.layoutRemotePageView(
          rightPane?.getChildByName(REMOTE_CARD_NODE_NAME) ?? null,
          videoCenterX,
          remoteY,
          videoWidth,
          videoHeight,
        );
        const localWidth = Math.min(320, videoWidth * 0.45);
        const localHeight = Math.floor(localWidth * 9 / 16);
        const localCenterX = -rightWidth / 2 + VIDEO_EDGE_PAD + VIDEO_PANE_LEFT_INSET + localWidth / 2;
        const localY = -rightHeight / 2 + VIDEO_EDGE_PAD + localHeight / 2 + VIDEO_TITLE_HEIGHT;
        this.positionVideoFrame(
          rightPane?.getChildByName(LOCAL_CARD_NODE_NAME) ?? null,
          localNode,
          localTitleNode,
          localHintNode,
          localCenterX,
          localY,
          localWidth,
          localHeight,
        );
      }
      [REMOTE_CARD_NODE_NAME, LOCAL_CARD_NODE_NAME].forEach((cardName) => {
        const card = rightPane?.getChildByName(cardName);
        const transform = card?.getComponent(UITransform);
        const graphics = card?.getComponent(Graphics);
        if (transform && graphics) {
          this.drawSectionCard(graphics, transform.contentSize.width, transform.contentSize.height, 'video');
        }
      });
      this.raiseVideoChrome(rightPane);
      this.getHeaderContentNode().getComponent(Layout)?.updateLayout(true);
      buttonGrid?.getComponent(Layout)?.updateLayout(true);
      this.buttonScrollView?.scrollToTop(0, false);
      this.syncEngineTextureSpriteNodes();
    }

    this.syncEditBoxPresentation(this.channelInput);
    this.syncEditBoxPresentation(this.uidInput);
    this.ensureConfigLogButton();
    this.ensureLogFloatButton();
    if (this.logPageVisible) {
      this.layoutStatusLogPage();
      this.syncMainHudForLogPageOverlay();
    } else {
      this.layoutLogFloatButton();
      if (this.renderBackend === 'engine-texture') {
        this.restoreEngineTextureSpritesAfterLogPage();
      }
    }
  }

  private resizeCanvasToVisibleArea() {
    const visibleSize = view.getVisibleSize();
    const transform = this.node.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(visibleSize.width, visibleSize.height);
    }
    this.node.setPosition(visibleSize.width / 2, visibleSize.height / 2, 0);
    this.layoutConsole();
    if (this.logPageVisible) {
      this.layoutStatusLogPage();
    }
    console.log('[agora-rtc] canvas resized to', visibleSize.width, visibleSize.height);
  }

  private refreshVideoHints() {
    const hideLocalHint =
      this.renderBackend === 'engine-texture' && this.localVideoSprite?.node.active === true;
    
    this.remoteVideoSprites.forEach((sprite, uid) => {
      const hideRemoteHint = this.renderBackend === 'engine-texture' && sprite.node.active === true;
      const hintLabel = this.remoteHintLabels.get(uid);
      if (hintLabel) {
        hintLabel.node.active = !hideRemoteHint;
      }
    });

    if (this.localHintLabel) {
      this.localHintLabel.string = this.localViewAttached
        ? 'Local\npreview active'
        : 'Local\npreview area';
      this.localHintLabel.node.active = !hideLocalHint;
    }
  }

  private refreshConfigLabel() {
    if (!this.configLabel) {
      return;
    }
    this.configLabel.string = [
      `App ${this.maskAppId(this.appId)}  ·  Token ${this.token ? '已配置' : '未配置'}`,
      `渲染 ${this.renderBackend}`,
      this.logUiHudLine,
    ].join('\n');
    this.configLabel.enableWrapText = true;
    this.configLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
  }

  private refreshSummary() {
    if (!this.summaryLabel) {
      return;
    }
    this.summaryLabel.string = [
      `Init ${this.initialized ? 'Y' : 'N'} · Join ${this.joined ? 'Y' : 'N'} · Remote ${this.activeRemoteUid ?? '-'}`,
      `Backend ${this.renderBackend} · Err ${this.lastErrorMessage}`,
    ].join('\n');
    this.summaryLabel.fontSize = 15;
    this.summaryLabel.lineHeight = 18;
    this.summaryLabel.enableWrapText = true;
    this.summaryLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
  }

  private syncMainHudForLogPageOverlay() {
    const hide = this.logPageVisible && (this.logPageNode?.active ?? false);
    if (this.summaryLabel?.node) {
      this.summaryLabel.node.active = !hide;
    }
    if (this.logPageVisible) {
      this.logPageNode?.setSiblingIndex(this.node.children.length - 1);
    }
  }

  private refreshSettingsPanel() {
    const backendLabel = this.settingsValueLabels.get('Backend');
    if (backendLabel) {
      backendLabel.string = this.renderBackend;
    }
    this.settingsValueLabels.get('Profile')!.string = this.selectedChannelProfile;
    this.settingsValueLabels.get('Role')!.string = this.selectedClientRole;
    this.settingsValueLabels.get('Encoder')!.string =
      VIDEO_ENCODER_PRESETS[this.selectedVideoEncoderPresetIndex].name;
    if (this.channelInput) {
      this.channelInput.string = this.channelId;
    }
    if (this.uidInput) {
      this.uidInput.string = String(this.uid);
    }
  }

  private refreshButtonLabels() {
    this.setButtonLabel(
      'Mic',
      this.localAudioEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('Mic', this.localAudioEnabled),
    );
    this.setButtonLabel(
      'Cam',
      this.localVideoEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('Cam', this.localVideoEnabled),
    );
    this.setButtonLabel(
      'Preview',
      this.previewStarted ? '关闭' : '开启',
      this.resolveToggleButtonVariant('Preview', this.previewStarted),
    );
    this.setButtonLabel(
      'Speaker',
      this.speakerphoneEnabled === null
        ? '未知'
        : (this.speakerphoneEnabled ? '开' : '关'),
      this.speakerphoneEnabled === null
        ? 'ghost'
        : this.resolveToggleButtonVariant('Speaker', this.speakerphoneEnabled),
    );
    this.setButtonLabel(
      'Freeze',
      this.statusFrozen ? '已冻结' : '未冻结',
      this.resolveToggleButtonVariant('Freeze', this.statusFrozen),
    );

    // 17 APIs Refresh Labels
    this.setButtonLabel(
      'EnableAudio',
      this.audioEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('EnableAudio', this.audioEnabled),
    );
    this.setButtonLabel(
      'EnableLocalAudio',
      this.localAudioEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('EnableLocalAudio', this.localAudioEnabled),
    );
    this.setButtonLabel(
      'MuteLocalAudio',
      this.localAudioMuted ? '已静' : '未静',
      this.resolveToggleButtonVariant('MuteLocalAudio', this.localAudioMuted),
    );
    this.setButtonLabel(
      'MuteRemoteAudio',
      this.remoteAudioMuted ? '已静' : '未静',
      this.resolveToggleButtonVariant('MuteRemoteAudio', this.remoteAudioMuted),
    );
    this.setButtonLabel(
      'MuteAllRemoteAudio',
      this.allRemoteAudioMuted ? '已静' : '未静',
      this.resolveToggleButtonVariant('MuteAllRemoteAudio', this.allRemoteAudioMuted),
    );
    this.setButtonLabel(
      'AudioVolumeIndication',
      this.audioVolumeIndicationEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('AudioVolumeIndication', this.audioVolumeIndicationEnabled),
    );
    this.setButtonLabel(
      'DefaultAudioRoute',
      this.defaultAudioRouteToSpeakerphone ? '喇叭' : '听筒',
      this.resolveToggleButtonVariant('DefaultAudioRoute', this.defaultAudioRouteToSpeakerphone),
    );
    this.setButtonLabel(
      'PlaybackVolume',
      `${this.playbackVolume}`,
      this.playbackVolume === 100 ? 'secondary' : 'toggleOn',
    );
    this.setButtonLabel(
      'AudioProfile',
      this.currentAudioProfile === 0 ? '默认' : '语音',
      this.resolveToggleButtonVariant('AudioProfile', this.currentAudioProfile !== 0),
    );

    this.setButtonLabel(
      'EnableVideo',
      this.videoEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('EnableVideo', this.videoEnabled),
    );
    this.setButtonLabel(
      'MuteLocalVideo',
      this.localVideoMuted ? '已禁' : '未禁',
      this.resolveToggleButtonVariant('MuteLocalVideo', this.localVideoMuted),
    );
    this.setButtonLabel(
      'MuteRemoteVideo',
      this.remoteVideoMuted ? '已禁' : '未禁',
      this.resolveToggleButtonVariant('MuteRemoteVideo', this.remoteVideoMuted),
    );
    this.setButtonLabel(
      'MuteAllRemoteVideo',
      this.allRemoteVideoMuted ? '已禁' : '未禁',
      this.resolveToggleButtonVariant('MuteAllRemoteVideo', this.allRemoteVideoMuted),
    );
    this.setButtonLabel(
      'BeautyEffect',
      this.beautyEffectEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('BeautyEffect', this.beautyEffectEnabled),
    );
    this.setButtonLabel(
      'ContentInspect',
      this.contentInspectEnabled ? '开' : '关',
      this.resolveToggleButtonVariant('ContentInspect', this.contentInspectEnabled),
    );
    this.setButtonLabel(
      'PlaybackUserVolume',
      `${this.userPlaybackVolume}`,
      this.userPlaybackVolume === 100 ? 'secondary' : 'toggleOn',
    );

    this.refreshSettingsPanel();

    const logFloatNode = this.logFloatButtonNode ?? this.node.getChildByName(LOG_FLOAT_BTN_NODE_NAME);
    if (logFloatNode) {
      const label = this.getAppButtonLabel(logFloatNode);
      if (label) {
        label.string = this.statusLines.length > 0 ? `日志 ${this.statusLines.length}` : '全部日志';
      }
    }
  }

  private setButtonLabel(name: string, text: string, variant?: AppButtonVariant) {
    const buttonNode = this.buttonNodes.get(name);
    const label = this.actionButtons.get(name);
    if (!buttonNode || !label) {
      return;
    }
    const result = this.actionResults.get(name) ?? 'idle';
    const base = ACTION_LABEL_ZH[name] ?? name;
    const suffix = result === 'ok' ? ' ✓' : result === 'fail' ? ' ✗' : '';
    const display = [
      'Mic', 'Cam', 'Speaker', 'Preview', 'Freeze',
      'EnableAudio', 'EnableLocalAudio', 'MuteLocalAudio', 'MuteRemoteAudio', 'MuteAllRemoteAudio',
      'AudioVolumeIndication', 'DefaultAudioRoute', 'PlaybackVolume', 'AudioProfile',
      'EnableVideo', 'MuteLocalVideo', 'MuteRemoteVideo', 'MuteAllRemoteVideo',
      'BeautyEffect', 'ContentInspect', 'PlaybackUserVolume'
    ].includes(name)
      ? `${base} ${text}`
      : `${base}${suffix}`;
    let resolvedVariant = variant ?? this.resolveActionButtonVariant(name);
    if (result === 'fail') {
      resolvedVariant = 'danger';
    } else if (result === 'ok' && resolvedVariant === 'secondary') {
      resolvedVariant = 'toggleOn';
    }
    label.string = display;
    const transform = buttonNode.getComponent(UITransform);
    if (transform) {
      this.applyAppButtonChrome(
        buttonNode,
        transform.contentSize.width,
        transform.contentSize.height,
        resolvedVariant,
      );
    }
  }

  private setActionResult(name: string, result: 'ok' | 'fail' | 'idle') {
    this.actionResults.set(name, result);
    this.refreshButtonLabels();
  }

  private maskAppId(appId: string): string {
    if (!appId) {
      return '-';
    }
    if (appId.length <= 10) {
      return appId;
    }
    return `${appId.slice(0, 6)}...${appId.slice(-4)}`;
  }

  private pushStatus(message: string) {
    if (this.statusFrozen) {
      this.refreshSummary();
      this.refreshButtonLabels();
      return;
    }
    const now = new Date();
    const timestamp = [
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0'),
    ].join(':');
    const line = `[${timestamp}] ${message}`;
    this.statusLines = [...this.statusLines, line].slice(-MAX_LOG_LINES);
    this.refreshLogPageContent();
    this.refreshSummary();
    this.refreshButtonLabels();
  }

  private bindNativeTextureSprite(kind: 'local' | 'remote', slotId: number, uid?: number) {
    if (this.renderBackend !== 'engine-texture') {
      console.log('[agora-rtc] bind skip backend', kind, slotId, this.renderBackend);
      return;
    }

    const nativeReady = this.client?.isEngineTextureReady(slotId) ?? false;
    const texture = this.client?.getEngineTexture(slotId) as Texture2D | null;
    if (!texture) {
      console.log('[agora-rtc] bind skip no texture', kind, slotId, 'ready=', nativeReady);
      this.scheduleOnce(() => {
        this.bindNativeTextureSprite(kind, slotId, uid);
      }, 0.05);
      return;
    }
    if (!nativeReady) {
      console.log('[agora-rtc] bind proceed without ready', kind, slotId);
    }

    let targetSprite: Sprite | null = null;
    if (kind === 'local') {
      targetSprite = this.localVideoSprite;
      this.localVideoTexture = texture;
      this.localTextureSlotId = slotId;
    } else if (uid !== undefined) {
      targetSprite = this.remoteVideoSprites.get(uid) ?? null;
      this.remoteVideoTextures.set(uid, texture);
      this.remoteTextureSlotIds.set(uid, slotId);
    }

    if (!targetSprite) {
      console.log('[agora-rtc] bind skip missing sprite', kind, slotId, uid);
      return;
    }

    console.log(
      '[agora-rtc] bind native texture sprite',
      kind,
      slotId,
      uid,
      (texture as any)?.width ?? 'unknown',
      (texture as any)?.height ?? 'unknown',
      targetSprite.node.active,
    );
    texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    texture.setMipFilter(Texture2D.Filter.NONE);
    texture.setWrapMode(
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
    );

    let spriteFrame: SpriteFrame | null = null;
    if (kind === 'local') {
      spriteFrame = this.localVideoSpriteFrame;
      if (!spriteFrame) {
        spriteFrame = new SpriteFrame();
        this.localVideoSpriteFrame = spriteFrame;
      }
    } else if (uid !== undefined) {
      spriteFrame = this.remoteVideoSpriteFrames.get(uid) ?? null;
      if (!spriteFrame) {
        spriteFrame = new SpriteFrame();
        this.remoteVideoSpriteFrames.set(uid, spriteFrame);
      }
    }

    if (spriteFrame) {
      spriteFrame.texture = texture;
      targetSprite.spriteFrame = spriteFrame;
      targetSprite.node.active = true;
    }

    console.log(
      '[agora-rtc] bind applied',
      kind,
      slotId,
      uid,
      targetSprite.node.active,
      targetSprite.node.name,
    );
    this.pushStatus(`Bound ${kind} engine texture slot ${slotId}`);
    this.refreshVideoHints();
    this.refreshSummary();
    this.syncEngineTextureSpriteNodes();
  }

  private clearNativeTextureSprite(kind: 'local' | 'remote', slotId: number) {
    if (kind === 'local') {
      if (this.localTextureSlotId !== slotId) return;
      this.localTextureSlotId = null;
      this.localVideoTexture = null;
      if (this.localVideoSprite) {
        this.localVideoSprite.node.active = false;
        this.localVideoSprite.spriteFrame = null;
      }
    } else {
      for (const [uid, storedSlotId] of this.remoteTextureSlotIds.entries()) {
        if (storedSlotId === slotId) {
          this.remoteTextureSlotIds.delete(uid);
          this.remoteVideoTextures.delete(uid);
          const targetSprite = this.remoteVideoSprites.get(uid);
          if (targetSprite) {
            targetSprite.node.active = false;
            targetSprite.spriteFrame = null;
          }
          break;
        }
      }
    }
    this.refreshVideoHints();
    this.refreshSummary();
  }

  async initializeRtc() {
    this.setActionResult('Initialize', 'idle');
    if (this.initialized) {
      this.pushStatus('RTC engine already initialized');
      this.setActionResult('Initialize', 'ok');
      return;
    }

    if (!this.appId.trim()) {
      throw new Error('App ID is required.');
    }

    const client = this.getClient();
    await client.setRenderBackend(this.renderBackend);
    await client.initialize(this.appId);
    await client.setChannelProfile(this.selectedChannelProfile);
    await client.setClientRole(this.selectedClientRole);
    await client.setVideoEncoderConfiguration(VIDEO_ENCODER_PRESETS[this.selectedVideoEncoderPresetIndex]);
    this.initialized = true;
    this.audioEnabled = true;
    this.localAudioEnabled = true;
    this.localVideoEnabled = true;
    this.videoEnabled = true;
    await client.enableVideo(true);
    await client.enableLocalVideo(true);
    await client.setupLocalVideoView(this.getLocalVideoRect());
    this.localViewAttached = true;
    if (!this.previewStarted) {
      await client.startPreview();
      this.previewStarted = true;
    }
    this.refreshVideoHints();
    this.refreshSummary();
    this.pushStatus('Initialize request sent');
    this.setActionResult('Initialize', 'ok');
  }

  async joinRtcChannel() {
    this.setActionResult('Join', 'idle');
    if (!this.channelId.trim()) {
      this.setActionResult('Join', 'fail');
      throw new Error('Channel ID is required.');
    }

    if (!this.initialized) {
      await this.initializeRtc();
    }

    await this.getClient().joinChannel(this.token, this.channelId, this.uid);
    this.pushStatus(`Join request sent: ${this.channelId}`);
    this.setActionResult('Join', 'ok');
  }

  async leaveRtcChannel() {
    this.setActionResult('Leave', 'idle');
    if (!this.client) {
      this.pushStatus('Channel is not active');
      this.setActionResult('Leave', 'ok');
      return;
    }

    await this.client.leaveChannel();
    if (this.remoteViewAttachedUid !== null) {
      await this.client.removeRemoteVideoView(this.remoteViewAttachedUid);
      this.remoteViewAttachedUid = null;
    }
    this.remoteUserUids.clear();
    this.activeRemoteUid = null;
    this.joined = false;
    this.pushStatus('Leave request sent');
    this.refreshVideoHints();
    this.refreshSummary();
    this.setActionResult('Leave', 'ok');
  }

  async setLocalAudioEnabled(enabled: boolean) {
    await this.getClient().enableLocalAudio(enabled);
    this.localAudioEnabled = enabled;
    this.refreshSummary();
  }

  async setLocalVideoEnabled(enabled: boolean) {
    const client = this.getClient();
    await client.enableLocalVideo(enabled);
    this.localVideoEnabled = enabled;
    if (!enabled) {
      await client.removeLocalVideoView();
      this.localViewAttached = false;
      if (this.localVideoSprite) {
        this.localVideoSprite.node.active = false;
        this.localVideoSprite.spriteFrame = null;
      }
    } else {
      await client.setupLocalVideoView(this.getLocalVideoRect());
      this.localViewAttached = true;
      if (this.previewStarted) {
        await client.startPreview();
      }
    }
    this.refreshVideoHints();
    this.refreshSummary();
  }

  async cycleRenderBackend() {
    const backends: Array<'surface-view' | 'texture-view' | 'engine-texture'> = [
      'surface-view',
      'texture-view',
      'engine-texture',
    ];
    const currentIndex = backends.indexOf(this.renderBackend);
    const nextBackend = backends[(currentIndex + 1) % backends.length];
    const shouldReinitialize = this.initialized;
    const shouldRejoin = this.joined;

    await this.teardownRtc();
    this.renderBackend = nextBackend;
    this.refreshConfigLabel();
    this.layoutConsole();
    this.pushStatus(`Backend switched to ${nextBackend}`);

    if (shouldReinitialize) {
      await this.initializeRtc();
      if (shouldRejoin) {
        await this.joinRtcChannel();
      }
    }
  }

  async setSurfaceViewBackend() {
    this.setActionResult('Surface', 'idle');
    await this.switchRenderBackend('surface-view');
    this.setActionResult('Surface', 'ok');
  }

  async setTextureViewBackend() {
    this.setActionResult('Texture', 'idle');
    await this.switchRenderBackend('texture-view');
    this.setActionResult('Texture', 'ok');
  }

  async setEngineTextureBackend() {
    this.setActionResult('EngineTex', 'idle');
    await this.switchRenderBackend('engine-texture');
    this.setActionResult('EngineTex', 'ok');
  }

  private async switchRenderBackend(nextBackend: 'surface-view' | 'texture-view' | 'engine-texture') {
    if (this.renderBackend === nextBackend) {
      this.pushStatus(`Backend already ${nextBackend}`);
      return;
    }
    const shouldReinitialize = this.initialized;
    const shouldRejoin = this.joined;

    await this.teardownRtc();
    this.renderBackend = nextBackend;
    this.refreshConfigLabel();
    this.refreshButtonLabels();
    this.layoutConsole();
    this.pushStatus(`Backend switched to ${nextBackend}`);

    if (shouldReinitialize) {
      await this.initializeRtc();
      if (shouldRejoin) {
        await this.joinRtcChannel();
      }
    }
  }

  async cycleRenderBackendSetting() {
    await this.cycleRenderBackend();
  }

  async applyConfigInputs() {
    const nextChannel = this.channelInput?.string.trim() || this.channelId;
    const nextUid = Number.parseInt(this.uidInput?.string.trim() || `${this.uid}`, 10);
    this.channelId = nextChannel;
    if (Number.isFinite(nextUid) && nextUid > 0) {
      this.uid = nextUid;
    }
    this.refreshConfigLabel();
    this.refreshSettingsPanel();
    this.pushStatus(`Applied config: ${this.channelId} / ${this.uid}`);
  }

  applyConfigInputsSilent() {
    const nextChannel = this.channelInput?.string.trim() || this.channelId;
    const nextUid = Number.parseInt(this.uidInput?.string.trim() || `${this.uid}`, 10);
    this.channelId = nextChannel;
    if (Number.isFinite(nextUid) && nextUid > 0) {
      this.uid = nextUid;
    }
    this.refreshConfigLabel();
    this.refreshSettingsPanel();
  }

  private applyEffectiveRenderBackend(nextBackend: 'surface-view' | 'texture-view' | 'engine-texture') {
    if (this.renderBackend === nextBackend) {
      this.refreshConfigLabel();
      this.refreshButtonLabels();
      this.layoutConsole();
      this.refreshSummary();
      return;
    }

    this.renderBackend = nextBackend;
    this.refreshConfigLabel();
    this.refreshButtonLabels();
    this.layoutConsole();
    this.refreshSummary();
  }

  async togglePreview() {
    this.setActionResult('Preview', 'idle');
    if (!this.initialized) {
      await this.initializeRtc();
      this.setActionResult('Preview', 'ok');
      return;
    }

    const client = this.getClient();
    if (this.previewStarted) {
      await client.stopPreview();
      this.previewStarted = false;
      this.pushStatus('Preview stopped');
    } else {
      if (!this.localVideoEnabled) {
        await this.setLocalVideoEnabled(true);
      }
      await client.startPreview();
      this.previewStarted = true;
      this.pushStatus('Preview started');
    }
    this.refreshSummary();
    this.refreshButtonLabels();
    this.setActionResult('Preview', 'ok');
  }

  async toggleLocalAudio() {
    this.setActionResult('Mic', 'idle');
    const enabled = !this.localAudioEnabled;
    await this.setLocalAudioEnabled(enabled);
    this.pushStatus(`Local audio ${enabled ? 'enabled' : 'disabled'}`);
    this.refreshButtonLabels();
    this.setActionResult('Mic', 'ok');
  }

  async toggleLocalVideo() {
    this.setActionResult('Cam', 'idle');
    const enabled = !this.localVideoEnabled;
    await this.setLocalVideoEnabled(enabled);
    this.pushStatus(`Local video ${enabled ? 'enabled' : 'disabled'}`);
    this.refreshButtonLabels();
    this.setActionResult('Cam', 'ok');
  }

  async toggleSpeakerphone() {
    this.setActionResult('Speaker', 'idle');
    const client = this.getClient();
    const nextValue = !(this.speakerphoneEnabled ?? false);
    await client.setEnableSpeakerphone(nextValue);
    this.speakerphoneEnabled = nextValue;
    this.pushStatus(`Speakerphone ${nextValue ? 'enabled' : 'disabled'}`);
    this.refreshSummary();
    this.refreshButtonLabels();
    this.setActionResult('Speaker', 'ok');
  }

  async refreshRtcViews() {
    this.setActionResult('Views', 'idle');
    if (!this.initialized) {
      await this.initializeRtc();
      this.setActionResult('Views', 'ok');
      return;
    }

    const client = this.getClient();
    if (this.localViewAttached) {
      await client.removeLocalVideoView();
      this.localViewAttached = false;
    }
    if (this.remoteViewAttachedUid !== null) {
      await client.removeRemoteVideoView(this.remoteViewAttachedUid);
      this.remoteViewAttachedUid = null;
    }

    await client.setupLocalVideoView(this.getLocalVideoRect());
    this.localViewAttached = true;
    for (const uid of this.remoteUserUids) {
      await client.setupRemoteVideoView(uid, this.getRemoteVideoRectForUid(uid));
    }

    this.refreshVideoHints();
    this.refreshSummary();
    this.pushStatus('RTC views refreshed');
    this.setActionResult('Views', 'ok');
  }

  async cycleChannelProfilePreset() {
    const currentIndex = CHANNEL_PROFILE_PRESETS.indexOf(this.selectedChannelProfile);
    this.selectedChannelProfile = CHANNEL_PROFILE_PRESETS[(currentIndex + 1) % CHANNEL_PROFILE_PRESETS.length];
    this.pushStatus(`Channel profile preset: ${this.selectedChannelProfile}`);
    this.refreshButtonLabels();
    this.setActionResult('Profile', 'ok');
  }

  async cycleClientRolePreset() {
    const currentIndex = CLIENT_ROLE_PRESETS.indexOf(this.selectedClientRole);
    this.selectedClientRole = CLIENT_ROLE_PRESETS[(currentIndex + 1) % CLIENT_ROLE_PRESETS.length];
    this.pushStatus(`Client role preset: ${this.selectedClientRole}`);
    this.refreshButtonLabels();
    this.setActionResult('Role', 'ok');
  }

  async cycleVideoEncoderPreset() {
    this.selectedVideoEncoderPresetIndex =
      (this.selectedVideoEncoderPresetIndex + 1) % VIDEO_ENCODER_PRESETS.length;
    const preset = VIDEO_ENCODER_PRESETS[this.selectedVideoEncoderPresetIndex];
    this.pushStatus(`Video encoder preset: ${preset.name} ${preset.width}x${preset.height}`);
    this.refreshButtonLabels();
    this.setActionResult('Encoder', 'ok');
  }

  async toggleStatusFreeze() {
    const nextValue = !this.statusFrozen;
    if (nextValue) {
      this.pushStatus('Status freeze enabled');
      this.statusFrozen = true;
    } else {
      this.statusFrozen = false;
      this.pushStatus('Status freeze disabled');
    }
    this.refreshButtonLabels();
    this.refreshLogPageContent();
    this.setActionResult('Freeze', 'ok');
  }

  async clearStatusLog() {
    this.statusLines = [];
    this.refreshLogPageContent();
    this.pushStatus('日志已清空');
    this.setActionResult('Clear', 'ok');
  }

  async toggleEnableAudio() {
    this.setActionResult('EnableAudio', 'idle');
    try {
      const client = this.getClient();
      const next = !this.audioEnabled;
      await client.enableAudio(next);
      this.audioEnabled = next;
      this.pushStatus(`Enable audio ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      this.pushStatus(`Enable audio failed: ${String(e)}`);
      this.setActionResult('EnableAudio', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('EnableAudio', 'ok');
  }

  async toggleEnableLocalAudio() {
    this.setActionResult('EnableLocalAudio', 'idle');
    try {
      const next = !this.localAudioEnabled;
      await this.setLocalAudioEnabled(next);
      this.pushStatus(`Enable local audio ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      this.pushStatus(`Enable local audio failed: ${String(e)}`);
      this.setActionResult('EnableLocalAudio', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('EnableLocalAudio', 'ok');
  }

  async toggleMuteLocalAudio() {
    this.setActionResult('MuteLocalAudio', 'idle');
    try {
      const client = this.getClient();
      const next = !this.localAudioMuted;
      await client.muteLocalAudioStream(next);
      this.localAudioMuted = next;
      this.pushStatus(`Mute local audio ${next ? 'muted' : 'unmuted'}`);
    } catch (e) {
      this.pushStatus(`Mute local audio failed: ${String(e)}`);
      this.setActionResult('MuteLocalAudio', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('MuteLocalAudio', 'ok');
  }

  async toggleMuteRemoteAudio() {
    this.setActionResult('MuteRemoteAudio', 'idle');
    try {
      const client = this.getClient();
      const next = !this.remoteAudioMuted;
      const targetUid = this.activeRemoteUid ?? 0;
      await client.muteRemoteAudioStream(targetUid, next);
      this.remoteAudioMuted = next;
      this.pushStatus(`Mute remote audio for uid ${targetUid}: ${next ? 'muted' : 'unmuted'}`);
    } catch (e) {
      this.pushStatus(`Mute remote audio failed: ${String(e)}`);
      this.setActionResult('MuteRemoteAudio', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('MuteRemoteAudio', 'ok');
  }

  async toggleMuteAllRemoteAudio() {
    this.setActionResult('MuteAllRemoteAudio', 'idle');
    try {
      const client = this.getClient();
      const next = !this.allRemoteAudioMuted;
      await client.muteAllRemoteAudioStreams(next);
      this.allRemoteAudioMuted = next;
      this.pushStatus(`Mute all remote audio: ${next ? 'muted' : 'unmuted'}`);
    } catch (e) {
      this.pushStatus(`Mute all remote audio failed: ${String(e)}`);
      this.setActionResult('MuteAllRemoteAudio', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('MuteAllRemoteAudio', 'ok');
  }

  async toggleAudioVolumeIndication() {
    this.setActionResult('AudioVolumeIndication', 'idle');
    try {
      const client = this.getClient();
      const next = !this.audioVolumeIndicationEnabled;
      if (next) {
        await client.enableAudioVolumeIndication(200, 3, true);
      } else {
        await client.enableAudioVolumeIndication(0);
      }
      this.audioVolumeIndicationEnabled = next;
      this.pushStatus(`Audio volume indication ${next ? 'enabled (200ms)' : 'disabled'}`);
    } catch (e) {
      this.pushStatus(`Audio volume indication failed: ${String(e)}`);
      this.setActionResult('AudioVolumeIndication', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('AudioVolumeIndication', 'ok');
  }

  async toggleDefaultAudioRoute() {
    this.setActionResult('DefaultAudioRoute', 'idle');
    try {
      const client = this.getClient();
      const next = !this.defaultAudioRouteToSpeakerphone;
      await client.setDefaultAudioRouteToSpeakerphone(next);
      this.defaultAudioRouteToSpeakerphone = next;
      this.pushStatus(`Default audio route to speakerphone: ${next ? 'speaker' : 'earpiece'}`);
    } catch (e) {
      this.pushStatus(`Default audio route failed: ${String(e)}`);
      this.setActionResult('DefaultAudioRoute', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('DefaultAudioRoute', 'ok');
  }

  async togglePlaybackVolume() {
    this.setActionResult('PlaybackVolume', 'idle');
    try {
      const client = this.getClient();
      const next = this.playbackVolume === 100 ? 50 : 100;
      await client.adjustPlaybackSignalVolume(next);
      this.playbackVolume = next;
      this.pushStatus(`Playback volume adjusted to: ${next}`);
    } catch (e) {
      this.pushStatus(`Playback volume failed: ${String(e)}`);
      this.setActionResult('PlaybackVolume', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('PlaybackVolume', 'ok');
  }

  async toggleAudioProfile() {
    this.setActionResult('AudioProfile', 'idle');
    try {
      const client = this.getClient();
      const next = this.currentAudioProfile === 0 ? 1 : 0;
      await client.setAudioProfile(next);
      this.currentAudioProfile = next;
      this.pushStatus(`Audio profile set to: ${next}`);
    } catch (e) {
      this.pushStatus(`Audio profile failed: ${String(e)}`);
      this.setActionResult('AudioProfile', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('AudioProfile', 'ok');
  }

  async toggleEnableVideo() {
    this.setActionResult('EnableVideo', 'idle');
    try {
      const client = this.getClient();
      const next = !this.videoEnabled;
      await client.enableVideo(next);
      this.videoEnabled = next;
      this.pushStatus(`Enable video ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      this.pushStatus(`Enable video failed: ${String(e)}`);
      this.setActionResult('EnableVideo', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('EnableVideo', 'ok');
  }

  async toggleMuteLocalVideo() {
    this.setActionResult('MuteLocalVideo', 'idle');
    try {
      const client = this.getClient();
      const next = !this.localVideoMuted;
      await client.muteLocalVideoStream(next);
      this.localVideoMuted = next;
      this.pushStatus(`Mute local video ${next ? 'muted' : 'unmuted'}`);
    } catch (e) {
      this.pushStatus(`Mute local video failed: ${String(e)}`);
      this.setActionResult('MuteLocalVideo', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('MuteLocalVideo', 'ok');
  }

  async toggleMuteRemoteVideo() {
    this.setActionResult('MuteRemoteVideo', 'idle');
    try {
      const client = this.getClient();
      const next = !this.remoteVideoMuted;
      const targetUid = this.activeRemoteUid ?? 0;
      await client.muteRemoteVideoStream(targetUid, next);
      this.remoteVideoMuted = next;
      this.pushStatus(`Mute remote video for uid ${targetUid}: ${next ? 'muted' : 'unmuted'}`);
    } catch (e) {
      this.pushStatus(`Mute remote video failed: ${String(e)}`);
      this.setActionResult('MuteRemoteVideo', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('MuteRemoteVideo', 'ok');
  }

  async toggleMuteAllRemoteVideo() {
    this.setActionResult('MuteAllRemoteVideo', 'idle');
    try {
      const client = this.getClient();
      const next = !this.allRemoteVideoMuted;
      await client.muteAllRemoteVideoStreams(next);
      this.allRemoteVideoMuted = next;
      this.pushStatus(`Mute all remote video: ${next ? 'muted' : 'unmuted'}`);
    } catch (e) {
      this.pushStatus(`Mute all remote video failed: ${String(e)}`);
      this.setActionResult('MuteAllRemoteVideo', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('MuteAllRemoteVideo', 'ok');
  }

  async triggerSwitchCamera() {
    this.setActionResult('SwitchCamera', 'idle');
    try {
      const client = this.getClient();
      await client.switchCamera();
      this.pushStatus('Camera switched');
    } catch (e) {
      this.pushStatus(`Switch camera failed: ${String(e)}`);
      this.setActionResult('SwitchCamera', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('SwitchCamera', 'ok');
  }

  async toggleBeautyEffect() {
    this.setActionResult('BeautyEffect', 'idle');
    try {
      const client = this.getClient();
      const next = !this.beautyEffectEnabled;
      if (next) {
        await client.setBeautyEffectOptions(true, {
          lighteningContrastLevel: 1,
          lighteningLevel: 0.7,
          smoothnessLevel: 0.5,
          rednessLevel: 0.1,
        });
      } else {
        await client.setBeautyEffectOptions(false, {
          lighteningContrastLevel: 0,
          lighteningLevel: 0,
          smoothnessLevel: 0,
          rednessLevel: 0,
        });
      }
      this.beautyEffectEnabled = next;
      this.pushStatus(`Beauty effect ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      this.pushStatus(`Beauty effect failed: ${String(e)}`);
      this.setActionResult('BeautyEffect', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('BeautyEffect', 'ok');
  }

  async toggleContentInspect() {
    this.setActionResult('ContentInspect', 'idle');
    try {
      const client = this.getClient();
      const next = !this.contentInspectEnabled;
      if (next) {
        await client.enableContentInspect(true, {
          extraInfo: 'inspect',
          modules: [{ type: 1, interval: 2 }],
        });
      } else {
        await client.enableContentInspect(false);
      }
      this.contentInspectEnabled = next;
      this.pushStatus(`Content inspect ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      this.pushStatus(`Content inspect failed: ${String(e)}`);
      this.setActionResult('ContentInspect', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('ContentInspect', 'ok');
  }

  async togglePlaybackUserVolume() {
    this.setActionResult('PlaybackUserVolume', 'idle');
    try {
      const client = this.getClient();
      const next = this.userPlaybackVolume === 100 ? 50 : 100;
      const targetUid = this.activeRemoteUid ?? 0;
      await client.adjustUserPlaybackSignalVolume(targetUid, next);
      this.userPlaybackVolume = next;
      this.pushStatus(`User ${targetUid} playback volume adjusted to: ${next}`);
    } catch (e) {
      this.pushStatus(`Playback user volume failed: ${String(e)}`);
      this.setActionResult('PlaybackUserVolume', 'fail');
      return;
    }
    this.refreshButtonLabels();
    this.setActionResult('PlaybackUserVolume', 'ok');
  }

  async runCapabilityDemo() {
    if (!this.initialized) {
      await this.initializeRtc();
    }
    await this.runChannelRoleDemo();
    await this.runAudioControlDemo();
    await this.runVideoControlDemo();
    await this.runMixingDemo();
    await this.runEffectDemo();
    await this.runDiagnosticsDemo();
    this.pushStatus('Capability demo completed');
  }

  private async runChannelRoleDemo() {
    const client = this.getClient();
    this.pushStatus('Demo: getSdkVersion');
    const sdkVersion = await client.getSdkVersion();
    this.pushStatus(`SDK version: ${sdkVersion}`);

    this.pushStatus('Demo: setChannelProfile(liveBroadcasting)');
    await client.setChannelProfile(this.selectedChannelProfile);

    this.pushStatus(`Demo: setClientRole(${this.selectedClientRole})`);
    await client.setClientRole(this.selectedClientRole);

    this.pushStatus('Demo: renewToken');
    await client.renewToken(this.token);
  }

  private async runAudioControlDemo() {
    const client = this.getClient();
    this.pushStatus('Demo: enableAudio(true)');
    await client.enableAudio(true);
    this.audioEnabled = true;

    this.pushStatus('Demo: enableLocalAudio(true)');
    await client.enableLocalAudio(true);
    this.localAudioEnabled = true;

    this.pushStatus('Demo: muteLocalAudioStream(false)');
    await client.muteLocalAudioStream(false);

    this.pushStatus('Demo: muteAllRemoteAudioStreams(false)');
    await client.muteAllRemoteAudioStreams(false);

    this.pushStatus('Demo: setAudioProfile');
    await client.setAudioProfile(0, 0);

    this.pushStatus('Demo: enableAudioVolumeIndication');
    await client.enableAudioVolumeIndication(300, 3, false);

    this.pushStatus('Demo: setDefaultAudioRouteToSpeakerphone(true)');
    await client.setDefaultAudioRouteToSpeakerphone(true);

    this.pushStatus('Demo: setEnableSpeakerphone(true)');
    await client.setEnableSpeakerphone(true);
    this.speakerphoneEnabled = true;

    this.pushStatus('Demo: adjustPlaybackSignalVolume(100)');
    await client.adjustPlaybackSignalVolume(100);

    this.pushStatus('Demo: adjustUserPlaybackSignalVolume');
    await client.adjustUserPlaybackSignalVolume(this.activeRemoteUid ?? 0, 100);

    this.pushStatus('Demo: setAudioSessionOperationRestriction');
    await this.callAndLogFailure('setAudioSessionOperationRestriction', () =>
      client.setAudioSessionOperationRestriction(0),
    );
  }

  private async runVideoControlDemo() {
    const client = this.getClient();
    this.pushStatus('Demo: enableVideo(true)');
    await client.enableVideo(true);

    this.pushStatus('Demo: enableLocalVideo(true)');
    await client.enableLocalVideo(true);

    this.pushStatus('Demo: muteLocalVideoStream(false)');
    await client.muteLocalVideoStream(false);

    this.pushStatus('Demo: muteAllRemoteVideoStreams(false)');
    await client.muteAllRemoteVideoStreams(false);

    this.pushStatus('Demo: setVideoEncoderConfiguration');
    await this.callAndLogFailure('setVideoEncoderConfiguration', () =>
      client.setVideoEncoderConfiguration(VIDEO_ENCODER_PRESETS[this.selectedVideoEncoderPresetIndex]),
    );

    this.pushStatus('Demo: switchCamera');
    await client.switchCamera();

    this.pushStatus('Demo: setBeautyEffectOptions');
    await this.callAndLogFailure('setBeautyEffectOptions', () =>
      client.setBeautyEffectOptions(true, {
        smoothnessLevel: 0.5,
      }),
    );

    this.pushStatus('Demo: enableContentInspect');
    await this.callAndLogFailure('enableContentInspect', () =>
      client.enableContentInspect(true, {
        module: 0,
        interval: 0,
      }),
    );
  }

  private async runMixingDemo() {
    const client = this.getClient();
    await this.callAndLogFailure('startAudioMixing', () =>
      client.startAudioMixing({
        path: 'audio/demo-mix.mp3',
        loopback: false,
        replace: false,
        cycle: 1,
        startPos: 0,
      }),
    );
    await this.callAndLogFailure('pauseAudioMixing', () => client.pauseAudioMixing());
    await this.callAndLogFailure('resumeAudioMixing', () => client.resumeAudioMixing());
    await this.callAndLogFailure('getAudioMixingCurrentPosition', async () => {
      const position = await client.getAudioMixingCurrentPosition();
      this.pushStatus(`Mixing position: ${position}`);
    });
    await this.callAndLogFailure('setAudioMixingPosition', () => client.setAudioMixingPosition(0));
    await this.callAndLogFailure('adjustAudioMixingVolume', () => client.adjustAudioMixingVolume(60));
    await this.callAndLogFailure('stopAudioMixing', () => client.stopAudioMixing());
  }

  private async runEffectDemo() {
    const client = this.getClient();
    await this.callAndLogFailure('preloadEffect', () => client.preloadEffect(1, 'audio/effect.mp3'));
    await this.callAndLogFailure('playEffect', () =>
      client.playEffect({
        soundId: 1,
        path: 'audio/effect.mp3',
        loopCount: 1,
        pitch: 1,
        pan: 0,
        gain: 100,
        publish: false,
        startPos: 0,
      }),
    );
    await this.callAndLogFailure('stopEffect', () => client.stopEffect(1));
  }

  private async runDiagnosticsDemo() {
    const client = this.getClient();
    this.pushStatus('Demo: getErrorDescription(0)');
    const errorDescription = await client.getErrorDescription(0);
    this.pushStatus(`Demo result: getErrorDescription -> ${errorDescription}`);

    this.pushStatus('Demo: setLogFilter');
    await client.setLogFilter(0);

    this.pushStatus('Demo: setLogFile');
    await client.setLogFile('/tmp/agora-cocos.log');

    await this.callAndLogFailure('isSpeakerphoneEnabled', async () => {
      const enabled = await client.isSpeakerphoneEnabled();
      this.speakerphoneEnabled = enabled;
      this.pushStatus(`Demo result: isSpeakerphoneEnabled -> ${enabled}`);
    });

    this.pushStatus('Demo: setParameters');
    await client.setParameters('{"rtc.debug":true}');
  }

  private async callAndLogFailure(label: string, action: () => Promise<unknown>) {
    try {
      await action();
      this.pushStatus(`Demo success: ${label}`);
    } catch (error) {
      this.pushStatus(`Demo result: ${label} -> ${String(error)}`);
    }
  }

  private async teardownRtc() {
    if (!this.client) {
      return;
    }

    try {
      if (this.previewStarted) {
        await this.client.stopPreview();
      }
      if (this.localViewAttached) {
        await this.client.removeLocalVideoView();
      }
      if (this.remoteViewAttachedUid !== null) {
        await this.client.removeRemoteVideoView(this.remoteViewAttachedUid);
      }
      await this.client.destroy();
    } catch (error) {
      console.error('[agora-rtc] destroy failed', error);
    } finally {
      this.client = null;
      this.listenersBound = false;
      this.initialized = false;
      this.joined = false;
      this.previewStarted = false;
      this.audioEnabled = true;
      this.localAudioEnabled = true;
      this.localVideoEnabled = true;
      this.speakerphoneEnabled = null;
      this.activeRemoteUid = null;
      this.remoteUserUids.clear();
      this.localViewAttached = false;
      this.remoteViewAttachedUid = null;
      this.localTextureSlotId = null;
      this.remoteTextureSlotId = null;
      this.lastErrorMessage = '-';
      this.lastRtcStatsSummary = '-';
      this.lastVolumeSummary = '-';
      this.statusFrozen = false;
      if (this.localVideoSprite) {
        this.localVideoSprite.node.active = false;
        this.localVideoSprite.spriteFrame = null;
      }
      this.remoteVideoSprites.forEach((sprite) => {
        sprite.node.active = false;
        sprite.spriteFrame = null;
      });
      this.remoteVideoSprites.clear();
      this.remoteVideoTextures.clear();
      this.remoteVideoSpriteFrames.clear();
      this.remoteVideoNodes.clear();
      this.remoteHintLabels.clear();
      this.remoteTextureSlotIds.clear();
      this.refreshVideoHints();
      this.refreshSummary();
      this.refreshButtonLabels();
    }
  }

  private getRemoteVideoRectForUid(uid: number) {
    return this.resolveNodeOverlayRect(REMOTE_TEXTURE_NODE_NAME, 'fit', uid);
  }

  private getLocalVideoRect() {
    return this.resolveNodeOverlayRect(LOCAL_TEXTURE_NODE_NAME, 'hidden');
  }

  private resolveNodeOverlayRect(
    nodeName: string,
    renderMode: 'hidden' | 'fit',
    uid?: number
  ) {
    let targetNode: Node | null = null;
    
    if (nodeName === REMOTE_TEXTURE_NODE_NAME && uid !== undefined) {
      const pageNode = this.remoteVideoNodes.get(uid);
      targetNode = pageNode?.getChildByName(nodeName) ?? null;
      if (!targetNode && pageNode) {
         console.warn('[agora-rtc] Failed to find target node by name', nodeName, 'in page', pageNode.name);
      }
    } else {
      const cardName = nodeName === REMOTE_TEXTURE_NODE_NAME ? REMOTE_CARD_NODE_NAME : LOCAL_CARD_NODE_NAME;
      targetNode = this.node.getChildByPath(`${QA_RIGHT_PANE_NODE_NAME}/${cardName}/${nodeName}`)
        ?? this.node.getChildByPath(`${QA_RIGHT_PANE_NODE_NAME}/${nodeName}`)
        ?? this.node.getChildByName(nodeName);
    }
    
    const targetTransform = targetNode?.getComponent(UITransform);
    const visibleSize = view.getVisibleSize();
    const rect = targetTransform?.getBoundingBoxToWorld();
    console.log('[agora-rtc] resolveNodeOverlayRect', nodeName, uid, 'found=', !!targetNode, 'rect=', rect);
    if (!rect) {
      return worldRectToNativeOverlayRect(
        { x: 0, y: 0, width: 0, height: 0 },
        {
          viewportX: view.getViewportRect().x,
          viewportY: view.getViewportRect().y,
          scaleX: view.getScaleX(),
          scaleY: view.getScaleY(),
          visibleHeight: visibleSize.height,
        },
        renderMode,
      );
    }
    return worldRectToNativeOverlayRect(
      {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      {
        viewportX: view.getViewportRect().x,
        viewportY: view.getViewportRect().y,
        scaleX: view.getScaleX(),
        scaleY: view.getScaleY(),
        visibleHeight: visibleSize.height,
      },
      renderMode,
    );
  }
}
