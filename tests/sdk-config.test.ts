import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();
const sourceConfig = JSON.parse(
  readFileSync(path.join(repoRoot, 'sdk/agora-rtc/sdk-config.json'), 'utf8'),
);

test('sdk native dependency config is exposed from a single source of truth', () => {
  const sdkConfig = require('../sdk/agora-rtc/dist/sdk-config.js');

  assert.deepEqual(sdkConfig.android.dependencies, sourceConfig.android.dependencies);
  assert.equal(sdkConfig.ios.packageVersion, sourceConfig.ios.packageVersion);
  assert.equal(sdkConfig.ios.packageUrl, sourceConfig.ios.packageUrl);
  assert.deepEqual(sdkConfig.ios.packageProducts, sourceConfig.ios.packageProducts);
  assert.deepEqual(
    sdkConfig.ios.productCompilationFlags,
    sourceConfig.ios.productCompilationFlags,
  );
  assert.equal(sdkConfig.ios.podName, sourceConfig.ios.podName);
  assert.equal(sdkConfig.ios.deploymentTarget, sourceConfig.ios.deploymentTarget);
  assert.equal(sdkConfig.ios.integrationMode, sourceConfig.ios.integrationMode);
});
