import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

async function assertExists(relativePath: string) {
  await access(path.join(repoRoot, relativePath));
}

test('gitignore keeps docs root committable and ignores only internal artifacts', async () => {
  const gitignore = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');

  assert.doesNotMatch(gitignore, /^docs\/$/m);
  assert.match(gitignore, /^docs\/superpowers\/reports\/$/m);
  assert.match(gitignore, /^\.superpowers\/$/m);
});

test('docs site scaffolding files exist for both locales', async () => {
  const expectedFiles = [
    'docs/index.html',
    'docs/assets/app.css',
    'docs/assets/app.js',
    'docs/zh/index.html',
    'docs/zh/quickstart.html',
    'docs/zh/core-apis.html',
    'docs/zh/rendering.html',
    'docs/zh/example.html',
    'docs/zh/platform-notes.html',
    'docs/zh/api-reference.html',
    'docs/en/index.html',
    'docs/en/quickstart.html',
    'docs/en/core-apis.html',
    'docs/en/rendering.html',
    'docs/en/example.html',
    'docs/en/platform-notes.html',
    'docs/en/api-reference.html',
  ];

  for (const file of expectedFiles) {
    await assertExists(file);
  }
});

async function readDoc(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const localePages = [
  'docs/zh/index.html',
  'docs/zh/quickstart.html',
  'docs/zh/core-apis.html',
  'docs/zh/rendering.html',
  'docs/zh/example.html',
  'docs/zh/platform-notes.html',
  'docs/zh/api-reference.html',
  'docs/en/index.html',
  'docs/en/quickstart.html',
  'docs/en/core-apis.html',
  'docs/en/rendering.html',
  'docs/en/example.html',
  'docs/en/platform-notes.html',
  'docs/en/api-reference.html',
];

test('all locale pages share the docs shell hooks', async () => {
  for (const file of localePages) {
    const content = await readDoc(file);

    assert.match(content, /class="doc-header"/);
    assert.match(content, /id="nav-toggle"/);
    assert.match(content, /class="doc-nav"/);
    assert.match(content, /class="doc-main"/);
    assert.match(content, /id="page-toc"/);
    assert.match(content, /data-locale-target=/);
    assert.match(content, /\.\.\/assets\/app\.css/);
    assert.match(content, /\.\.\/assets\/app\.js/);
  }
});

test('shared app.js handles locale switch, mobile nav, and toc activation', async () => {
  const content = await readDoc('docs/assets/app.js');

  assert.match(content, /querySelectorAll\('\[data-locale-target\]'\)/);
  assert.match(content, /replace\('\/zh\/', '\/en\/'\)/);
  assert.match(content, /replace\('\/en\/', '\/zh\/'\)/);
  assert.match(content, /nav-toggle/);
  assert.match(content, /IntersectionObserver/);
  assert.match(content, /page-toc/);
});

test('docs root entry page routes readers into zh and en doc trees', async () => {
  const content = await readDoc('docs/index.html');

  assert.match(content, /Agora Cocos RTC/);
  assert.match(content, /Developer Docs/);
  assert.match(content, /href="\.\/zh\/index\.html"/);
  assert.match(content, /href="\.\/en\/index\.html"/);
  assert.match(content, /中文/);
  assert.match(content, /English/);
});

test('shared app.css defines desktop and mobile docs layout', async () => {
  const content = await readDoc('docs/assets/app.css');

  assert.match(content, /\.doc-shell/);
  assert.match(content, /\.doc-header/);
  assert.match(content, /\.doc-nav/);
  assert.match(content, /\.doc-main/);
  assert.match(content, /\.doc-toc/);
  assert.match(content, /@media \(max-width: 960px\)/);
});

test('overview pages explain package contents, support matrix, and reading paths', async () => {
  const zh = await readDoc('docs/zh/index.html');
  const en = await readDoc('docs/en/index.html');

  for (const content of [zh, en]) {
    assert.match(content, /sdk\/agora-rtc/);
    assert.match(content, /example\/basic-call/);
    assert.match(content, /Cocos Creator 3\.8\.8/);
    assert.match(content, /Android/);
    assert.match(content, /iOS/);
    assert.match(content, /Quickstart/);
    assert.match(content, /API Reference/);
  }
});

test('quickstart pages show the first-success path and concrete code snippets', async () => {
  const zh = await readDoc('docs/zh/quickstart.html');
  const en = await readDoc('docs/en/quickstart.html');

  for (const content of [zh, en]) {
    assert.match(content, /\.\/scripts\/prepare-example\.sh/);
    assert.match(content, /createAgoraRtcClient/);
    assert.match(content, /await client\.initialize\(appId\)/);
    assert.match(content, /await client\.joinChannel\(token, channelId, uid\)/);
    assert.match(content, /joinChannelSuccess/);
    assert.match(content, /localVideoTextureReady/);
    assert.match(content, /\.\/core-apis\.html/);
    assert.match(content, /\.\/rendering\.html/);
  }
});

test('core api pages group methods by developer task instead of source file', async () => {
  const zh = await readDoc('docs/zh/core-apis.html');
  const en = await readDoc('docs/en/core-apis.html');

  for (const content of [zh, en]) {
    assert.match(content, /Engine &amp; Session|引擎与会话/);
    assert.match(content, /Channel &amp; Identity|频道与身份/);
    assert.match(content, /Audio|音频/);
    assert.match(content, /Video &amp; Views|视频与视图/);
    assert.match(content, /Rendering &amp; Visual Controls|渲染与视觉控制/);
    assert.match(content, /Mixing, Effects &amp; Diagnostics|混音、音效与诊断/);
    assert.match(content, /initialize/);
    assert.match(content, /joinChannel/);
    assert.match(content, /setVideoEncoderConfiguration/);
  }
});

test('rendering pages explain current engine-texture behavior and compatibility limits', async () => {
  const zh = await readDoc('docs/zh/rendering.html');
  const en = await readDoc('docs/en/rendering.html');

  for (const content of [zh, en]) {
    assert.match(content, /engine-texture/);
    assert.match(content, /displayNode/);
    assert.match(content, /localVideoTextureReady/);
    assert.match(content, /remoteVideoTextureReady/);
    assert.match(content, /setNativeVideoOverlaySuspended/);
    assert.match(content, /position semantics|position 语义/);
    assert.match(content, /mirror/i);
  }
});

test('example pages explain the QA console and grouped demo actions', async () => {
  const zh = await readDoc('docs/zh/example.html');
  const en = await readDoc('docs/en/example.html');

  for (const content of [zh, en]) {
    assert.match(content, /QA/);
    assert.match(content, /Full Demo/);
    assert.match(content, /Channel/);
    assert.match(content, /Mixing/);
    assert.match(content, /Effect/);
    assert.match(content, /Diag/);
    assert.match(content, /RtcSessionService/);
  }
});

test('platform notes pages surface Android and iOS differences inline', async () => {
  const zh = await readDoc('docs/zh/platform-notes.html');
  const en = await readDoc('docs/en/platform-notes.html');

  for (const content of [zh, en]) {
    assert.match(content, /setDefaultAudioRouteToSpeakerphone/);
    assert.match(content, /setAudioSessionOperationRestriction/);
    assert.match(content, /publishThirdCameraTrack/);
    assert.match(content, /publishFourthCameraTrack/);
    assert.match(content, /playEffect\.gain/);
    assert.match(content, /sourceType/);
  }
});

const expectedReferenceAnchors = [
  'export-createAgoraRtcClient',
  'export-createAgoraEngineTextureViewManager',
  'export-createAgoraEngineTextureViewController',
  'export-getAgoraEngineTextureBridge',
  'method-on',
  'method-off',
  'method-initialize',
  'method-joinChannel',
  'method-joinChannelWithUserAccount',
  'method-getUserInfoByUserAccount',
  'method-setRenderBackend',
  'method-setVideoEncoderConfiguration',
  'method-setupLocalVideoView',
  'method-setupRemoteVideoView',
  'method-startPreview',
  'method-stopPreview',
  'method-switchCamera',
  'method-startAudioMixing',
  'method-playEffect',
  'method-setParameters',
  'method-getEngineTexture',
  'method-isEngineTextureReady',
  'method-destroy',
  'event-joinChannelSuccess',
  'event-leaveChannel',
  'event-rtcStats',
  'event-localVideoTextureReady',
  'event-remoteVideoTextureReady',
  'event-renderBackendState',
  'event-error',
];

test('api reference pages expose stable anchors for public exports, methods, and events', async () => {
  const zh = await readDoc('docs/zh/api-reference.html');
  const en = await readDoc('docs/en/api-reference.html');

  for (const anchor of expectedReferenceAnchors) {
    assert.match(zh, new RegExp(`id="${anchor}"`));
    assert.match(en, new RegExp(`id="${anchor}"`));
  }
});

test('api reference documents signatures, params, and returns for key methods', async () => {
  const zh = await readDoc('docs/zh/api-reference.html');
  const en = await readDoc('docs/en/api-reference.html');

  for (const content of [zh, en]) {
    assert.match(content, /data-signature="createAgoraRtcClient\(options\?: AgoraRtcClientOptions\)"/);
    assert.match(content, /data-signature="initialize\(config: string \| AgoraRtcEngineConfig\)"/);
    assert.match(content, /data-signature="joinChannel\(token: string, channelId: string, uid: number, options\?: AgoraChannelMediaOptions\)"/);
    assert.match(content, /data-signature="setVideoEncoderConfiguration\(config: AgoraVideoEncoderConfiguration\)"/);
    assert.match(content, /data-signature="playEffect\(config: AgoraPlayEffectConfig\)"/);
    assert.match(content, /data-signature="setParameters\(parameters: string \| Record(?:<|&lt;)string, unknown(?:>|&gt;)\)"/);
    assert.match(content, /class="param-list"/);
    assert.match(content, /class="return-note"/);
  }

  assert.match(zh, /参数说明/);
  assert.match(zh, /返回值/);
  assert.match(en, /Parameters/);
  assert.match(en, /Returns/);
});

test('every listed api reference method article includes signature and return metadata', async () => {
  const zh = await readDoc('docs/zh/api-reference.html');
  const en = await readDoc('docs/en/api-reference.html');

  const methodIds = [
    'method-on',
    'method-off',
    'method-initialize',
    'method-joinChannel',
    'method-joinChannelWithUserAccount',
    'method-getUserInfoByUserAccount',
    'method-setRenderBackend',
    'method-setVideoEncoderConfiguration',
    'method-setupLocalVideoView',
    'method-setupRemoteVideoView',
    'method-startPreview',
    'method-stopPreview',
    'method-switchCamera',
    'method-startAudioMixing',
    'method-playEffect',
    'method-setParameters',
    'method-getEngineTexture',
    'method-isEngineTextureReady',
    'method-destroy',
  ];

  for (const content of [zh, en]) {
    for (const id of methodIds) {
      assert.match(content, new RegExp(`<article id="${id}"[\\s\\S]*?class="signature"[\\s\\S]*?class="return-note"`));
    }
  }
});

test('priority event entries include payload field documentation', async () => {
  const zh = await readDoc('docs/zh/api-reference.html');
  const en = await readDoc('docs/en/api-reference.html');

  for (const content of [zh, en]) {
    assert.match(content, /id="event-joinChannelSuccess"[\s\S]*?class="param-list"/);
    assert.match(content, /id="event-leaveChannel"[\s\S]*?class="param-list"/);
    assert.match(content, /id="event-rtcStats"[\s\S]*?class="param-list"/);
    assert.match(content, /id="event-localVideoTextureReady"[\s\S]*?class="param-list"/);
    assert.match(content, /id="event-remoteVideoTextureReady"[\s\S]*?class="param-list"/);
    assert.match(content, /id="event-renderBackendState"[\s\S]*?class="param-list"/);
    assert.match(content, /id="event-error"[\s\S]*?class="param-list"/);
  }

  assert.match(zh, /payload 字段/);
  assert.match(en, /Payload fields/);
});

test('event docs do not fall back to source-type placeholders', async () => {
  const zh = await readDoc('docs/zh/api-reference.html');
  const en = await readDoc('docs/en/api-reference.html');

  assert.doesNotMatch(zh, /见源码事件 payload 类型定义/);
  assert.doesNotMatch(en, /See source event payload type/);
});

test('narrative docs link related api names to deep reference anchors', async () => {
  const zhQuickstart = await readDoc('docs/zh/quickstart.html');
  const enQuickstart = await readDoc('docs/en/quickstart.html');
  const zhCoreApis = await readDoc('docs/zh/core-apis.html');
  const enCoreApis = await readDoc('docs/en/core-apis.html');

  for (const content of [zhQuickstart, enQuickstart]) {
    assert.match(content, /href="\.\/api-reference\.html#export-createAgoraRtcClient"/);
    assert.match(content, /href="\.\/api-reference\.html#method-initialize"/);
    assert.match(content, /href="\.\/api-reference\.html#method-joinChannel"/);
    assert.match(content, /href="\.\/api-reference\.html#event-joinChannelSuccess"/);
    assert.match(content, /href="\.\/api-reference\.html#event-localVideoTextureReady"/);
  }

  for (const content of [zhCoreApis, enCoreApis]) {
    assert.match(content, /href="\.\/api-reference\.html#method-setChannelProfile"/);
    assert.match(content, /href="\.\/api-reference\.html#method-joinChannelWithUserAccount"/);
    assert.match(content, /href="\.\/api-reference\.html#method-setVideoEncoderConfiguration"/);
    assert.match(content, /href="\.\/api-reference\.html#method-setRenderBackend"/);
    assert.match(content, /href="\.\/api-reference\.html#method-startAudioMixing"/);
    assert.match(content, /href="\.\/api-reference\.html#method-setLogFile"/);
  }
});

test('readmes point users to the new static docs entry pages', async () => {
  const rootReadme = await readFile(path.join(repoRoot, 'README.md'), 'utf8');
  const sdkReadme = await readFile(path.join(repoRoot, 'sdk/agora-rtc/README.md'), 'utf8');

  assert.match(rootReadme, /docs\/zh\/index\.html/);
  assert.match(rootReadme, /docs\/en\/index\.html/);
  assert.match(sdkReadme, /docs\/zh\/index\.html/);
  assert.match(sdkReadme, /docs\/en\/index\.html/);
});

test('github pages workflow publishes the docs directory', async () => {
  const workflow = await readFile(path.join(repoRoot, '.github/workflows/deploy-pages.yml'), 'utf8');

  assert.match(workflow, /name:\s*['"]?Deploy Docs to GitHub Pages['"]?/);
  assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.match(workflow, /on:\s*[\s\S]*\n\s*push:\s*[\s\S]*\n\s*branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /permissions:\s*[\s\S]*pages:\s*write/);
  assert.match(workflow, /permissions:\s*[\s\S]*id-token:\s*write/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /path:\s*\.\/docs/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

const sourceSurfaceSnapshot = JSON.parse(execFileSync('python3', ['-c', `
import json, pathlib, re
root = pathlib.Path('.').resolve()
agora = (root / 'sdk/agora-rtc/js/agora.ts').read_text()
types = (root / 'sdk/agora-rtc/js/types.ts').read_text()
exports = re.findall(r'^export function ([A-Za-z0-9_]+)\\(', agora, re.M)
start = agora.index('export class AgoraRtcClient {')
end = agora.index('export function createAgoraRtcClient')
class_block = agora[start:end]
methods = []
for match in re.finditer(r'^  (?:async )?([A-Za-z0-9_]+)\\(', class_block, re.M):
    name = match.group(1)
    if name != 'constructor' and not name.startswith('#'):
        methods.append(name)
event_block = types.split('export interface AgoraEventMap {', 1)[1].split('export interface CocosJsbBridgeTransport', 1)[0]
events = []
for line in event_block.splitlines():
    match = re.match(r'\\s{2}([A-Za-z0-9_]+):', line)
    if match:
        events.append(match.group(1))
print(json.dumps({
  'exports': exports,
  'methods': methods,
  'events': events,
}))
`], { encoding: 'utf8', cwd: repoRoot }));

test('api reference covers every public top-level export, client method, and event from source', async () => {
  const zh = await readDoc('docs/zh/api-reference.html');
  const en = await readDoc('docs/en/api-reference.html');

  for (const name of sourceSurfaceSnapshot.exports) {
    const anchor = `export-${name}`;
    assert.match(zh, new RegExp(`id="${anchor}"`));
    assert.match(en, new RegExp(`id="${anchor}"`));
  }

  for (const name of sourceSurfaceSnapshot.methods) {
    const anchor = `method-${name}`;
    assert.match(zh, new RegExp(`id="${anchor}"`), `zh doc missing ${anchor}`);
    assert.match(en, new RegExp(`id="${anchor}"`), `en doc missing ${anchor}`);
  }

  for (const name of sourceSurfaceSnapshot.events) {
    const anchor = `event-${name}`;
    assert.match(zh, new RegExp(`id="${anchor}"`), `zh doc missing ${anchor}`);
    assert.match(en, new RegExp(`id="${anchor}"`), `en doc missing ${anchor}`);
  }
});

test('source types expose tsdoc on key config and payload structures', async () => {
  const agora = await readFile(path.join(repoRoot, 'sdk/agora-rtc/js/agora.ts'), 'utf8');
  const types = await readFile(path.join(repoRoot, 'sdk/agora-rtc/js/types.ts'), 'utf8');

  assert.match(agora, /\/\*\*[\s\S]*?\*\/\s*export type AgoraRtcClientOptions/);

  for (const name of [
    'AgoraRtcVideoCanvas',
    'AgoraVideoEncoderConfiguration',
    'AgoraContentInspectConfig',
    'AgoraClientRoleOptions',
    'AgoraRtcEngineConfig',
    'AgoraChannelMediaOptions',
    'AgoraLeaveChannelOptions',
    'AgoraAudioMixingConfig',
    'AgoraPlayEffectConfig',
    'AgoraUserInfo',
    'AgoraRtcStatsPayload',
    'AgoraEventMap',
  ]) {
    assert.match(types, new RegExp(`/\\*\\*[\\s\\S]*?\\*/\\s*export (?:interface|type) ${name}`), `${name} should have TSDoc`);
  }
});
