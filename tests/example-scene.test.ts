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
  assert.match(content, /runDiagnosticsDemo/);
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
