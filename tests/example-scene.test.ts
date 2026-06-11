import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const controllerUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000001';
const demoRootUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000103';
const rtcSessionUuid = '6f0fce55-1000-42b8-8b7b-1aaf80000102';
const demoRootCompressedUuid = '6f0fc5VEABCuIt7Gq+AAAED';
const panelCompressedUuids = [
  '6f0fc5VEABCuIt7Gq+AAAEE',
  '6f0fc5VEABCuIt7Gq+AAAEF',
  '6f0fc5VEABCuIt7Gq+AAAEG',
  '6f0fc5VEABCuIt7Gq+AAAEH',
];
const panelScriptMetas = [
  [
    'example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts.meta',
    '6f0fce55-1000-42b8-8b7b-1aaf80000104',
  ],
  [
    'example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts.meta',
    '6f0fce55-1000-42b8-8b7b-1aaf80000105',
  ],
  [
    'example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts.meta',
    '6f0fce55-1000-42b8-8b7b-1aaf80000106',
  ],
  [
    'example/basic-call/assets/scripts/demo/panels/LogPanel.ts.meta',
    '6f0fce55-1000-42b8-8b7b-1aaf80000107',
  ],
] as const;

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
  assert.doesNotMatch(content, new RegExp(controllerUuid));
  assert.doesNotMatch(content, /__simple_Initialize/);
  assert.match(content, /"_visibility": 1853882369/);
});

test('prepare-example default scene template writes the prefab-style demo root', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/prepare-example.sh`,
    'utf8',
  );

  assert.match(content, /DemoRoot/);
  assert.match(content, /HeaderPanel/);
  assert.match(content, /ActionPanel/);
  assert.match(content, /VideoStagePanel/);
  assert.match(content, /LogPanel/);
  assert.match(content, new RegExp(demoRootUuid));
  assert.doesNotMatch(content, /"channelId": "demo"/);
  assert.match(content, /"_visibility": 1853882369/);
});

test('example bootstrap no longer mounts the monolithic controller at runtime', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`,
    'utf8',
  );

  assert.match(content, /EVENT_AFTER_SCENE_LAUNCH/);
  assert.match(content, /const pipeline = director\.root\?\.pipeline/);
  assert.match(content, /if \(pipeline\) \{[\s\S]*pipeline\.profiler = null;[\s\S]*hideStats\?\.\(\);[\s\S]*\}/);
  assert.doesNotMatch(content, /game\.config\.showFPS = false/);
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

  for (const [path, uuid] of panelScriptMetas) {
    const content = await readFile(`${repoRoot}/${path}`, 'utf8');
    assert.match(content, new RegExp(uuid));
  }
});

test('tracked Cocos asset metadata uuids are unique', async () => {
  const { stdout } = await execFileAsync('git', ['ls-files', 'example/basic-call/assets'], {
    cwd: repoRoot,
  });
  const metaPaths = stdout
    .split('\n')
    .filter((path) => path.endsWith('.meta'))
    .sort();
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const metaPath of metaPaths) {
    const content = await readFile(`${repoRoot}/${metaPath}`, 'utf8');
    const uuid = JSON.parse(content).uuid;
    const previousPath = seen.get(uuid);
    if (previousPath) {
      duplicates.push(`${uuid}: ${previousPath}, ${metaPath}`);
      continue;
    }
    seen.set(uuid, metaPath);
  }

  assert.deepEqual(duplicates, []);
});

