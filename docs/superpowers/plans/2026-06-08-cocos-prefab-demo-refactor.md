# Cocos Prefab Demo Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `example/basic-call` from a runtime-built monolithic QA controller into a Cocos Creator scene/prefab/component-bound demo while preserving the current Android RTC behavior.

**Architecture:** Keep `main.scene` as the only start scene. Add an explicit `DemoRoot` node with `AgoraRtcDemoRoot`, split UI into panel components, move RTC calls into `RtcSessionService`, and keep dynamic node creation only for repeated runtime content such as action buttons and remote user pages. Update repo tests and setup scripts so generated scenes use the new entry path.

**Tech Stack:** Cocos Creator 3.8.8 assets, TypeScript components under `example/basic-call/assets/scripts`, Node.js test runner, Android Gradle debug build, Agora Cocos RTC bridge.

---

## File Structure

- Modify: `tests/example-scene.test.ts`
  - Replace old bootstrap/controller assertions with scene, prefab, panel, and service contract checks.
- Create: `example/basic-call/assets/scripts/demo/actions.ts`
  - Own button names, labels, sections, and typed action ids.
- Create: `example/basic-call/assets/scripts/demo/types.ts`
  - Own shared panel state, session state, and action callback types.
- Create: `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
  - Own Agora client creation, RTC command methods, event binding, and native render callbacks.
- Create: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
  - Own scene lifecycle, config loading, panel wiring, action dispatch, and state refresh.
- Create: `example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts`
  - Own config labels, channel/uid inputs, settings rows, and log entry callback.
- Create: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`
  - Own quick buttons and grouped API action buttons.
- Create: `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`
  - Own local and remote video nodes, hints, title labels, sprites, and remote page nodes.
- Create: `example/basic-call/assets/scripts/demo/panels/LogPanel.ts`
  - Own log overlay visibility, clear/freeze/back controls, and scroll body.
- Create: `example/basic-call/assets/scripts/demo/ui/uiStyles.ts`
  - Own shared colors, button drawing, labels, and panel card drawing helpers.
- Create: `.meta` files for the new TypeScript files and directories with stable UUIDs.
- Create: `example/basic-call/assets/prefabs/` plus `.meta` files.
  - Store `DemoRoot.prefab`, `HeaderPanel.prefab`, `ActionPanel.prefab`, `VideoStagePanel.prefab`, and `LogPanel.prefab`.
- Modify: `example/basic-call/assets/scene/main.scene`
  - Replace legacy embedded QA fallback nodes with `DemoRoot` and explicit panel nodes.
- Modify: `example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`
  - Keep profiler hiding and cache diagnostics, remove runtime `Canvas.addComponent(AgoraRtcExampleController)`.
- Modify: `scripts/prepare-example.sh`
  - Create new directories, metas, scene template, and prefab assets for fresh checkouts.
- Modify: `scripts/patch-exported-main-bundle.mjs`
  - Remove old controller injection assumptions or make the patch no-op when the new root module is present.
- Modify: `tests/productization.test.ts`
  - Replace old single-controller packaging expectations with new demo script file expectations.

## Stable UUIDs

Use these UUIDs for new Cocos script assets. Keep them stable across scene, prefab, script meta, and `prepare-example.sh`.

```text
assets/scripts/demo.meta                                      2eae89cb-6f8e-4615-ac44-0012f1200100
assets/scripts/demo/actions.ts.meta                          6f0fce55-1000-42b8-8b7b-1aaf80000100
assets/scripts/demo/types.ts.meta                            6f0fce55-1000-42b8-8b7b-1aaf80000101
assets/scripts/demo/RtcSessionService.ts.meta                6f0fce55-1000-42b8-8b7b-1aaf80000102
assets/scripts/demo/AgoraRtcDemoRoot.ts.meta                 6f0fce55-1000-42b8-8b7b-1aaf80000103
assets/scripts/demo/panels.meta                              2eae89cb-6f8e-4615-ac44-0012f1200101
assets/scripts/demo/panels/DemoHeaderPanel.ts.meta           6f0fce55-1000-42b8-8b7b-1aaf80000104
assets/scripts/demo/panels/DemoActionPanel.ts.meta           6f0fce55-1000-42b8-8b7b-1aaf80000105
assets/scripts/demo/panels/VideoStagePanel.ts.meta           6f0fce55-1000-42b8-8b7b-1aaf80000106
assets/scripts/demo/panels/LogPanel.ts.meta                  6f0fce55-1000-42b8-8b7b-1aaf80000107
assets/scripts/demo/ui.meta                                  2eae89cb-6f8e-4615-ac44-0012f1200102
assets/scripts/demo/ui/uiStyles.ts.meta                      6f0fce55-1000-42b8-8b7b-1aaf80000108
assets/prefabs.meta                                          2eae89cb-6f8e-4615-ac44-0012f1200200
assets/prefabs/DemoRoot.prefab.meta                          7f0fce55-1000-42b8-8b7b-1aaf80000200
assets/prefabs/HeaderPanel.prefab.meta                       7f0fce55-1000-42b8-8b7b-1aaf80000201
assets/prefabs/ActionPanel.prefab.meta                       7f0fce55-1000-42b8-8b7b-1aaf80000202
assets/prefabs/VideoStagePanel.prefab.meta                   7f0fce55-1000-42b8-8b7b-1aaf80000203
assets/prefabs/LogPanel.prefab.meta                          7f0fce55-1000-42b8-8b7b-1aaf80000204
```

### Task 1: Lock The New Architecture With Failing Tests

**Files:**
- Modify: `tests/example-scene.test.ts`
- Modify: `tests/productization.test.ts`

- [ ] **Step 1: Replace the old bootstrap tests**

In `tests/example-scene.test.ts`, replace the tests named `example bootstrap script mounts the controller onto Canvas at runtime` and `prepare-example writes bootstrap script metadata` with these tests:

```ts
const demoRootUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000103';
const rtcSessionUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000102';
const panelScriptUuids = [
  '6f0fce55-1000-42b8-8b7b-1aaf80000104',
  '6f0fce55-1000-42b8-8b7b-1aaf80000105',
  '6f0fce55-1000-42b8-8b7b-1aaf80000106',
  '6f0fce55-1000-42b8-8b7b-1aaf80000107',
];

test('example main.scene declares an explicit prefab-style demo root', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scene/main.scene`,
    'utf8',
  );
  const scene = JSON.parse(content);
  const nodeNames = scene
    .filter((entry: any) => entry?.__type__ === 'cc.Node')
    .map((entry: any) => entry._name);

  assert.ok(nodeNames.includes('DemoRoot'));
  assert.ok(nodeNames.includes('HeaderPanel'));
  assert.ok(nodeNames.includes('ActionPanel'));
  assert.ok(nodeNames.includes('VideoStagePanel'));
  assert.ok(nodeNames.includes('LogPanel'));
  assert.match(content, new RegExp(demoRootUuid));
  assert.doesNotMatch(content, /__simple_Initialize/);
});

