import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('dev-google-play script exports google-play with Cocos CLI and shared android integration scripts', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/dev-google-play.sh`,
    'utf8',
  );

  assert.match(content, /CocosCreator\.app\/Contents\/MacOS\/CocosCreator/);
  assert.match(content, /GOOGLE_PLAY_BUILD_CONFIG=.*build-configs\/google-play-debug\.json/);
  assert.match(content, /GOOGLE_PLAY_COCOS_BUILD_CONFIG=.*build-google-play\/google-play-debug\.local\.json/);
  assert.match(content, /GOOGLE_PLAY_PROJECT_DIR=.*build-google-play\/google-play\/proj/);
  assert.match(content, /write-cocos-native-build-config\.mjs/);
  assert.match(content, /--build "configPath=\$GOOGLE_PLAY_COCOS_BUILD_CONFIG"/);
  assert.match(content, /build-google-play\/google-play\/data\/assets\/main\/index\.js/);
  assert.match(content, /sync-android-app-bridge\.mjs/);
  assert.match(content, /LOCAL_AGORA_MAVEN_DIR=.*example\/basic-call\/local-maven/);
});