test('scene and prefabs serialize demo scripts by Cocos script uuid', async () => {
  const assetPaths = [
    'example/basic-call/assets/scene/main.scene',
    'example/basic-call/assets/prefabs/DemoRoot.prefab',
    'example/basic-call/assets/prefabs/HeaderPanel.prefab',
    'example/basic-call/assets/prefabs/ActionPanel.prefab',
    'example/basic-call/assets/prefabs/VideoStagePanel.prefab',
    'example/basic-call/assets/prefabs/LogPanel.prefab',
    'scripts/prepare-example.sh',
  ];
  const content = (
    await Promise.all(assetPaths.map((path) => readFile(`${repoRoot}/${path}`, 'utf8')))
  ).join('\n');

  assert.match(content, new RegExp(escapeRegExp(demoRootCompressedUuid)));
  for (const uuid of panelCompressedUuids) {
    assert.match(content, new RegExp(escapeRegExp(uuid)));
  }
  assert.doesNotMatch(content, /"__type__": "AgoraRtcDemoRoot"/);
  assert.doesNotMatch(content, /"__type__": "DemoHeaderPanel"/);
  assert.doesNotMatch(content, /"__type__": "DemoActionPanel"/);
  assert.doesNotMatch(content, /"__type__": "VideoStagePanel"/);
  assert.doesNotMatch(content, /"__type__": "LogPanel"/);
});

test('rtc session service owns client lifecycle and native texture binding', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(content, /createAgoraRtcClient/);
  assert.match(content, /private client: AgoraRtcClient \| null = null;/);
  assert.match(content, /private getClient\(\): AgoraRtcClient/);
  assert.match(content, /setupLocalVideoView/);
  assert.match(content, /setupRemoteVideoView/);
  assert.match(content, /bindNativeTextureSprite/);
  assert.match(content, /getEngineTexture\(slotId\)/);
  assert.doesNotMatch(content, /Texture2D\.PixelFormat\.RGBA8888/);
  assert.doesNotMatch(content, /uploadData/);
});

test('rtc session service passes configurable video join media options from TypeScript', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  const joinMethodMatch = content.match(/async joinRtcChannel\(\): Promise<void>[\s\S]*?async leaveRtcChannel/);
  assert.ok(joinMethodMatch);
  const joinMethod = joinMethodMatch[0];

  assert.match(joinMethod, /client\.joinChannel\(\s*config\.token,\s*config\.channelId\.trim\(\),\s*config\.uid,\s*\{/);
  assert.match(joinMethod, /clientRoleType:\s*this\.selectedClientRole/);
  assert.match(joinMethod, /channelProfile:\s*this\.selectedChannelProfile/);
  assert.match(joinMethod, /publishCameraTrack:\s*config\.publishCameraTrack/);
  assert.match(joinMethod, /publishMicrophoneTrack:\s*config\.publishMicrophoneTrack/);
  assert.match(joinMethod, /autoSubscribeAudio:\s*config\.autoSubscribeAudio/);
  assert.match(joinMethod, /autoSubscribeVideo:\s*config\.autoSubscribeVideo/);
  assert.match(joinMethod, /if \(config\.publishCameraTrack\)/);
  assert.match(content, /setupLocalVideoView\(\{[\s\S]*mirrorMode:\s*0,/);
});

test('rtc session service leave clears local and remote rendering resources without destroying engine', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  const leaveMethodMatch = content.match(/async leaveRtcChannel\(\): Promise<void>[\s\S]*?async startLocalPreview/);
  assert.ok(leaveMethodMatch);
  const leaveMethod = leaveMethodMatch[0];

  assert.match(leaveMethod, /const remoteUids = \[\.\.\.this\.remoteUserUids\]/);
  assert.match(leaveMethod, /if \(this\.previewStarted\)[\s\S]*client\.stopPreview\(\)/);
  assert.match(leaveMethod, /if \(this\.localViewAttached\)[\s\S]*client\.removeLocalVideoView\(\)/);
  assert.match(leaveMethod, /for \(const uid of remoteUids\)[\s\S]*client\.removeRemoteVideoView\(uid\)/);
  assert.match(leaveMethod, /await client\.leaveChannel\(\)/);
  assert.match(leaveMethod, /this\.clearLocalVideoRenderState\(\)/);
  assert.match(leaveMethod, /this\.clearRemoteVideoRenderState\(remoteUids\)/);
  assert.doesNotMatch(leaveMethod, /client\.destroy\(\)/);
});

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

test('rtc session service retries engine texture binding until the native slot is ready', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(content, /MAX_TEXTURE_BIND_RETRIES/);
  assert.match(content, /TEXTURE_BIND_RETRY_MS/);
  assert.match(content, /private textureBindRetryTimers/);
  assert.match(content, /scheduleTextureBindRetry/);
  assert.match(content, /bindNativeTextureSprite\('local', slotId, undefined, 0\)/);
  assert.match(content, /bindNativeTextureSprite\('local', this\.localTextureSlotId, undefined, 0\)/);
  assert.match(content, /this\.bindNativeTextureSprite\(kind, slotId, uid, retryCount \+ 1\)/);
  assert.match(content, /clearTimeout/);
});

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
  assert.match(content, /clearLocalVideoFrame/);
  assert.match(content, /clearRemoteVideoFrame/);
});