test('example bootstrap no longer mounts the monolithic controller at runtime', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`,
    'utf8',
  );

  assert.match(content, /EVENT_AFTER_SCENE_LAUNCH/);
  assert.match(content, /profiler/);
  assert.doesNotMatch(content, /canvas\.addComponent\(AgoraRtcExampleController\)/);
  assert.doesNotMatch(content, /ensureExampleControllerMounted/);
});

test('new demo component scripts have stable Cocos metadata', async () => {
  const rootMeta = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts.meta`,
    'utf8',
  );
  const serviceMeta = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts.meta`,
    'utf8',
  );

  assert.match(rootMeta, new RegExp(demoRootUuid));
  assert.match(serviceMeta, new RegExp(rtcSessionUuid));
  for (const uuid of panelScriptUuids) {
    const metas = await Promise.all([
      readFile(`${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts.meta`, 'utf8'),
      readFile(`${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts.meta`, 'utf8'),
      readFile(`${repoRoot}/example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts.meta`, 'utf8'),
      readFile(`${repoRoot}/example/basic-call/assets/scripts/demo/panels/LogPanel.ts.meta`, 'utf8'),
    ]);
    assert.ok(metas.some((content) => content.includes(uuid)));
  }
});
```

- [ ] **Step 2: Update the old controller source test names**

In `tests/example-scene.test.ts`, change tests that start with `example controller` to assert against the new file that owns that behavior. Use these replacements for the first three controller checks:

```ts
test('rtc session service uses lazy client creation and loads native engine texture slots', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(content, /createAgoraRtcClient/);
  assert.match(content, /private client: AgoraRtcClient \| null = null;/);
  assert.match(content, /private getClient\(\): AgoraRtcClient/);
  assert.match(content, /bindNativeTextureSprite/);
  assert.match(content, /getEngineTexture\(slotId\)/);
  assert.doesNotMatch(content, /Texture2D\.PixelFormat\.RGBA8888/);
  assert.doesNotMatch(content, /uploadData/);
});

test('demo root loads runtime config and auto joins after scene startup', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  assert.match(content, /resolveAgoraExampleConfig/);
  assert.match(content, /this\.loadJsonConfig\('agora-config\.build'\)/);
  assert.match(content, /this\.loadJsonConfig\('agora-config'\)/);
  assert.match(content, /Auto initialize \+ join enabled/);
  assert.match(content, /await this\.initializeRtc\(\);/);
  assert.match(content, /await this\.joinRtcChannel\(\);/);
});

test('demo action registry keeps all QA API buttons grouped', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/actions.ts`,
    'utf8',
  );

  assert.match(content, /DEFAULT_BUTTON_LAYOUT/);
  assert.match(content, /SESSION_QUICK_BUTTONS/);
  assert.match(content, /BUTTON_SECTION_LAYOUT/);
  assert.match(content, /EnableAudio/);
  assert.match(content, /PlaybackUserVolume/);
});
```

- [ ] **Step 3: Update productization packaging expectations**

In `tests/productization.test.ts`, replace the single old source expectation around `example/basic-call/assets/scripts/AgoraRtcExampleController.ts` with:

```ts
const demoScriptFiles = [
  'example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts',
  'example/basic-call/assets/scripts/demo/RtcSessionService.ts',
  'example/basic-call/assets/scripts/demo/actions.ts',
  'example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts',
  'example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts',
  'example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts',
  'example/basic-call/assets/scripts/demo/panels/LogPanel.ts',
];

for (const file of demoScriptFiles) {
  assert.ok(files.includes(file), `expected customer package to include ${file}`);
}
```

- [ ] **Step 4: Run the architecture tests and verify they fail for the new reasons**

Run:

```bash
npm test -- tests/example-scene.test.ts tests/productization.test.ts
```

Expected: FAIL because `DemoRoot`, new demo scripts, and new metadata files do not exist yet.

- [ ] **Step 5: Commit the failing tests**

```bash
git add tests/example-scene.test.ts tests/productization.test.ts
git commit -m "test: define cocos prefab demo architecture"
```

### Task 2: Add Shared Demo Contracts And Action Registry

**Files:**
- Create: `example/basic-call/assets/scripts/demo.meta`
- Create: `example/basic-call/assets/scripts/demo/actions.ts`
- Create: `example/basic-call/assets/scripts/demo/actions.ts.meta`
- Create: `example/basic-call/assets/scripts/demo/types.ts`
- Create: `example/basic-call/assets/scripts/demo/types.ts.meta`

- [ ] **Step 1: Create the demo script directory metadata**

Create `example/basic-call/assets/scripts/demo.meta`:

```json
{
  "ver": "1.1.0",
  "importer": "directory",
  "imported": true,
  "uuid": "2eae89cb-6f8e-4615-ac44-0012f1200100",
  "files": [],
  "subMetas": {},
  "userData": {
    "compressionType": {},
    "isRemoteBundle": {}
  }
}
```

- [ ] **Step 2: Add shared panel and session types**

Create `example/basic-call/assets/scripts/demo/types.ts`:

```ts
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
```

- [ ] **Step 3: Add types metadata**

Create `example/basic-call/assets/scripts/demo/types.ts.meta`:

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000101",
  "files": [],
  "subMetas": {},
  "userData": {
    "simulateGlobals": []
  }
}
```

- [ ] **Step 4: Move action constants into a registry file**

Create `example/basic-call/assets/scripts/demo/actions.ts` by copying the button arrays and label maps from `AgoraRtcExampleController.ts`, exporting them with these exact names:

