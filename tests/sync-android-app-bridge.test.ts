import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('sync-android-app-bridge only copies Example demo Java, not rtc templates', async () => {
  const content = await readFile(`${repoRoot}/scripts/sync-android-app-bridge.mjs`, 'utf8');

  assert.match(content, /native\/agora-rtc\/android\/src\/main\/java\/io\/agora\/cocos\/demo/);
  assert.match(content, /ANDROID_ENGINE_DIR_NAMES/);
  assert.match(content, /native\/engine\/google-play/);
  assert.match(content, /build-\$\{engineDir\}/);
  assert.match(content, /syncExampleDemoJava/);
  assert.doesNotMatch(content, /cp\(runtimeJavaDir/);
  assert.doesNotMatch(content, /engineJavaDir/);
});
