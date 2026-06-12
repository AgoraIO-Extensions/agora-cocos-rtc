import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { access, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();

async function listFiles(root: string) {
  const results: string[] = [];

  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  }

  await walk(root);
  return results.sort();
}

test('package-customer-delivery script assembles sdk zip and example assets without local docs', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-delivery-'));
  const script = path.join(repoRoot, 'scripts/package-customer-delivery.sh');
  const localBuildConfigPath = path.join(
    repoRoot,
    'example/basic-call/assets/resources/agora-config.build.json',
  );
  const localBuildConfigMetaPath = `${localBuildConfigPath}.meta`;

  await writeFile(
    localBuildConfigPath,
    JSON.stringify({ appId: 'local-secret-app-id', channelId: 'local-channel', token: '' }, null, 2),
    'utf8',
  );
  await writeFile(
    localBuildConfigMetaPath,
    JSON.stringify({ importer: 'json', uuid: 'local-build-config-meta' }, null, 2),
    'utf8',
  );

  try {
    await execFileAsync('/bin/zsh', [script, outputDir], {
      cwd: repoRoot,
    });
  } finally {
    await rm(localBuildConfigPath, { force: true });
    await rm(localBuildConfigMetaPath, { force: true });
  }

  const checks = [
    'agora-rtc-cocos-plugin.zip',
    'example-basic-call/.creator/default-meta.json',
    'example-basic-call/.gitignore',
    'example-basic-call/README.md',
    'example-basic-call/assets',
    'example-basic-call/build-configs',
    'example-basic-call/native/agora-rtc/cc_plugin.json',
    'example-basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift',
    'example-basic-call/package.json',
    'example-basic-call/settings/v2/packages/project.json',
    'example-basic-call/tsconfig.json',
  ];

  for (const relativePath of checks) {
    const absolutePath = path.join(outputDir, relativePath);
    await access(absolutePath);
  }

  const files = await listFiles(outputDir);
  const forbiddenPatterns = [
    /(?:^|\/)\.DS_Store$/,
    /(?:^|\/)node_modules\//,
    /(?:^|\/)dist-cache\//,
    /^docs\//,
    /HANDOFF/i,
    /^example-basic-call\/build(?:-|\/)(?!configs\/)/,
    /^example-basic-call\/library\//,
    /^example-basic-call\/temp\//,
    /^example-basic-call\/assets\/resources\/agora-config\.build\.json(?:\.meta)?$/,
    /\.(?:mobileprovision|p12|jks|keystore)$/,
  ];

  const forbiddenFiles = files.filter((file) =>
    forbiddenPatterns.some((pattern) => pattern.test(file)),
  );
  assert.deepEqual(forbiddenFiles, []);

  for (const file of files) {
    const absolutePath = path.join(outputDir, file);
    const content = await readFile(absolutePath, 'utf8').catch(() => '');
    assert.doesNotMatch(content, /(?:file:\/\/)?\/Users\/[^)\s"'`]+/);
    assert.doesNotMatch(content, /\bappId["']?\s*[:=]\s*["'][0-9a-f]{32}["']/i);
    assert.doesNotMatch(content, /\btoken["']?\s*[:=]\s*["'](?!\s*["'])[A-Za-z0-9_=-]{40,}["']/);
  }
});

test('package-customer-delivery script copies the checked-in native engine template before packaging', async () => {
  const script = await readFile(
    path.join(repoRoot, 'scripts/package-customer-delivery.sh'),
    'utf8',
  );

  assert.match(script, /DELIVERY_TEMPLATE_DIR="\$ROOT_DIR\/customer-delivery\/example-basic-call"/);
  assert.match(script, /mkdir -p "\$EXAMPLE_DIR\/native"/);
  assert.match(script, /cp -R "\$DELIVERY_TEMPLATE_DIR\/native\/engine" "\$EXAMPLE_DIR\/native\/"/);

  const engineTemplateRoot = path.join(
    repoRoot,
    'customer-delivery/example-basic-call/native/engine',
  );
  const expectedTemplateFiles = [
    'android/res/values/strings.xml',
    'common/CMakeLists.txt',
    'ios/Info.plist',
  ];

  for (const relativePath of expectedTemplateFiles) {
    await access(path.join(engineTemplateRoot, relativePath));
  }
});

test('customer-delivery template map defines directory-level sync boundaries', async () => {
  const templateMap = JSON.parse(
    await readFile(
      path.join(repoRoot, 'scripts/customer-delivery-template-map.json'),
      'utf8',
    ),
  );

  assert.ok(Array.isArray(templateMap.rules));
  assert.ok(templateMap.rules.length > 0);
  assert.ok(Array.isArray(templateMap.overrides));

  const exampleAndroidRule = templateMap.rules.find(
    (rule: Record<string, unknown>) =>
      rule.type === 'mirror'
      && rule.src === 'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc'
      && rule.dst === 'example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc',
  );
  assert.ok(exampleAndroidRule, 'example Android runtime bridge should mirror from sdk templates');

  const deliveryEngineRule = templateMap.rules.find(
    (rule: Record<string, unknown>) =>
      rule.type === 'preserve'
      && rule.src === 'customer-delivery/example-basic-call/native/engine',
  );
  assert.ok(deliveryEngineRule, 'customer-delivery native engine should be preserved as a dedicated template root');
});

test('customer-delivery sync script enforces template rules from the shared map', async () => {
  const script = await readFile(
    path.join(repoRoot, 'scripts/sync-customer-delivery-templates.mjs'),
    'utf8',
  );

  assert.match(script, /customer-delivery-template-map\.json/);
  assert.match(script, /rule\.src/);
  assert.match(script, /rule\.dst/);
  assert.match(script, /Unsupported rule type/);
  assert.match(script, /preserve/);
  assert.match(script, /mirror/);
});