```ts
export const DEFAULT_BUTTON_LAYOUT = [
  { name: 'Initialize', handler: 'initializeRtc' },
  { name: 'Join', handler: 'joinRtcChannel' },
  { name: 'Leave', handler: 'leaveRtcChannel' },
  { name: 'Preview', handler: 'togglePreview' },
  { name: 'Views', handler: 'refreshRtcViews' },
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
  { name: 'MuteLocalVideo', handler: 'toggleMuteLocalVideo' },
  { name: 'MuteRemoteVideo', handler: 'toggleMuteRemoteVideo' },
  { name: 'MuteAllRemoteVideo', handler: 'toggleMuteAllRemoteVideo' },
  { name: 'SwitchCamera', handler: 'triggerSwitchCamera' },
  { name: 'BeautyEffect', handler: 'toggleBeautyEffect' },
  { name: 'ContentInspect', handler: 'toggleContentInspect' },
  { name: 'PlaybackUserVolume', handler: 'togglePlaybackUserVolume' },
] as const;

export const SESSION_QUICK_BUTTONS = ['Initialize', 'Join', 'Leave'] as const;

export const BUTTON_SECTION_LAYOUT = [
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
    'AudioProfile',
  ] },
  { title: 'Video API', buttons: [
    'EnableVideo',
    'MuteLocalVideo',
    'MuteRemoteVideo',
    'MuteAllRemoteVideo',
    'SwitchCamera',
    'BeautyEffect',
    'ContentInspect',
    'PlaybackUserVolume',
  ] },
  { title: 'Mixer', buttons: ['Mixing', 'Effect', 'Diag'] },
  { title: 'Tools', buttons: ['Freeze', 'Clear'] },
] as const;

export const ACTION_LABELS: Record<string, string> = {
  Initialize: 'Initialize',
  Join: 'Join',
  Leave: 'Leave',
  Preview: 'Preview',
  Views: 'Views',
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
  MuteLocalVideo: 'Mute Local Video',
  MuteRemoteVideo: 'Mute Remote Video',
  MuteAllRemoteVideo: 'Mute All Remote',
  SwitchCamera: 'Switch Camera',
  BeautyEffect: 'Beauty Effect',
  ContentInspect: 'Content Inspect',
  PlaybackUserVolume: 'User Volume',
};

export type DemoActionName = typeof DEFAULT_BUTTON_LAYOUT[number]['name'];
export type DemoActionHandlerName = typeof DEFAULT_BUTTON_LAYOUT[number]['handler'];
```

- [ ] **Step 5: Add actions metadata**

Create `example/basic-call/assets/scripts/demo/actions.ts.meta`:

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000100",
  "files": [],
  "subMetas": {},
  "userData": {
    "simulateGlobals": []
  }
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: the action registry test now passes; scene, root, panel, and service tests still fail because the components and assets are not created.

- [ ] **Step 7: Commit shared contracts**

```bash
git add example/basic-call/assets/scripts/demo.meta \
  example/basic-call/assets/scripts/demo/actions.ts \
  example/basic-call/assets/scripts/demo/actions.ts.meta \
  example/basic-call/assets/scripts/demo/types.ts \
  example/basic-call/assets/scripts/demo/types.ts.meta
git commit -m "feat: add demo action and state contracts"
```

### Task 3: Add Panel Components And Shared UI Styles

**Files:**
- Create: `example/basic-call/assets/scripts/demo/panels.meta`
- Create: `example/basic-call/assets/scripts/demo/ui.meta`
- Create: `example/basic-call/assets/scripts/demo/ui/uiStyles.ts`
- Create: `example/basic-call/assets/scripts/demo/ui/uiStyles.ts.meta`
- Create: `example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts`
- Create: `example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts.meta`
- Create: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`
- Create: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts.meta`
- Create: `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`
- Create: `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts.meta`
- Create: `example/basic-call/assets/scripts/demo/panels/LogPanel.ts`
- Create: `example/basic-call/assets/scripts/demo/panels/LogPanel.ts.meta`

- [ ] **Step 1: Create panel and UI directory metadata**

Create `example/basic-call/assets/scripts/demo/panels.meta` and `example/basic-call/assets/scripts/demo/ui.meta` using the directory meta shape from Task 2 with UUIDs from the Stable UUIDs section.

- [ ] **Step 2: Add shared UI styles**

Create `example/basic-call/assets/scripts/demo/ui/uiStyles.ts`:

```ts
import { Color, Graphics, Label, Node, UITransform } from 'cc';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'toggleOn' | 'toggleOff';

export const COLORS = {
  panelFill: new Color(12, 18, 28, 236),
  panelStroke: new Color(78, 112, 138, 210),
  textPrimary: new Color(230, 240, 250, 255),
  textMuted: new Color(166, 182, 198, 255),
  ok: new Color(28, 108, 88, 255),
  fail: new Color(178, 56, 56, 255),
  primary: new Color(42, 118, 178, 255),
  secondary: new Color(44, 58, 76, 255),
};

export function ensureTransform(node: Node, width: number, height: number): UITransform {
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  return transform;
}

export function configureLabel(label: Label, text: string, fontSize: number, color = COLORS.textPrimary): void {
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = fontSize + 4;
  label.useSystemFont = true;
  label.fontFamily = 'Arial';
  label.color = color;
}

export function drawPanel(graphics: Graphics, width: number, height: number): void {
  graphics.clear();
  graphics.fillColor = COLORS.panelFill;
  graphics.strokeColor = COLORS.panelStroke;
  graphics.lineWidth = 1;
  graphics.roundRect(-width / 2, -height / 2, width, height, 6);
  graphics.fill();
  graphics.stroke();
}

export function drawButton(graphics: Graphics, width: number, height: number, variant: ButtonVariant): void {
  graphics.clear();
  const fill = variant === 'primary'
    ? COLORS.primary
    : variant === 'danger'
      ? COLORS.fail
      : variant === 'toggleOn'
        ? COLORS.ok
        : COLORS.secondary;
  graphics.fillColor = fill;
  graphics.strokeColor = new Color(96, 130, 160, 220);
  graphics.lineWidth = 1;
  graphics.roundRect(-width / 2, -height / 2, width, height, 6);
  graphics.fill();
  graphics.stroke();
}
```

- [ ] **Step 3: Add header panel**

Create `example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts`:

