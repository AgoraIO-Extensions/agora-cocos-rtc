import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { access, readFile } from 'node:fs/promises';

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
