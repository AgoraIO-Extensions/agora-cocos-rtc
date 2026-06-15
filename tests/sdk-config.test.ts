import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const EXPECTED_IOS_PACKAGE_PRODUCTS = [
  'RtcBasic',
  'AINS',
  'AINSLL',
  'AudioBeauty',
  'ClearVision',
  'ContentInspect',
  'SpatialAudio',
  'VirtualBackground',
  'AIAEC',
  'AIAECLL',
  'VQA',
  'FaceDetection',
  'FaceCapture',
  'LipSync',
  'VideoCodecEnc',
  'VideoAv1CodecEnc',
  'ReplayKit',
];

test('sdk native dependency config is exposed from a single source of truth', () => {
  const sdkConfig = require('../sdk/agora-rtc/dist/sdk-config.js');

  assert.deepEqual(sdkConfig.android.dependencies, [
    'io.agora.rtc:full-sdk:4.5.3',
  ]);
  assert.equal(sdkConfig.android.gradlePluginVersion, '8.13.1');
  assert.equal(sdkConfig.android.targetPackageName, 'io.agora.cocos.example');
  assert.equal(
    sdkConfig.android.gradleDistributionUrl,
    'https\\://services.gradle.org/distributions/gradle-8.13-bin.zip',
  );
  assert.equal(sdkConfig.ios.packageVersion, '4.5.3');
  assert.equal(
    sdkConfig.ios.packageUrl,
    'https://github.com/AgoraIO/AgoraRtcEngine_iOS.git',
  );
  assert.deepEqual(sdkConfig.ios.packageProducts, EXPECTED_IOS_PACKAGE_PRODUCTS);
  assert.equal(sdkConfig.ios.podName, 'AgoraRtcEngine_iOS');
  assert.equal(sdkConfig.ios.deploymentTarget, '13.0');
  assert.equal(sdkConfig.ios.integrationMode, 'swift-package-manager');
});
