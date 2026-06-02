import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('build-all-platforms script exports android and ios packages without launching devices', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/build-all-platforms.sh`,
    'utf8',
  );

  assert.match(content, /AGORA_CONFIG_PATH=/);
  assert.match(content, /<YOUR_AGORA_APP_ID>/);
  assert.match(content, /Please edit example\/basic-call\/assets\/resources\/agora-config\.json/);
  assert.match(content, /ANDROID_BUILD_CONFIG=.*build-configs\/android-debug\.json/);
  assert.match(content, /IOS_BUILD_CONFIG=.*build-configs\/ios-debug\.json/);
  assert.match(content, /fetch-agora-maven\.mjs/);
  assert.match(content, /generate-ios-podfile\.mjs/);
  assert.match(content, /integrate-ios-project\.rb/);
  assert.match(content, /ANDROID_GRADLE_OFFLINE="\$\{ANDROID_GRADLE_OFFLINE:-false\}"/);
  assert.match(content, /\.\/gradlew :agora-cocos-basic-call:assembleDebug/);
  assert.match(content, /\.\/gradlew --offline :agora-cocos-basic-call:assembleDebug/);
  assert.match(content, /xcodebuild -workspace "\$IOS_WORKSPACE_PATH"/);
  assert.match(content, /ditto -c -k --keepParent "\$IOS_APP_PATH" "\$IOS_APP_ZIP_PATH"/);
  assert.doesNotMatch(content, /adb install/);
  assert.doesNotMatch(content, /simctl install/);
  assert.doesNotMatch(content, /simctl launch/);
  assert.match(content, /Android APK:/);
  assert.match(content, /iOS simulator app:/);
});

test('package scripts expose the local all-platform build command', async () => {
  const packageJson = JSON.parse(await readFile(`${repoRoot}/package.json`, 'utf8'));

  assert.equal(packageJson.scripts['build:all-platforms'], './scripts/build-all-platforms.sh');
});

test('root readme does not expose internal example package workflow to sdk customers', async () => {
  const content = await readFile(`${repoRoot}/README.md`, 'utf8');

  assert.doesNotMatch(content, /npm run build:all-platforms/);
  assert.doesNotMatch(content, /example\/basic-call\/assets\/resources\/agora-config\.json/);
  assert.match(content, /scripts\/package-sdk\.sh/);
});

test('github build workflow can inject agora secrets and optionally upload platform packages', async () => {
  const content = await readFile(`${repoRoot}/.github/workflows/run_build_example.yml`, 'utf8');
  const verifyIndex = content.indexOf('- name: Verify');
  const deliveryIndex = content.indexOf('- name: Package customer delivery');
  const configureIndex = content.indexOf('- name: Configure Agora example credentials');
  const buildIndex = content.indexOf('- name: Build Android and iOS example packages');

  assert.match(content, /build_platform_packages:/);
  assert.match(content, /runner_label:/);
  assert.match(content, /runs-on: \$\{\{ inputs\.runner_label \|\| 'macos-latest' \}\}/);
  assert.match(content, /DEFAULT_BUILD_APP_ID:/);
  assert.match(content, /AGORA_CHANNEL_ID:/);
  assert.match(content, /AGORA_TOKEN:/);
  assert.match(content, /DEFAULT_BUILD_APP_ID: \$\{\{ secrets\.APP_ID \}\}/);
  assert.match(content, /AGORA_CHANNEL_ID: \$\{\{ secrets\.AGORA_CHANNEL_ID \}\}/);
  assert.match(content, /AGORA_TOKEN: \$\{\{ secrets\.AGORA_TOKEN \}\}/);
  assert.match(content, /APP_ID secret is required when build_platform_packages is true/);
  assert.match(content, /exit 1/);
  assert.match(content, /export AGORA_CHANNEL_ID="\$\{AGORA_CHANNEL_ID:-testapi\}"/);
  assert.match(content, /config\.appId = process\.env\.DEFAULT_BUILD_APP_ID/);
  assert.match(content, /npm run build:all-platforms/);
  assert.match(content, /name: agora-cocos-example-android-apk/);
  assert.match(content, /name: agora-cocos-example-ios-simulator-app/);
  assert.doesNotMatch(content, /echo .*\$APP_ID/);
  assert.doesNotMatch(content, /echo .*\$\{APP_ID\}/);
  assert.doesNotMatch(content, /echo .*AGORA_TOKEN/);
  assert.doesNotMatch(content, /AGORA_APP_ID|vars\./);
  assert.ok(verifyIndex >= 0, 'workflow should run verification');
  assert.ok(deliveryIndex > verifyIndex, 'customer delivery should be packaged after verification');
  assert.ok(
    configureIndex > deliveryIndex,
    'temporary Agora credentials should not be injected before SDK/customer delivery packaging',
  );
  assert.ok(
    buildIndex > configureIndex,
    'platform package build should run after temporary Agora credentials are injected',
  );
});
