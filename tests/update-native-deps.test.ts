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
    gradlePluginVersion: '8.13.1',
    gradleDistributionUrl:
      'https\\://services.gradle.org/distributions/gradle-8.13-bin.zip',
    localMavenRelativePath: '../../../local-maven',
    targetPackageName: 'io.agora.cocos.example',
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
  assert.equal(config.android.targetPackageName, 'io.agora.cocos.example');
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

test('dependencies-content updates iOS package products when provided', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1 | products:RtcBasic,AINS',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic', 'AINS']);
});

test('package products tolerate spaces after commas', async () => {
  const config = await runWithContent(
    'github:https://github.com/AgoraIO/AgoraAudio_iOS.git | tag:4.5.3-a1 | products:RtcBasic, AINS, AudioBeauty',
  );

  assert.deepEqual(config.ios.packageProducts, ['RtcBasic', 'AINS', 'AudioBeauty']);
});
