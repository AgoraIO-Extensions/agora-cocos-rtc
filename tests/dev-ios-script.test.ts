import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('dev-ios script syncs current ios runtime bridge sources and links the configured Swift package', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/dev-ios.sh`,
    'utf8',
  );

  assert.match(content, /\.\/scripts\/prepare-example\.sh/);
  assert.match(content, /CocosCreator/);
  assert.match(content, /IOS_RUNTIME_PLUGIN_DIR=/);
  assert.match(content, /IOS_EXPORTED_PLUGIN_DIR=/);
  assert.match(content, /PROJECT_PATH="\$IOS_PROJECT_DIR\/agora-cocos-basic-call\.xcodeproj"/);
  assert.doesNotMatch(content, /WORKSPACE_PATH=/);
  assert.match(content, /cp -R "\$IOS_RUNTIME_PLUGIN_DIR\/\." "\$IOS_EXPORTED_PLUGIN_DIR\/"/);
  assert.ok(
    content.indexOf('"$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$COCOS_BUILD_CONFIG"')
      < content.indexOf('IOS_INTEGRATION_ARGS='),
    'expected integrate-ios-project.rb to run after cocos ios export',
  );
  assert.doesNotMatch(content, /generate-ios-podfile\.mjs/);
  assert.match(content, /IOS_SIMULATOR_RESOURCE_MODE="\$\{IOS_SIMULATOR_RESOURCE_MODE:-auto\}"/);
  assert.match(content, /xcodebuild -version -sdk iphonesimulator ProductBuildVersion/);
  assert.match(content, /xcrun simctl list runtimes/);
  assert.match(content, /--skip-simulator-launch-assets/);
  assert.match(content, /integrate-ios-project\.rb "\$\{IOS_INTEGRATION_ARGS\[@\]\}"/);
  assert.doesNotMatch(content, /pod install/);
  assert.match(content, /xcodebuild -project "\$PROJECT_PATH"/);
  assert.match(content, /-target "\$SCHEME_NAME"/);
  assert.doesNotMatch(content, /-scheme "\$SCHEME_NAME"/);
  assert.doesNotMatch(content, /-derivedDataPath/);
  assert.match(content, /SYMROOT="\$IOS_PRODUCTS_DIR"/);
  assert.match(content, /OBJROOT="\$IOS_INTERMEDIATES_DIR"/);
  assert.doesNotMatch(content, /xcodebuild -workspace/);
  assert.match(content, /IOS_BUNDLE_ID="\$\{IOS_BUNDLE_ID:-io\.agora\.cocos\.example\}"/);
});

test('ios debug build config uses the requested agora example bundle identifier', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/build-configs/ios-debug.json`,
    'utf8',
  );

  assert.match(content, /"packageName": "io\.agora\.cocos\.example"/);
});

test('integrate-ios-project can apply manual signing overrides for device builds', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/integrate-ios-project.rb`,
    'utf8',
  );

  assert.match(content, /^#!\/usr\/bin\/env ruby/);
  assert.doesNotMatch(content, /\/opt\/homebrew\/opt\/ruby/);
  assert.match(content, /COMMON_ENGINE_TEXTURE_BRIDGE_DIR/);
  assert.match(content, /AgoraEngineTextureBridge\.h/);
  assert.match(content, /AgoraEngineTextureBridge\.cpp/);
  assert.match(content, /add_file_references/);
  assert.match(content, /ENV\['IOS_BUNDLE_ID'\]/);
  assert.match(content, /ENV\['IOS_DEVELOPMENT_TEAM'\]/);
  assert.match(content, /ENV\['IOS_PROVISIONING_PROFILE_SPECIFIER'\]/);
  assert.match(content, /CODE_SIGN_STYLE/);
  assert.match(content, /PROVISIONING_PROFILE_SPECIFIER/);
  assert.match(content, /PRODUCT_BUNDLE_IDENTIFIER/);
});

test('dev-ios-device script wires bundle id, team, provisioning profile, and device install flow', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/dev-ios-device.sh`,
    'utf8',
  );

  assert.match(content, /IOS_BUNDLE_ID=.*io\.agora\.cocos\.example/);
  assert.match(content, /IOS_DEVELOPMENT_TEAM="\$\{IOS_DEVELOPMENT_TEAM:-\}"/);
  assert.match(content, /IOS_PROVISIONING_PROFILE_SPECIFIER="\$\{IOS_PROVISIONING_PROFILE_SPECIFIER:-\}"/);
  assert.match(content, /PROJECT_PATH="\$IOS_PROJECT_DIR\/agora-cocos-basic-call\.xcodeproj"/);
  assert.doesNotMatch(content, /WORKSPACE_PATH=/);
  assert.match(content, /security find-identity -v -p codesigning/);
  assert.doesNotMatch(content, /generate-ios-podfile\.mjs/);
  assert.match(content, /integrate-ios-project\.rb --with-package/);
  assert.doesNotMatch(content, /pod install/);
  assert.match(content, /xcodebuild -project "\$PROJECT_PATH"/);
  assert.doesNotMatch(content, /xcodebuild -workspace/);
  assert.match(content, /devicectl device install app/);
  assert.match(content, /devicectl device process launch/);
});

test('agora native plugin manifest remains disabled because this project uses manual native integration', async () => {
  const content = await readFile(
    `${repoRoot}/sdk/agora-rtc/cc_plugin.json`,
    'utf8',
  );

  assert.match(content, /"disabled":\s*true/);
  assert.match(content, /"engine-version":\s*">=3\.8\.0"/);
  assert.match(content, /"platforms":\s*\[/);
});