test('demo root loads runtime smoke config and can auto join when requested', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  assert.match(content, /resolveAgoraExampleConfig/);
  assert.match(content, /this\.loadJsonConfig\('agora-config\.build'\)/);
  assert.match(content, /this\.loadJsonConfig\('agora-config'\)/);
  assert.match(content, /this\.autoPreview/);
  assert.match(content, /this\.autoJoin/);
  assert.match(content, /Auto preview enabled/);
  assert.match(content, /await this\.initializeRtc\(\);/);
  assert.match(content, /if \(this\.autoPreview\)[\s\S]*await this\.startLocalPreview\(\);/);
  assert.match(content, /Auto join enabled/);
  assert.match(content, /if \(this\.autoJoin\)[\s\S]*await this\.joinRtcChannel\(\);/);
});

test('demo root lays out panels from the landscape visible size', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  assert.match(content, /layoutResponsivePanels/);
  assert.match(content, /view\.getVisibleSize\(\)/);
  assert.match(content, /Math\.max\(visibleSize\.width, visibleSize\.height\)/);
  assert.match(content, /PANEL_GAP/);
  assert.match(content, /actionScale/);
  assert.match(content, /videoStagePanel\?\.applyLayout\(stageWidth, availableHeight\)/);
  assert.doesNotMatch(content, /videoStagePanel\?\.node\.setScale\(stageScale/);
});

test('video stage panel uses concrete layout dimensions and visible video frames', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`,
    'utf8',
  );

  assert.match(content, /applyLayout\(width: number, height: number\)/);
  assert.match(content, /private stageWidth/);
  assert.match(content, /private stageHeight/);
  assert.match(content, /drawPanel/);
  assert.match(content, /LocalVideoSprite', localVideoWidth, localVideoHeight/);
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
  assert.match(content, /runDiagnosticsDemo/);
});

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

test('demo action panel renders left controls in a scroll view', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(content, /ScrollView/);
  assert.match(content, /ActionScrollView/);
  assert.match(content, /ActionScrollContent/);
  assert.match(content, /scrollView\.content = this\.scrollContent/);
  assert.match(content, /clearScrollContent/);
  assert.doesNotMatch(content, /for \(const child of \[\.\.\.this\.node\.children\]\)/);
});

test('demo action panel lays case sections from content flow to avoid overlap', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(content, /appendSection/);
  assert.match(content, /caseActionSectionHeight/);
  assert.match(content, /Math\.ceil\(actionCount \/ CASE_ACTION_COLUMNS\)/);
  assert.match(content, /this\.buildCaseActionButtons\(actions, actionHeight\)/);
  assert.doesNotMatch(content, /ensureContainer\('ConnectionSection', 0, 180/);
  assert.doesNotMatch(content, /ensureContainer\('DiagnosticsSection', 0, -185/);
});

test('demo case registry exposes the approved flutter-aligned case list', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`,
    'utf8',
  );

  for (const name of [
    'Basic',
    'JoinChannelAudio',
    'JoinChannelVideo',
    'StringUid',
    'Advanced',
    'AudioEffectMixing',
    'SetVideoEncoderConfiguration',
    'SetBeautyEffect',
    'SetContentInspect',
    'ChannelProfile',
    'SetParameters',
  ]) {
    assert.match(content, new RegExp(`name:\\s*'${name}'`));
  }

  for (const unsupported of [
    'ChannelMediaRelay',
    'ScreenSharing',
    'MediaPlayer',
    'PictureInPicture',
  ]) {
    assert.doesNotMatch(content, new RegExp(`name:\\s*'${unsupported}'`));
  }

  assert.match(content, /displayMode:\s*'audio'/);
  assert.match(content, /displayMode:\s*'video'/);
});

