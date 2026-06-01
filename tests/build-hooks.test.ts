import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {
  applyAndroidGradleDependencies,
  ensureAgoraLocalMavenRepository,
  ensureIosSetupGuide,
  findFirstExistingPath,
  rewriteAndroidGradlePluginVersion,
  rewriteGradleDistributionUrl,
  sdkConfig,
} = require('../sdk/agora-rtc/dist/hooks.js');

test('applyAndroidGradleDependencies injects Agora artifacts once', () => {
  const original = `plugins {
    id 'com.android.application'
  }

  dependencies {
      implementation "com.google.code.gson:gson:2.10.1"
  }
  `;

  const once = applyAndroidGradleDependencies(original);
  const twice = applyAndroidGradleDependencies(once);

  for (const dependency of sdkConfig.android.dependencies) {
    assert.match(once, new RegExp(dependency.replaceAll('.', '\\.')));
  }
  assert.equal(once, twice);
});

test('rewriteAndroidGradlePluginVersion upgrades AGP to the pinned cached version', () => {
  const original = "classpath 'com.android.tools.build:gradle:8.10.1'";
  const rewritten = rewriteAndroidGradlePluginVersion(original);

  assert.match(
    rewritten,
    new RegExp(sdkConfig.android.gradlePluginVersion.replaceAll('.', '\\.')),
  );
  assert.doesNotMatch(rewritten, /8\.10\.1/);
});

test('ensureAgoraLocalMavenRepository injects project-local Maven mirror once', () => {
  const original = `allprojects {
    repositories {
        google()
        mavenCentral()
    }
  }`;

  const once = ensureAgoraLocalMavenRepository(original);
  const twice = ensureAgoraLocalMavenRepository(once);

  assert.match(once, /local-maven/);
  assert.equal(once, twice);
});

test('rewriteGradleDistributionUrl pins the wrapper to Gradle 8.13', () => {
  const original = 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip';
  const rewritten = rewriteGradleDistributionUrl(original);

  assert.equal(rewritten, `distributionUrl=${sdkConfig.android.gradleDistributionUrl}`);
});

test('findFirstExistingPath returns the first matching candidate', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-paths-'));
  const target = path.join(root, 'proj', 'android', 'app', 'build.gradle');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, 'dependencies {}', 'utf8');

  const result = await findFirstExistingPath(root, [
    'missing/file.txt',
    'proj/android/app/build.gradle',
  ]);

  assert.equal(result, target);
});

test('ensureIosSetupGuide writes an actionable SPM guide', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-'));

  const filePath = await ensureIosSetupGuide(root);
  const content = await readFile(filePath, 'utf8');

  assert.match(content, new RegExp(sdkConfig.ios.packageProduct));
  assert.match(content, new RegExp(sdkConfig.ios.packageVersion.replaceAll('.', '\\.')));
  assert.match(content, /Swift Package Manager/);
});

test('cocos extension entrypoints are loadable from commonjs', () => {
  const main = require('../sdk/agora-rtc/dist/main.js');
  const builder = require('../sdk/agora-rtc/dist/builder.js');

  assert.equal(typeof main.load, 'function');
  assert.equal(typeof main.unload, 'function');
  assert.equal(typeof builder.configs.ios.hooks, 'string');
});
