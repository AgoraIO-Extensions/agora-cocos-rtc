import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();
const controllerUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000001';
const bootstrapUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000005';

test('example main.scene keeps Canvas free of custom controller serialization', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scene/main.scene`,
    'utf8',
  );

  assert.doesNotMatch(content, new RegExp(controllerUuid));
  assert.doesNotMatch(content, /"channelId": "demo"/);
  assert.match(content, /"_visibility": 1853882369/);
});

test('prepare-example default scene template avoids serializing the example controller', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/prepare-example.sh`,
    'utf8',
  );

  assert.doesNotMatch(content, /"channelId": "demo"/);
  assert.match(content, /"_visibility": 1853882369/);
});

test('example bootstrap script mounts the controller onto Canvas at runtime', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`,
    'utf8',
  );

  assert.match(content, /EVENT_AFTER_SCENE_LAUNCH/);
  assert.match(content, /canvas\.addComponent\(AgoraRtcExampleController\)/);
  assert.match(content, /getChildByName\('Canvas'\)/);
});

test('prepare-example writes bootstrap script metadata', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/prepare-example.sh`,
    'utf8',
  );

  assert.match(content, new RegExp(bootstrapUuid));
  assert.match(content, /AgoraRtcExampleBootstrap\.ts/);
});

test('example controller source uses lazy client creation and fallback button nodes', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /resolveAgoraExampleConfig/);
  assert.match(content, /this\.loadJsonConfig\('agora-config\.build'\)/);
  assert.match(content, /private client: AgoraRtcClient \| null = null;/);
  assert.match(content, /private getClient\(\): AgoraRtcClient/);
  assert.match(content, /DEFAULT_BUTTON_LAYOUT/);
  assert.match(content, /SUMMARY_NODE_NAME/);
  assert.match(content, /__simple_/);
  assert.match(content, /buttonNode\.off\(Button\.EventType\.CLICK\)/);
  assert.match(content, /label\.useSystemFont = true;/);
  assert.match(content, /this\.loadJsonConfig\('agora-config'\)/);
  assert.match(content, /if \(this\.appId\.trim\(\) && this\.channelId\.trim\(\)\)/);
  assert.match(content, /Loaded config for channel/);
  assert.match(content, /setRenderBackend/);
  assert.match(content, /await client\.enableVideo\(true\);/);
  assert.match(content, /Join request sent/);
  assert.match(content, /Leave request sent/);
  assert.match(content, /Manual join ready/);
  assert.match(content, /uid = 0;/);
  assert.match(content, /private readonly renderBackend = 'engine-texture' as const;/);
  assert.doesNotMatch(content, /Auto initialize \+ join enabled/);
  assert.doesNotMatch(content, /await this\.joinRtcChannel\(\);/);
  assert.doesNotMatch(content, /waitForLeaveChannelEvent/);
  assert.doesNotMatch(content, /resolvePendingLeaveWaiters/);
  assert.doesNotMatch(content, /runRtcSessionOperation/);
  assert.doesNotMatch(content, /rtcSessionOperation/);
  assert.doesNotMatch(content, /pendingLeaveResolvers/);
  assert.doesNotMatch(content, /cycleRenderBackend/);
  assert.doesNotMatch(content, /setSurfaceViewBackend/);
  assert.doesNotMatch(content, /setTextureViewBackend/);
  assert.doesNotMatch(content, /setEngineTextureBackend/);
  assert.doesNotMatch(content, /switchRenderBackend/);
  assert.match(content, /togglePreview/);
  assert.match(content, /toggleLocalAudio/);
  assert.match(content, /toggleLocalVideo/);
  assert.match(content, /toggleSpeakerphone/);
  assert.match(content, /toggleStatusFreeze/);
  assert.match(content, /clearStatusLog/);
  assert.match(content, /cycleChannelProfilePreset/);
  assert.match(content, /cycleClientRolePreset/);
  assert.match(content, /cycleVideoEncoderPreset/);
  assert.match(content, /refreshRtcViews/);
  assert.match(content, /refreshSummary/);
  assert.match(content, /refreshButtonLabels/);
  assert.match(content, /setActionResult/);
  assert.match(content, /VIDEO_ENCODER_PRESETS/);
  assert.match(content, /CHANNEL_PROFILE_PRESETS/);
  assert.match(content, /CLIENT_ROLE_PRESETS/);
  assert.match(content, /setupLocalVideoView/);
  assert.match(content, /setupRemoteVideoView/);
  assert.match(content, /startPreview/);
  assert.match(content, /removeRemoteVideoView/);
  assert.match(content, /removeLocalVideoView/);
  assert.match(content, /__video_remote/);
  assert.match(content, /__video_local/);
  assert.match(content, /remoteVideoTextureReady/);
  assert.match(content, /localVideoTextureReady/);
  assert.match(content, /remoteVideoTextureReleased/);
  assert.match(content, /localVideoTextureReleased/);
  assert.match(content, /getEngineTexture/);
  assert.doesNotMatch(content, /dataBase64/);
  assert.doesNotMatch(content, /remoteVideoFrame/);
  assert.doesNotMatch(content, /localVideoFrame/);
  assert.doesNotMatch(content, /new Texture2D/);
  assert.doesNotMatch(content, /uploadData/);
  assert.doesNotMatch(content, /fallbackBackend/);
  assert.doesNotMatch(content, /applyEffectiveRenderBackend/);
});