test('demo root supports case list navigation before case detail actions', async () => {
  const rootContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const panelContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(rootContent, /selectedCaseName/);
  assert.match(rootContent, /showCaseList/);
  assert.match(rootContent, /selectDemoCase/);
  assert.match(rootContent, /DEMO_CASES/);
  assert.match(panelContent, /renderCaseList/);
  assert.match(panelContent, /renderCaseControls/);
  assert.match(panelContent, /Back/);
  assert.match(panelContent, /AudioEffectMixing/);
});

test('audio effect mixing case wires flutter-required controls', async () => {
  const actionsContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/actions.ts`,
    'utf8',
  );
  const serviceContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );
  const rootContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  for (const name of [
    'PreloadEffect',
    'PlayEffect',
    'PauseEffect',
    'ResumeEffect',
    'SetEffectsVolume',
    'StartAudioMixing',
    'SetAudioMixingPosition',
    'AudioMixingPublishVolume',
    'AudioMixingPlayoutVolume',
    'AudioMixingVolume',
  ]) {
    assert.match(actionsContent, new RegExp(name));
  }

  assert.match(serviceContent, /pauseEffect/);
  assert.match(serviceContent, /resumeEffect/);
  assert.match(serviceContent, /setEffectsVolume/);
  assert.match(serviceContent, /adjustAudioMixingPublishVolume/);
  assert.match(serviceContent, /adjustAudioMixingPlayoutVolume/);
  assert.match(serviceContent, /remoteAudioStateChanged/);
  assert.match(rootContent, /runAudioEffectMixingAction/);
});

test('audio effect mixing case resolves a bundled local mixing asset', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts`,
    'utf8',
  );

  assert.match(content, /Agora\.io-Interactions\.mp3/);
  assert.match(content, /resolveAudioMixingAssetPath/);
  assert.match(content, /native\.fileUtils/);
  assert.match(content, /getWritablePath/);
  assert.match(content, /copyFile/);
  assert.match(content, /https:\/\/webdemo\.agora\.io\/ding\.mp3/);
});

test('demo action panel renders case-specific controls instead of the full qa matrix', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(content, /buildCaseActionButtons/);
  assert.match(content, /selectedCase\.actions/);
  assert.match(content, /buildAudioEffectMixingControls/);
  assert.match(content, /buildBeautyControls/);
  assert.match(content, /buildEncoderControls/);
  assert.match(content, /buildContentInspectControls/);
});

