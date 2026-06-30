import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

const baseConfig = {
  android: {
    dependencies: ['io.agora.rtc:agora-special-voice:4.5.3.0.BASIC1'],
  },
  ios: {
    packageUrl: 'https://github.com/AgoraIO/AgoraAudio_iOS.git',
    packageVersion: '4.5.3-a0',
    packageProducts: ['RtcBasic'],
    swiftVersion: '5.0',
    podName: 'AgoraRtcEngine_iOS',
    deploymentTarget: '13.0',
    integrationMode: 'swift-package-manager',
  },
};

async function runWithContent(content: string) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agora-update-deps-'));
  const configPath = path.join(tempRoot, 'sdk-config.json');
  await writeFile(configPath, `${JSON.stringify(baseConfig, null, 2)}\n`, 'utf8');

  await execFileAsync(
    'node',
    [
      './scripts/update-native-deps.mjs',
      '--dependencies-content',
      content,
      '--config',
      configPath,
    ],
    { cwd: repoRoot },
  );

  return JSON.parse(await readFile(configPath, 'utf8'));
}

test('dependencies-content updates iOS package url/version and Android coordinates', async () => {
  const config = await runWithContent(
    [
      'github:git@github.com:AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1',
      "implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
    ].join('\n'),
  );

  assert.deepEqual(config.android.dependencies, [
    'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1',
  ]);
  assert.equal(config.ios.packageUrl, 'https://github.com/AgoraIO/AgoraAudio_iOS.git');
  assert.equal(config.ios.packageVersion, '4.5.3-a1');
});

test('dependencies-content preserves unrelated config fields', async () => {
  const config = await runWithContent(
    "implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
  );

  assert.equal(config.ios.integrationMode, 'swift-package-manager');
  assert.deepEqual(config.ios.packageProducts, ['RtcBasic']);
});

test('dependencies-content collects multiple Android coordinates', async () => {
  const config = await runWithContent(
    [
      "implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
      "api 'io.agora.rtc:full-screen-sharing-special:4.5.3.1.BASIC1'",
    ].join('\n'),
  );

  assert.deepEqual(config.android.dependencies, [
    'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1',
    'io.agora.rtc:full-screen-sharing-special:4.5.3.1.BASIC1',
  ]);
});

test('https github source is kept as-is', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1',
  );

  assert.equal(config.ios.packageUrl, 'https://github.com/AgoraIO/AgoraAudio_iOS.git');
});

test('products listed after a products: label are taken verbatim', async () => {
  // Any names work — the script does not assume a fixed set, so future
  // Package.swift products are supported without code changes.
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1 | products:RtcBasic,AINS,AudioBeauty',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic', 'AINS', 'AudioBeauty']);
});

test('a future product name not known in advance is still selectable', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1 | products:RtcBasic,SomeBrandNewProduct',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic', 'SomeBrandNewProduct']);
});

test('products list tolerates assorted spacing and a product:/= label', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git tag:4.5.3-a1 product = RtcBasic, AINS ,AudioBeauty',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic', 'AINS', 'AudioBeauty']);
});

test('a trailing Maven coordinate after the products list is left alone', async () => {
  // workflow_dispatch inputs arrive on one line, so the Android coordinate can
  // sit right after the products list; the list must stop before it.
  const config = await runWithContent(
    "github:https://github.com/AgoraIO/AgoraAudio_iOS.git tag:4.5.3-a1 products:RtcBasic implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic']);
  assert.deepEqual(config.android.dependencies, [
    'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1',
  ]);
});

test('omitting the products label leaves the existing package products untouched', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic']);
});

test('messy free-form input still resolves every field', async () => {
  const config = await runWithContent(
    [
      'please bump iOS to tag = 4.5.3-a1',
      'repo git@github.com:AgoraIO/AgoraAudio_iOS.git',
      "android: implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
      'products: RtcBasic, AINS',
    ].join('\n'),
  );

  assert.equal(config.ios.packageVersion, '4.5.3-a1');
  assert.equal(config.ios.packageUrl, 'https://github.com/AgoraIO/AgoraAudio_iOS.git');
  assert.deepEqual(config.ios.packageProducts, ['RtcBasic', 'AINS']);
  assert.deepEqual(config.android.dependencies, [
    'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1',
  ]);
});

// --- Adversarial cases: each of these caught a real parser bug. ---

test('the word "hashtag" is not mistaken for a tag: label', async () => {
  // /tag/ without a word boundary matches the "tag" inside "hashtag", which
  // would set the iOS version to a stray neighbouring token.
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git tag:4.5.3-a1 hashtag meeting',
  );

  assert.equal(config.ios.packageVersion, '4.5.3-a1');
});

test('a github url with a trailing slash is still recognized', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git/ tag:4.5.3-a1',
  );

  assert.equal(config.ios.packageUrl, 'https://github.com/AgoraIO/AgoraAudio_iOS.git');
});

test('an empty products label does not harvest a word from a following url', async () => {
  // `products:` with no real names must NOT pull "https"/"github" out of the
  // URL that follows it. With nothing valid after the label, products stay put.
  const config = await runWithContent(
    'products: https://github.com/AgoraIO/AgoraAudio_iOS.git tag:4.5.3-a1',
  );

  // The base config's products are left untouched, not replaced by a URL token.
  assert.deepEqual(config.ios.packageProducts, ['RtcBasic']);
});

test('duplicate Maven coordinates are de-duplicated', async () => {
  const config = await runWithContent(
    [
      "implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
      "implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'",
    ].join('\n'),
  );

  assert.deepEqual(config.android.dependencies, [
    'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1',
  ]);
});

test('a product name that is a prefix of a url host is not captured', async () => {
  // "github" is a valid-looking identifier but here it is the url host, not a
  // product. The negative lookahead on "." / ":" / "/" must reject it.
  const config = await runWithContent(
    'products:github.com tag:1.0',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic']);
});