test('example config override supports build-time values without committing credentials', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/agoraRtcConfigOverride.ts`,
    'utf8',
  );

  assert.match(content, /keyAppId = 'TEST_APP_ID'/);
  assert.match(content, /keyChannelId = 'TEST_CHANNEL_ID'/);
  assert.match(content, /keyToken = 'TEST_TOKEN'/);
  assert.match(content, /class ExampleConfigOverride/);
  assert.match(content, /set\(name: string, value: string\)/);
  assert.match(content, /resolveAgoraExampleConfig/);
  assert.doesNotMatch(content, /\bappId\s*[:=]\s*['"][0-9a-f]{32}['"]/i);
});

test('example controller binds native engine texture slots instead of creating upload textures in JS', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /bindNativeTextureSprite/);
  assert.match(content, /getEngineTexture\(slotId\)/);
  assert.doesNotMatch(content, /Texture2D\.PixelFormat\.RGBA8888/);
});

test('example controller renders all remote streams dynamically using PageView pages', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /private remoteUserUids = new Set<number>\(\);/);
  assert.match(content, /this\.remoteUserUids\.add\(uid\);/);
  assert.match(content, /this\.addRemoteUserPage\(uid\);/);
  assert.match(content, /if \(this\.activeRemoteUid === null\)/);
  assert.match(content, /this\.remoteUserUids\.delete\(uid\);/);
  assert.match(content, /private async clearAllRemoteVideoPages\(\)/);
  assert.match(content, /await this\.clearAllRemoteVideoPages\(\);/);
});

test('example controller resolves native overlay rects from nested QA pane video nodes', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /this\.node\.getChildByPath\(`\$\{QA_RIGHT_PANE_NODE_NAME\}\/\$\{nodeName\}`\)/);
  assert.doesNotMatch(content, /const targetNode = this\.node\.getChildByName\(nodeName\);/);
});

test('example controller keeps header, actions, and footer separated and uses equal remote\/local split layout', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /QA_LEFT_HEADER_NODE_NAME/);
  assert.match(content, /BUTTON_PANEL_NODE_NAME/);
  assert.match(content, /STATUS_SCROLL_NODE_NAME/);
  assert.match(content, /leftPane\.getComponent\(Layout\)\?\.destroy\(\);/);
  assert.match(content, /CONFIG_PRESET_BUTTON_WIDTH = 52;/);
  assert.match(content, /this\.layoutLeftPaneStack\(leftPane!, paneHeight, headerScrollHeight, buttonHeight\);/);
  assert.match(content, /private layoutSplitVideoStack\(/);
  assert.match(content, /LOCAL_PIP_WIDTH_RATIO/);
  assert.match(content, /this\.layoutRemotePageView\(remoteCard, remoteCenterX, remoteCenterY, remoteVideoWidth, remoteVideoHeight\);/);
  assert.match(content, /this\.positionVideoFrame\(localCard, localNode, localTitle, localHint, pipCenterX, pipCenterY, pipWidth, pipHeight\);/);
  assert.match(content, /scrollView\.inertia = true;/);
  assert.match(content, /refreshAllRemoteVideoSurfaces/);
  assert.match(content, /await this\.client\.setupRemoteVideoView\(uid, this\.getRemoteVideoRectForUid\(uid\)\)/);
});

test('example controller renders styled cards for left sections and both video panes', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /REMOTE_CARD_NODE_NAME/);
  assert.match(content, /LOCAL_CARD_NODE_NAME/);
  assert.match(content, /ensureVideoCards\(\)/);
  assert.match(content, /let bgNode = panelNode\.getChildByName\(PANEL_BG_NODE_NAME\);/);
  assert.match(content, /const graphics = bgNode\.getComponent\(Graphics\) \?\? bgNode\.addComponent\(Graphics\);/);
  assert.match(content, /this\.drawSectionCard\(graphics, width, height, 'panel'\);/);
  assert.match(content, /drawSectionCard\(graphics, transform\.contentSize\.width, transform\.contentSize\.height, 'video'\)/);
});

test('example controller uses muted color tiers and button state colors for status feedback', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /this\.configLabel\.color = new Color\(214, 226, 240, 255\);/);
  assert.match(content, /this\.summaryLabel\.color = new Color\(170, 210, 188, 255\);/);
  assert.match(content, /fill: new Color\(178, 56, 56, 255\)/);
  assert.match(content, /fill: new Color\(28, 108, 88, 255\)/);
});

test('example controller trims header copy, increases button group spacing, and widens split video gap', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /`App \$\{this\.maskAppId\(this\.appId\)\}  ·  Token \$\{this\.token \? 'configured' : 'not configured'\}`/);
  assert.doesNotMatch(content, /`Render \$\{this\.renderBackend\}`/);
  assert.doesNotMatch(content, /Backend \$\{this\.renderBackend\}/);
  assert.match(content, /layout\.spacingY = 10;/);
  assert.match(content, /QA_GRID_BUTTON_HEIGHT = 36;/);
  assert.match(content, /QA_LANDSCAPE_LEFT_MAX_WIDTH = 420;/);
  assert.match(content, /QA_PANE_GAP = 10;/);
  assert.match(content, /VIDEO_PANE_LEFT_INSET = 6;/);
  assert.match(content, /rowTransform\?\.setAnchorPoint\(0\.5, 0\.5\);/);
  assert.match(content, /__channel_cycle/);
  assert.match(content, /const remoteBlockSpan = titleBlock \+ remoteVideoHeight \+ VIDEO_CARD_PAD \* 2;/);
  assert.match(content, /rightPane\?\.getComponent\(UITransform\)\?\.setContentSize\(rightWidth, rightHeight\);/);
});

test('example controller top-aligns scroll content and resets action scroll to top after layout', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /buttonGrid\.setPosition\(0, viewportHeight \/ 2, 0\);/);
  assert.match(content, /this\.buttonScrollView\?\.scrollToTop\(0, false\);/);
  assert.match(content, /private buttonScrollView: ScrollView \| null = null;/);
});

test('example controller reduces title overlap, shrinks header, and reserves left footer space above profiler', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /const titleY = halfHeight - 40;/);
  assert.match(content, /const headerContentHeight = this\.measureHeaderContentHeight\(contentWidth\);/);
  assert.match(content, /resolveHeaderScrollHeight\(paneHeight, headerContentHeight\)/);
  assert.match(content, /const remoteCenterX = -paneWidth \/ 2 \+ edgePad \+ VIDEO_PANE_LEFT_INSET \+ remoteVideoWidth \/ 2/);
  assert.match(content, /const buttonHeight = Math\.max\(/);
});

test('example controller applies softer title and card contrast for final polish', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /label\.fontSize = 22;/);
  assert.match(content, /label\.color = new Color\(88, 160, 205, 140\);/);
  assert.match(content, /\? new Color\(62, 96, 128, 255\)/);
  assert.match(content, /: new Color\(42, 76, 102, 255\);/);
  assert.match(content, /sectionLabel\.color = new Color\(108, 194, 230, 255\);/);
});

test('example bootstrap disables profiler and controller hides the floating title overlay', async () => {
  const bootstrap = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`,
    'utf8',
  );
  const controller = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(bootstrap, /game\.config\.showFPS = false/);
  assert.match(bootstrap, /director\.root\.pipeline\.profiler = null/);
  assert.match(controller, /titleNode\.active = false/);
});