test('example scene and template use landscape canvas dimensions', async () => {
  const sceneContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scene/main.scene`,
    'utf8',
  );
  const scene = JSON.parse(sceneContent);
  const sizeForNode = (name: string) => {
    const nodeId = scene.findIndex((entry: any) => entry?.__type__ === 'cc.Node' && entry._name === name);
    assert.ok(nodeId >= 0, `missing ${name}`);
    const transform = scene.find((entry: any) =>
      entry?.__type__ === 'cc.UITransform' && entry.node?.__id__ === nodeId);
    assert.ok(transform, `missing ${name} UITransform`);
    return transform._contentSize;
  };

  assert.deepEqual(sizeForNode('Canvas'), { __type__: 'cc.Size', width: 960, height: 640 });
  assert.deepEqual(sizeForNode('DemoRoot'), { __type__: 'cc.Size', width: 960, height: 640 });

  const templateContent = await readFile(`${repoRoot}/scripts/prepare-example.sh`, 'utf8');
  assert.doesNotMatch(templateContent, /"width": 720,\s+"height": 1280/);
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
  assert.match(content, /autoPreview/);
  assert.match(content, /autoJoin/);
  assert.match(content, /publishCameraTrack/);
  assert.match(content, /publishMicrophoneTrack/);
  assert.match(content, /autoSubscribeAudio/);
  assert.match(content, /autoSubscribeVideo/);
  assert.doesNotMatch(content, /\bappId\s*[:=]\s*['"][0-9a-f]{32}['"]/i);
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
  assert.match(content, /"renderBackend": "engine-texture"/);
});

test('example runtime defaults keep Agora auto-assigned uid semantics', async () => {
  const rootContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const actionPanelContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );
  const headerPanelContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoHeaderPanel.ts`,
    'utf8',
  );
  const bundlePatchContent = await readFile(
    `${repoRoot}/scripts/patch-exported-main-bundle.mjs`,
    'utf8',
  );

  assert.match(rootContent, /uid = 0;/);
  assert.match(actionPanelContent, /String\(this\.config\?\.uid \?\? 0\)/);
  assert.match(actionPanelContent, /editBox\.placeholder = name === 'UidInput' \? '0' : 'demo'/);
  assert.match(
    actionPanelContent,
    /uid: Number\.isFinite\(parsedUid\) \? Math\.max\(0, Math\.floor\(parsedUid\)\) : this\.config\?\.uid \?\? 0,/,
  );
  assert.match(
    headerPanelContent,
    /const uid = Number\.isFinite\(parsedUid\) && parsedUid >= 0 \? Math\.floor\(parsedUid\) : 0;/,
  );
  assert.match(
    bundlePatchContent,
    /const runtimeUid = Number\.isFinite\(runtimeConfig\.uid\) \? Number\(runtimeConfig\.uid\) : 0;/,
  );
  assert.match(bundlePatchContent, /this\.uid = 0;/);
});

test('rebased demo case registry keeps main architecture and adds string uid and parameter cases', async () => {
  const registry = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`,
    'utf8',
  );
  const root = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  for (const name of [
    'JoinChannelAudio',
    'JoinChannelVideo',
    'StringUid',
    'AudioEffectMixing',
    'SetVideoEncoderConfiguration',
    'SetBeautyEffect',
    'SetContentInspect',
    'ChannelProfile',
    'SetParameters',
  ]) {
    assert.match(registry, new RegExp(`name:\\s*'${name}'`));
  }

  assert.match(root, /DEMO_CASES/);
  assert.match(root, /findDemoCase/);
  assert.doesNotMatch(root, /\.\.\/examples\/index\.ts/);
});

test('demo root and service route string uid and setParameters cases through supported APIs', async () => {
  const registry = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`,
    'utf8',
  );
  const root = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const service = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(registry, /actions:\s*\[[\s\S]*'JoinWithUserAccount'[\s\S]*'GetUserInfoByUserAccount'/);
  assert.match(root, /STRING_USER_ACCOUNT = 'cocos-user-0'/);
  assert.match(root, /joinWithUserAccount\(\): Promise<void>/);
  assert.match(root, /getUserInfoByUserAccount\(\): Promise<void>/);
  assert.match(service, /joinChannelWithUserAccount/);
  assert.match(service, /getUserInfoByUserAccount/);

  assert.match(registry, /name:\s*'SetParameters'[\s\S]*'KeepAudioSession'[\s\S]*'MixableAudio'[\s\S]*'AutoMirror'/);
  assert.match(root, /applyKeepAudioSessionParameter/);
  assert.match(root, /applyMixableAudioParameter/);
  assert.match(root, /applyAutoMirrorParameter/);
  assert.match(service, /applyParameterPreset\(parameters: Record<string, unknown>\)/);
});

test('example detail pages keep an in-panel log action without overlapping header controls', async () => {
  const panel = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(panel, /buildCaseUtilitySection/);
  assert.match(panel, /this\.buildButtonList\(parent, \['RefreshViews', 'OpenLog'\], 2, -6\)/);
  assert.match(panel, /ACTION_LABELS\[name\] \?\? name/);
  assert.doesNotMatch(panel, /ensureGlobalLogButton/);
  assert.doesNotMatch(panel, /GlobalLogButton/);
});

