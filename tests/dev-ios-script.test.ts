import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('dev-ios script syncs current ios runtime bridge sources into exported project before pod install', async () => {
  const content = await readFile(
    `${repoRoot}/scripts/dev-ios.sh`,
    'utf8',
  );

  assert.match(content, /\.\/scripts\/prepare-example\.sh/);
  assert.match(content, /CocosCreator/);
  assert.match(content, /IOS_RUNTIME_PLUGIN_DIR=/);
  assert.match(content, /IOS_EXPORTED_PLUGIN_DIR=/);
  assert.match(content, /cp -R "\$IOS_RUNTIME_PLUGIN_DIR\/\." "\$IOS_EXPORTED_PLUGIN_DIR\/"/);
  assert.ok(
    content.indexOf('"$COCOS_CLI" --project "$COCOS_PROJECT_DIR" --build "configPath=$COCOS_BUILD_CONFIG"')
      < content.indexOf('./scripts/integrate-ios-project.rb >/dev/null'),
    'expected integrate-ios-project.rb to run after cocos ios export',
  );
  assert.match(content, /pod install/);
  assert.match(content, /xcodebuild/);
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
  assert.match(content, /security find-identity -v -p codesigning/);
  assert.match(content, /integrate-ios-project\.rb/);
  assert.match(content, /xcodebuild/);
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