test('example controller separates settings controls from action buttons and raises video titles above the cards', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /EditBox/);
  assert.match(content, /SETTINGS_PANEL_NODE_NAME/);
  assert.match(content, /CHANNEL_INPUT_NODE_NAME/);
  assert.match(content, /UID_INPUT_NODE_NAME/);
  assert.match(content, /applyConfigInputs/);
  assert.match(content, /const SETTINGS_ROWS =/);
  assert.match(content, /titleNode\?\.setPosition\(0, titleOffsetY, 0\);/);
  assert.match(content, /const titleOffsetY = videoHeight \/ 2 \+ VIDEO_CARD_PAD \+ VIDEO_TITLE_GAP \+ VIDEO_TITLE_HEIGHT \/ 2;/);
  assert.match(content, /const pipCenterY = -paneHeight \/ 2 \+ edgePad \+ LOCAL_PIP_EDGE_PAD \+ pipHeight \/ 2 \+ VIDEO_TITLE_HEIGHT;/);
  assert.doesNotMatch(content, /Config', buttons: \['Profile', 'Role', 'Encoder'/);
});

test('example controller no longer decodes frame Base64 in JS', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.doesNotMatch(content, /globalThis\.atob/);
  assert.doesNotMatch(content, /BASE64_CHARSET/);
  assert.doesNotMatch(content, /BASE64_DECODE_TABLE/);
});

