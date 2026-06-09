import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();
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

  for (const [path, uuid] of panelScriptMetas) {
    const content = await readFile(`${repoRoot}/${path}`, 'utf8');
    assert.match(content, new RegExp(uuid));
  }
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

test('demo action panel keeps basic video controls in a mobile-safe vertical range', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );
  const sectionY = (name: string) => {
    const match = content.match(new RegExp(`const \\w+ = this\\.ensureContainer\\('${name}', 0, (-?\\d+),`));
    assert.ok(match, `missing ${name} container`);
    return Number(match[1]);
  };

  const connectionY = sectionY('ConnectionSection');
  const previewY = sectionY('PreviewCameraSection');
  const renderY = sectionY('RenderEncoderSection');
  const diagnosticsY = sectionY('DiagnosticsSection');

  assert.ok(connectionY > previewY && previewY > renderY && renderY > diagnosticsY);
  assert.ok(connectionY + 58 <= 240);
  assert.ok(diagnosticsY + 43 <= renderY - 55);
  assert.ok(diagnosticsY + 32 >= -155);
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
    'Advanced',
    'AudioEffectMixing',
    'SetVideoEncoderConfiguration',
    'SetBeautyEffect',
    'SetContentInspect',
  ]) {
    assert.match(content, new RegExp(`name:\\s*'${name}'`));
  }

  for (const unsupported of [
    'StringUid',
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
  assert.match(content, /"uid": 1001/);
  assert.match(content, /"renderBackend": "(surface-view|texture-view|engine-texture)"/);
});
