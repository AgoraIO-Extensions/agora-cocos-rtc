import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('android debug doc reflects current export flow instead of removed patch scripts', async () => {
  const content = await readFile(
    `${repoRoot}/docs/android-debug.md`,
    'utf8',
  );

  assert.doesNotMatch(content, /patch-exported-main-bundle/);
  assert.doesNotMatch(content, /sync-android-runtime-main-assets/);
  assert.match(content, /runtime plugin Java 源码同步到导出工程/);
  assert.match(content, /不要和 `dev-ios\.sh` 并行跑/);
});

test('customer integration doc lists the expanded sdk surface and events', async () => {
  const content = await readFile(
    `${repoRoot}/docs/customer-integration.md`,
    'utf8',
  );

  assert.match(content, /getErrorDescription/);
  assert.match(content, /isSpeakerphoneEnabled/);
  assert.match(content, /rtcStats/);
  assert.match(content, /contentInspectResult/);
});

test('api verification matrix records current platform gaps explicitly', async () => {
  const content = await readFile(
    `${repoRoot}/docs/api-verification-matrix.md`,
    'utf8',
  );

  assert.match(content, /setDefaultAudioRouteToSpeakerphone/);
  assert.match(content, /Android 4\.5\.3 Java API 无该方法/);
  assert.match(content, /setAudioSessionOperationRestriction/);
  assert.match(content, /warning/);
  assert.match(content, /EnableVideoObserver/);
  assert.match(content, /initialize \/ destroy/);
});