test('example controller uses Texture2D filter and wrap enums for native texture setup', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.doesNotMatch(content, /,\s*TextureFilter,\s*/);
  assert.doesNotMatch(content, /,\s*WrapMode,\s*/);
  assert.match(content, /Texture2D\.Filter\.LINEAR/);
  assert.match(content, /Texture2D\.WrapMode\.CLAMP_TO_EDGE/);
});

test('example ships a runtime Agora config template', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/resources/agora-config.json`,
    'utf8',
  );

  assert.match(content, /"appId": "<YOUR_AGORA_APP_ID>"/);
  assert.match(content, /"channelId": "<YOUR_CHANNEL_ID>"/);
  assert.doesNotMatch(content, /\bappId["']?\s*:\s*["'][0-9a-f]{32}["']/i);
  assert.match(content, /"uid": 0/);
  assert.doesNotMatch(content, /"renderBackend"/);
});

test('example controller includes grouped capability demos for expanded sdk api', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleController.ts`,
    'utf8',
  );

  assert.match(content, /runChannelRoleDemo/);
  assert.match(content, /runAudioControlDemo/);
  assert.match(content, /runVideoControlDemo/);
  assert.match(content, /runMixingDemo/);
  assert.match(content, /runEffectDemo/);
  assert.match(content, /runDiagnosticsDemo/);
  assert.match(content, /runCapabilityDemo/);
  assert.match(content, /getSdkVersion/);
  assert.match(content, /setChannelProfile/);
  assert.match(content, /startAudioMixing/);
  assert.match(content, /playEffect/);
  assert.match(content, /setParameters/);
  assert.match(content, /getErrorDescription/);
  assert.match(content, /isSpeakerphoneEnabled/);
  assert.match(content, /rtcStats/);
  assert.doesNotMatch(content, /setSurfaceViewBackend/);
  assert.doesNotMatch(content, /setTextureViewBackend/);
  assert.doesNotMatch(content, /setEngineTextureBackend/);
  assert.doesNotMatch(content, /'EngineTex'/);
  assert.match(content, /Preview/);
  assert.match(content, /Views/);
  assert.match(content, /Mic/);
  assert.match(content, /Cam/);
  assert.match(content, /Speaker/);
  assert.match(content, /Freeze/);
  assert.match(content, /Clear/);
  assert.match(content, /Profile/);
  assert.match(content, /Role/);
  assert.match(content, /Encoder/);
  assert.match(content, /Full Demo/);
});
