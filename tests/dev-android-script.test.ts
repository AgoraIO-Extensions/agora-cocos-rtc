import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('dev-android script exports current source with Cocos CLI instead of old runtime patching', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/dev-android.sh`,
    'utf8',
  );

  assert.match(content, /CocosCreator\.app\/Contents\/MacOS\/CocosCreator/);
  assert.match(content, /COCOS_BUILD_CONFIG=.*build-configs\/android-debug\.json/);
  assert.match(content, /--build "configPath=\$COCOS_BUILD_CONFIG"/);
  assert.match(content, /ANDROID_RUNTIME_PLUGIN_DIR=/);
  assert.match(content, /ANDROID_EXPORTED_PLUGIN_DIR=/);
  assert.match(content, /cp -R "\$ANDROID_RUNTIME_PLUGIN_DIR\/\." "\$ANDROID_EXPORTED_PLUGIN_DIR\/"/);
  assert.match(content, /ANDROID_SDK_ROOT_DEFAULT=/);
  assert.match(content, /ADB_BIN=/);
  assert.match(content, /if \[\[ ! -x "\$ADB_BIN" \]\]; then/);
  assert.match(content, /if \[\[ ! -d "\$LOCAL_AGORA_MAVEN_DIR" \]\]; then/);
  assert.match(content, /node \.\/scripts\/fetch-agora-maven\.mjs >/);
  assert.match(content, /"\$ADB_BIN" install -g -r --no-streaming "\$APK_PATH"/);
  assert.match(content, /"\$ADB_BIN" shell am start -n "\$PACKAGE_NAME\/\$ACTIVITY_NAME"/);
  assert.doesNotMatch(content, /patch-exported-main-bundle/);
  assert.doesNotMatch(content, /sync-android-runtime-main-assets/);
});