```ts
import { _decorator, Component, EditBox, Label, Node } from 'cc';
import type { RuntimeConfigState, DemoSessionState } from '../types.ts';

const { ccclass, property } = _decorator;

@ccclass('DemoHeaderPanel')
export class DemoHeaderPanel extends Component {
  @property(Label)
  configLabel: Label | null = null;

  @property(Label)
  summaryLabel: Label | null = null;

  @property(EditBox)
  channelInput: EditBox | null = null;

  @property(EditBox)
  uidInput: EditBox | null = null;

  @property(Node)
  logButton: Node | null = null;

  private onOpenLog: (() => void) | null = null;
  private onApplyConfig: ((channelId: string, uid: number) => void) | null = null;

  initialize(callbacks: {
    onOpenLog: () => void;
    onApplyConfig: (channelId: string, uid: number) => void;
  }): void {
    this.onOpenLog = callbacks.onOpenLog;
    this.onApplyConfig = callbacks.onApplyConfig;
    this.logButton?.off(Node.EventType.TOUCH_END);
    this.logButton?.on(Node.EventType.TOUCH_END, () => this.onOpenLog?.(), this);
  }

  setConfig(config: RuntimeConfigState): void {
    if (this.configLabel) {
      const tokenState = config.token ? 'configured' : 'not configured';
      this.configLabel.string = `App ${this.maskAppId(config.appId)}  ·  Token ${tokenState}\nChannel ${config.channelId}  ·  UID ${config.uid}\nRender ${config.renderBackend}`;
    }
    if (this.channelInput) {
      this.channelInput.string = config.channelId;
    }
    if (this.uidInput) {
      this.uidInput.string = String(config.uid);
    }
  }

  setSummary(state: DemoSessionState): void {
    if (!this.summaryLabel) {
      return;
    }
    this.summaryLabel.string = [
      `Initialized ${state.initialized ? 'yes' : 'no'} · Joined ${state.joined ? 'yes' : 'no'} · Preview ${state.previewStarted ? 'on' : 'off'}`,
      `Remote users ${state.remoteUserUids.length} · Last error ${state.lastErrorMessage}`,
      `RTC ${state.lastRtcStatsSummary} · Volume ${state.lastVolumeSummary}`,
    ].join('\n');
  }

  applyConfigFromInputs(): void {
    const channelId = this.channelInput?.string.trim() || 'demo';
    const parsedUid = Number(this.uidInput?.string ?? '');
    const uid = Number.isFinite(parsedUid) && parsedUid > 0 ? Math.floor(parsedUid) : 1001;
    this.onApplyConfig?.(channelId, uid);
  }

  private maskAppId(appId: string): string {
    if (appId.length <= 8) {
      return appId || '-';
    }
    return `${appId.slice(0, 4)}...${appId.slice(-4)}`;
  }
}
```

- [ ] **Step 4: Add action panel**

Create `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`:

```ts
import { _decorator, Component, Label, Node, UITransform } from 'cc';
import { ACTION_LABELS, BUTTON_SECTION_LAYOUT, DEFAULT_BUTTON_LAYOUT, SESSION_QUICK_BUTTONS } from '../actions.ts';
import type { ActionResult } from '../types.ts';

const { ccclass, property } = _decorator;

@ccclass('DemoActionPanel')
export class DemoActionPanel extends Component {
  @property(Node)
  quickBar: Node | null = null;

  @property(Node)
  actionGrid: Node | null = null;

  private onAction: ((actionName: string) => void) | null = null;
  private labels = new Map<string, Label>();
  private results = new Map<string, ActionResult>();

  initialize(onAction: (actionName: string) => void): void {
    this.onAction = onAction;
    this.ensureButtons();
    this.refresh();
  }

  setActionResult(actionName: string, result: ActionResult): void {
    this.results.set(actionName, result);
    this.refreshButton(actionName);
  }

  refresh(): void {
    for (const button of DEFAULT_BUTTON_LAYOUT) {
      this.refreshButton(button.name);
    }
  }

  private ensureButtons(): void {
    this.ensureButtonList(this.quickBar ?? this.node, [...SESSION_QUICK_BUTTONS]);
    for (const section of BUTTON_SECTION_LAYOUT) {
      this.ensureButtonList(this.actionGrid ?? this.node, [...section.buttons]);
    }
  }

  private ensureButtonList(parent: Node, names: string[]): void {
    names.forEach((name, index) => {
      let buttonNode = parent.getChildByName(`Action_${name}`);
      if (!buttonNode) {
        buttonNode = new Node(`Action_${name}`);
        buttonNode.setParent(parent);
        buttonNode.layer = parent.layer;
        buttonNode.setPosition((index % 3) * 126 - 126, -Math.floor(index / 3) * 42, 0);
        buttonNode.addComponent(UITransform).setContentSize(120, 36);
        const labelNode = new Node('Label');
        labelNode.setParent(buttonNode);
        labelNode.layer = parent.layer;
        labelNode.addComponent(UITransform).setContentSize(120, 36);
        const label = labelNode.addComponent(Label);
        this.labels.set(name, label);
      } else {
        const label = buttonNode.getChildByName('Label')?.getComponent(Label);
        if (label) {
          this.labels.set(name, label);
        }
      }
      buttonNode.off(Node.EventType.TOUCH_END);
      buttonNode.on(Node.EventType.TOUCH_END, () => this.onAction?.(name), this);
    });
  }

  private refreshButton(name: string): void {
    const label = this.labels.get(name);
    if (!label) {
      return;
    }
    const result = this.results.get(name) ?? 'idle';
    const suffix = result === 'ok' ? ' OK' : result === 'fail' ? ' FAIL' : '';
    label.string = `${ACTION_LABELS[name] ?? name}${suffix}`;
    label.fontSize = 14;
    label.lineHeight = 18;
  }
}
```

- [ ] **Step 5: Add video panel**

Create `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts` with methods that mirror the current controller's video UI responsibilities:

```ts
import { _decorator, Component, Label, Node, PageView, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('VideoStagePanel')
export class VideoStagePanel extends Component {
  @property(Node)
  localCard: Node | null = null;

  @property(Node)
  remoteCard: Node | null = null;

  @property(Label)
  localHintLabel: Label | null = null;

  @property(Sprite)
  localVideoSprite: Sprite | null = null;

  private remoteHintLabels = new Map<number, Label>();
  private remoteVideoSprites = new Map<number, Sprite>();
  private remoteVideoNodes = new Map<number, Node>();
  private remotePageView: PageView | null = null;

  initialize(): void {
    this.remotePageView = this.remoteCard?.getComponent(PageView) ?? null;
  }

  setLocalHint(text: string): void {
    if (this.localHintLabel) {
      this.localHintLabel.string = text;
    }
  }

  setRemoteUsers(uids: number[], activeUid: number | null): void {
    for (const uid of uids) {
      this.ensureRemoteUserPage(uid);
    }
    for (const uid of [...this.remoteVideoNodes.keys()]) {
      if (!uids.includes(uid)) {
        this.removeRemoteUserPage(uid);
      }
    }
    if (activeUid !== null) {
      this.focusRemoteUser(activeUid);
    }
  }

  getLocalVideoNode(): Node | null {
    return this.localVideoSprite?.node ?? null;
  }

  getRemoteVideoNode(uid: number): Node | null {
    return this.ensureRemoteUserPage(uid);
  }

  bindLocalSpriteFrame(texture: Texture2D, spriteFrame: SpriteFrame): void {
    if (this.localVideoSprite) {
      spriteFrame.texture = texture;
      this.localVideoSprite.spriteFrame = spriteFrame;
    }
  }

  bindRemoteSpriteFrame(uid: number, texture: Texture2D, spriteFrame: SpriteFrame): void {
    const sprite = this.remoteVideoSprites.get(uid);
    if (sprite) {
      spriteFrame.texture = texture;
      sprite.spriteFrame = spriteFrame;
    }
  }

  private ensureRemoteUserPage(uid: number): Node | null {
    if (this.remoteVideoNodes.has(uid)) {
      return this.remoteVideoNodes.get(uid) ?? null;
    }
    const parent = this.remoteCard ?? this.node;
    const pageNode = new Node(`RemoteUser_${uid}`);
    pageNode.setParent(parent);
    pageNode.layer = parent.layer;
    pageNode.addComponent(UITransform).setContentSize(320, 180);
    const spriteNode = new Node('VideoSprite');
    spriteNode.setParent(pageNode);
    spriteNode.layer = parent.layer;
    spriteNode.addComponent(UITransform).setContentSize(320, 180);
    const sprite = spriteNode.addComponent(Sprite);
    const hintNode = new Node('Hint');
    hintNode.setParent(pageNode);
    hintNode.layer = parent.layer;
    hintNode.addComponent(UITransform).setContentSize(320, 32);
    const hint = hintNode.addComponent(Label);
    hint.string = `Remote ${uid}`;
    this.remoteVideoNodes.set(uid, pageNode);
    this.remoteVideoSprites.set(uid, sprite);
    this.remoteHintLabels.set(uid, hint);
    return pageNode;
  }

  private removeRemoteUserPage(uid: number): void {
    this.remoteVideoNodes.get(uid)?.destroy();
    this.remoteVideoNodes.delete(uid);
    this.remoteVideoSprites.delete(uid);
    this.remoteHintLabels.delete(uid);
  }

  private focusRemoteUser(uid: number): void {
    const node = this.remoteVideoNodes.get(uid);
    if (node) {
      node.setSiblingIndex(this.remoteCard?.children.length ?? 0);
    }
  }
}
```

