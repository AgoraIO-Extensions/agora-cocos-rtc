import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

test('build-all-platforms script exports selected android apk and ios ipa packages without launching devices', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/build-all-platforms.sh`,
    'utf8',
  );
  const prepareContent = await readFile(
    `${repoRoot}/scripts/prepare-example.sh`,
    'utf8',
  );

  assert.match(content, /LOCAL_BUILD_ENV=/);
  assert.match(content, /source "\$LOCAL_BUILD_ENV"/);
  assert.match(content, /TARGET_PLATFORMS=/);
  assert.match(content, /REQUESTED_PLATFORMS/);
  assert.match(content, /unsupported platform/);
  assert.match(content, /should_build_platform\(\)/);
  assert.match(content, /AGORA_CONFIG_PATH=/);
  assert.match(content, /AGORA_BUILD_CONFIG_PATH=/);
  assert.match(content, /APP_ID:-/);
  assert.match(content, /TEST_APP_ID:-/);
  assert.match(content, /AUTO_JOIN:-/);
  assert.match(content, /PUBLISH_CAMERA_TRACK:-/);
  assert.match(content, /write-example-build-config\.mjs/);
  assert.match(content, /<YOUR_AGORA_APP_ID>/);
  assert.match(content, /Please edit example\/basic-call\/assets\/resources\/agora-config\.json/);
  assert.match(content, /Alternatively pass APP_ID or TEST_APP_ID/);
  assert.match(content, /ANDROID_BUILD_CONFIG=.*build-configs\/android-release\.json/);
  assert.match(content, /ANDROID_COCOS_BUILD_CONFIG=/);
  assert.match(content, /ANDROID_NDK_HOME=/);
  assert.match(content, /resolve_android_ndk_path\(\)/);
  assert.match(content, /write_android_cocos_build_config\(\)/);
  assert.match(content, /sdkPath/);
  assert.match(content, /ndkPath/);
  assert.match(content, /IOS_BUILD_CONFIG=.*build-configs\/ios-release\.json/);
  assert.match(content, /IOS_SKIP_COCOS_EXPORT="\$\{IOS_SKIP_COCOS_EXPORT:-false\}"/);
  assert.match(content, /fetch-agora-maven\.mjs/);
  assert.match(content, /sync-native-engine-texture-bridge\.mjs/);
  assert.match(content, /sync-android-app-bridge\.mjs/);
  assert.match(prepareContent, /sync-native-engine-texture-bridge\.mjs/);
  assert.match(prepareContent, /sync-android-app-bridge\.mjs/);
  assert.doesNotMatch(content, /generate-ios-podfile\.mjs/);
  assert.match(content, /integrate-ios-project\.rb --with-package/);
  assert.match(content, /ANDROID_GRADLE_OFFLINE="\$\{ANDROID_GRADLE_OFFLINE:-false\}"/);
  assert.match(content, /\.\/gradlew :agora-cocos-basic-call:assembleRelease/);
  assert.match(content, /\.\/gradlew --offline :agora-cocos-basic-call:assembleRelease/);
  assert.match(content, /validate_ios_signing\(\)/);
  assert.ok(
    content.indexOf('run_cocos_build "$IOS_BUILD_CONFIG" "iOS"') <
      content.indexOf('IOS_BUNDLE_ID="$IOS_BUNDLE_ID"'),
    'iOS project should be exported before integrating the configured Swift package',
  );
  assert.ok(
    content.indexOf('run_cocos_build "$IOS_BUILD_CONFIG" "iOS"') <
      content.indexOf('\n  validate_ios_signing'),
    'iOS project should be exported before signing validation so it can be opened in Xcode',
  );
  assert.match(content, /IOS_EXPORT_METHOD/);
  assert.match(content, /-configuration Release/);
  assert.match(content, /BUILD_PROVISION_PROFILE_NAME/);
  assert.match(content, /BUILD_PROVISION_PROFILE_TEAMID/);
  assert.match(content, /BUILD_PROVISION_PROFILE_IDENTITY/);
  assert.match(content, /IOS_CODE_SIGN_IDENTITY="\$BUILD_PROVISION_PROFILE_IDENTITY"/);
  assert.match(content, /IOS_PROJECT_PATH="\$IOS_PROJECT_DIR\/agora-cocos-basic-call\.xcodeproj"/);
  assert.doesNotMatch(content, /IOS_WORKSPACE_PATH=/);
  assert.match(content, /xcodebuild -project "\$IOS_PROJECT_PATH"/);
  assert.doesNotMatch(content, /xcodebuild -workspace/);
  assert.match(content, /-sdk iphoneos/);
  assert.match(content, /-destination generic\/platform=iOS/);
  assert.match(content, /archive/);
  assert.doesNotMatch(content, /^\s+DEVELOPMENT_TEAM="\$BUILD_PROVISION_PROFILE_TEAMID" \\\s*$/m);
  assert.doesNotMatch(content, /^\s+CODE_SIGN_IDENTITY="\$BUILD_PROVISION_PROFILE_IDENTITY" \\\s*$/m);
  assert.doesNotMatch(content, /^\s+PROVISIONING_PROFILE_SPECIFIER="\$BUILD_PROVISION_PROFILE_NAME" \\\s*$/m);
  assert.match(content, /-exportArchive/);
  assert.match(content, /find "\$IOS_EXPORT_PATH" -maxdepth 1 -name '\*\.ipa'/);
  assert.match(content, /IOS_IPA_PATH=/);
  assert.doesNotMatch(content, /adb install/);
  assert.doesNotMatch(content, /simctl install/);
  assert.doesNotMatch(content, /simctl launch/);
  assert.doesNotMatch(content, /pod install/);
  assert.match(content, /Release packages:/);
  assert.match(content, /print_build_artifacts\(\)/);
});

test('package scripts expose the local all-platform build command', async () => {
  const packageJson = JSON.parse(await readFile(`${repoRoot}/package.json`, 'utf8'));

  assert.equal(packageJson.scripts['build:all-platforms'], './scripts/build-all-platforms.sh');
});

test('example build config writer accepts command-line environment credentials', async () => {
  const buildConfigPath = `${repoRoot}/example/basic-call/assets/resources/agora-config.build.json`;
  const buildConfigMetaPath = `${buildConfigPath}.meta`;
  await rm(buildConfigPath, { force: true });
  await rm(buildConfigMetaPath, { force: true });

  await execFileAsync('node', ['./scripts/write-example-build-config.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      APP_ID: '',
      CHANNEL_ID: '',
      TOKEN: '',
      TEST_APP_ID: 'test-app-id',
      TEST_CHANNEL_ID: 'testapi',
      TEST_TOKEN: '',
    },
  });

  const buildConfig = JSON.parse(await readFile(buildConfigPath, 'utf8'));
  assert.equal(buildConfig.appId, 'test-app-id');
  assert.equal(buildConfig.channelId, 'testapi');
  assert.equal(buildConfig.token, '');
  const buildConfigMeta = JSON.parse(await readFile(buildConfigMetaPath, 'utf8'));
  assert.equal(buildConfigMeta.importer, 'json');

  await rm(buildConfigPath, { force: true });
  await rm(buildConfigMetaPath, { force: true });
});

test('example build config writer accepts smoke media options', async () => {
  const buildConfigPath = `${repoRoot}/example/basic-call/assets/resources/agora-config.build.json`;
  const buildConfigMetaPath = `${buildConfigPath}.meta`;
  await rm(buildConfigPath, { force: true });
  await rm(buildConfigMetaPath, { force: true });

  await execFileAsync('node', ['./scripts/write-example-build-config.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      TEST_APP_ID: 'test-app-id',
      TEST_CHANNEL_ID: 'testapi',
      TEST_TOKEN: '',
      UID: '501',
      TEST_UID: '2002',
      AUTO_PREVIEW: 'false',
      AUTO_JOIN: 'true',
      PUBLISH_CAMERA_TRACK: 'false',
      PUBLISH_MICROPHONE_TRACK: 'false',
      AUTO_SUBSCRIBE_AUDIO: 'true',
      AUTO_SUBSCRIBE_VIDEO: 'true',
    },
  });

  const buildConfig = JSON.parse(await readFile(buildConfigPath, 'utf8'));
  assert.equal(buildConfig.uid, 2002);
  assert.equal(buildConfig.autoPreview, false);
  assert.equal(buildConfig.autoJoin, true);
  assert.equal(buildConfig.publishCameraTrack, false);
  assert.equal(buildConfig.publishMicrophoneTrack, false);
  assert.equal(buildConfig.autoSubscribeAudio, true);
  assert.equal(buildConfig.autoSubscribeVideo, true);

  await rm(buildConfigPath, { force: true });
  await rm(buildConfigMetaPath, { force: true });
});

test('example build config writer can apply smoke flags to an edited base config without env app id', async () => {
  const baseConfigPath = `${repoRoot}/example/basic-call/assets/resources/agora-config.json`;
  const buildConfigPath = `${repoRoot}/example/basic-call/assets/resources/agora-config.build.json`;
  const buildConfigMetaPath = `${buildConfigPath}.meta`;
  const originalBaseConfig = await readFile(baseConfigPath, 'utf8');
  const baseConfig = {
    ...JSON.parse(originalBaseConfig),
    appId: 'base-app-id',
    channelId: 'base-channel',
    token: 'base-token',
  };

  await rm(buildConfigPath, { force: true });
  await rm(buildConfigMetaPath, { force: true });
  await writeFile(baseConfigPath, `${JSON.stringify(baseConfig, null, 2)}\n`, 'utf8');

  try {
    await execFileAsync('node', ['./scripts/write-example-build-config.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        APP_ID: '',
        TEST_APP_ID: '',
        CHANNEL_ID: '',
        TEST_CHANNEL_ID: '',
        TOKEN: '',
        TEST_TOKEN: '',
        AUTO_JOIN: 'true',
        PUBLISH_CAMERA_TRACK: 'false',
      },
    });

    const buildConfig = JSON.parse(await readFile(buildConfigPath, 'utf8'));
    assert.equal(buildConfig.appId, 'base-app-id');
    assert.equal(buildConfig.channelId, 'base-channel');
    assert.equal(buildConfig.token, 'base-token');
    assert.equal(buildConfig.autoJoin, true);
    assert.equal(buildConfig.publishCameraTrack, false);
  } finally {
    await writeFile(baseConfigPath, originalBaseConfig, 'utf8');
    await rm(buildConfigPath, { force: true });
    await rm(buildConfigMetaPath, { force: true });
  }
});

test('example build config writer rejects non-integer smoke uid', async () => {
  await assert.rejects(
    execFileAsync('node', ['./scripts/write-example-build-config.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        TEST_APP_ID: 'test-app-id',
        TEST_UID: '1.9',
      },
    }),
    (error: any) => {
      assert.match(error.stderr, /TEST_UID must be a non-negative integer\./);
      return true;
    },
  );
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
  const buildIndex = content.indexOf('- name: Build selected example package');

  assert.match(content, /target_platforms:/);
  assert.match(content, /description: 'Example package platforms: android, ios, or android,ios\.'/);
  assert.match(content, /default: 'android,ios'/);
  assert.doesNotMatch(content, /build_platform_packages:/);
  assert.match(content, /split-platforms:/);
  assert.match(content, /platforms: \$\{\{ steps\.split-platforms\.outputs\.platforms \}\}/);
  assert.match(content, /Unsupported target_platforms value/);
  assert.match(content, /matrix:[\s\S]*platform: \$\{\{ fromJson\(needs\.split-platforms\.outputs\.platforms\) \}\}/);
  assert.match(content, /runner_label:/);
  assert.match(content, /runner_label is required when target_platforms is not empty/);
  assert.match(content, /default: 'macos-latest'/);
  assert.match(content, /runs-on: \$\{\{ fromJson\(needs\.split-runner-labels\.outputs\.runner_labels\) \}\}/);
  assert.match(content, /COCOS_CREATOR_VERSION: 3\.8\.8/);
  assert.match(content, /COCOS_CREATOR_DOWNLOAD_URL: https:\/\/download\.cocos\.org\/CocosCreator\/v3\.8\.8\/CocosCreator-v3\.8\.8-mac-010512\.zip/);
  assert.match(content, /name: Cache Cocos Creator installer/);
  assert.match(content, /key: cocos-creator-\$\{\{ runner\.os \}\}-\$\{\{ env\.COCOS_CREATOR_VERSION \}\}-010512/);
  assert.match(content, /name: Install Cocos Creator/);
  assert.match(content, /\/Applications\/Cocos\/Creator\/\$\{COCOS_CREATOR_VERSION\}\/CocosCreator\.app/);
  assert.match(content, /find "\$extract_dir" -name CocosCreator\.app -type d/);
  assert.match(content, /APP_ID:/);
  assert.match(content, /APP_ID: \$\{\{ secrets\.APP_ID \}\}/);
  assert.match(content, /CHANNEL_ID: testapi/);
  assert.doesNotMatch(content, /AGORA_CHANNEL_ID:/);
  assert.doesNotMatch(content, /AGORA_TOKEN:/);
  assert.match(content, /APP_ID secret is required when target_platforms is not empty/);
  assert.match(content, /exit 1/);
  assert.match(content, /node \.\/scripts\/write-example-build-config\.mjs/);
  assert.doesNotMatch(content, /config\.appId = process\.env/);
  assert.match(content, /BUILD_PROVISION_PROFILE_UUID:/);
  assert.match(content, /BUILD_PROVISION_PROFILE_NAME:/);
  assert.match(content, /BUILD_PROVISION_PROFILE_TEAMID:/);
  assert.match(content, /BUILD_PROVISION_PROFILE_IDENTITY:/);
  assert.match(content, /BUILD_CERTIFICATE_BASE64:/);
  assert.match(content, /P12_PASSWORD:/);
  assert.match(content, /BUILD_PROVISION_PROFILE_BASE64:/);
  assert.match(content, /KEYCHAIN_PASSWORD:/);
  assert.match(content, /security import/);
  assert.match(content, /security set-key-partition-list/);
  assert.match(content, /BUILD_CERTIFICATE_BASE64/);
  assert.match(content, /BUILD_PROVISION_PROFILE_BASE64/);
  assert.match(content, /echo "\$name secret is required when target_platforms includes ios\."/);
  assert.match(content, /name: Setup Android SDK for Cocos/);
  assert.match(content, /cmdline-tools\/latest\/bin\/sdkmanager/);
  assert.match(content, /set \+e\s+yes \| "\$sdkmanager" --licenses >\/dev\/null\s+license_status="\$\{PIPESTATUS\[1\]\}"\s+set -e/);
  assert.match(content, /license_status="\$\{PIPESTATUS\[1\]\}"/);
  assert.match(content, /Failed to accept Android SDK licenses/);
  assert.match(content, /ndk;23\.1\.7779620/);
  assert.match(content, /ANDROID_SDK_ROOT=/);
  assert.match(content, /ANDROID_NDK_HOME=/);
  assert.match(content, /npm run build:all-platforms -- "\$\{\{ matrix\.platform \}\}"/);
  assert.match(content, /name: agora-cocos-example-android-apk/);
  assert.match(content, /outputs\/apk\/release\/\*\.apk/);
  assert.match(content, /name: agora-cocos-example-ios-ipa/);
  assert.doesNotMatch(content, /echo .*\$APP_ID/);
  assert.doesNotMatch(content, /echo .*\$\{APP_ID\}/);
  assert.doesNotMatch(content, /AGORA_APP_ID|vars\.|AGORA_CHANNEL_ID|AGORA_TOKEN/);
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
