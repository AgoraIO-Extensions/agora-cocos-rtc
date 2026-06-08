# Cocos Flutter-Style Basic Video Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `example/basic-call` so the first screen behaves like Agora Flutter SDK's `join_channel_video` example: local preview first, explicit join/leave, remote thumbnails, stats overlays, and advanced API controls moved out of the primary viewport.

**Architecture:** Keep the existing Cocos scene/prefab/component setup. `AgoraRtcDemoRoot` remains the coordinator, `RtcSessionService` owns RTC and event state, `DemoActionPanel` becomes the Flutter-style controls panel, and `VideoStagePanel` becomes the dominant video display with remote thumbnails and stats overlays. Update scene templates only to keep fresh checkouts and Cocos imports consistent; most layout is enforced by panel components at runtime.

**Tech Stack:** Cocos Creator 3.8.8 scene/prefab assets, TypeScript Cocos components, Node.js test runner, Android Gradle debug build, Agora Cocos RTC bridge.

---

## File Structure

- Modify: `tests/example-scene.test.ts`
  - Add contracts for Flutter-style basic video controls, auto-preview startup, stats overlays, and advanced action demotion.
- Modify: `example/basic-call/assets/scripts/demo/types.ts`
  - Add typed `ChannelProfile`, `VideoEncoderPresetName`, `BasicVideoConfigState`, and extra `DemoSessionState` fields for encoder, profile, render backend, and stats maps.
- Modify: `example/basic-call/assets/scripts/demo/actions.ts`
  - Replace the top-level QA grid ordering with `BASIC_VIDEO_ACTIONS`, `ADVANCED_ACTIONS`, `BASIC_VIDEO_ACTION_SECTIONS`, and a compatibility `DEFAULT_BUTTON_LAYOUT`.
- Modify: `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
  - Add explicit preview/start/stop methods, join/leave toggle support, channel profile, render backend, encoder preset state, and stats/event summaries.
- Modify: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
  - Change startup from auto-join to initialize plus preview, route settings from the action panel to the service, and refresh panels from state snapshots.
- Modify: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`
  - Build the Connection, Preview and camera, Render and encoder, Diagnostics, and Advanced controls.
- Modify: `example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts`
  - Reduce to compact status/config summary and log entry if action panel owns editable controls.
- Modify: `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`
  - Add dominant local stage, remote thumbnail row, placeholder labels, and stats labels.
- Modify: `example/basic-call/assets/scripts/demo/ui/uiStyles.ts`
  - Add small-label, field, section title, and active/inactive button helpers.
- Modify: `example/basic-call/assets/scene/main.scene`
  - Update default panel positions to landscape-oriented action-left/video-right positions.
- Modify: `example/basic-call/assets/prefabs/*.prefab`
  - Keep component bindings intact and update default sizes/positions where the prefab file carries them.
- Modify: `scripts/prepare-example.sh`
  - Mirror the scene, prefab, and generated runtime layout defaults for fresh generated examples.

## Task 1: Lock Flutter-Style Demo Contracts With Tests

**Files:**
- Modify: `tests/example-scene.test.ts`

- [ ] **Step 1: Add action registry contract tests**

Append this test after the existing `demo action registry keeps all QA API buttons grouped` test:

```ts
test('demo action registry prioritizes flutter-style basic video controls', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/actions.ts`,
    'utf8',
  );

  assert.match(content, /BASIC_VIDEO_ACTIONS/);
  assert.match(content, /ADVANCED_ACTIONS/);
  assert.match(content, /BASIC_VIDEO_ACTION_SECTIONS/);
  assert.match(content, /JoinChannel/);
  assert.match(content, /StartPreview/);
  assert.match(content, /SwitchCamera/);
  assert.match(content, /ApplyEncoder/);
  assert.match(content, /Advanced/);
  assert.ok(content.indexOf('JoinChannel') < content.indexOf('Full Demo'));
});
```

- [ ] **Step 2: Add root startup contract test**

Replace the body of `demo root loads runtime config and auto joins after scene startup` with this test and rename it:

```ts
test('demo root loads runtime config and starts preview without auto joining', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  assert.match(content, /resolveAgoraExampleConfig/);
  assert.match(content, /this\.loadJsonConfig\('agora-config\.build'\)/);
  assert.match(content, /this\.loadJsonConfig\('agora-config'\)/);
  assert.match(content, /Auto preview enabled/);
  assert.match(content, /await this\.initializeRtc\(\);/);
  assert.match(content, /await this\.startLocalPreview\(\);/);
  assert.doesNotMatch(content, /Auto initialize \+ join enabled/);
  assert.doesNotMatch(content, /await this\.joinRtcChannel\(\);/);
});
```

- [ ] **Step 3: Add video stage contract test**

Append this test near the existing scene tests:

```ts
test('video stage panel owns local stage, remote thumbnails, and stats overlays', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`,
    'utf8',
  );

  assert.match(content, /LocalStage/);
  assert.match(content, /RemoteThumbnailRow/);
  assert.match(content, /LocalStatsLabel/);
  assert.match(content, /RemoteStats_/);
  assert.match(content, /setStats/);
  assert.match(content, /setLocalStageState/);
  assert.match(content, /setRemoteUsers/);
});
```

- [ ] **Step 4: Add session state contract test**

Append this test after the `rtc session service owns client lifecycle and native texture binding` test:

```ts
test('rtc session service tracks flutter-style video settings and stats', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(content, /VIDEO_ENCODER_PRESETS/);
  assert.match(content, /selectedChannelProfile/);
  assert.match(content, /selectedVideoEncoderPresetName/);
  assert.match(content, /lastLocalVideoStatsSummary/);
  assert.match(content, /lastRemoteVideoStatsByUid/);
  assert.match(content, /startLocalPreview/);
  assert.match(content, /stopLocalPreview/);
  assert.match(content, /applyVideoEncoderPreset/);
});
```

- [ ] **Step 5: Run tests and verify they fail**

Run:

```bash
node --test tests/example-scene.test.ts
```

Expected: failures mention missing `BASIC_VIDEO_ACTIONS`, `Auto preview enabled`, `LocalStage`, and stats-related strings.

- [ ] **Step 6: Commit the failing contracts**

```bash
git add tests/example-scene.test.ts
git commit -m "test: define flutter-style basic video demo"
```

## Task 2: Add Basic Video Action And State Contracts

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/types.ts`
- Modify: `example/basic-call/assets/scripts/demo/actions.ts`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Replace shared state types**

In `example/basic-call/assets/scripts/demo/types.ts`, keep the imports and replace the exported state interfaces with:

```ts
import type { Node, Sprite, SpriteFrame, Texture2D } from 'cc';

export type RenderBackend = 'surface-view' | 'texture-view' | 'engine-texture';
export type ActionResult = 'ok' | 'fail' | 'idle';
export type ChannelProfile = 'communication' | 'liveBroadcasting';
export type ClientRole = 'broadcaster' | 'audience';
export type VideoEncoderPresetName = '360p' | '540p' | '720p';

export interface RuntimeConfigState {
  appId: string;
  token: string;
  channelId: string;
  uid: number;
  renderBackend: RenderBackend;
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
  speakerphoneEnabled: boolean | null;
  lastErrorMessage: string;
  lastRtcStatsSummary: string;
  lastLocalVideoStatsSummary: string;
  lastRemoteVideoStatsByUid: Record<number, string>;
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
```

- [ ] **Step 2: Replace the action registry**

In `example/basic-call/assets/scripts/demo/actions.ts`, replace the whole file with:

```ts
export const BASIC_VIDEO_ACTIONS = [
  { name: 'JoinChannel', handler: 'toggleJoinChannel' },
  { name: 'StartPreview', handler: 'togglePreview' },
  { name: 'SwitchCamera', handler: 'triggerSwitchCamera' },
  { name: 'MuteLocalVideo', handler: 'toggleMuteLocalVideo' },
  { name: 'MuteAllRemoteVideo', handler: 'toggleMuteAllRemoteVideo' },
  { name: 'ApplyEncoder', handler: 'applySelectedVideoEncoder' },
  { name: 'RefreshViews', handler: 'refreshRtcViews' },
  { name: 'OpenLog', handler: 'openStatusLogPage' },
] as const;

export const ADVANCED_ACTIONS = [
  { name: 'Initialize', handler: 'initializeRtc' },
  { name: 'Leave', handler: 'leaveRtcChannel' },
  { name: 'Speaker', handler: 'toggleSpeakerphone' },
  { name: 'Mic', handler: 'toggleLocalAudio' },
  { name: 'Cam', handler: 'toggleLocalVideo' },
  { name: 'Full Demo', handler: 'runCapabilityDemo' },
  { name: 'Channel', handler: 'runChannelRoleDemo' },
  { name: 'Mixing', handler: 'runMixingDemo' },
  { name: 'Effect', handler: 'runEffectDemo' },
  { name: 'Diag', handler: 'runDiagnosticsDemo' },
  { name: 'Profile', handler: 'cycleChannelProfilePreset' },
  { name: 'Role', handler: 'cycleClientRolePreset' },
  { name: 'Encoder', handler: 'cycleVideoEncoderPreset' },
  { name: 'Freeze', handler: 'toggleStatusFreeze' },
  { name: 'Clear', handler: 'clearStatusLog' },
  { name: 'EnableAudio', handler: 'toggleEnableAudio' },
  { name: 'EnableLocalAudio', handler: 'toggleEnableLocalAudio' },
  { name: 'MuteLocalAudio', handler: 'toggleMuteLocalAudio' },
  { name: 'MuteRemoteAudio', handler: 'toggleMuteRemoteAudio' },
  { name: 'MuteAllRemoteAudio', handler: 'toggleMuteAllRemoteAudio' },
  { name: 'AudioVolumeIndication', handler: 'toggleAudioVolumeIndication' },
  { name: 'DefaultAudioRoute', handler: 'toggleDefaultAudioRoute' },
  { name: 'PlaybackVolume', handler: 'togglePlaybackVolume' },
  { name: 'AudioProfile', handler: 'toggleAudioProfile' },
  { name: 'EnableVideo', handler: 'toggleEnableVideo' },
  { name: 'MuteRemoteVideo', handler: 'toggleMuteRemoteVideo' },
  { name: 'BeautyEffect', handler: 'toggleBeautyEffect' },
  { name: 'ContentInspect', handler: 'toggleContentInspect' },
  { name: 'PlaybackUserVolume', handler: 'togglePlaybackUserVolume' },
] as const;

export const DEFAULT_BUTTON_LAYOUT = [...BASIC_VIDEO_ACTIONS, ...ADVANCED_ACTIONS] as const;

export const BASIC_VIDEO_ACTION_SECTIONS = [
  { title: 'Connection', buttons: ['JoinChannel'] },
  { title: 'Preview and camera', buttons: ['StartPreview', 'SwitchCamera', 'MuteLocalVideo', 'MuteAllRemoteVideo'] },
  { title: 'Render and encoder', buttons: ['ApplyEncoder'] },
  { title: 'Diagnostics', buttons: ['RefreshViews', 'OpenLog'] },
  { title: 'Advanced', buttons: ADVANCED_ACTIONS.map((action) => action.name) },
] as const;

export const ACTION_LABELS: Record<string, string> = {
  JoinChannel: 'Join Channel',
  StartPreview: 'Start Preview',
  SwitchCamera: 'Switch Camera',
  MuteLocalVideo: 'Camera On',
  MuteAllRemoteVideo: 'Remote Video On',
  ApplyEncoder: 'Apply Encoder',
  RefreshViews: 'Refresh Views',
  OpenLog: 'Log',
  Initialize: 'Initialize',
  Leave: 'Leave',
  Speaker: 'Speaker',
  Mic: 'Mic',
  Cam: 'Cam',
  'Full Demo': 'Full Demo',
  Mixing: 'Mixing',
  Effect: 'Effect',
  Diag: 'Diagnostics',
  Freeze: 'Freeze Log',
  Clear: 'Clear Log',
  Channel: 'Channel Demo',
  Profile: 'Profile',
  Role: 'Role',
  Encoder: 'Encoder',
  EnableAudio: 'Enable Audio',
  EnableLocalAudio: 'Local Audio',
  MuteLocalAudio: 'Mute Local Audio',
  MuteRemoteAudio: 'Mute Remote Audio',
  MuteAllRemoteAudio: 'Mute All Remote',
  AudioVolumeIndication: 'Volume Indicator',
  DefaultAudioRoute: 'Default Route',
  PlaybackVolume: 'Playback Volume',
  AudioProfile: 'Audio Profile',
  EnableVideo: 'Enable Video',
  MuteRemoteVideo: 'Mute Remote Video',
  BeautyEffect: 'Beauty Effect',
  ContentInspect: 'Content Inspect',
  PlaybackUserVolume: 'User Volume',
};

export type DemoActionName = typeof DEFAULT_BUTTON_LAYOUT[number]['name'];
export type DemoActionHandlerName = typeof DEFAULT_BUTTON_LAYOUT[number]['handler'];
```

- [ ] **Step 3: Run the action tests**

Run:

```bash
node --test tests/example-scene.test.ts
```

Expected: action registry test passes; root, video panel, and service tests still fail.

- [ ] **Step 4: Commit action contracts**

```bash
git add example/basic-call/assets/scripts/demo/types.ts example/basic-call/assets/scripts/demo/actions.ts
git commit -m "feat: add basic video demo action contracts"
```

## Task 3: Update RTC Session Service For Basic Video Flow

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Add service state fields**

In `RtcSessionService`, update imports from `./types.ts` to include `ChannelProfile`, `ClientRole`, and `VideoEncoderPresetName`, then replace the preset constants with:

```ts
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
```

Replace `selectedVideoEncoderPresetIndex` with:

```ts
private selectedVideoEncoderPresetName: VideoEncoderPresetName = '360p';
private lastLocalVideoStatsSummary = '-';
private lastRemoteVideoStatsByUid = new Map<number, string>();
```

- [ ] **Step 2: Return expanded state**

In `getState()`, add these fields:

```ts
channelProfile: this.selectedChannelProfile,
clientRole: this.selectedClientRole,
renderBackend: this.options.getConfig().renderBackend,
videoEncoderPresetName: this.selectedVideoEncoderPresetName,
videoEnabled: this.videoEnabled,
lastLocalVideoStatsSummary: this.lastLocalVideoStatsSummary,
lastRemoteVideoStatsByUid: Object.fromEntries(this.lastRemoteVideoStatsByUid),
```

- [ ] **Step 3: Add explicit preview methods**

Add these methods before `togglePreview()`:

```ts
async startLocalPreview(): Promise<void> {
  if (!this.initialized) {
    await this.initializeRtc();
  }
  if (this.previewStarted) {
    this.log('Preview already started');
    return;
  }
  await this.setupLocalVideoView();
  await this.getClient().startPreview();
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
  this.previewStarted = false;
  this.log('Preview stopped');
  this.emitState();
}
```

Then replace `togglePreview()` with:

```ts
async togglePreview(): Promise<void> {
  if (this.previewStarted) {
    await this.stopLocalPreview();
    return;
  }
  await this.startLocalPreview();
}
```

- [ ] **Step 4: Add setting methods**

Add these public methods near the existing profile/encoder methods:

```ts
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
```

Update `cycleVideoEncoderPreset()` to use `VIDEO_ENCODER_PRESET_NAMES`:

```ts
async cycleVideoEncoderPreset(): Promise<void> {
  const index = VIDEO_ENCODER_PRESET_NAMES.indexOf(this.selectedVideoEncoderPresetName);
  const next = VIDEO_ENCODER_PRESET_NAMES[(index + 1) % VIDEO_ENCODER_PRESET_NAMES.length];
  await this.applyVideoEncoderPreset(next);
}
```

- [ ] **Step 5: Add event summaries**

In `bindRtcEventListeners()`, add listeners after `rtcStats`:

```ts
this.client.on('localVideoStateChanged', ({ state, error }) => {
  this.lastLocalVideoStatsSummary = `state ${state}/err ${error}`;
  this.log(`Local video state: ${state} error ${error}`);
  this.emitState();
});
this.client.on('remoteVideoStateChanged', ({ uid, state, reason }) => {
  this.lastRemoteVideoStatsByUid.set(uid, `state ${state}/reason ${reason}`);
  this.log(`Remote video state: ${uid} state ${state} reason ${reason}`);
  this.emitState();
});
```

Keep `localVideoTextureReady` and `remoteVideoTextureReady` as the main texture-binding events.

- [ ] **Step 6: Run service tests**

Run:

```bash
node --test tests/example-scene.test.ts
npm run typecheck
```

Expected: service contract passes; typecheck passes after state fields are added.

- [ ] **Step 7: Commit service flow**

```bash
git add example/basic-call/assets/scripts/demo/RtcSessionService.ts example/basic-call/assets/scripts/demo/types.ts tests/example-scene.test.ts
git commit -m "feat: add basic video session state"
```

## Task 4: Change Root Startup And Action Dispatch

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Import the expanded config types**

Update the type import in `AgoraRtcDemoRoot.ts`:

```ts
import type {
  ActionResult,
  BasicVideoConfigState,
  ChannelProfile,
  DemoSessionState,
  RuntimeConfigState,
  VideoEncoderPresetName,
} from './types.ts';
```

- [ ] **Step 2: Add profile and encoder properties**

Below the `renderBackend` property, add:

```ts
@property
channelProfile: ChannelProfile = 'communication';

@property
videoEncoderPresetName: VideoEncoderPresetName = '360p';
```

- [ ] **Step 3: Change startup to initialize and preview**

Replace the end of `start()` with:

```ts
this.createSession();
this.refreshPanels();
this.pushStatus('Example ready');
this.pushStatus(`Render backend: ${this.renderBackend}`);
this.pushStatus('Auto preview enabled');
try {
  await this.initializeRtc();
  await this.startLocalPreview();
} catch (error) {
  this.pushStatus(`Auto preview failed: ${String(error)}`);
}
```

- [ ] **Step 4: Add primary basic-video actions**

Add these methods after `joinRtcChannel()`:

```ts
async toggleJoinChannel(): Promise<void> {
  const state = this.getSessionState();
  if (state.joined) {
    await this.leaveRtcChannel();
    return;
  }
  await this.joinRtcChannel();
}

async startLocalPreview(): Promise<void> {
  await this.runSessionAction('StartPreview', (session) => session.startLocalPreview());
}

async applySelectedVideoEncoder(): Promise<void> {
  await this.runSessionAction('ApplyEncoder', (session) =>
    session.applyVideoEncoderPreset(this.videoEncoderPresetName),
  );
}
```

- [ ] **Step 5: Add config application callbacks**

Add this method near `applyConfig()`:

```ts
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
```

- [ ] **Step 6: Pass state into panels**

Update `onLoad()` so `DemoActionPanel.initialize` receives an object:

```ts
this.actionPanel?.initialize({
  onAction: (actionName) => { void this.invokeAction(actionName); },
  onApplyConfig: (config) => this.applyBasicVideoConfig(config),
});
```

Update `refreshPanels()`:

```ts
private refreshPanels(): void {
  const config = this.getBasicVideoConfigState();
  const state = this.getSessionState();
  this.headerPanel?.setConfig(config);
  this.headerPanel?.setSummary(state);
  this.actionPanel?.setConfig(config);
  this.actionPanel?.setSessionState(state);
  this.actionPanel?.refresh();
  this.videoStagePanel?.setLocalStageState(state);
  this.videoStagePanel?.setStats(state);
}
```

Add:

```ts
private getBasicVideoConfigState(): BasicVideoConfigState {
  return {
    ...this.getRuntimeConfigState(),
    channelProfile: this.channelProfile,
    clientRole: 'broadcaster',
    videoEncoderPresetName: this.videoEncoderPresetName,
  };
}
```

- [ ] **Step 7: Run root tests**

Run:

```bash
node --test tests/example-scene.test.ts
npm run typecheck
```

Expected: root startup contract passes.

- [ ] **Step 8: Commit root behavior**

```bash
git add example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts
git commit -m "feat: start basic video preview before join"
```

## Task 5: Build The Flutter-Style Action Panel

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`
- Modify: `example/basic-call/assets/scripts/demo/ui/uiStyles.ts`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Add UI helpers**

In `uiStyles.ts`, add these helpers after `ensureButtonNode()`:

```ts
export function ensureLabelNode(
  parent: Node,
  name: string,
  width: number,
  height: number,
  text: string,
  fontSize = 13,
  color = COLORS.textMuted,
): Label {
  let node = parent.getChildByName(name);
  if (!node) {
    node = new Node(name);
    node.setParent(parent);
  }
  node.layer = parent.layer;
  ensureTransform(node, width, height);
  const label = node.getComponent(Label) ?? node.addComponent(Label);
  configureLabel(label, text, fontSize, color);
  return label;
}

export function refreshButtonVariant(node: Node, width: number, height: number, variant: ButtonVariant): void {
  const bgNode = node.getChildByName('Background');
  if (!bgNode) {
    return;
  }
  drawButton(bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics), width, height, variant);
}
```

- [ ] **Step 2: Replace action panel imports and callback shape**

At the top of `DemoActionPanel.ts`, use:

```ts
import { _decorator, Component, EditBox, Label, Node } from 'cc';
import {
  ACTION_LABELS,
  ADVANCED_ACTIONS,
  BASIC_VIDEO_ACTION_SECTIONS,
  DEFAULT_BUTTON_LAYOUT,
} from '../actions.ts';
import type {
  ActionResult,
  BasicVideoConfigState,
  ChannelProfile,
  DemoSessionState,
  RenderBackend,
  VideoEncoderPresetName,
} from '../types.ts';
import {
  COLORS,
  ensureButtonNode,
  ensureLabelNode,
  ensureTransform,
  refreshButtonVariant,
} from '../ui/uiStyles.ts';
```

Change `initialize` signature to:

```ts
initialize(callbacks: {
  onAction: (actionName: string) => void;
  onApplyConfig: (config: Partial<BasicVideoConfigState>) => void;
}): void {
  this.onAction = callbacks.onAction;
  this.onApplyConfig = callbacks.onApplyConfig;
  this.ensureContainers();
  this.ensureControls();
  this.refresh();
}
```

- [ ] **Step 3: Add panel fields**

Add these fields in the class:

```ts
private onApplyConfig: ((config: Partial<BasicVideoConfigState>) => void) | null = null;
private config: BasicVideoConfigState | null = null;
private sessionState: DemoSessionState | null = null;
private channelInput: EditBox | null = null;
private uidInput: EditBox | null = null;
private profileLabel: Label | null = null;
private renderLabel: Label | null = null;
private encoderLabel: Label | null = null;
private statusLabel: Label | null = null;
private advancedVisible = false;
```

Add setters:

```ts
setConfig(config: BasicVideoConfigState): void {
  this.config = config;
  this.ensureControls();
  if (this.channelInput && this.channelInput.string !== config.channelId) {
    this.channelInput.string = config.channelId;
  }
  if (this.uidInput && this.uidInput.string !== String(config.uid)) {
    this.uidInput.string = String(config.uid);
  }
  this.refresh();
}

setSessionState(state: DemoSessionState): void {
  this.sessionState = state;
  this.refresh();
}
```

- [ ] **Step 4: Build fixed sections**

Replace `ensureButtons()` with an `ensureControls()` method that creates:

```ts
private ensureControls(): void {
  ensureTransform(this.node, 420, 620);
  const connection = this.ensureContainer('ConnectionSection', 0, 230, 390, 150);
  const preview = this.ensureContainer('PreviewCameraSection', 0, 70, 390, 150);
  const render = this.ensureContainer('RenderEncoderSection', 0, -80, 390, 130);
  const diagnostics = this.ensureContainer('DiagnosticsSection', 0, -205, 390, 86);
  const advanced = this.ensureContainer('AdvancedSection', 0, -330, 390, 160);
  advanced.active = this.advancedVisible;

  this.buildConnectionSection(connection);
  this.buildButtonList(preview, ['StartPreview', 'SwitchCamera', 'MuteLocalVideo', 'MuteAllRemoteVideo'], 2, 38);
  this.buildRenderSection(render);
  this.buildButtonList(diagnostics, ['RefreshViews', 'OpenLog'], 2, 8);
  this.buildButtonList(advanced, ADVANCED_ACTIONS.map((action) => action.name), 3, 52);
}
```

Add section builders:

```ts
private buildConnectionSection(parent: Node): void {
  ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Connection', 14, COLORS.textPrimary).node.setPosition(-180, 56, 0);
  this.channelInput = this.ensureEditBox(parent, 'ChannelInput', -92, 18, 174, this.config?.channelId ?? 'demo');
  this.uidInput = this.ensureEditBox(parent, 'UidInput', 95, 18, 78, String(this.config?.uid ?? 1001));
  const join = this.ensureActionButton(parent, 'JoinChannel', 0, -38, 200, 40, 'primary');
  join.node.on(Node.EventType.TOUCH_END, () => {
    this.applyInputs();
    this.onAction?.('JoinChannel');
  }, this);
}

private buildRenderSection(parent: Node): void {
  ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Render and encoder', 14, COLORS.textPrimary).node.setPosition(-180, 44, 0);
  this.profileLabel = this.ensureToggleLabel(parent, 'ProfileToggle', -120, 10, 112, `Profile ${this.config?.channelProfile ?? 'communication'}`, () => this.cycleProfile());
  this.renderLabel = this.ensureToggleLabel(parent, 'RenderToggle', 0, 10, 112, `Render ${this.config?.renderBackend ?? 'engine-texture'}`, () => this.cycleRenderBackend());
  this.encoderLabel = this.ensureToggleLabel(parent, 'EncoderToggle', 120, 10, 112, `Encoder ${this.config?.videoEncoderPresetName ?? '360p'}`, () => this.cycleEncoder());
  this.buildButtonList(parent, ['ApplyEncoder'], 1, -44);
}
```

Use existing `ensureButtonNode` for toggles and buttons. The exact helper signatures can be local private methods, but keep the names `ConnectionSection`, `PreviewCameraSection`, `RenderEncoderSection`, `DiagnosticsSection`, and `AdvancedSection`.

- [ ] **Step 5: Refresh button labels from state**

Update `refreshButton()` so it rewrites primary labels:

```ts
const baseLabel = name === 'JoinChannel' && this.sessionState?.joined
  ? 'Leave Channel'
  : name === 'StartPreview' && this.sessionState?.previewStarted
    ? 'Stop Preview'
    : ACTION_LABELS[name] ?? name;
const suffix = result === 'ok' ? ' OK' : result === 'fail' ? ' FAIL' : '';
label.string = `${baseLabel}${suffix}`;
```

When `name === 'OpenLog'`, dispatch `OpenLog`. When an advanced button toggles visibility, call it `Advanced` only if you add that button; otherwise keep advanced visible below the fold.

- [ ] **Step 6: Run panel tests**

Run:

```bash
node --test tests/example-scene.test.ts
npm run typecheck
```

Expected: action panel compiles and action registry tests pass.

- [ ] **Step 7: Commit action panel UI**

```bash
git add example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts example/basic-call/assets/scripts/demo/ui/uiStyles.ts
git commit -m "feat: add basic video action panel"
```

## Task 6: Rework Video Stage For Local Stage And Remote Thumbnails

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Add stats and layout fields**

Add these fields:

```ts
@property(Label)
localStatsLabel: Label | null = null;

@property(Node)
remoteThumbnailRow: Node | null = null;

private remoteStatsLabels = new Map<number, Label>();
```

- [ ] **Step 2: Replace base layout**

Replace `ensureBaseNodes()` with:

```ts
private ensureBaseNodes(): void {
  ensureTransform(this.node, 820, 620);
  this.localCard ??= this.ensureCard('LocalStage', 0, 0, 780, 520);
  this.remoteThumbnailRow ??= this.ensureCard('RemoteThumbnailRow', 0, 235, 760, 112);
  if (!this.localVideoSprite) {
    this.localVideoSprite = this.ensureSprite(this.localCard, 'LocalVideoSprite', 780, 520);
  }
  if (!this.localHintLabel) {
    this.localHintLabel = this.ensureLabel(this.localCard, 'LocalHint', 'Local preview', 240, 32, -350, -220);
  }
  if (!this.localStatsLabel) {
    this.localStatsLabel = this.ensureLabel(this.localCard, 'LocalStatsLabel', 'Local -', 320, 32, -340, -250);
  }
}
```

- [ ] **Step 3: Add state and stats render methods**

Add:

```ts
setLocalStageState(state: DemoSessionState): void {
  this.ensureBaseNodes();
  this.setLocalHint(state.previewStarted ? 'Local preview' : 'Preview stopped');
}

setStats(state: DemoSessionState): void {
  this.ensureBaseNodes();
  if (this.localStatsLabel) {
    this.localStatsLabel.string = `Local ${state.lastLocalVideoStatsSummary} | RTC ${state.lastRtcStatsSummary}`;
  }
  for (const uid of state.remoteUserUids) {
    const label = this.remoteStatsLabels.get(uid);
    if (label) {
      label.string = state.lastRemoteVideoStatsByUid[uid] ?? `Remote ${uid}`;
    }
  }
}
```

Import `DemoSessionState`.

- [ ] **Step 4: Build remote thumbnail nodes**

Update `ensureRemoteUserPage(uid)` so it uses `RemoteThumbnailRow` and names stats labels:

```ts
const parent = this.remoteThumbnailRow ?? this.node;
const index = this.remoteVideoNodes.size;
const pageNode = this.ensureCard(`RemoteUser_${uid}`, -300 + index * 150, 0, 136, 86);
pageNode.setParent(parent);
pageNode.setPosition(-300 + index * 150, 0, 0);
const sprite = this.ensureSprite(pageNode, 'VideoSprite', 136, 86);
const hint = this.ensureLabel(pageNode, 'Hint', `Remote ${uid}`, 120, 22, 0, 20);
const stats = this.ensureLabel(pageNode, `RemoteStats_${uid}`, `Remote ${uid}`, 126, 22, 0, -28);
this.remoteVideoNodes.set(uid, pageNode);
this.remoteVideoSprites.set(uid, sprite);
this.remoteHintLabels.set(uid, hint);
this.remoteStatsLabels.set(uid, stats);
return pageNode;
```

Update `removeRemoteUserPage(uid)` to delete `remoteStatsLabels`.

- [ ] **Step 5: Run video panel tests**

Run:

```bash
node --test tests/example-scene.test.ts
npm run typecheck
```

Expected: video stage contract passes.

- [ ] **Step 6: Commit video stage**

```bash
git add example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts
git commit -m "feat: add basic video stage layout"
```

## Task 7: Update Scene And Generated Asset Defaults

**Files:**
- Modify: `example/basic-call/assets/scene/main.scene`
- Modify: `example/basic-call/assets/prefabs/ActionPanel.prefab`
- Modify: `example/basic-call/assets/prefabs/VideoStagePanel.prefab`
- Modify: `scripts/prepare-example.sh`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Adjust scene positions**

In `example/basic-call/assets/scene/main.scene`, keep the existing compressed script UUIDs and update these node positions:

```json
HeaderPanel: { "x": -390, "y": 250, "z": 0 }
ActionPanel: { "x": -390, "y": -40, "z": 0 }
VideoStagePanel: { "x": 140, "y": -20, "z": 0 }
LogPanel: unchanged and inactive
```

Keep `DemoRoot`, `HeaderPanel`, `ActionPanel`, `VideoStagePanel`, and `LogPanel` node names exactly as-is.

- [ ] **Step 2: Adjust prefab sizes**

In `ActionPanel.prefab`, update its `cc.UITransform` content size to:

```json
{ "width": 420, "height": 620 }
```

In `VideoStagePanel.prefab`, update its `cc.UITransform` content size to:

```json
{ "width": 820, "height": 620 }
```

- [ ] **Step 3: Mirror changes in prepare script**

In `scripts/prepare-example.sh`, update the `main.scene`, `ActionPanel.prefab`, and `VideoStagePanel.prefab` heredocs with the same positions and sizes. Preserve these compressed script IDs:

```text
AgoraRtcDemoRoot 6f0fc5VEABCuIt7Gq+AAAED
DemoHeaderPanel  6f0fc5VEABCuIt7Gq+AAAEE
DemoActionPanel  6f0fc5VEABCuIt7Gq+AAAEF
VideoStagePanel  6f0fc5VEABCuIt7Gq+AAAEG
LogPanel         6f0fc5VEABCuIt7Gq+AAAEH
```

- [ ] **Step 4: Run asset tests and shell syntax**

Run:

```bash
zsh -n scripts/prepare-example.sh
node --test tests/example-scene.test.ts
```

Expected: both commands pass.

- [ ] **Step 5: Commit asset defaults**

```bash
git add example/basic-call/assets/scene/main.scene example/basic-call/assets/prefabs/ActionPanel.prefab example/basic-call/assets/prefabs/VideoStagePanel.prefab scripts/prepare-example.sh
git commit -m "feat: align demo assets with basic video layout"
```

## Task 8: Verification And Android Smoke

**Files:**
- No source edits unless verification reveals a root-cause bug.

- [ ] **Step 1: Run focused checks**

Run:

```bash
zsh -n scripts/prepare-example.sh
node --test tests/example-scene.test.ts tests/dev-android-script.test.ts tests/productization.test.ts tests/package-customer-delivery.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 2: Run full tests**

Run:

```bash
npm test
```

Expected: all tests pass. Existing Node `MODULE_TYPELESS_PACKAGE_JSON` warnings are acceptable if the command exits `0`.

- [ ] **Step 3: Generate ignored runtime app config**

Run:

```bash
APP_ID=dd8dfbf0f9484a8c960546ffe4ba4dce CHANNEL_ID=testapi TOKEN= \
  node ./scripts/write-example-build-config.mjs
```

Expected: `example/basic-call/assets/resources/agora-config.build.json` exists and is ignored by git.

- [ ] **Step 4: Build, install, and launch Android**

Run:

```bash
env \
  http_proxy=http://127.0.0.1:7892 \
  https_proxy=http://127.0.0.1:7892 \
  all_proxy=http://127.0.0.1:7892 \
  ANDROID_NDK_HOME=/Users/admin/Library/Android/sdk/ndk/23.1.7779620 \
  ./scripts/dev-android.sh
```

Expected:

- Cocos build reaches Android export without missing script errors.
- Gradle `assembleDebug` succeeds.
- `adb install` succeeds.
- `am start` launches `io.agora.cocos.example/com.cocos.game.AppActivity`.

- [ ] **Step 5: Verify runtime logs and screenshot**

Run:

```bash
adb shell pm grant io.agora.cocos.example android.permission.CAMERA || true
adb shell pm grant io.agora.cocos.example android.permission.RECORD_AUDIO || true
adb logcat -c
adb shell am force-stop io.agora.cocos.example
adb shell am start -n io.agora.cocos.example/com.cocos.game.AppActivity
sleep 5
adb logcat -d | rg "\\[agora-rtc\\]|Success to load scene|RtcEngine|agora-rtc-native|createSlot|Preview|Join|error|Error|Exception" -n
adb exec-out screencap -p > /tmp/agora-cocos-flutter-basic-video.png
```

Expected:

- log contains `Success to load scene: db://assets/scene/main.scene`;
- log contains `RtcEngine` creation or native texture slot setup;
- screenshot shows a basic video page with visible join/preview controls and a larger video area.

- [ ] **Step 6: Tap Preview and verify texture frames**

Use device coordinates after checking `adb shell wm size`. For the current landscape emulator, tap the preview button in the left controls column, then run:

```bash
adb logcat -c
adb shell input tap 350 600
sleep 3
adb logcat -d | rg "CameraService|agora-rtc-native|applyPendingFrame|localVideoTextureReady|Preview" -n
```

Expected: camera opens and native texture frames are applied, such as `applyPendingFrame slot=1 width=320 height=180`.

- [ ] **Step 7: Clean ignored credential config**

Run:

```bash
rm -f example/basic-call/assets/resources/agora-config.build.json \
      example/basic-call/assets/resources/agora-config.build.json.meta
git status --short
```

Expected: no tracked changes. Ignored build output directories may remain if `git status --short --ignored` is used.

- [ ] **Step 8: Commit verification fixes only if needed**

If verification requires source fixes, commit those exact fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize basic video demo smoke"
```

Do not commit screenshots, build output, or app id config.

## Self-Review

- Spec coverage: tasks cover basic-video controls, auto preview, join/leave behavior, local stage, remote thumbnails, stats labels, action demotion, Android build, and credential cleanup.
- Scope: the plan stays within the existing single-scene Cocos demo and does not change the SDK bridge.
- Type consistency: action names in `actions.ts`, root handler names, service methods, and tests use the same names: `JoinChannel`, `StartPreview`, `ApplyEncoder`, `startLocalPreview`, `applyVideoEncoderPreset`.
- Credential safety: the only real app id use is in the ignored build config during smoke, then removed.