- [ ] **Step 6: Add log panel**

Create `example/basic-call/assets/scripts/demo/panels/LogPanel.ts`:

```ts
import { _decorator, Component, Label, Node, ScrollView } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('LogPanel')
export class LogPanel extends Component {
  @property(Label)
  bodyLabel: Label | null = null;

  @property(ScrollView)
  scrollView: ScrollView | null = null;

  @property(Node)
  backButton: Node | null = null;

  @property(Node)
  clearButton: Node | null = null;

  @property(Node)
  freezeButton: Node | null = null;

  private onClose: (() => void) | null = null;
  private onClear: (() => void) | null = null;
  private onFreeze: (() => void) | null = null;

  initialize(callbacks: {
    onClose: () => void;
    onClear: () => void;
    onFreeze: () => void;
  }): void {
    this.onClose = callbacks.onClose;
    this.onClear = callbacks.onClear;
    this.onFreeze = callbacks.onFreeze;
    this.bind(this.backButton, () => this.onClose?.());
    this.bind(this.clearButton, () => this.onClear?.());
    this.bind(this.freezeButton, () => this.onFreeze?.());
    this.hide();
  }

  show(): void {
    this.node.active = true;
    this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1);
    this.scrollView?.scrollToBottom(0, false);
  }

  hide(): void {
    this.node.active = false;
  }

  setLines(lines: string[]): void {
    if (this.bodyLabel) {
      this.bodyLabel.string = lines.join('\n');
    }
    if (this.node.active) {
      this.scrollView?.scrollToBottom(0, false);
    }
  }

  private bind(node: Node | null, handler: () => void): void {
    node?.off(Node.EventType.TOUCH_END);
    node?.on(Node.EventType.TOUCH_END, handler, this);
  }
}
```

- [ ] **Step 7: Add metadata for each TypeScript file**

For each new `.ts` file, create the matching `.meta` with this exact shape. Use the file-specific UUID already listed in the Stable UUIDs table. For example, `example/basic-call/assets/scripts/demo/ui/uiStyles.ts.meta` is:

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000108",
  "files": [],
  "subMetas": {},
  "userData": {
    "simulateGlobals": []
  }
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: panel metadata checks pass; service, root, and scene checks still fail.

- [ ] **Step 9: Commit panel components**

```bash
git add example/basic-call/assets/scripts/demo/panels.meta \
  example/basic-call/assets/scripts/demo/ui.meta \
  example/basic-call/assets/scripts/demo/ui/uiStyles.ts \
  example/basic-call/assets/scripts/demo/ui/uiStyles.ts.meta \
  example/basic-call/assets/scripts/demo/panels \
  example/basic-call/assets/scripts/demo/panels/*.meta
git commit -m "feat: add prefab-backed demo panel components"
```

### Task 4: Extract RTC Session Service

**Files:**
- Create: `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
- Create: `example/basic-call/assets/scripts/demo/RtcSessionService.ts.meta`
- Modify: `example/basic-call/assets/scripts/AgoraRtcExampleController.ts`

- [ ] **Step 1: Create the service with the current client lifecycle**

Create `example/basic-call/assets/scripts/demo/RtcSessionService.ts`. Start by moving these current methods and state from `AgoraRtcExampleController.ts` into the service:

```text
private client: AgoraRtcClient | null = null
private listenersBound = false
private initialized = false
private joined = false
private previewStarted = false
private remoteUserUids = new Set<number>()
private activeRemoteUid: number | null = null
private getClient()
private bindRtcEventListeners()
initializeRtc()
joinRtcChannel()
leaveRtcChannel()
teardownRtc()
togglePreview()
refreshRtcViews()
setupLocalVideoView()
setupRemoteVideoView()
removeLocalVideoView()
removeRemoteVideoView()
bindNativeTextureSprite()
releaseNativeTextureSlot()
```

The service constructor receives dependencies instead of reading UI fields directly:

```ts
export interface RtcSessionServiceOptions {
  getConfig(): RuntimeConfigState;
  getLocalVideoNode(): Node | null;
  getRemoteVideoNode(uid: number): Node | null;
  onLog(line: string): void;
  onStateChanged(): void;
  onRemoteUsersChanged(uids: number[], activeUid: number | null): void;
  onLocalTextureReady(texture: Texture2D, spriteFrame: SpriteFrame): void;
  onRemoteTextureReady(uid: number, texture: Texture2D, spriteFrame: SpriteFrame): void;
}
```

- [ ] **Step 2: Preserve public command names**

Expose these methods on `RtcSessionService` so `AgoraRtcDemoRoot` can keep the existing button handlers:

```ts
initializeRtc(): Promise<void>;
joinRtcChannel(): Promise<void>;
leaveRtcChannel(): Promise<void>;
togglePreview(): Promise<void>;
refreshRtcViews(): Promise<void>;
toggleEnableAudio(): Promise<void>;
toggleEnableLocalAudio(): Promise<void>;
toggleMuteLocalAudio(): Promise<void>;
toggleMuteRemoteAudio(): Promise<void>;
toggleMuteAllRemoteAudio(): Promise<void>;
toggleAudioVolumeIndication(): Promise<void>;
toggleDefaultAudioRoute(): Promise<void>;
togglePlaybackVolume(): Promise<void>;
toggleAudioProfile(): Promise<void>;
toggleEnableVideo(): Promise<void>;
toggleMuteLocalVideo(): Promise<void>;
toggleMuteRemoteVideo(): Promise<void>;
toggleMuteAllRemoteVideo(): Promise<void>;
triggerSwitchCamera(): Promise<void>;
toggleBeautyEffect(): Promise<void>;
toggleContentInspect(): Promise<void>;
togglePlaybackUserVolume(): Promise<void>;
runCapabilityDemo(): Promise<void>;
runChannelRoleDemo(): Promise<void>;
runMixingDemo(): Promise<void>;
runEffectDemo(): Promise<void>;
runDiagnosticsDemo(): Promise<void>;
```

- [ ] **Step 3: Add service metadata**

Create `example/basic-call/assets/scripts/demo/RtcSessionService.ts.meta` with UUID `6f0fce55-1000-42b8-8b7b-1aaf80000102`.

- [ ] **Step 4: Leave a compatibility export in the old controller file**

Replace `AgoraRtcExampleController.ts` with a small compatibility class that logs a deprecation warning and adds `AgoraRtcDemoRoot` when the old component is manually attached:

```ts
import { _decorator, Component } from 'cc';
import { AgoraRtcDemoRoot } from './demo/AgoraRtcDemoRoot.ts';

