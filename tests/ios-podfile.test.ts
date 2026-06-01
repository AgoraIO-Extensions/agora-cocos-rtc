import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { renderPodfile } = require('../sdk/agora-rtc/dist/ios-podfile.js');

test('ios podfile renderer uses sdk config as the single source of truth', () => {
  const podfile = renderPodfile({
    targetName: 'agora-cocos-basic-call-mobile',
    projectName: 'agora-cocos-basic-call.xcodeproj',
  });

  assert.match(podfile, /platform :ios, '13\.0'/);
  assert.match(podfile, /project 'agora-cocos-basic-call\.xcodeproj'/);
  assert.match(podfile, /target 'agora-cocos-basic-call-mobile'/);
  assert.match(podfile, /pod 'AgoraRtcEngine_iOS', '4\.5\.3'/);
  assert.match(podfile, /SWIFT_VERSION/);
});