test('example UI only exposes engine-texture rendering mode', async () => {
  const panel = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );
  const root = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const configOverride = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/agoraRtcConfigOverride.ts`,
    'utf8',
  );
  const types = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/types.ts`,
    'utf8',
  );

  assert.doesNotMatch(panel, /RENDER_BACKENDS/);
  assert.doesNotMatch(panel, /RenderToggle/);
  assert.doesNotMatch(panel, /cycleRenderBackend/);
  assert.doesNotMatch(panel, /surface-view|texture-view/);
  assert.match(root, /this\.renderBackend = 'engine-texture'/);
  assert.doesNotMatch(root, /this\.renderBackend = config\.renderBackend/);
  assert.doesNotMatch(configOverride, /surface-view|texture-view/);
  assert.match(types, /export type RenderBackend = 'engine-texture'/);
  assert.doesNotMatch(types, /surface-view|texture-view/);
});

test('returning to the case list tears down rtc and leaves channel first', async () => {
  const root = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const service = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(root, /onBackToCases: \(\) => \{ void this\.backToCaseList\(\); \}/);
  assert.match(root, /private async backToCaseList\(\): Promise<void> \{[\s\S]*this\.closeStatusLogPage\(\)[\s\S]*await this\.session\?\.teardownRtc\(\)[\s\S]*this\.session = null[\s\S]*this\.showCaseList\(\)/);
  assert.match(service, /const client = this\.client;/);
  assert.match(service, /await this\.teardownRtcStep\('leaveChannel', \(\) => client\.leaveChannel\(\)\)/);
  assert.match(service, /await this\.teardownRtcStep\('removeLocalVideoView', \(\) => client\.removeLocalVideoView\(\)\)/);
  assert.match(service, /this\.clearLocalVideoRenderState\(\)/);
  assert.match(service, /await this\.teardownRtcStep\('destroy', \(\) => client\.destroy\(\)\)/);
  assert.ok(
    service.indexOf("await this.teardownRtcStep('leaveChannel'") <
      service.indexOf("await this.teardownRtcStep('destroy'"),
    'leaveChannel should happen before destroy in teardownRtc',
  );
  assert.match(service, /private async teardownRtcStep\(label: string, action: \(\) => Promise<unknown>\): Promise<void>/);
  assert.match(service, /this\.recordAsyncError\(`Teardown \$\{label\}`/);
});

test('log panel fits landscape devices and keeps close controls visible', async () => {
  const root = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const logPanel = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/LogPanel.ts`,
    'utf8',
  );

  assert.match(root, /this\.logPanel\.applyLayout\(landscapeWidth, landscapeHeight\)/);
  assert.match(logPanel, /applyLayout\(visibleWidth: number, visibleHeight: number\): void/);
  assert.match(logPanel, /CloseButton/);
  assert.match(logPanel, /'Close'/);
  assert.match(logPanel, /LOG_PANEL_MAX_WIDTH/);
  assert.match(logPanel, /buttonRight/);
  assert.match(logPanel, /this\.closeButton\.setPosition/);
  assert.doesNotMatch(logPanel, /BackButton/);
});

test('demo buttons route touch events through the full button hit area', async () => {
  const panel = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );
  const logPanel = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/LogPanel.ts`,
    'utf8',
  );
  const styles = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/ui/uiStyles.ts`,
    'utf8',
  );

  assert.match(styles, /const touchTargets:[^=]+=\s*\[node,\s*bgNode,\s*labelNode\]/);
  assert.match(styles, /node\.emit\('agora-button-click'\)/);
  assert.match(styles, /export function bindButtonTouch/);
  assert.match(panel, /bindButtonTouch\(back\.node/);
  assert.match(panel, /bindButtonTouch\(node, \(\) => this\.onAction\?/);
  assert.match(logPanel, /bindButtonTouch/);
});