const { ccclass } = _decorator;

@ccclass('AgoraRtcExampleController')
export class AgoraRtcExampleController extends Component {
  onLoad(): void {
    console.warn('[agora-rtc] AgoraRtcExampleController is deprecated; use AgoraRtcDemoRoot on DemoRoot.');
    if (!this.node.getComponent(AgoraRtcDemoRoot)) {
      this.node.addComponent(AgoraRtcDemoRoot);
    }
  }
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: service source checks pass; scene and root checks still fail.

- [ ] **Step 6: Commit the service extraction**

```bash
git add example/basic-call/assets/scripts/demo/RtcSessionService.ts \
  example/basic-call/assets/scripts/demo/RtcSessionService.ts.meta \
  example/basic-call/assets/scripts/AgoraRtcExampleController.ts
git commit -m "feat: extract rtc session service"
```

### Task 5: Add Demo Root And Scene-Bound Orchestration

**Files:**
- Create: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
- Create: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts.meta`

- [ ] **Step 1: Create the root component**

Create `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`:

```ts
import { _decorator, Component, JsonAsset, resources, sys, view } from 'cc';
import { resolveAgoraExampleConfig, type AgoraExampleRuntimeConfig } from '../agoraRtcConfigOverride.ts';
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
    await this.loadRuntimeConfig();
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

  async initializeRtc(): Promise<void> { await this.runSessionAction('Initialize', (session) => session.initializeRtc()); }
  async joinRtcChannel(): Promise<void> { await this.runSessionAction('Join', (session) => session.joinRtcChannel()); }
  async leaveRtcChannel(): Promise<void> { await this.runSessionAction('Leave', (session) => session.leaveRtcChannel()); }
  async togglePreview(): Promise<void> { await this.runSessionAction('Preview', (session) => session.togglePreview()); }
  async refreshRtcViews(): Promise<void> { await this.runSessionAction('Views', (session) => session.refreshRtcViews()); }

  async clearStatusLog(): Promise<void> {
    this.statusLines = [];
    this.refreshLogPanel();
  }

  async toggleStatusFreeze(): Promise<void> {
    this.statusFrozen = !this.statusFrozen;
    this.pushStatus(`Status log ${this.statusFrozen ? 'frozen' : 'live'}`);
  }

  openStatusLogPage(): void {
    this.logPanel?.show();
  }

  closeStatusLogPage(): void {
    this.logPanel?.hide();
  }

  private createSession(): void {
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
    this.appId = config.appId || this.appId;
    this.token = config.token || this.token;
    this.channelId = config.channelId || this.channelId;
    this.uid = typeof config.uid === 'number' ? config.uid : this.uid;
    this.renderBackend = config.renderBackend ?? this.renderBackend;
  }

  private loadJsonConfig(name: string): Promise<AgoraExampleRuntimeConfig | null> {
    return new Promise((resolve) => {
      resources.load(name, JsonAsset, (error, asset) => {
        if (error || !asset) {
          resolve(null);
          return;
        }
        resolve(asset.json as AgoraExampleRuntimeConfig);
      });
    });
  }

  private async invokeAction(actionName: string): Promise<void> {
    const spec = DEFAULT_BUTTON_LAYOUT.find((item) => item.name === actionName);
    if (!spec) {
      this.pushStatus(`Unknown action: ${actionName}`);
      return;
    }
    const handler = (this as any)[spec.handler];
    if (typeof handler !== 'function') {
      this.pushStatus(`Action not wired: ${actionName}`);
      this.setActionResult(actionName, 'fail');
      return;
    }
    await Promise.resolve(handler.call(this));
  }

