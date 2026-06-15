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
  assert.match(content, /ANDROID_BUILD_CONFIG=.*build-configs\/android-debug\.json/);
  assert.match(content, /ANDROID_COCOS_BUILD_CONFIG=.*build-android\/android-debug\.local\.json/);
  assert.match(content, /ANDROID_NDK_HOME="\$\{ANDROID_NDK_HOME:-\$\{ANDROID_NDK_ROOT:-\}\}"/);
  assert.match(content, /resolve_android_ndk_path\(\)/);
  assert.match(content, /write_android_cocos_build_config\(\)/);
  assert.match(content, /sdkPath/);
  assert.match(content, /ndkPath/);
  assert.match(content, /--build "configPath=\$ANDROID_COCOS_BUILD_CONFIG"/);
  assert.match(content, /sync-android-app-bridge\.mjs/);
  assert.doesNotMatch(content, /ANDROID_RUNTIME_JAVA_DIR=/);
  assert.doesNotMatch(content, /cp -R "\$ANDROID_RUNTIME/);
  assert.match(content, /ANDROID_SDK_ROOT_DEFAULT=/);
  assert.match(content, /PACKAGE_NAME="io\.agora\.cocos\.example"/);
  assert.match(content, /ADB_BIN=/);
  assert.match(content, /TARGET_ANDROID_SERIAL="\$\{1:-\$\{ANDROID_SERIAL:-\}\}"/);
  assert.match(content, /ADB_TARGET_ARGS=\(\)/);
  assert.match(content, /ADB_TARGET_ARGS=\(-s "\$TARGET_ANDROID_SERIAL"\)/);
  assert.match(content, /if \[\[ ! -x "\$ADB_BIN" \]\]; then/);
  assert.match(content, /if \[\[ ! -d "\$LOCAL_AGORA_MAVEN_DIR" \]\]; then/);
  assert.match(content, /node \.\/scripts\/fetch-agora-maven\.mjs >/);
  assert.match(content, /has_example_build_config_env\(\)/);
  assert.match(content, /AUTO_JOIN/);
  assert.match(content, /PUBLISH_CAMERA_TRACK/);
  assert.match(content, /node \.\/scripts\/write-example-build-config\.mjs >/);
  assert.match(content, /"\$ADB_BIN" "\$\{ADB_TARGET_ARGS\[@\]\}" install -g -r --no-streaming "\$APK_PATH"/);
  assert.match(content, /"\$ADB_BIN" "\$\{ADB_TARGET_ARGS\[@\]\}" logcat -c \|\| echo "Warning: failed to clear logcat; continuing\." >&2/);
  assert.match(content, /"\$ADB_BIN" "\$\{ADB_TARGET_ARGS\[@\]\}" shell am start -n "\$PACKAGE_NAME\/\$ACTIVITY_NAME"/);
  assert.doesNotMatch(content, /patch-exported-main-bundle/);
  assert.doesNotMatch(content, /sync-android-runtime-main-assets/);
});