  private async runSessionAction(actionName: string, action: (session: RtcSessionService) => Promise<void>): Promise<void> {
    if (!this.session) {
      this.createSession();
    }
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
      speakerphoneEnabled: null,
      lastErrorMessage: '-',
      lastRtcStatsSummary: '-',
      lastVolumeSummary: '-',
    };
  }
}
```

- [ ] **Step 2: Add forwarding methods for all remaining actions**

Add methods to `AgoraRtcDemoRoot` for every handler exported from `DEFAULT_BUTTON_LAYOUT`. Each method calls `runSessionAction` with the matching action label and `RtcSessionService` method. Example:

```ts
async toggleEnableAudio(): Promise<void> { await this.runSessionAction('EnableAudio', (session) => session.toggleEnableAudio()); }
async toggleEnableLocalAudio(): Promise<void> { await this.runSessionAction('EnableLocalAudio', (session) => session.toggleEnableLocalAudio()); }
async toggleMuteLocalAudio(): Promise<void> { await this.runSessionAction('MuteLocalAudio', (session) => session.toggleMuteLocalAudio()); }
async toggleMuteRemoteAudio(): Promise<void> { await this.runSessionAction('MuteRemoteAudio', (session) => session.toggleMuteRemoteAudio()); }
async toggleMuteAllRemoteAudio(): Promise<void> { await this.runSessionAction('MuteAllRemoteAudio', (session) => session.toggleMuteAllRemoteAudio()); }
async toggleAudioVolumeIndication(): Promise<void> { await this.runSessionAction('AudioVolumeIndication', (session) => session.toggleAudioVolumeIndication()); }
async toggleDefaultAudioRoute(): Promise<void> { await this.runSessionAction('DefaultAudioRoute', (session) => session.toggleDefaultAudioRoute()); }
async togglePlaybackVolume(): Promise<void> { await this.runSessionAction('PlaybackVolume', (session) => session.togglePlaybackVolume()); }
async toggleAudioProfile(): Promise<void> { await this.runSessionAction('AudioProfile', (session) => session.toggleAudioProfile()); }
async toggleEnableVideo(): Promise<void> { await this.runSessionAction('EnableVideo', (session) => session.toggleEnableVideo()); }
async toggleMuteLocalVideo(): Promise<void> { await this.runSessionAction('MuteLocalVideo', (session) => session.toggleMuteLocalVideo()); }
async toggleMuteRemoteVideo(): Promise<void> { await this.runSessionAction('MuteRemoteVideo', (session) => session.toggleMuteRemoteVideo()); }
async toggleMuteAllRemoteVideo(): Promise<void> { await this.runSessionAction('MuteAllRemoteVideo', (session) => session.toggleMuteAllRemoteVideo()); }
async triggerSwitchCamera(): Promise<void> { await this.runSessionAction('SwitchCamera', (session) => session.triggerSwitchCamera()); }
async toggleBeautyEffect(): Promise<void> { await this.runSessionAction('BeautyEffect', (session) => session.toggleBeautyEffect()); }
async toggleContentInspect(): Promise<void> { await this.runSessionAction('ContentInspect', (session) => session.toggleContentInspect()); }
async togglePlaybackUserVolume(): Promise<void> { await this.runSessionAction('PlaybackUserVolume', (session) => session.togglePlaybackUserVolume()); }
async runCapabilityDemo(): Promise<void> { await this.runSessionAction('Full Demo', (session) => session.runCapabilityDemo()); }
async runChannelRoleDemo(): Promise<void> { await this.runSessionAction('Channel', (session) => session.runChannelRoleDemo()); }
async runMixingDemo(): Promise<void> { await this.runSessionAction('Mixing', (session) => session.runMixingDemo()); }
async runEffectDemo(): Promise<void> { await this.runSessionAction('Effect', (session) => session.runEffectDemo()); }
async runDiagnosticsDemo(): Promise<void> { await this.runSessionAction('Diag', (session) => session.runDiagnosticsDemo()); }
```

- [ ] **Step 3: Add root metadata**

Create `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts.meta` with UUID `6f0fce55-1000-42b8-8b7b-1aaf80000103`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: root source checks pass; scene checks still fail because `main.scene` is not wired yet.

- [ ] **Step 5: Commit root orchestration**

```bash
git add example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts \
  example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts.meta
git commit -m "feat: add scene-bound rtc demo root"
```

### Task 6: Write Prefab Assets And Wire main.scene

**Files:**
- Create: `example/basic-call/assets/prefabs.meta`
- Create: `example/basic-call/assets/prefabs/DemoRoot.prefab`
- Create: `example/basic-call/assets/prefabs/DemoRoot.prefab.meta`
- Create: `example/basic-call/assets/prefabs/HeaderPanel.prefab`
- Create: `example/basic-call/assets/prefabs/HeaderPanel.prefab.meta`
- Create: `example/basic-call/assets/prefabs/ActionPanel.prefab`
- Create: `example/basic-call/assets/prefabs/ActionPanel.prefab.meta`
- Create: `example/basic-call/assets/prefabs/VideoStagePanel.prefab`
- Create: `example/basic-call/assets/prefabs/VideoStagePanel.prefab.meta`
- Create: `example/basic-call/assets/prefabs/LogPanel.prefab`
- Create: `example/basic-call/assets/prefabs/LogPanel.prefab.meta`
- Modify: `example/basic-call/assets/scene/main.scene`

- [ ] **Step 1: Create prefab directory metadata**

Create `example/basic-call/assets/prefabs.meta` with UUID `2eae89cb-6f8e-4615-ac44-0012f1200200` using the directory meta shape from Task 2.

- [ ] **Step 2: Create prefab metadata**

For each `.prefab.meta`, use this exact shape with the file-specific UUID listed in Stable UUIDs. For example, `example/basic-call/assets/prefabs/DemoRoot.prefab.meta` is:

```json
{
  "ver": "1.1.50",
  "importer": "prefab",
  "imported": true,
  "uuid": "7f0fce55-1000-42b8-8b7b-1aaf80000200",
  "files": [
    ".json"
  ],
  "subMetas": {},
  "userData": {}
}
```

- [ ] **Step 3: Create prefab JSON assets**

Create each `.prefab` as a `cc.Prefab` JSON array with a root `cc.Node`, `cc.UITransform`, and the matching panel component. Use `main.scene` as the source of truth for final layout. For `DemoRoot.prefab`, include child nodes named:

```text
HeaderPanel
ActionPanel
VideoStagePanel
LogPanel
```

- [ ] **Step 4: Wire `main.scene` directly**

Modify `example/basic-call/assets/scene/main.scene` so `Canvas._children` contains a single `DemoRoot` child plus any existing safe camera linkage. `DemoRoot` must contain:

```text
HeaderPanel
ActionPanel
VideoStagePanel
LogPanel
```

Attach these components:

```text
DemoRoot -> AgoraRtcDemoRoot
HeaderPanel -> DemoHeaderPanel
ActionPanel -> DemoActionPanel
VideoStagePanel -> VideoStagePanel
LogPanel -> LogPanel
```

Bind `AgoraRtcDemoRoot` properties to the four panel components. Bind each panel component property to concrete child labels, inputs, buttons, sprites, and scroll views in the same scene JSON.

- [ ] **Step 5: Run scene tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: scene and metadata tests pass.

- [ ] **Step 6: Commit scene and prefab assets**

```bash
git add example/basic-call/assets/prefabs.meta \
  example/basic-call/assets/prefabs \
  example/basic-call/assets/scene/main.scene
git commit -m "feat: wire demo scene to prefab-style panels"
```

### Task 7: Retire Dynamic Bootstrap And Sync Setup Scripts

**Files:**
- Modify: `example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`
- Modify: `scripts/prepare-example.sh`
- Modify: `scripts/patch-exported-main-bundle.mjs`

- [ ] **Step 1: Replace bootstrap runtime mounting**

Modify `AgoraRtcExampleBootstrap.ts` so it keeps native cache/profiler setup but removes imports and code for `AgoraRtcExampleController`. The file should keep this behavior:

```ts
import { director, Director, game, native, sys } from 'cc';

console.log('[agora-rtc] bootstrap module loaded v20260608-prefab-root');

function configureNativeRuntime(): void {
  if (!sys.isNative) {
    return;
  }
  try {
    (globalThis as any).cc?.assetManager?.cacheManager?.clearCache?.();
    game.config.showFPS = false;
    if (director.root?.pipeline) {
      director.root.pipeline.profiler = null;
    }
    (globalThis as any).cc?.profiler?.hideStats?.();
    const writablePath = (globalThis as any).jsb?.fileUtils?.getWritablePath?.() ?? 'unknown';
    const cacheDir = (globalThis as any).cc?.assetManager?.cacheManager?.cacheDir ?? 'unknown';
    console.log('[agora-rtc] bootstrap runtime paths', writablePath, cacheDir, Boolean(native));
  } catch (error) {
    console.log('[agora-rtc] bootstrap runtime paths failed', String(error));
  }
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, configureNativeRuntime);
game.onPostProjectInitDelegate?.add?.(configureNativeRuntime);
configureNativeRuntime();

export {};
```

- [ ] **Step 2: Update prepare-example directory creation**

In `scripts/prepare-example.sh`, add:

```zsh
PREFABS_DIR="$ROOT_DIR/example/basic-call/assets/prefabs"
DEMO_SCRIPTS_DIR="$ROOT_DIR/example/basic-call/assets/scripts/demo"
DEMO_PANELS_DIR="$DEMO_SCRIPTS_DIR/panels"
DEMO_UI_DIR="$DEMO_SCRIPTS_DIR/ui"
mkdir -p "$PREFABS_DIR"
mkdir -p "$DEMO_SCRIPTS_DIR"
mkdir -p "$DEMO_PANELS_DIR"
mkdir -p "$DEMO_UI_DIR"
```

- [ ] **Step 3: Update prepare-example metadata writes**

Add `write_directory_meta` and `write_typescript_meta` calls for every UUID in Stable UUIDs.

- [ ] **Step 4: Update prepare-example scene template**

Replace the current `main.scene` heredoc with the new `main.scene` contents from Task 6. The generated template must include `DemoRoot`, `HeaderPanel`, `ActionPanel`, `VideoStagePanel`, `LogPanel`, and `AgoraRtcDemoRoot` UUID references.

- [ ] **Step 5: Update patch-exported-main-bundle**

Modify `scripts/patch-exported-main-bundle.mjs` so `patchBundle` returns without injecting the old `AgoraRtcExampleController` module when the built bundle contains `AgoraRtcDemoRoot.ts`:

```js
if (content.includes('AgoraRtcDemoRoot.ts')) {
  return false;
}
```

Then remove the `controllerModule` injection path or leave it only as a fallback for old exported bundles. The fallback must not run for current builds.

- [ ] **Step 6: Run setup and script tests**

Run:

```bash
npm test -- tests/example-scene.test.ts tests/dev-android-script.test.ts tests/build-both-platforms-script.test.ts tests/productization.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 7: Commit setup script sync**

```bash
git add example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts \
  scripts/prepare-example.sh \
  scripts/patch-exported-main-bundle.mjs
git commit -m "feat: retire dynamic demo bootstrap"
```

### Task 8: Typecheck And Repository Tests

**Files:**
- Modify only files needed to fix type or packaging failures from previous tasks.

- [ ] **Step 1: Run TypeScript check**

Run:

```bash
npm run typecheck
```

Expected: PASS. If it fails because `example/basic-call/temp/tsconfig.cocos.json` is missing, run:

```bash
./scripts/prepare-example.sh >/dev/null
npm run typecheck
```

Expected after preparing the example: PASS.

- [ ] **Step 2: Run the full Node test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Commit type and test fixes**

If Step 1 or Step 2 required code changes:

```bash
git add tests scripts example/basic-call/assets/scripts example/basic-call/assets/scene example/basic-call/assets/prefabs
git commit -m "fix: align prefab demo tests and scripts"
```

If no code changes were needed, record the passing commands in the final implementation notes and do not create an empty commit.

### Task 9: Android Build And Emulator Smoke

**Files:**
- Modify only files required to fix Android build or runtime smoke failures.

- [ ] **Step 1: Export proxy settings**

Run:

```bash
export http_proxy=http://127.0.0.1:7892
export https_proxy=http://127.0.0.1:7892
export all_proxy=http://127.0.0.1:7892
```

- [ ] **Step 2: Use the Gradle proxy workaround**

Run:

```bash
rm -rf /tmp/agora-cocos-gradle-home
mkdir -p /tmp/agora-cocos-gradle-home
ln -s /Users/admin/.gradle/caches /tmp/agora-cocos-gradle-home/caches
ln -s /Users/admin/.gradle/wrapper /tmp/agora-cocos-gradle-home/wrapper
export GRADLE_USER_HOME=/tmp/agora-cocos-gradle-home
```

- [ ] **Step 3: Build and launch Android debug**

Run:

```bash
./scripts/dev-android.sh
```

Expected: APK builds, installs, and launches. APK path:

```text
example/basic-call/build-android/android/proj/build/agora-cocos-basic-call/outputs/apk/debug/agora-cocos-basic-call-debug.apk
```

- [ ] **Step 4: Grant permissions after launch**

Run:

```bash
adb shell pm grant io.agora.cocos.example android.permission.CAMERA
adb shell pm grant io.agora.cocos.example android.permission.RECORD_AUDIO
adb shell am force-stop io.agora.cocos.example
adb shell am start -n io.agora.cocos.example/com.cocos.game.AppActivity
```

- [ ] **Step 5: Check runtime logs**

Run:

```bash
adb logcat -d | rg "\\[agora-rtc\\]|RTC stats|join|localVideoTextureReady|remoteVideoTextureReady" -n
```

Expected: logs include `Auto initialize + join enabled`, a successful join event, and `RTC stats` lines.

- [ ] **Step 6: Capture a screenshot**

Run:

```bash
adb exec-out screencap -p > /tmp/agora-cocos-prefab-demo.png
```

Expected: screenshot shows the demo root UI, local preview area, action controls, and log entry button.

- [ ] **Step 7: Commit Android smoke fixes**

If Android smoke required code changes:

```bash
git add example/basic-call/assets scripts tests
git commit -m "fix: stabilize prefab demo android smoke"
```

If no code changes were needed, record the passing APK path, log evidence, and screenshot path in the final implementation notes.

## Self-Review

- Spec coverage: Tasks 2-6 implement the prefab/component architecture, Task 7 removes dynamic bootstrap assumptions, Task 8 covers repo checks, and Task 9 covers Android smoke verification.
- Scope: The plan keeps one scene and does not introduce app routing or SDK bridge changes.
- Type consistency: Root, panel, action, and service names match the design document and stable UUID section.
- Risk: Manual Cocos asset JSON is the highest-risk area; Task 6 is isolated and followed by scene tests before script and Android work.
