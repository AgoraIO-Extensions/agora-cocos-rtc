import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();
const engineTextureBackendTemplate = path.join(
  repoRoot,
  'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java',
);
const engineTextureBackendRuntime = path.join(
  repoRoot,
  'native/engine/android/app/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java',
);
const engineTextureSlotBridgeTemplate = path.join(
  repoRoot,
  'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/AgoraEngineTextureSlotBridge.java',
);
const iosEngineTextureSlotBridgeTemplate = path.join(
  repoRoot,
  'sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.mm',
);
const iosEngineTextureSlotBridgeHeaderTemplate = path.join(
  repoRoot,
  'sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.h',
);
const primaryRepoRoot = repoRoot.replace(/\/\.worktrees\/[^/]+$/, '');
const iosRtcDelegateHeaderCandidates = [
  path.join(
    repoRoot,
    'example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineDelegate.h',
  ),
  path.join(
    primaryRepoRoot,
    'example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineDelegate.h',
  ),
];
const iosRtcObjectsHeaderCandidates = [
  path.join(
    repoRoot,
    'example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraObjects.h',
  ),
  path.join(
    primaryRepoRoot,
    'example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraObjects.h',
  ),
];

async function readFirstExistingFile(filePaths: string[]) {
  for (const filePath of filePaths) {
    try {
      return {
        filePath,
        content: await readFile(filePath, 'utf8'),
      };
    } catch (error) {
      if ((error as { code?: string }).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return null;
}

async function readEngineTextureLimits(filePath: string) {
  const content = await readFile(filePath, 'utf8');
  const remoteWidthMatch = content.match(/REMOTE_TARGET_WIDTH = (\d+);/);
  const remoteHeightMatch = content.match(/REMOTE_TARGET_HEIGHT = (\d+);/);
  const localWidthMatch = content.match(/LOCAL_TARGET_WIDTH = (\d+);/);
  const localHeightMatch = content.match(/LOCAL_TARGET_HEIGHT = (\d+);/);

  assert.ok(remoteWidthMatch, `Missing REMOTE_TARGET_WIDTH in ${filePath}`);
  assert.ok(remoteHeightMatch, `Missing REMOTE_TARGET_HEIGHT in ${filePath}`);
  assert.ok(localWidthMatch, `Missing LOCAL_TARGET_WIDTH in ${filePath}`);
  assert.ok(localHeightMatch, `Missing LOCAL_TARGET_HEIGHT in ${filePath}`);

  return {
    remoteWidth: Number(remoteWidthMatch[1]),
    remoteHeight: Number(remoteHeightMatch[1]),
    localWidth: Number(localWidthMatch[1]),
    localHeight: Number(localHeightMatch[1]),
  };
}

function assertPatternBefore(
  content: string,
  beforePattern: RegExp,
  afterPattern: RegExp,
  message: string,
) {
  const beforeIndex = content.search(beforePattern);
  const afterIndex = content.search(afterPattern);

  assert.ok(beforeIndex >= 0, `Missing before pattern for ${message}`);
  assert.ok(afterIndex >= 0, `Missing after pattern for ${message}`);
  assert.ok(
    beforeIndex < afterIndex,
    `Expected ${message}: ${beforePattern} before ${afterPattern}`,
  );
}

function normalizeRotation(rotation: number) {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 180 || normalized === 270
    ? normalized
    : 0;
}

function mapTransformedPixel(
  outputX: number,
  outputY: number,
  width: number,
  height: number,
  rotation: number,
  mirror: boolean,
  verticalFlip = false,
  outputWidth?: number,
  outputHeight?: number,
) {
  const normalizedRotation = normalizeRotation(rotation);
  const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  const naturalWidth = swapsDimensions ? height : width;
  const naturalHeight = swapsDimensions ? width : height;
  const resolvedOutputWidth = outputWidth ?? naturalWidth;
  const resolvedOutputHeight = outputHeight ?? naturalHeight;
  const naturalX = Math.min(
    naturalWidth - 1,
    Math.max(0, Math.floor(outputX * naturalWidth / resolvedOutputWidth)),
  );
  const rawNaturalY = Math.min(
    naturalHeight - 1,
    Math.max(0, Math.floor(outputY * naturalHeight / resolvedOutputHeight)),
  );
  const naturalY = verticalFlip ? naturalHeight - 1 - rawNaturalY : rawNaturalY;
  const mappedNaturalX = mirror ? naturalWidth - 1 - naturalX : naturalX;

  switch (normalizedRotation) {
    case 90:
      return { x: naturalY, y: height - 1 - mappedNaturalX };
    case 180:
      return { x: width - 1 - mappedNaturalX, y: height - 1 - naturalY };
    case 270:
      return { x: width - 1 - naturalY, y: mappedNaturalX };
    default:
      return { x: mappedNaturalX, y: naturalY };
  }
}

function transformPixelLabels(
  labels: string[][],
  rotation: number,
  mirror: boolean,
  targetWidth?: number,
  targetHeight?: number,
  verticalFlip = false,
) {
  const height = labels.length;
  const width = labels[0].length;
  const normalizedRotation = normalizeRotation(rotation);
  const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  const outputWidth = targetWidth ?? (swapsDimensions ? height : width);
  const outputHeight = targetHeight ?? (swapsDimensions ? width : height);

  return Array.from({ length: outputHeight }, (_, outputY) =>
    Array.from({ length: outputWidth }, (_, outputX) => {
      const source = mapTransformedPixel(
        outputX,
        outputY,
        width,
        height,
        rotation,
        mirror,
        verticalFlip,
        outputWidth,
        outputHeight,
      );
      return labels[source.y][source.x];
    }),
  );
}

test('ios swift bridge template passes a syntax-only compile', async () => {
  const swiftFile = path.join(
    repoRoot,
    'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift',
  );

  await execFileAsync('/usr/bin/swiftc', ['-parse', swiftFile]);
});

test('engine-texture backend keeps template/runtime slot upload dimensions in sync', async () => {
  const templateLimits = await readEngineTextureLimits(engineTextureBackendTemplate);
  const runtimeLimits = await readEngineTextureLimits(engineTextureBackendRuntime);

  assert.deepEqual(runtimeLimits, templateLimits);
  assert.ok(
    templateLimits.remoteWidth > 0 && templateLimits.remoteHeight > 0,
    `Expected positive remote texture size, got ${templateLimits.remoteWidth}x${templateLimits.remoteHeight}`,
  );
  assert.ok(
    templateLimits.localWidth > 0 && templateLimits.localHeight > 0,
    `Expected positive local texture size, got ${templateLimits.localWidth}x${templateLimits.localHeight}`,
  );
});

test('engine-texture backend emits texture slot lifecycle events instead of Base64 frame payloads', async () => {
  const templateContent = await readFile(engineTextureBackendTemplate, 'utf8');
  const runtimeContent = await readFile(engineTextureBackendRuntime, 'utf8');
  const slotBridgeContent = await readFile(engineTextureSlotBridgeTemplate, 'utf8');
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');

  assert.doesNotMatch(templateContent, /dataBase64/);
  assert.doesNotMatch(runtimeContent, /dataBase64/);
  assert.match(templateContent, /localVideoTextureReady/);
  assert.match(templateContent, /remoteVideoTextureReady/);
  assert.match(templateContent, /localVideoTextureReleased/);
  assert.match(templateContent, /remoteVideoTextureReleased/);
  assert.match(templateContent, /\.put\("slotId", slotId\)/);
  assert.match(templateContent, /\.put\("width", width\)/);
  assert.match(templateContent, /\.put\("height", height\)/);
  assert.match(templateContent, /payload\.put\("uid", uid\)/);
  assert.match(templateContent, /\.put\("backend", getType\(\)\)/);
  assert.match(templateContent, /\.put\("phase", phase\)/);
  assert.match(templateContent, /\.put\("result", result\)/);
  assert.match(templateContent, /\.put\("uid", uid\)/);
  assert.match(templateContent, /FRAME_DIAGNOSTIC_INTERVAL_MS = 2000L/);
  assert.match(templateContent, /Log\.i\(\s*LOG_TAG/);
  assert.match(templateContent, /engine-texture frame/);
  assert.doesNotMatch(templateContent, /localVideoTextureUpdated/);
  assert.doesNotMatch(templateContent, /remoteVideoTextureUpdated/);
  assert.doesNotMatch(runtimeContent, /localVideoTextureUpdated/);
  assert.doesNotMatch(runtimeContent, /remoteVideoTextureUpdated/);
  assert.match(slotBridgeContent, /nativeCreateSlot/);
  assert.match(slotBridgeContent, /nativeUpdateSlot/);
  assert.match(slotBridgeContent, /nativeReleaseSlot/);
  assert.match(iosSlotBridgeContent, /create_agora_engine_texture_slot/);
  assert.match(iosSlotBridgeContent, /update_agora_engine_texture_slot/);
  assert.match(iosSlotBridgeContent, /release_agora_engine_texture_slot/);
});

test('engine-texture raw frame path applies orientation before uploading texture data', async () => {
  const templateContent = await readFile(engineTextureBackendTemplate, 'utf8');
  const runtimeContent = await readFile(engineTextureBackendRuntime, 'utf8');
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');
  const commonBridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/common/Classes/agora/AgoraEngineTextureBridge.cpp'),
    'utf8',
  );

  for (const content of [templateContent, runtimeContent]) {
    assert.match(content, /videoFrame\.getRotation\(\)/);
    assert.match(content, /final boolean mirror = false;/);
    assert.doesNotMatch(
      content,
      /VideoFrame\.SourceType\.kFrontCamera/,
      'engine-texture should not add a selfie mirror on top of raw frame orientation.',
    );
    assert.match(content, /nativeUpdateI420Slot\([\s\S]*rotation,[\s\S]*mirror[\s\S]*\);/);
    assert.doesNotMatch(
      content,
      /buffer\.rotate\(rotation\)|buffer\.mirror\(/,
      'Android I420 buffers may not implement rotate/mirror, so native conversion must handle orientation.',
    );
  }

  assert.match(iosSlotBridgeContent, /videoFrame\.rotation/);
  assert.match(iosSlotBridgeContent, /mirroredVideoFrame:\(AgoraOutputVideoFrame \*\)videoFrame/);
  assert.match(iosSlotBridgeContent, /update_agora_engine_texture_nv12_slot\([\s\S]*videoFrame\.rotation[\s\S]*mirror/);
  assert.match(
    iosSlotBridgeContent,
    /update_agora_engine_texture_nv12_slot\([\s\S]*static_cast<int>\(height\),\s*static_cast<int>\(videoFrame\.rotation\),\s*mirror[\s\S]*\);/,
  );
  assert.match(iosSlotBridgeContent, /update_agora_engine_texture_i420_slot\([\s\S]*videoFrame\.rotation[\s\S]*mirror/);
  assert.match(commonBridgeContent, /normalizeRotation/);
  assert.match(commonBridgeContent, /mapTransformedPixel/);
  assert.match(commonBridgeContent, /mirror/);
});

test('engine-texture local camera preview does not add an extra selfie mirror', async () => {
  const androidTemplateContent = await readFile(engineTextureBackendTemplate, 'utf8');
  const androidRuntimeContent = await readFile(engineTextureBackendRuntime, 'utf8');
  const iosBridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  for (const content of [androidTemplateContent, androidRuntimeContent]) {
    assert.match(content, /final boolean mirror = false;/);
    assert.doesNotMatch(content, /kFrontCamera/);
  }

  assert.match(
    iosBridgeContent,
    /private func updateTextureSlot\(_ slot: TextureSlotState, videoFrame: AgoraOutputVideoFrame\) \{[\s\S]*mirror: false[\s\S]*dispatchTextureReadyIfNeeded/,
  );
  assert.doesNotMatch(
    iosBridgeContent,
    /updateTextureSlot\(slotId: slot\.slotId, videoFrame: videoFrame, mirror: usingFrontCamera\)/,
  );
});

test('engine-texture iOS mirror is applied in display coordinates after rotation', async () => {
  const commonBridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/common/Classes/agora/AgoraEngineTextureBridge.cpp'),
    'utf8',
  );

  assert.match(
    commonBridgeContent,
    /const int normalizedRotation = normalizeRotation\(rotation\);/,
  );
  assert.match(
    commonBridgeContent,
    /const bool swapsDimensions = normalizedRotation == 90 \|\| normalizedRotation == 270;/,
  );
  assert.match(
    commonBridgeContent,
    /const int naturalWidth = swapsDimensions \? height : width;/,
  );
  assert.match(
    commonBridgeContent,
    /const int naturalX = std::min\(naturalWidth - 1, std::max\(0, outputX \* naturalWidth \/ outputWidth\)\);/,
  );
  assert.match(
    commonBridgeContent,
    /const int mappedNaturalX = mirror \? naturalWidth - 1 - naturalX : naturalX;/,
  );
  assert.doesNotMatch(
    commonBridgeContent,
    /sourceX = width - 1 - sourceX;/,
    'Mirror must be applied in output/display coordinates before inverse rotation mapping.',
  );
  assertPatternBefore(
    commonBridgeContent,
    /const int mappedNaturalX = mirror \? naturalWidth - 1 - naturalX : naturalX;/,
    /switch \(normalizedRotation\)/,
    'iOS local mirror should stay horizontal after applying videoFrame.rotation',
  );
});

test('engine-texture iOS coordinate mapping keeps mirror horizontal for rotated frames', () => {
  const source = [
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
  ];

  assert.deepEqual(transformPixelLabels(source, 90, false), [
    ['D', 'A'],
    ['E', 'B'],
    ['F', 'C'],
  ]);
  assert.deepEqual(transformPixelLabels(source, 90, true), [
    ['A', 'D'],
    ['B', 'E'],
    ['C', 'F'],
  ]);
  assert.deepEqual(transformPixelLabels(source, 270, false), [
    ['C', 'F'],
    ['B', 'E'],
    ['A', 'D'],
  ]);
  assert.deepEqual(transformPixelLabels(source, 270, true), [
    ['F', 'C'],
    ['E', 'B'],
    ['D', 'A'],
  ]);
});

test('engine-texture Android coordinate mapping supports native target-size scaling', () => {
  const source = [
    ['A', 'B', 'C', 'D'],
    ['E', 'F', 'G', 'H'],
  ];

  assert.deepEqual(transformPixelLabels(source, 0, false, 2, 1), [
    ['A', 'C'],
  ]);
  assert.deepEqual(transformPixelLabels(source, 90, true, 2, 4), [
    ['A', 'E'],
    ['B', 'F'],
    ['C', 'G'],
    ['D', 'H'],
  ]);
});

test('engine-texture coordinate mapping preserves top-to-bottom upload order for Cocos textures', () => {
  const source = [
    ['top-left', 'top-right'],
    ['bottom-left', 'bottom-right'],
  ];

  assert.deepEqual(transformPixelLabels(source, 0, false), source);
  assert.deepEqual(transformPixelLabels(source, 0, true), [
    ['top-right', 'top-left'],
    ['bottom-right', 'bottom-left'],
  ]);
  assert.notDeepEqual(
    transformPixelLabels(source, 0, false, undefined, undefined, true),
    source,
    'A vertical flip would upload the bottom camera row into the top Cocos texture row.',
  );
});

test('engine-texture iOS requests a frame format with explicit rotation and mirror conversion', async () => {
  const iosBridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');

  assert.match(
    iosBridgeContent,
    /func getVideoFormatPreference\(\) -> AgoraVideoFormat \{[\s\S]*return \.cvPixelNV12[\s\S]*\}/,
  );
  assert.doesNotMatch(iosBridgeContent, /\.CVPixelNV12/);
  assert.doesNotMatch(
    iosBridgeContent,
    /func getVideoFormatPreference\(\) -> AgoraVideoFormat \{[\s\S]*return \.default[\s\S]*\}/,
  );
  assert.doesNotMatch(
    iosSlotBridgeContent,
    /case 13:\s*case 14:\s*\[self updateSlot:slotId pixelBuffer:videoFrame\.pixelBuffer\];/,
    'CVPixelBuffer I420 must not bypass the rotation/mirror-aware conversion path.',
  );
});

test('engine-texture iOS converts CVPixelBuffer I420 frames instead of dropping them', async () => {
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');

  assert.match(
    iosSlotBridgeContent,
    /case 13:[\s\S]*CVPixelBufferGetBaseAddressOfPlane\(videoFrame\.pixelBuffer, 0\)[\s\S]*CVPixelBufferGetBaseAddressOfPlane\(videoFrame\.pixelBuffer, 1\)[\s\S]*CVPixelBufferGetBaseAddressOfPlane\(videoFrame\.pixelBuffer, 2\)/,
  );
  assert.match(
    iosSlotBridgeContent,
    /case 13:[\s\S]*update_agora_engine_texture_i420_slot\([\s\S]*videoFrame\.rotation[\s\S]*mirror[\s\S]*\);[\s\S]*break;/,
  );
  assert.doesNotMatch(
    iosSlotBridgeContent,
    /case 13:\s*break;/,
    'CVPixelBuffer I420 frames should be converted, not ignored.',
  );
});

test('android bridge template dispatches expanded sdk methods', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /case "getSdkVersion":/);
  assert.match(bridgeContent, /case "getErrorDescription":/);
  assert.match(bridgeContent, /case "setChannelProfile":/);
  assert.match(bridgeContent, /case "enableAudio":/);
  assert.match(bridgeContent, /case "isSpeakerphoneEnabled":/);
  assert.match(bridgeContent, /case "startAudioMixing":/);
  assert.match(bridgeContent, /case "playEffect":/);
  assert.match(bridgeContent, /case "pauseEffect":/);
  assert.match(bridgeContent, /case "resumeEffect":/);
  assert.match(bridgeContent, /case "setEffectsVolume":/);
  assert.match(bridgeContent, /case "adjustAudioMixingPublishVolume":/);
  assert.match(bridgeContent, /case "adjustAudioMixingPlayoutVolume":/);
  assert.match(bridgeContent, /case "setParameters":/);
});

test('android bridge template wires supported advanced sdk methods to real Agora APIs', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /rtcEngine\.setVideoEncoderConfiguration/);
  assert.match(bridgeContent, /rtcEngine\.setBeautyEffectOptions/);
  assert.match(bridgeContent, /rtcEngine\.enableContentInspect/);
  assert.match(bridgeContent, /rtcEngine\.startAudioMixing/);
  assert.match(bridgeContent, /rtcEngine\.pauseAudioMixing/);
  assert.match(bridgeContent, /rtcEngine\.resumeAudioMixing/);
  assert.match(bridgeContent, /rtcEngine\.stopAudioMixing/);
  assert.match(bridgeContent, /rtcEngine\.getAudioMixingCurrentPosition/);
  assert.match(bridgeContent, /rtcEngine\.setAudioMixingPosition/);
  assert.match(bridgeContent, /rtcEngine\.adjustAudioMixingVolume/);
  assert.match(bridgeContent, /rtcEngine\.getAudioEffectManager\(\)/);
  assert.match(bridgeContent, /preloadEffect/);
  assert.match(bridgeContent, /playEffect/);
  assert.match(bridgeContent, /pauseEffect/);
  assert.match(bridgeContent, /resumeEffect/);
  assert.match(bridgeContent, /setEffectsVolume/);
  assert.match(bridgeContent, /stopEffect/);
  assert.match(bridgeContent, /rtcEngine\.adjustAudioMixingPublishVolume/);
  assert.match(bridgeContent, /rtcEngine\.adjustAudioMixingPlayoutVolume/);
  assert.match(bridgeContent, /onRemoteAudioStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("remoteAudioStateChanged"/);
  assert.match(bridgeContent, /rtcEngine\.setDefaultAudioRoutetoSpeakerphone/);
});

test('android bridge template returns errors for bad native requests instead of timing out', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /private void dispatchNativeExceptionError\(String requestId, Exception error\)/);
  assert.match(bridgeContent, /catch \(Exception error\)[\s\S]*dispatchNativeExceptionError\(requestId, error\);/);
  assert.match(bridgeContent, /Unsupported render backend/);
  assert.match(bridgeContent, /isSupportedRenderBackend\(backend\)/);
  assert.match(bridgeContent, /catch \(Exception error\)[\s\S]*dispatchNativeExceptionError\(requestId, error\);[\s\S]*return;/);
});

test('android bridge template rejects unsafe invalid arguments before calling the rtc sdk', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private void handleJoinChannel[\s\S]*?private void handleGetErrorDescription/,
  );
  assert.ok(handleJoinChannelMatch);
  assert.match(handleJoinChannelMatch[0], /Channel ID is required\./);
  assertPatternBefore(
    handleJoinChannelMatch[0],
    /Channel ID is required\./,
    /rtcEngine\.joinChannel/,
    'joinChannel must reject an empty channel before invoking native sdk',
  );

  const handleSetLogFileMatch = bridgeContent.match(
    /private void handleSetLogFile[\s\S]*?private void handleSetChannelProfile/,
  );
  assert.ok(handleSetLogFileMatch);
  assert.match(handleSetLogFileMatch[0], /Log file path is required\./);
  assertPatternBefore(
    handleSetLogFileMatch[0],
    /Log file path is required\./,
    /rtcEngine\.setLogFile/,
    'setLogFile must reject an empty path before invoking native sdk',
  );

  const handleStartAudioMixingMatch = bridgeContent.match(
    /private void handleStartAudioMixing[\s\S]*?private void handlePauseAudioMixing/,
  );
  assert.ok(handleStartAudioMixingMatch);
  assert.match(handleStartAudioMixingMatch[0], /Audio mixing path is required\./);
  assertPatternBefore(
    handleStartAudioMixingMatch[0],
    /Audio mixing path is required\./,
    /rtcEngine\.startAudioMixing/,
    'startAudioMixing must reject an empty path before invoking native sdk',
  );

  const handleSetParametersMatch = bridgeContent.match(
    /private void handleSetParameters[\s\S]*?private Activity requireActivity/,
  );
  assert.ok(handleSetParametersMatch);
  assert.match(handleSetParametersMatch[0], /Parameters are required\./);
  assertPatternBefore(
    handleSetParametersMatch[0],
    /Parameters are required\./,
    /rtcEngine\.setParameters/,
    'setParameters must reject an empty payload before invoking native sdk',
  );
});

test('android bridge template resolves joinChannel after the sdk accepts the request', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private void handleJoinChannel[\s\S]*?private void handleGetErrorDescription/,
  );
  assert.ok(handleJoinChannelMatch);
  assert.match(handleJoinChannelMatch[0], /dispatchOk\(requestId\);/);
  assert.doesNotMatch(handleJoinChannelMatch[0], /pendingJoinRequestId\s*=\s*requestId/);

  const onJoinChannelSuccessMatch = bridgeContent.match(
    /public void onJoinChannelSuccess[\s\S]*?@Override/,
  );
  assert.ok(onJoinChannelSuccessMatch);
  assert.match(onJoinChannelSuccessMatch[0], /dispatchEvent\("joinChannelSuccess"/);
  assert.doesNotMatch(onJoinChannelSuccessMatch[0], /dispatchOk\(pendingJoinRequestId\)/);
});

test('android bridge template maps joinChannel media options from request payload', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private void handleJoinChannel[\s\S]*?private void handleGetErrorDescription/,
  );
  assert.ok(handleJoinChannelMatch);
  const handleJoinChannel = handleJoinChannelMatch[0];

  assert.match(handleJoinChannel, /JSONObject mediaOptions = params != null \? params\.optJSONObject\("options"\) : null/);
  assert.match(handleJoinChannel, /mediaOptionBoolean\(mediaOptions, "publishCameraTrack", true\)/);
  assert.match(handleJoinChannel, /mediaOptionBoolean\(mediaOptions, "publishMicrophoneTrack", true\)/);
  assert.match(handleJoinChannel, /continueJoinChannel\(requestId, token, channelId, uid, mediaOptions\)/);
  assert.match(handleJoinChannel, /applyChannelMediaOptions\(options, mediaOptions\)/);
  assert.doesNotMatch(handleJoinChannel, /options\.clientRoleType\s*=\s*Constants\.CLIENT_ROLE_BROADCASTER/);
  assert.doesNotMatch(handleJoinChannel, /options\.publishCameraTrack\s*=\s*true/);
  assert.doesNotMatch(handleJoinChannel, /options\.publishMicrophoneTrack\s*=\s*true/);
  assert.doesNotMatch(handleJoinChannel, /options\.autoSubscribeAudio\s*=\s*true/);
  assert.doesNotMatch(handleJoinChannel, /options\.autoSubscribeVideo\s*=\s*true/);

  assert.match(bridgeContent, /private void applyChannelMediaOptions\(ChannelMediaOptions options, JSONObject mediaOptions\)/);
  assert.match(bridgeContent, /options\.clientRoleType = parseClientRoleType\(mediaOptions\.opt\("clientRoleType"\)\)/);
  assert.match(bridgeContent, /options\.channelProfile = parseChannelProfile\(mediaOptions\.opt\("channelProfile"\)\)/);
  assert.match(bridgeContent, /options\.publishCameraTrack = optNullableBoolean\(mediaOptions, "publishCameraTrack"\)/);
  assert.match(bridgeContent, /options\.publishMicrophoneTrack = optNullableBoolean\(mediaOptions, "publishMicrophoneTrack"\)/);
  assert.match(bridgeContent, /options\.autoSubscribeAudio = optNullableBoolean\(mediaOptions, "autoSubscribeAudio"\)/);
  assert.match(bridgeContent, /options\.autoSubscribeVideo = optNullableBoolean\(mediaOptions, "autoSubscribeVideo"\)/);
  assert.match(bridgeContent, /options\.publishSecondaryCameraTrack = optNullableBoolean\(mediaOptions, "publishSecondaryCameraTrack"\)/);
  assert.match(bridgeContent, /options\.publishThirdCameraTrack = optNullableBoolean\(mediaOptions, "publishThirdCameraTrack"\)/);
  assert.match(bridgeContent, /options\.publishFourthCameraTrack = optNullableBoolean\(mediaOptions, "publishFourthCameraTrack"\)/);
  assert.match(bridgeContent, /options\.publishScreenCaptureVideo = optNullableBoolean\(mediaOptions, "publishScreenCaptureVideo"\)/);
  assert.match(bridgeContent, /options\.publishScreenCaptureAudio = optNullableBoolean\(mediaOptions, "publishScreenCaptureAudio"\)/);
  assert.match(bridgeContent, /options\.publishCustomAudioTrack = optNullableBoolean\(mediaOptions, "publishCustomAudioTrack"\)/);
  assert.match(bridgeContent, /options\.publishCustomAudioTrackId = optNullableInteger\(mediaOptions, "publishCustomAudioTrackId"\)/);
  assert.match(bridgeContent, /options\.publishCustomVideoTrack = optNullableBoolean\(mediaOptions, "publishCustomVideoTrack"\)/);
  assert.match(bridgeContent, /options\.publishEncodedVideoTrack = optNullableBoolean\(mediaOptions, "publishEncodedVideoTrack"\)/);
  assert.match(bridgeContent, /options\.publishMediaPlayerAudioTrack = optNullableBoolean\(mediaOptions, "publishMediaPlayerAudioTrack"\)/);
  assert.match(bridgeContent, /options\.publishMediaPlayerVideoTrack = optNullableBoolean\(mediaOptions, "publishMediaPlayerVideoTrack"\)/);
  assert.match(bridgeContent, /options\.publishTranscodedVideoTrack = optNullableBoolean\(mediaOptions, "publishTranscodedVideoTrack"\)/);
  assert.match(bridgeContent, /options\.publishMixedAudioTrack = optNullableBoolean\(mediaOptions, "publishMixedAudioTrack"\)/);
  assert.match(bridgeContent, /options\.publishLipSyncTrack = optNullableBoolean\(mediaOptions, "publishLipSyncTrack"\)/);
  assert.match(bridgeContent, /options\.publishMediaPlayerId = optNullableInteger\(mediaOptions, "publishMediaPlayerId"\)/);
  assert.match(bridgeContent, /options\.audienceLatencyLevel = optNullableInteger\(mediaOptions, "audienceLatencyLevel"\)/);
  assert.match(bridgeContent, /options\.defaultVideoStreamType = optNullableInteger\(mediaOptions, "defaultVideoStreamType"\)/);
  assert.match(bridgeContent, /options\.audioDelayMs = optNullableInteger\(mediaOptions, "audioDelayMs"\)/);
  assert.match(bridgeContent, /options\.mediaPlayerAudioDelayMs = optNullableInteger\(mediaOptions, "mediaPlayerAudioDelayMs"\)/);
  assert.match(bridgeContent, /options\.enableBuiltInMediaEncryption = optNullableBoolean\(mediaOptions, "enableBuiltInMediaEncryption"\)/);
  assert.match(bridgeContent, /options\.publishRhythmPlayerTrack = optNullableBoolean\(mediaOptions, "publishRhythmPlayerTrack"\)/);
  assert.match(bridgeContent, /options\.isInteractiveAudience = optNullableBoolean\(mediaOptions, "isInteractiveAudience"\)/);
  assert.match(bridgeContent, /options\.customVideoTrackId = optNullableInteger\(mediaOptions, "customVideoTrackId"\)/);
  assert.match(bridgeContent, /options\.isAudioFilterable = optNullableBoolean\(mediaOptions, "isAudioFilterable"\)/);
  assert.match(bridgeContent, /options\.enableMultipath = optNullableBoolean\(mediaOptions, "enableMultipath"\)/);
  assert.match(bridgeContent, /options\.uplinkMultipathMode = optNullableInteger\(mediaOptions, "uplinkMultipathMode"\)/);
  assert.match(bridgeContent, /options\.downlinkMultipathMode = optNullableInteger\(mediaOptions, "downlinkMultipathMode"\)/);
  assert.match(bridgeContent, /options\.preferMultipathType = optNullableInteger\(mediaOptions, "preferMultipathType"\)/);
  assert.match(bridgeContent, /options\.token = mediaOptions\.optString\("token"\)/);
  assert.match(bridgeContent, /options\.parameters = mediaOptions\.optString\("parameters"\)/);
});

test('android bridge template wires string uid account APIs to the native sdk', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /case "joinChannelWithUserAccount"/);
  assert.match(bridgeContent, /case "getUserInfoByUserAccount"/);
  assert.match(bridgeContent, /rtcEngine\.joinChannelWithUserAccount/);
  assert.match(bridgeContent, /rtcEngine\.getUserInfoByUserAccount/);
  assert.match(bridgeContent, /User account is required\./);
  assert.match(bridgeContent, /userAccount/);
});

test('android bridge template requests rtc runtime permissions before camera and microphone use', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /RTC_PERMISSION_REQUEST_CODE/);
  assert.match(bridgeContent, /Manifest\.permission\.CAMERA/);
  assert.match(bridgeContent, /Manifest\.permission\.RECORD_AUDIO/);
  assert.match(bridgeContent, /requestPermissions\(/);
  assert.match(bridgeContent, /pendingPermissionActions/);
  assert.match(bridgeContent, /onRequestPermissionsResult/);
  assert.match(bridgeContent, /requiresCamera/);
  assert.match(bridgeContent, /requiresMicrophone/);
  assert.match(bridgeContent, /private boolean requiresCameraPermission\(JSONObject mediaOptions\)/);
  assert.match(bridgeContent, /mediaOptionBoolean\(mediaOptions, "startPreview", false\)/);
  assert.match(bridgeContent, /mediaOptionBoolean\(mediaOptions, "publishSecondaryCameraTrack", false\)/);
  assert.match(bridgeContent, /mediaOptionBoolean\(mediaOptions, "publishThirdCameraTrack", false\)/);
  assert.match(bridgeContent, /mediaOptionBoolean\(mediaOptions, "publishFourthCameraTrack", false\)/);

  const handleJoinChannelMatch = bridgeContent.match(
    /private void handleJoinChannel[\s\S]*?private void handleGetErrorDescription/,
  );
  assert.ok(handleJoinChannelMatch);
  assertPatternBefore(
    handleJoinChannelMatch[0],
    /ensureRtcPermissions\([\s\S]*requestId,[\s\S]*requiresCameraPermission,[\s\S]*requiresMicrophonePermission,[\s\S]*continueJoinChannel/,
    /rtcEngine\.joinChannel/,
    'joinChannel must request camera and microphone permissions before invoking native sdk',
  );

  const handleStartPreviewMatch = bridgeContent.match(
    /private void handleStartPreview[\s\S]*?private void handleStopPreview/,
  );
  assert.ok(handleStartPreviewMatch);
  assertPatternBefore(
    handleStartPreviewMatch[0],
    /ensureRtcPermissions\(\s*requestId,\s*true,\s*false,[\s\S]*continueStartPreview/,
    /renderBackend\.startPreview/,
    'startPreview must request only camera permission before invoking native sdk',
  );
});

test('android bridge template supports default audio route to speakerphone', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const routeMatch = bridgeContent.match(
    /private void handleSetDefaultAudioRouteToSpeakerphone[\s\S]*?private void handleSetEnableSpeakerphone/,
  );
  assert.ok(routeMatch);
  assert.match(routeMatch[0], /rtcEngine\.setDefaultAudioRoutetoSpeakerphone\(params == null \|\| params\.optBoolean\("enabled", true\)\)/);
  assert.doesNotMatch(routeMatch[0], /dispatchUnsupported/);
});

test('android bridge template dispatches expanded native rtc callbacks as js events', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /onLeaveChannel/);
  assert.match(bridgeContent, /dispatchEvent\("leaveChannel"/);
  assert.match(bridgeContent, /toRtcStatsPayload\(stats\)/);
  assert.match(bridgeContent, /"duration", stats != null \? stats\.totalDuration : 0/);
  assert.match(bridgeContent, /"txBytes", stats != null \? stats\.txBytes : 0/);
  assert.match(bridgeContent, /"rxBytes", stats != null \? stats\.rxBytes : 0/);
  assert.match(bridgeContent, /"txKBitRate", stats != null \? stats\.txKBitRate : 0/);
  assert.match(bridgeContent, /"rxKBitRate", stats != null \? stats\.rxKBitRate : 0/);
  assert.match(bridgeContent, /"txAudioBytes", stats != null \? stats\.txAudioBytes : 0/);
  assert.match(bridgeContent, /"rxAudioBytes", stats != null \? stats\.rxAudioBytes : 0/);
  assert.match(bridgeContent, /"txVideoBytes", stats != null \? stats\.txVideoBytes : 0/);
  assert.match(bridgeContent, /"rxVideoBytes", stats != null \? stats\.rxVideoBytes : 0/);
  assert.match(bridgeContent, /"txAudioKBitRate", stats != null \? stats\.txAudioKBitRate : 0/);
  assert.match(bridgeContent, /"rxAudioKBitRate", stats != null \? stats\.rxAudioKBitRate : 0/);
  assert.match(bridgeContent, /"txVideoKBitRate", stats != null \? stats\.txVideoKBitRate : 0/);
  assert.match(bridgeContent, /"rxVideoKBitRate", stats != null \? stats\.rxVideoKBitRate : 0/);
  assert.match(bridgeContent, /"lastmileDelay", stats != null \? stats\.lastmileDelay : 0/);
  assert.match(bridgeContent, /"cpuTotalUsage", stats != null \? stats\.cpuTotalUsage : 0/);
  assert.match(bridgeContent, /"gatewayRtt", stats != null \? stats\.gatewayRtt : 0/);
  assert.match(bridgeContent, /"cpuAppUsage", stats != null \? stats\.cpuAppUsage : 0/);
  assert.match(bridgeContent, /"users", stats != null \? stats\.users : 0/);
  assert.match(bridgeContent, /"connectTimeMs", stats != null \? stats\.connectTimeMs : 0/);
  assert.match(bridgeContent, /"txPacketLossRate", stats != null \? stats\.txPacketLossRate : 0/);
  assert.match(bridgeContent, /"rxPacketLossRate", stats != null \? stats\.rxPacketLossRate : 0/);
  assert.match(bridgeContent, /"memoryAppUsageRatio", stats != null \? stats\.memoryAppUsageRatio : 0/);
  assert.match(bridgeContent, /"memoryTotalUsageRatio", stats != null \? stats\.memoryTotalUsageRatio : 0/);
  assert.match(bridgeContent, /"memoryAppUsageInKbytes", stats != null \? stats\.memoryAppUsageInKbytes : 0/);
  assert.match(bridgeContent, /onRtcStats/);
  assert.match(bridgeContent, /dispatchEvent\("rtcStats"/);
  assert.doesNotMatch(bridgeContent, /onWarning\(int warn\)/);
  assert.doesNotMatch(bridgeContent, /dispatchEvent\("warning"/);
  assert.match(bridgeContent, /onError\(int err\)/);
  assert.match(bridgeContent, /dispatchEvent\("error"/);
  assert.match(bridgeContent, /"code", err/);
  assert.match(bridgeContent, /"message", RtcEngine\.getErrorDescription\(err\)/);
  assert.match(bridgeContent, /"channelId", channel/);
  assert.match(bridgeContent, /"uid", uid/);
  assert.match(bridgeContent, /"elapsed", elapsed/);
  assert.match(bridgeContent, /onRejoinChannelSuccess/);
  assert.match(bridgeContent, /dispatchEvent\("rejoinChannelSuccess"/);
  assert.match(bridgeContent, /onConnectionInterrupted/);
  assert.match(bridgeContent, /dispatchEvent\("connectionInterrupted"/);
  assert.match(bridgeContent, /onConnectionStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("connectionStateChanged"/);
  assert.match(bridgeContent, /"state", state/);
  assert.match(bridgeContent, /"reason", reason/);
  assert.match(bridgeContent, /onRemoteVideoStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("remoteVideoStateChanged"/);
  assert.match(bridgeContent, /"uid", uid,[\s\S]*"state", state,[\s\S]*"reason", reason,[\s\S]*"elapsed", elapsed/);
  assert.match(bridgeContent, /onLocalVideoStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("localVideoStateChanged"/);
  assert.match(bridgeContent, /"sourceType", source != null \? source\.ordinal\(\) : 0/);
  assert.match(bridgeContent, /"error", error/);
  assert.match(bridgeContent, /onAudioMixingFinished/);
  assert.match(bridgeContent, /dispatchEvent\("audioMixingFinished"/);
  assert.match(bridgeContent, /onAudioMixingStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("audioMixingStateChanged"/);
  assert.match(bridgeContent, /onContentInspectResult/);
  assert.match(bridgeContent, /dispatchEvent\("contentInspectResult"/);
  assert.match(bridgeContent, /"result", result/);
  assert.match(bridgeContent, /onAudioVolumeIndication/);
  assert.match(bridgeContent, /dispatchEvent\("volumeIndication"/);
  assert.match(bridgeContent, /"speakers", toAudioVolumeArray\(speakers\)/);
  assert.match(bridgeContent, /"totalVolume", totalVolume/);
  assert.match(bridgeContent, /"volume", speaker\.volume/);
  assert.match(bridgeContent, /"vad", speaker\.vad/);
  assert.match(bridgeContent, /"voicePitch", speaker\.voicePitch/);
});

test('android bridge template maps expanded config objects and reliable results', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  assert.match(bridgeContent, /import io\.agora\.rtc2\.RtcEngineConfig;/);
  assert.match(bridgeContent, /RtcEngine\.create\(config\)/);
  assert.match(bridgeContent, /config\.mAppId = appId/);
  assert.match(bridgeContent, /config\.mAreaCode = params\.optInt\("areaCode", config\.mAreaCode\)/);
  assert.match(bridgeContent, /config\.mChannelProfile = params\.optInt\("channelProfile", config\.mChannelProfile\)/);
  assert.match(bridgeContent, /config\.mLicense = params\.optString\("license", config\.mLicense\)/);
  assert.match(bridgeContent, /config\.mAudioScenario = params\.optInt\("audioScenario", config\.mAudioScenario\)/);
  assert.match(bridgeContent, /config\.mAutoRegisterAgoraExtensions = params\.optBoolean\(/);
  assert.match(bridgeContent, /"autoRegisterAgoraExtensions"/);
  assert.match(bridgeContent, /config\.mDomainLimit = params\.optBoolean\("domainLimit", config\.mDomainLimit\)/);
  assert.match(bridgeContent, /config\.mThreadPriority = params\.optInt\("threadPriority"\)/);
  assert.match(bridgeContent, /config\.mNativeLibPath = params\.optString\("nativeLibPath", config\.mNativeLibPath\)/);
  assert.match(bridgeContent, /logConfig\.filePath = logConfigParams\.optString\("filePath", logConfig\.filePath\)/);
  assert.match(bridgeContent, /logConfig\.fileSizeInKB = logConfigParams\.optInt\("fileSizeInKB", logConfig\.fileSizeInKB\)/);
  assert.match(bridgeContent, /logConfig\.level = logConfigParams\.optInt\("level", logConfig\.level\)/);
  assert.match(bridgeContent, /config\.mLogConfig = logConfig/);
  assert.match(bridgeContent, /config\.addExtension\(extensions\.optString\(index\)\)/);

  const clientRoleMatch = bridgeContent.match(
    /private void handleSetClientRole[\s\S]*?private void handleSetRenderBackend/,
  );
  assert.ok(clientRoleMatch);
  assert.match(clientRoleMatch[0], /ClientRoleOptions options = buildClientRoleOptions/);
  assert.match(bridgeContent, /options\.audienceLatencyLevel = params\.optInt\("audienceLatencyLevel", options\.audienceLatencyLevel\)/);
  assert.match(clientRoleMatch[0], /rtcEngine\.setClientRole\(agoraRole, options\)/);

  const audioMatch = bridgeContent.match(
    /private void handleEnableLocalAudio[\s\S]*?private void handleMuteLocalAudioStream/,
  );
  assert.ok(audioMatch);
  assert.match(audioMatch[0], /RtcEngine is not initialized\./);
  assert.match(audioMatch[0], /int result = rtcEngine\.enableLocalAudio/);
  assert.match(audioMatch[0], /dispatchAgoraError\(requestId, "enableLocalAudio", result\)/);

  const videoMatch = bridgeContent.match(
    /private void handleEnableLocalVideo[\s\S]*?private void handleMuteLocalVideoStream/,
  );
  assert.ok(videoMatch);
  assert.match(videoMatch[0], /RtcEngine is not initialized\./);
  assert.match(videoMatch[0], /int result = rtcEngine\.enableLocalVideo/);
  assert.match(videoMatch[0], /dispatchAgoraError\(requestId, "enableLocalVideo", result\)/);

  const encoderMatch = bridgeContent.match(
    /private void handleSetVideoEncoderConfiguration[\s\S]*?private void handleSetBeautyEffectOptions/,
  );
  assert.ok(encoderMatch);
  assert.match(encoderMatch[0], /configuration\.minFrameRate = params\.optInt\("minFrameRate"/);
  assert.match(encoderMatch[0], /configuration\.minBitrate = params\.optInt\("minBitrate"/);
  assert.match(encoderMatch[0], /params\.has\("mirrorMode"\) && !params\.isNull\("mirrorMode"\)/);
  assert.match(encoderMatch[0], /configuration\.mirrorMode = mapMirrorMode\(params\.optInt\("mirrorMode"\)\)/);
  assert.match(encoderMatch[0], /params\.has\("degradationPreference"\) && !params\.isNull\("degradationPreference"\)/);
  assert.match(encoderMatch[0], /configuration\.degradationPrefer = mapDegradationPreference\(params\.optInt\("degradationPreference"\)\)/);
  assert.doesNotMatch(encoderMatch[0], /params\.optInt\("mirrorMode", 0\)/);
  assert.doesNotMatch(encoderMatch[0], /params\.optInt\("degradationPreference", 0\)/);
  assert.match(encoderMatch[0], /params\.has\("codecType"\) && !params\.isNull\("codecType"\)/);
  assert.match(encoderMatch[0], /configuration\.codecType = mapVideoCodecType\(params\.optInt\("codecType"\)\)/);
  assert.match(encoderMatch[0], /params\.has\("advancedVideoOptions"\) && !params\.isNull\("advancedVideoOptions"\)/);
  assert.match(encoderMatch[0], /configuration\.advanceOptions = buildAdvancedVideoOptions\(params\.optJSONObject\("advancedVideoOptions"\)\)/);
  assert.doesNotMatch(encoderMatch[0], /mapVideoCodecType\(params != null \? params\.optInt\("codecType", 0\) : 0\)/);
  assert.doesNotMatch(encoderMatch[0], /buildAdvancedVideoOptions\(params != null \? params\.optJSONObject\("advancedVideoOptions"\) : null\)/);

  const beautyMatch = bridgeContent.match(
    /private void handleSetBeautyEffectOptions[\s\S]*?private void handleEnableContentInspect/,
  );
  assert.ok(beautyMatch);
  assert.match(beautyMatch[0], /boolean enabled = params != null && params\.optBoolean\("enabled", false\)/);
  assert.match(beautyMatch[0], /options\.optInt\("lighteningContrastLevel", BeautyOptions\.LIGHTENING_CONTRAST_NORMAL\)/);
  assert.match(beautyMatch[0], /options\.optDouble\("lighteningLevel", 0\.0\)/);
  assert.match(beautyMatch[0], /options\.optDouble\("smoothnessLevel", 0\.0\)/);
  assert.match(beautyMatch[0], /options\.optDouble\("rednessLevel", 0\.0\)/);
  assert.match(beautyMatch[0], /options\.optDouble\("sharpnessLevel", 0\.0\)/);

  const inspectMatch = bridgeContent.match(
    /private void handleEnableContentInspect[\s\S]*?private void handleStartAudioMixing/,
  );
  assert.ok(inspectMatch);
  assert.match(inspectMatch[0], /boolean enabled = params != null && params\.optBoolean\("enabled", false\)/);
  assert.match(inspectMatch[0], /inspectConfig\.extraInfo = config\.optString\("extraInfo"/);
  assert.match(inspectMatch[0], /inspectConfig\.serverConfig = config\.optString\("serverConfig"/);
  assert.match(inspectMatch[0], /JSONArray modules = config\.optJSONArray\("modules"\)/);
  assert.match(inspectMatch[0], /module\.type = config != null \? config\.optInt\("module", ContentInspectConfig\.CONTENT_INSPECT_TYPE_MODERATION\)/);
  assert.match(inspectMatch[0], /module\.interval = config != null \? config\.optInt\("interval", 0\)/);
  assert.match(inspectMatch[0], /inspectConfig\.moduleCount = inspectConfig\.modules\.length/);
  assert.match(bridgeContent, /module\.type = params != null \? params\.optInt\("type", ContentInspectConfig\.CONTENT_INSPECT_TYPE_MODERATION\)/);
  assert.match(bridgeContent, /module\.interval = params != null \? params\.optInt\("interval", 0\)/);
  assert.match(bridgeContent, /module\.position = mapContentInspectModulePosition\(params != null \? params\.optInt\("position"/);
  assert.match(bridgeContent, /private Constants\.VideoModulePosition mapContentInspectModulePosition\(int value\)/);

  const mixingMatch = bridgeContent.match(
    /private void handleStartAudioMixing[\s\S]*?private void handlePauseAudioMixing/,
  );
  assert.ok(mixingMatch);
  assert.match(mixingMatch[0], /String path = params != null \? params\.optString\("path", ""\) : ""/);
  assert.match(mixingMatch[0], /boolean loopback = params != null && params\.optBoolean\("loopback", false\)/);
  assert.match(mixingMatch[0], /int cycle = params != null \? params\.optInt\("cycle", 1\) : 1/);
  assert.match(mixingMatch[0], /int startPos = params != null \? params\.optInt\("startPos", 0\) : 0/);
  assert.match(mixingMatch[0], /rtcEngine\.startAudioMixing\(path, loopback, cycle, startPos\)/);

  const playEffectMatch = bridgeContent.match(
    /private void handlePlayEffect[\s\S]*?private void handlePauseEffect/,
  );
  assert.ok(playEffectMatch);
  assert.match(playEffectMatch[0], /int soundId = params != null \? params\.optInt\("soundId", 0\) : 0/);
  assert.match(playEffectMatch[0], /String path = params != null \? params\.optString\("path", ""\) : ""/);
  assert.match(playEffectMatch[0], /int loopCount = params != null \? params\.optInt\("loopCount", 1\) : 1/);
  assert.match(playEffectMatch[0], /double pitch = params != null \? params\.optDouble\("pitch", 1\.0\) : 1\.0/);
  assert.match(playEffectMatch[0], /double pan = params != null \? params\.optDouble\("pan", 0\.0\) : 0\.0/);
  assert.match(playEffectMatch[0], /double gain = params != null \? params\.optDouble\("gain", 100\.0\) : 100\.0/);
  assert.match(playEffectMatch[0], /boolean publish = params != null && params\.optBoolean\("publish", false\)/);
  assert.match(playEffectMatch[0], /int startPos = params != null \? params\.optInt\("startPos", 0\) : 0/);
  assert.match(playEffectMatch[0], /effectManager\.playEffect\(soundId, path, loopCount, pitch, pan, gain, publish, startPos\)/);

  const setPositionMatch = bridgeContent.match(
    /private void handleSetAudioMixingPosition[\s\S]*?private void handleAdjustAudioMixingVolume/,
  );
  assert.ok(setPositionMatch);
  assert.match(setPositionMatch[0], /rtcEngine\.setAudioMixingPosition\(params != null \? params\.optInt\("positionMs", 0\) : 0\)/);

  const adjustVolumeMatch = bridgeContent.match(
    /private void handleAdjustAudioMixingVolume[\s\S]*?private void handleAdjustAudioMixingPublishVolume/,
  );
  assert.ok(adjustVolumeMatch);
  assert.match(adjustVolumeMatch[0], /rtcEngine\.adjustAudioMixingVolume\(params != null \? params\.optInt\("volume", 100\) : 100\)/);

  const adjustPublishVolumeMatch = bridgeContent.match(
    /private void handleAdjustAudioMixingPublishVolume[\s\S]*?private void handleAdjustAudioMixingPlayoutVolume/,
  );
  assert.ok(adjustPublishVolumeMatch);
  assert.match(adjustPublishVolumeMatch[0], /rtcEngine\.adjustAudioMixingPublishVolume\(params != null \? params\.optInt\("volume", 100\) : 100\)/);

  const adjustPlayoutVolumeMatch = bridgeContent.match(
    /private void handleAdjustAudioMixingPlayoutVolume[\s\S]*?private void handlePreloadEffect/,
  );
  assert.ok(adjustPlayoutVolumeMatch);
  assert.match(adjustPlayoutVolumeMatch[0], /rtcEngine\.adjustAudioMixingPlayoutVolume\(params != null \? params\.optInt\("volume", 100\) : 100\)/);

  const preloadEffectMatch = bridgeContent.match(
    /private void handlePreloadEffect[\s\S]*?private void handlePlayEffect/,
  );
  assert.ok(preloadEffectMatch);
  assert.match(preloadEffectMatch[0], /int soundId = params != null \? params\.optInt\("soundId", 0\) : 0/);
  assert.match(preloadEffectMatch[0], /String path = params != null \? params\.optString\("path", ""\) : ""/);
  assert.match(preloadEffectMatch[0], /effectManager\.preloadEffect\(soundId, path\)/);

  const setEffectsVolumeMatch = bridgeContent.match(
    /private void handleSetEffectsVolume[\s\S]*?private void handleStopEffect/,
  );
  assert.ok(setEffectsVolumeMatch);
  assert.match(setEffectsVolumeMatch[0], /double volume = params != null \? params\.optDouble\("volume", 100\.0\) : 100\.0/);
  assert.match(setEffectsVolumeMatch[0], /effectManager\.setEffectsVolume\(volume\)/);

  for (const [handler, nativeCall] of [
    ['handlePauseEffect', 'pauseEffect'],
    ['handleResumeEffect', 'resumeEffect'],
    ['handleStopEffect', 'stopEffect'],
  ]) {
    const effectMatch = bridgeContent.match(new RegExp(`private void ${handler}[\\s\\S]*?private void`));
    assert.ok(effectMatch, `${handler} should exist`);
    assert.match(effectMatch[0], /params != null \? params\.optInt\("soundId", 0\) : 0/);
    assert.match(effectMatch[0], new RegExp(`effectManager\\.${nativeCall}\\(`));
  }
});

test('android bridge template maps video encoder enum raw values from rtc 4.5.3', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const degradationMatch = bridgeContent.match(
    /private VideoEncoderConfiguration\.DEGRADATION_PREFERENCE mapDegradationPreference[\s\S]*?private VideoEncoderConfiguration\.VIDEO_CODEC_TYPE mapVideoCodecType/,
  );
  assert.ok(degradationMatch);
  assert.match(degradationMatch[0], /case -1:[\s\S]*MAINTAIN_AUTO/);
  assert.match(degradationMatch[0], /case 0:[\s\S]*MAINTAIN_QUALITY/);
  assert.match(degradationMatch[0], /case 1:[\s\S]*MAINTAIN_FRAMERATE/);
  assert.match(degradationMatch[0], /case 2:[\s\S]*MAINTAIN_BALANCED/);
  assert.match(degradationMatch[0], /case 3:[\s\S]*MAINTAIN_RESOLUTION/);
  assert.match(degradationMatch[0], /case 100:[\s\S]*DISABLED/);
  assert.doesNotMatch(degradationMatch[0], /case 4:[\s\S]*MAINTAIN_RESOLUTION/);
  assert.doesNotMatch(degradationMatch[0], /case 5:[\s\S]*DISABLED/);

  const codecMatch = bridgeContent.match(
    /private VideoEncoderConfiguration\.VIDEO_CODEC_TYPE mapVideoCodecType[\s\S]*?private VideoEncoderConfiguration\.AdvanceOptions buildAdvancedVideoOptions/,
  );
  assert.ok(codecMatch);
  assert.match(codecMatch[0], /case 0:[\s\S]*VIDEO_CODEC_NONE/);
  assert.match(codecMatch[0], /case 1:[\s\S]*VIDEO_CODEC_VP8/);
  assert.match(codecMatch[0], /case 2:[\s\S]*VIDEO_CODEC_H264/);
  assert.match(codecMatch[0], /case 3:[\s\S]*VIDEO_CODEC_H265/);
  assert.match(codecMatch[0], /case 6:[\s\S]*VIDEO_CODEC_GENERIC/);
  assert.match(codecMatch[0], /case 12:[\s\S]*VIDEO_CODEC_AV1/);
  assert.match(codecMatch[0], /case 13:[\s\S]*VIDEO_CODEC_VP9/);
  assert.match(codecMatch[0], /case 20:[\s\S]*VIDEO_CODEC_GENERIC_JPEG/);
  assert.doesNotMatch(codecMatch[0], /case 5:[\s\S]*VIDEO_CODEC_AV1/);

  const advancedOptionsMatch = bridgeContent.match(
    /private VideoEncoderConfiguration\.AdvanceOptions buildAdvancedVideoOptions[\s\S]*?private VideoEncoderConfiguration\.ENCODING_PREFERENCE mapEncodingPreference/,
  );
  assert.ok(advancedOptionsMatch);
  assert.match(advancedOptionsMatch[0], /params\.optInt\("encodingPreference", -1\)/);
  assert.match(advancedOptionsMatch[0], /params\.optInt\("compressionPreference", -1\)/);
  assert.match(advancedOptionsMatch[0], /options\.encodeAlpha = params\.optBoolean\("encodeAlpha", options\.encodeAlpha\)/);

  const encodingMatch = bridgeContent.match(
    /private VideoEncoderConfiguration\.ENCODING_PREFERENCE mapEncodingPreference[\s\S]*?private VideoEncoderConfiguration\.COMPRESSION_PREFERENCE mapCompressionPreference/,
  );
  assert.ok(encodingMatch);
  assert.match(encodingMatch[0], /case -1:[\s\S]*PREFER_AUTO/);
  assert.match(encodingMatch[0], /case 0:[\s\S]*PREFER_SOFTWARE/);
  assert.match(encodingMatch[0], /case 1:[\s\S]*PREFER_HARDWARE/);
  assert.doesNotMatch(encodingMatch[0], /case 2:[\s\S]*PREFER_HARDWARE/);

  const compressionMatch = bridgeContent.match(
    /private VideoEncoderConfiguration\.COMPRESSION_PREFERENCE mapCompressionPreference[\s\S]*?private ContentInspectConfig\.ContentInspectModule buildContentInspectModule/,
  );
  assert.ok(compressionMatch);
  assert.match(compressionMatch[0], /case -1:[\s\S]*PREFER_COMPRESSION_AUTO/);
  assert.match(compressionMatch[0], /case 0:[\s\S]*PREFER_LOW_LATENCY/);
  assert.match(compressionMatch[0], /case 1:[\s\S]*PREFER_QUALITY/);
  assert.doesNotMatch(compressionMatch[0], /case 2:[\s\S]*PREFER_QUALITY/);
});

test('ios bridge template dispatches expanded sdk methods or explicit unsupported responses', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /case "getSdkVersion"/);
  assert.match(bridgeContent, /case "getErrorDescription"/);
  assert.match(bridgeContent, /"setChannelProfile"/);
  assert.match(bridgeContent, /"isSpeakerphoneEnabled"/);
  assert.match(bridgeContent, /"startAudioMixing"/);
  assert.match(bridgeContent, /"playEffect"/);
  assert.match(bridgeContent, /case "pauseEffect"/);
  assert.match(bridgeContent, /case "resumeEffect"/);
  assert.match(bridgeContent, /case "setEffectsVolume"/);
  assert.match(bridgeContent, /case "adjustAudioMixingPublishVolume"/);
  assert.match(bridgeContent, /case "adjustAudioMixingPlayoutVolume"/);
  assert.match(bridgeContent, /Unsupported on current platform/);
});

test('ios bridge template wires minimum real rtc engine methods and delegate callbacks', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /AgoraRtcEngineKit/);
  assert.match(bridgeContent, /sharedEngine/);
  assert.match(bridgeContent, /setChannelProfile/);
  assert.match(bridgeContent, /setClientRole/);
  assert.match(bridgeContent, /joinChannel\(/);
  assert.match(bridgeContent, /leaveChannel/);
  assert.match(bridgeContent, /renewToken/);
  assert.match(bridgeContent, /enableAudio/);
  assert.match(bridgeContent, /enableLocalAudio/);
  assert.match(bridgeContent, /enableAudioVolumeIndication/);
  assert.match(bridgeContent, /adjustPlaybackSignalVolume/);
  assert.match(bridgeContent, /adjustUserPlaybackSignalVolume/);
  assert.match(bridgeContent, /muteLocalAudioStream/);
  assert.match(bridgeContent, /muteRemoteAudioStream/);
  assert.match(bridgeContent, /muteAllRemoteAudioStreams/);
  assert.match(bridgeContent, /enableVideo/);
  assert.match(bridgeContent, /enableLocalVideo/);
  assert.match(bridgeContent, /muteLocalVideoStream/);
  assert.match(bridgeContent, /muteRemoteVideoStream/);
  assert.match(bridgeContent, /muteAllRemoteVideoStreams/);
  assert.match(bridgeContent, /setEnableSpeakerphone/);
  assert.match(bridgeContent, /isSpeakerphoneEnabled/);
  assert.match(bridgeContent, /setAudioProfile/);
  assert.match(bridgeContent, /startPreview/);
  assert.match(bridgeContent, /stopPreview/);
  assert.match(bridgeContent, /switchCamera/);
  assert.match(bridgeContent, /didJoinChannel/);
  assert.match(bridgeContent, /didRejoinChannel/);
  assert.match(bridgeContent, /didLeaveChannelWith/);
  assert.match(bridgeContent, /reportRtcStats/);
  assert.match(bridgeContent, /didJoinedOfUid/);
  assert.match(bridgeContent, /firstRemoteVideoDecodedOfUid/);
  assert.match(bridgeContent, /firstRemoteVideoFrameOfUid/);
  assert.match(bridgeContent, /remoteVideoStateChangedOfUid/);
  assert.match(bridgeContent, /didOfflineOfUid/);
  assert.match(bridgeContent, /connectionChangedTo/);
  assert.match(bridgeContent, /didOccurError/);
  assert.match(bridgeContent, /reportAudioVolumeIndicationOfSpeakers/);
  assert.match(bridgeContent, /audioMixingStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\(name: "audioMixingStateChanged"/);
  assert.match(bridgeContent, /reasonCode == \.allLoopsCompleted/);
  assert.match(bridgeContent, /dispatchEvent\(name: "audioMixingFinished"/);
  assert.match(bridgeContent, /engine\.pauseEffect/);
  assert.match(bridgeContent, /engine\.resumeEffect/);
  assert.match(bridgeContent, /engine\.setEffectsVolume/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingPublishVolume/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingPlayoutVolume/);
  assert.match(bridgeContent, /remoteAudioStateChangedOfUid/);
  assert.match(bridgeContent, /dispatchEvent\(name: "remoteAudioStateChanged"/);
});

test('ios bridge template resolves joinChannel after the sdk accepts the request', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private func handleJoinChannel[\s\S]*?private func requireEngine/,
  );
  assert.ok(handleJoinChannelMatch);
  assert.match(
    handleJoinChannelMatch[0],
    /dispatchResult\(requestId: requestId, method: "joinChannel", result: result\)/,
  );
  assert.doesNotMatch(handleJoinChannelMatch[0], /pendingJoinRequestId\s*=\s*requestId/);

  const didJoinChannelMatch = bridgeContent.match(
    /func rtcEngine\(_ engine: AgoraRtcEngineKit, didJoinChannel[\s\S]*?func rtcEngine\(_ engine: AgoraRtcEngineKit, didRejoinChannel/,
  );
  assert.ok(didJoinChannelMatch);
  assert.match(didJoinChannelMatch[0], /dispatchEvent\(name: "joinChannelSuccess"/);
  assert.doesNotMatch(didJoinChannelMatch[0], /pendingJoinRequestId/);
});

test('ios bridge template maps joinChannel media options from request payload', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private func handleJoinChannel\(requestId: String, params: \[String: Any\]\)[\s\S]*?private func requireEngine/,
  );
  assert.ok(handleJoinChannelMatch);
  const handleJoinChannel = handleJoinChannelMatch[0];

  assert.match(handleJoinChannel, /if let mediaOptionParams = params\["options"\] as\? \[String: Any\]/);
  assert.match(handleJoinChannel, /let mediaOptions = buildChannelMediaOptions\(mediaOptionParams\)/);
  assert.match(handleJoinChannel, /let requiresCameraPermission = requiresCameraPermission\(mediaOptionParams\)/);
  assert.match(handleJoinChannel, /let requiresMicrophonePermission = requiresMicrophonePermission\(mediaOptionParams\)/);
  assert.match(handleJoinChannel, /uid: uid,\s*mediaOptions: mediaOptions,\s*joinSuccess: nil/);
  assert.match(
    handleJoinChannel,
    /else\s*\{[\s\S]*?engine\.joinChannel\(\s*byToken: token,\s*channelId: channelId,\s*info: nil,\s*uid: uid,\s*joinSuccess: nil\s*\)/,
  );

  assert.match(bridgeContent, /private func buildChannelMediaOptions\(_ params: \[String: Any\]\?\) -> AgoraRtcChannelMediaOptions/);
  assert.match(bridgeContent, /options\.clientRoleType = parseClientRoleType\(rawValue\)/);
  assert.match(bridgeContent, /options\.channelProfile = parseChannelProfile\(rawValue\)/);
  assert.match(bridgeContent, /options\.publishCameraTrack = value/);
  assert.match(bridgeContent, /options\.publishMicrophoneTrack = value/);
  assert.match(bridgeContent, /options\.autoSubscribeAudio = value/);
  assert.match(bridgeContent, /options\.autoSubscribeVideo = value/);
  assert.match(bridgeContent, /options\.publishScreenCaptureVideo = value/);
  assert.match(bridgeContent, /options\.publishScreenCaptureAudio = value/);
  assert.match(bridgeContent, /options\.publishCustomAudioTrack = value/);
  assert.match(bridgeContent, /options\.publishCustomAudioTrackId = value/);
  assert.match(bridgeContent, /options\.publishCustomVideoTrack = value/);
  assert.match(bridgeContent, /options\.publishEncodedVideoTrack = value/);
  assert.match(bridgeContent, /options\.publishMediaPlayerAudioTrack = value/);
  assert.match(bridgeContent, /options\.publishMediaPlayerVideoTrack = value/);
  assert.match(bridgeContent, /options\.publishTranscodedVideoTrack = value/);
  assert.match(bridgeContent, /options\.publishMixedAudioTrack = value/);
  assert.match(bridgeContent, /options\.publishLipSyncTrack = value/);
  assert.match(bridgeContent, /options\.publishMediaPlayerId = value/);
  assert.match(bridgeContent, /options\.audienceLatencyLevel = parseAudienceLatencyLevel/);
  assert.match(bridgeContent, /options\.defaultVideoStreamType = parseVideoStreamType/);
  assert.match(bridgeContent, /options\.audioDelayMs = value/);
  assert.match(bridgeContent, /options\.mediaPlayerAudioDelayMs = value/);
  assert.match(bridgeContent, /options\.token = value/);
  assert.match(bridgeContent, /options\.enableBuiltInMediaEncryption = value/);
  assert.match(bridgeContent, /options\.publishRhythmPlayerTrack = value/);
  assert.match(bridgeContent, /options\.isInteractiveAudience = value/);
  assert.match(bridgeContent, /options\.customVideoTrackId = value/);
  assert.match(bridgeContent, /options\.isAudioFilterable = value/);
  assert.match(bridgeContent, /if let value = params\["startPreview"\] as\? Bool/);
  assert.match(bridgeContent, /options\.parameters = value/);
  assert.doesNotMatch(bridgeContent, /options\.publishThirdCameraTrack/);
  assert.doesNotMatch(bridgeContent, /options\.publishFourthCameraTrack/);
  assert.doesNotMatch(bridgeContent, /options\.enableMultipath/);
  assert.doesNotMatch(bridgeContent, /options\.uplinkMultipathMode/);
  assert.doesNotMatch(bridgeContent, /options\.downlinkMultipathMode/);
  assert.doesNotMatch(bridgeContent, /options\.preferMultipathType/);
  assert.match(handleJoinChannel, /if mediaOptionBool\(mediaOptionParams, key: "startPreview", defaultValue: false\)[\s\S]*engine\.startPreview\(\)/);
});

test('ios bridge template maps expanded configs and callbacks', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /AgoraRtcEngineConfig\(\)/);
  assert.match(bridgeContent, /sharedEngine\(with: config, delegate: self\)/);
  assert.match(bridgeContent, /config\.appId = appId/);
  assert.match(bridgeContent, /config\.channelProfile = channelProfile/);
  assert.match(bridgeContent, /config\.license = license/);
  assert.match(bridgeContent, /config\.audioScenario = audioScenario/);
  assert.match(bridgeContent, /config\.areaCode = AgoraAreaCodeType\(rawValue:/);
  assert.match(bridgeContent, /config\.threadPriority = threadPriority/);
  assert.match(bridgeContent, /config\.domainLimit = domainLimit/);
  assert.match(bridgeContent, /config\.autoRegisterAgoraExtensions = autoRegisterAgoraExtensions/);
  assert.match(bridgeContent, /logConfig\.filePath = logConfigParams\["filePath"\] as\? String/);
  assert.match(bridgeContent, /logConfig\.fileSizeInKB = logConfigParams\["fileSizeInKB"\] as\? Int \?\? logConfig\.fileSizeInKB/);
  assert.match(bridgeContent, /logConfig\.level = level/);
  assert.match(bridgeContent, /config\.logConfig = logConfig/);
  assert.doesNotMatch(bridgeContent, /config\.nativeLibPath/);
  assert.doesNotMatch(bridgeContent, /config\.extensions/);

  const clientRoleMatch = bridgeContent.match(
    /case "setClientRole":[\s\S]*?case "joinChannel":/,
  );
  assert.ok(clientRoleMatch);
  assert.match(clientRoleMatch[0], /let options = buildClientRoleOptions/);
  assert.match(bridgeContent, /options\.audienceLatencyLevel = parseAudienceLatencyLevel\(rawValue\)/);
  assert.match(clientRoleMatch[0], /engine\.setClientRole\(agoraRole, options: options\)/);

  const audioProfileMatch = bridgeContent.match(
    /case "setAudioProfile":[\s\S]*?case "adjustPlaybackSignalVolume":/,
  );
  assert.ok(audioProfileMatch);
  assert.match(audioProfileMatch[0], /let scenario = AgoraAudioScenario\(rawValue: scenarioValue\)/);
  assert.match(audioProfileMatch[0], /engine\.setAudioProfile\(profile, scenario: scenario\)/);

  const encoderMatch = bridgeContent.match(
    /case "setVideoEncoderConfiguration":[\s\S]*?case "setBeautyEffectOptions":/,
  );
  assert.ok(encoderMatch);
  assert.match(encoderMatch[0], /mirrorModeValue/);
  assert.doesNotMatch(encoderMatch[0], /minFrameRate/);
  assert.match(encoderMatch[0], /let config = AgoraVideoEncoderConfiguration\(\)/);
  assert.match(encoderMatch[0], /config\.dimensions = CGSize\(width: CGFloat\(width\), height: CGFloat\(height\)\)/);
  assert.match(encoderMatch[0], /config\.frameRate = frameRate\.rawValue/);
  assert.doesNotMatch(encoderMatch[0], /config\.frameRate = frameRate\n/);
  assert.match(encoderMatch[0], /config\.bitrate = bitrate/);
  assert.match(encoderMatch[0], /config\.orientationMode = orientationMode/);
  assert.match(encoderMatch[0], /config\.mirrorMode = mirrorMode/);
  assert.doesNotMatch(encoderMatch[0], /AgoraVideoEncoderConfiguration\(\s*width:/);
  assert.match(encoderMatch[0], /config\.minBitrate = params\["minBitrate"\]/);
  assert.match(encoderMatch[0], /if let degradationPreferenceRawValue = params\["degradationPreference"\]/);
  assert.match(encoderMatch[0], /config\.degradationPreference = degradationPreference/);
  assert.match(encoderMatch[0], /if let codecTypeRawValue = params\["codecType"\]/);
  assert.match(encoderMatch[0], /config\.codecType = codecType/);
  assert.doesNotMatch(encoderMatch[0], /params\["degradationPreference"\] as\? Int \?\? 0/);
  assert.doesNotMatch(encoderMatch[0], /params\["codecType"\] as\? Int \?\? 0/);
  assert.match(encoderMatch[0], /if let advancedVideoOptionsParams = params\["advancedVideoOptions"\] as\? \[String: Any\]/);
  assert.match(encoderMatch[0], /config\.advancedVideoOptions = buildAdvancedVideoOptions\(advancedVideoOptionsParams\)/);
  assert.doesNotMatch(encoderMatch[0], /let advancedVideoOptions = buildAdvancedVideoOptions\(params\["advancedVideoOptions"\] as\? \[String: Any\]\)[\s\S]*config\.advancedVideoOptions = advancedVideoOptions/);

  const advancedOptionsMatch = bridgeContent.match(
    /private func buildAdvancedVideoOptions[\s\S]*?private func buildContentInspectModules/,
  );
  assert.ok(advancedOptionsMatch);
  assert.match(advancedOptionsMatch[0], /params\?\["encodingPreference"\] \?\? -1/);
  assert.match(advancedOptionsMatch[0], /params\?\["compressionPreference"\] \?\? -1/);
  assert.match(advancedOptionsMatch[0], /options\.encodeAlpha = params\?\["encodeAlpha"\] as\? Bool \?\? false/);

  const beautyMatch = bridgeContent.match(
    /case "setBeautyEffectOptions":[\s\S]*?case "setLogFilter":/,
  );
  assert.ok(beautyMatch);
  assert.match(beautyMatch[0], /let enabled = params\["enabled"\] as\? Bool \?\? false/);
  assert.match(beautyMatch[0], /optionsObject\["lighteningContrastLevel"\] as\? Int/);
  assert.match(beautyMatch[0], /options\.lighteningContrastLevel = contrast/);
  assert.match(beautyMatch[0], /options\.lighteningLevel = Float\(optionsObject\["lighteningLevel"\] as\? Double \?\? 0\.0\)/);
  assert.match(beautyMatch[0], /options\.smoothnessLevel = Float\(optionsObject\["smoothnessLevel"\] as\? Double \?\? 0\.0\)/);
  assert.match(beautyMatch[0], /options\.rednessLevel = Float\(optionsObject\["rednessLevel"\] as\? Double \?\? 0\.0\)/);
  assert.match(beautyMatch[0], /options\.sharpnessLevel = Float\(optionsObject\["sharpnessLevel"\] as\? Double \?\? 0\.0\)/);

  const inspectMatch = bridgeContent.match(
    /case "enableContentInspect":[\s\S]*?case "setNativeVideoOverlaySuspended":/,
  );
  assert.ok(inspectMatch);
  assert.match(inspectMatch[0], /let enabled = params\["enabled"\] as\? Bool \?\? false/);
  assert.match(inspectMatch[0], /config\.extraInfo = extraInfo/);
  assert.match(inspectMatch[0], /config\.serverConfig = serverConfig/);
  assert.match(inspectMatch[0], /config\.modules = buildContentInspectModules/);
  assert.match(bridgeContent, /module\.position = parseContentInspectModulePosition/);
  assert.match(bridgeContent, /private func parseContentInspectModulePosition/);

  const inspectModuleMatch = bridgeContent.match(
    /private func buildContentInspectModules[\s\S]*?private func intValue/,
  );
  assert.ok(inspectModuleMatch);
  assert.match(inspectModuleMatch[0], /"type": params\["module"\] \?\? 1/);
  assert.match(inspectModuleMatch[0], /"interval": params\["interval"\] \?\? 0/);
  assert.match(inspectModuleMatch[0], /module\.type = AgoraContentInspectType\(rawValue: typeValue\)/);
  assert.match(inspectModuleMatch[0], /module\.interval = intValue\(params\["interval"\] \?\? 0\)/);

  assert.doesNotMatch(bridgeContent, /didOccurWarning warningCode/);
  assert.doesNotMatch(bridgeContent, /dispatchEvent\(name: "warning"/);
  assert.match(bridgeContent, /firstLocalAudioFramePublished elapsed/);
  assert.match(bridgeContent, /dispatchEvent\(name: "firstLocalAudioFramePublished"/);
  assert.match(bridgeContent, /"elapsed": elapsed/);
  assert.match(bridgeContent, /contentInspectResult result/);
  assert.match(bridgeContent, /dispatchEvent\(name: "contentInspectResult"/);
  assert.match(bridgeContent, /"result": result\.rawValue/);
  assert.match(bridgeContent, /localVideoStateChangedOf state/);
  assert.match(bridgeContent, /dispatchEvent\(name: "localVideoStateChanged"/);
  assert.match(bridgeContent, /"sourceType": sourceType\.rawValue/);
  assert.match(bridgeContent, /"state": state\.rawValue/);
  assert.match(bridgeContent, /"error": reason\.rawValue/);
  assert.match(bridgeContent, /dispatchEvent\(name: "joinChannelSuccess"/);
  assert.match(bridgeContent, /"channelId": channel/);
  assert.match(bridgeContent, /"uid": uid/);
  assert.match(bridgeContent, /dispatchEvent\(name: "rejoinChannelSuccess"/);
  assert.match(bridgeContent, /dispatchEvent\(name: "userOffline"/);
  assert.match(bridgeContent, /"reason": reason\.rawValue/);
  assert.match(bridgeContent, /dispatchEvent\(name: "connectionStateChanged"/);
  assert.match(bridgeContent, /"state": state\.rawValue/);
  assert.match(bridgeContent, /dispatchEvent\(name: "remoteVideoStateChanged"/);
  assert.match(bridgeContent, /dispatchEvent\(name: "remoteAudioStateChanged"/);
  assert.match(bridgeContent, /dispatchEvent\(name: "audioMixingStateChanged"/);
  assert.match(bridgeContent, /"speakers": speakers\.map/);
  assert.match(bridgeContent, /"volume": speaker\.volume/);
  assert.match(bridgeContent, /"vad": speaker\.vad/);
  assert.match(bridgeContent, /"voicePitch": speaker\.voicePitch/);
  assert.match(bridgeContent, /"totalVolume": totalVolume/);
  assert.match(bridgeContent, /private func channelStatsPayload/);
  assert.match(bridgeContent, /"duration": stats\.duration/);
  assert.match(bridgeContent, /"txBytes": stats\.txBytes/);
  assert.match(bridgeContent, /"rxBytes": stats\.rxBytes/);
  assert.match(bridgeContent, /"txKBitRate": stats\.txKBitrate/);
  assert.match(bridgeContent, /"rxKBitRate": stats\.rxKBitrate/);
  assert.match(bridgeContent, /"txAudioKBitRate": stats\.txAudioKBitrate/);
  assert.match(bridgeContent, /"rxAudioKBitRate": stats\.rxAudioKBitrate/);
  assert.match(bridgeContent, /"txVideoKBitRate": stats\.txVideoKBitrate/);
  assert.match(bridgeContent, /"rxVideoKBitRate": stats\.rxVideoKBitrate/);
  assert.match(bridgeContent, /"txAudioBytes": stats\.txAudioBytes/);
  assert.match(bridgeContent, /"txVideoBytes": stats\.txVideoBytes/);
  assert.match(bridgeContent, /"rxAudioBytes": stats\.rxAudioBytes/);
  assert.match(bridgeContent, /"rxVideoBytes": stats\.rxVideoBytes/);
  assert.match(bridgeContent, /"lastmileDelay": stats\.lastmileDelay/);
  assert.match(bridgeContent, /"users": stats\.userCount/);
  assert.match(bridgeContent, /"cpuAppUsage": stats\.cpuAppUsage/);
  assert.match(bridgeContent, /"cpuTotalUsage": stats\.cpuTotalUsage/);
  assert.match(bridgeContent, /"gatewayRtt": stats\.gatewayRtt/);
  assert.match(bridgeContent, /"memoryAppUsageRatio": stats\.memoryAppUsageRatio/);
  assert.match(bridgeContent, /"memoryTotalUsageRatio": stats\.memoryTotalUsageRatio/);
  assert.match(bridgeContent, /"memoryAppUsageInKbytes": stats\.memoryAppUsageInKbytes/);
  assert.match(bridgeContent, /"connectTimeMs": stats\.connectTimeMs/);
  assert.match(bridgeContent, /"txPacketLossRate": stats\.txPacketLossRate/);
  assert.match(bridgeContent, /"rxPacketLossRate": stats\.rxPacketLossRate/);
  assert.doesNotMatch(bridgeContent, /"txKBitrate"/);
  assert.doesNotMatch(bridgeContent, /"rxKBitrate"/);
  assert.doesNotMatch(bridgeContent, /"txAudioKBitrate"/);
  assert.doesNotMatch(bridgeContent, /"rxAudioKBitrate"/);
  assert.doesNotMatch(bridgeContent, /"txVideoKBitrate"/);
  assert.doesNotMatch(bridgeContent, /"rxVideoKBitrate"/);

  const playEffectMatch = bridgeContent.match(
    /case "playEffect":[\s\S]*?case "stopEffect":/,
  );
  assert.ok(playEffectMatch);
  assert.match(playEffectMatch[0], /let soundId = Int32\(params\["soundId"\] as\? Int \?\? 0\)/);
  assert.match(playEffectMatch[0], /let path = params\["path"\] as\? String \?\? ""/);
  assert.match(playEffectMatch[0], /let loopCount = params\["loopCount"\] as\? Int \?\? 1/);
  assert.match(playEffectMatch[0], /let pitch = params\["pitch"\] as\? Double \?\? 1\.0/);
  assert.match(playEffectMatch[0], /let pan = params\["pan"\] as\? Double \?\? 0\.0/);
  assert.match(playEffectMatch[0], /let gain = params\["gain"\] as\? Double \?\? 100\.0/);
  assert.match(playEffectMatch[0], /let publish = params\["publish"\] as\? Bool \?\? false/);
  assert.match(playEffectMatch[0], /let startPos = params\["startPos"\] as\? Int \?\? 0/);
  assert.match(playEffectMatch[0], /engine\.playEffect\(soundId, filePath: path, loopCount: loopCount, pitch: pitch, pan: pan, gain: Int\(gain\), publish: publish, startPos: Int32\(startPos\)\)/);

  const startMixingMatch = bridgeContent.match(
    /case "startAudioMixing":[\s\S]*?case "pauseAudioMixing":/,
  );
  assert.ok(startMixingMatch);
  assert.match(startMixingMatch[0], /key: "path"/);
  assert.match(startMixingMatch[0], /let loopback = params\["loopback"\] as\? Bool \?\? false/);
  assert.match(startMixingMatch[0], /let cycle = params\["cycle"\] as\? Int \?\? 1/);
  assert.match(startMixingMatch[0], /let startPos = params\["startPos"\] as\? Int \?\? 0/);
  assert.match(startMixingMatch[0], /engine\.startAudioMixing\(path, loopback: loopback, cycle: cycle, startPos: startPos\)/);

  assert.match(bridgeContent, /let position = params\["positionMs"\] as\? Int \?\? 0/);
  assert.match(bridgeContent, /engine\.setAudioMixingPosition\(position\)/);
  assert.match(bridgeContent, /let volume = params\["volume"\] as\? Int \?\? 100/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingVolume\(volume\)/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingPublishVolume\(volume\)/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingPlayoutVolume\(volume\)/);
  assert.match(bridgeContent, /engine\.preloadEffect\(soundId, filePath: path\)/);
  assert.match(bridgeContent, /engine\.pauseEffect\(soundId\)/);
  assert.match(bridgeContent, /engine\.resumeEffect\(soundId\)/);
  assert.match(bridgeContent, /engine\.setEffectsVolume\(volume\)/);
  assert.match(bridgeContent, /engine\.stopEffect\(soundId\)/);
});

test('ios bridge template wires string uid account APIs to the native sdk', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /case "joinChannelWithUserAccount"/);
  assert.match(bridgeContent, /case "getUserInfoByUserAccount"/);
  assert.match(bridgeContent, /engine\.joinChannel\(byToken: token,/);
  assert.match(bridgeContent, /channelId: channelId,/);
  assert.match(bridgeContent, /userAccount: userAccount,/);
  assert.doesNotMatch(bridgeContent, /joinChannel\(byUserAccount:/);
  assert.match(bridgeContent, /engine\.getUserInfo\(byUserAccount: userAccount, withError: &errorCode\)/);
  assert.match(bridgeContent, /var errorCode = AgoraErrorCode\.noError/);
  assert.match(bridgeContent, /User account is required\./);
  assert.match(bridgeContent, /userAccount/);
});

test('ios bridge template rejects unsafe invalid arguments before calling the rtc sdk', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /private func requiredString/);
  assert.match(bridgeContent, /private func dispatchInvalidArgumentError/);

  const setRenderBackendMatch = bridgeContent.match(
    /case "setRenderBackend":[\s\S]*?case "setChannelProfile":/,
  );
  assert.ok(setRenderBackendMatch);
  assert.match(setRenderBackendMatch[0], /Render backend is required\./);
  assert.match(setRenderBackendMatch[0], /isSupportedRenderBackend\(requestedBackend\)/);
  assert.match(setRenderBackendMatch[0], /Unsupported render backend/);
  assertPatternBefore(
    setRenderBackendMatch[0],
    /dispatchInvalidArgumentError/,
    /renderBackend = requestedBackend/,
    'setRenderBackend must reject unknown backends before mutating state',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private func handleJoinChannel[\s\S]*?private func requireEngine/,
  );
  assert.ok(handleJoinChannelMatch);
  assert.match(handleJoinChannelMatch[0], /Channel ID is required\./);
  assertPatternBefore(
    handleJoinChannelMatch[0],
    /Channel ID is required\./,
    /engine\.joinChannel/,
    'joinChannel must reject an empty channel before invoking native sdk',
  );

  const setLogFileMatch = bridgeContent.match(
    /case "setLogFile":[\s\S]*?case "setParameters":/,
  );
  assert.ok(setLogFileMatch);
  assert.match(setLogFileMatch[0], /Log file path is required\./);
  assertPatternBefore(
    setLogFileMatch[0],
    /Log file path is required\./,
    /engine\.setLogFile/,
    'setLogFile must reject an empty path before invoking native sdk',
  );

  const setParametersMatch = bridgeContent.match(
    /case "setParameters":[\s\S]*?case "enableContentInspect":/,
  );
  assert.ok(setParametersMatch);
  assert.match(setParametersMatch[0], /Parameters are required\./);
  assertPatternBefore(
    setParametersMatch[0],
    /Parameters are required\./,
    /engine\.setParameters/,
    'setParameters must reject an empty payload before invoking native sdk',
  );

  const startAudioMixingMatch = bridgeContent.match(
    /case "startAudioMixing":[\s\S]*?case "pauseAudioMixing":/,
  );
  assert.ok(startAudioMixingMatch);
  assert.match(startAudioMixingMatch[0], /Audio mixing path is required\./);
  assertPatternBefore(
    startAudioMixingMatch[0],
    /Audio mixing path is required\./,
    /engine\.startAudioMixing/,
    'startAudioMixing must reject an empty path before invoking native sdk',
  );
});

test('ios bridge template explicitly requests rtc permissions before camera and microphone use', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /import AVFoundation/);
  assert.match(bridgeContent, /AVCaptureDevice\.requestAccess\(for: \.video/);
  assert.match(bridgeContent, /AVAudioSession\.sharedInstance\(\)\.requestRecordPermission/);
  assert.match(bridgeContent, /ensureRtcPermissions/);
  assert.match(bridgeContent, /private func requiresCameraPermission\(_ mediaOptions: \[String: Any\]\?\) -> Bool/);
  assert.match(bridgeContent, /mediaOptionBool\(mediaOptions, key: "startPreview", defaultValue: false\)/);
  assert.match(bridgeContent, /mediaOptionBool\(mediaOptions, key: "publishSecondaryCameraTrack", defaultValue: false\)/);
  assert.doesNotMatch(bridgeContent, /mediaOptionBool\(mediaOptions, key: "publishThirdCameraTrack", defaultValue: false\)/);
  assert.doesNotMatch(bridgeContent, /mediaOptionBool\(mediaOptions, key: "publishFourthCameraTrack", defaultValue: false\)/);

  const startPreviewMatch = bridgeContent.match(
    /case "startPreview":[\s\S]*?case "stopPreview":/,
  );
  assert.ok(startPreviewMatch);
  assertPatternBefore(
    startPreviewMatch[0],
    /ensureRtcPermissions\(\s*requestId: requestId,\s*requiresCamera: true,\s*requiresMicrophone: false/,
    /engine\.startPreview/,
    'startPreview must request only iOS camera permission before invoking native sdk',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private func handleJoinChannel[\s\S]*?private func requireEngine/,
  );
  assert.ok(handleJoinChannelMatch);
  assertPatternBefore(
    handleJoinChannelMatch[0],
    /ensureRtcPermissions\([\s\S]*requestId: requestId,[\s\S]*requiresCamera: requiresCameraPermission,[\s\S]*requiresMicrophone: requiresMicrophonePermission/,
    /engine\.joinChannel/,
    'joinChannel must request required iOS permissions before invoking native sdk',
  );
});

test('ios bridge template only dispatches callbacks exposed by the installed rtc delegate header', async (t) => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );
  const delegateHeader = await readFirstExistingFile(iosRtcDelegateHeaderCandidates);
  if (delegateHeader == null) {
    t.skip('AgoraRtcEngineDelegate.h is unavailable before iOS dependency restore');
    return;
  }

  assert.match(delegateHeader.content, /didOccurError/);
  assert.doesNotMatch(delegateHeader.content, /didOccurWarning|warningCode/);
  assert.doesNotMatch(bridgeContent, /didOccurWarning|dispatchEvent\(name: "warning"/);
});

test('ios content inspect module boundary matches the installed rtc objects header', async (t) => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );
  const objectsHeader = await readFirstExistingFile(iosRtcObjectsHeaderCandidates);
  if (objectsHeader == null) {
    t.skip('AgoraObjects.h is unavailable before iOS dependency restore');
    return;
  }

  const moduleMatch = objectsHeader.content.match(
    /@interface AgoraContentInspectModule:[\s\S]*?@end/,
  );
  assert.ok(moduleMatch);
  assert.match(moduleMatch[0], /AgoraContentInspectType type/);
  assert.match(moduleMatch[0], /NSInteger interval/);
  assert.match(moduleMatch[0], /AgoraVideoModulePosition position/);
  assert.match(bridgeContent, /module\.position = parseContentInspectModulePosition/);
});

test('ios plugin registrar attaches the js bridge wrapper and forwards responses back to script', async () => {
  const pluginContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcPlugin.mm'),
    'utf8',
  );
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(pluginContent, /JsbBridgeWrapper/);
  assert.match(pluginContent, /addScriptEventListener/);
  assert.match(pluginContent, /agora:request/);
  assert.match(pluginContent, /_listener = \^\(NSString \*payload\)/);
  assert.match(pluginContent, /_listener = \[_listener copy\];/);
  assert.doesNotMatch(pluginContent, /listener:\[_listener copy\]/);
  assert.match(pluginContent, /CFBundleExecutable/);
  assert.match(pluginContent, /stringByReplacingOccurrencesOfString:@"-" withString:@"_"/);
  assert.match(pluginContent, /NSClassFromString\(qualifiedName\)/);
  assert.match(pluginContent, /handleScriptRequest:/);
  assert.match(pluginContent, /#import "apple\/JsbBridge\.h"/);
  assert.match(pluginContent, /dispatchEventToScript:\(NSString \*\)eventName payload:\(NSString \*\)payload/);
  assert.match(pluginContent, /\[\[JsbBridge sharedInstance\] sendToScript:eventName arg1:payload\]/);
  assert.match(pluginContent, /_bridgeCallback = \^\(NSString \*eventName, NSString \*arg\)/);
  assert.match(pluginContent, /\[\[JsbBridge sharedInstance\] setCallback:_bridgeCallback\]/);
  assert.match(bridgeContent, /dispatchToScript\(event:/);
  assert.match(bridgeContent, /dispatchEventToScript:payload:/);
  assert.match(bridgeContent, /agora:response/);
  assert.match(bridgeContent, /agora:event/);
});

test('ios integration script registers all committed bridge templates in the exported project', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );

  assert.match(scriptContent, /AgoraRtcBridge\.swift/);
  assert.match(scriptContent, /AgoraRtcPlugin\.mm/);
  assert.match(scriptContent, /AgoraEngineTextureSlotBridge\.h/);
  assert.match(scriptContent, /AgoraEngineTextureSlotBridge\.mm/);
  assert.match(scriptContent, /APP_DELEGATE_PATH/);
  assert.match(scriptContent, /INFO_PLIST_PATH/);
  assert.match(scriptContent, /ensure_app_delegate_attaches_bridge/);
  assert.match(scriptContent, /ensure_info_plist_usage_descriptions/);
  assert.match(scriptContent, /\[\[AgoraRtcPlugin sharedInstance\] attachBridge\]/);
  assert.match(scriptContent, /NSCameraUsageDescription/);
  assert.match(scriptContent, /NSMicrophoneUsageDescription/);
});

test('ios integration script refreshes the configured Swift package exact version', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );
  const withPackageIndex = scriptContent.indexOf('if WITH_PACKAGE');
  const createPackageIndex = scriptContent.indexOf('unless package_ref', withPackageIndex);
  const packageProductIndex = scriptContent.indexOf('unless package_product', createPackageIndex);

  assert.ok(withPackageIndex >= 0, 'expected WITH_PACKAGE branch');
  assert.ok(createPackageIndex >= 0, 'expected package creation branch');
  assert.ok(packageProductIndex >= 0, 'expected package product branch');
  assert.match(
    scriptContent,
    /unless package_ref[\s\S]+project\.root_object\.package_references << package_ref\s+end\s+package_ref\.requirement =/,
  );
  assert.match(scriptContent, /'kind' => 'exactVersion'/);
  assert.match(scriptContent, /'version' => PACKAGE_VERSION/);
});

test('ios integration script removes stale Swift package products for the same repository', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );

  assert.match(scriptContent, /remove_stale_swift_package_products/);
  assert.match(scriptContent, /dependency\.package == package_ref/);
  assert.match(scriptContent, /dependency\.product_name != package_product_name/);
  assert.match(scriptContent, /frameworks_phase\.files/);
  assert.match(scriptContent, /target\.package_product_dependencies\.delete\(dependency\)/);
  assert.match(scriptContent, /dependency\.remove_from_project/);
  assert.match(
    scriptContent,
    /remove_stale_swift_package_products\(target, frameworks_phase, package_ref, PACKAGE_PRODUCT\)/,
  );
});

test('ios sdk config uses the product name declared by the local 4.5.3 Package.swift', async () => {
  const sdkConfig = JSON.parse(
    await readFile(path.join(repoRoot, 'sdk/agora-rtc/sdk-config.json'), 'utf8'),
  );

  assert.equal(sdkConfig.ios.packageProduct, 'RtcBasic');
});

test('ios integration script removes Cocos legacy build locations before enabling Swift packages', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );
  const cleanupIndex = scriptContent.indexOf('remove_legacy_build_locations_for_swift_packages');
  const withPackageIndex = scriptContent.indexOf('if WITH_PACKAGE');

  assert.ok(cleanupIndex >= 0, 'expected legacy build location cleanup helper');
  assert.ok(withPackageIndex >= 0, 'expected WITH_PACKAGE branch');
  assert.ok(cleanupIndex < withPackageIndex, 'cleanup helper should be defined before package integration');
  assert.match(scriptContent, /SYMROOT/);
  assert.match(scriptContent, /OBJROOT/);
  assert.match(scriptContent, /CONFIGURATION_BUILD_DIR/);
  assert.match(scriptContent, /CONFIGURATION_TEMP_DIR/);
  assert.match(scriptContent, /project\.targets\.flat_map\(&:build_configurations\)/);
  assert.match(
    scriptContent,
    /remove_legacy_build_locations_for_swift_packages\(project\) if WITH_PACKAGE/,
  );
});

test('ios integration script rewrites Cocos archive linker flags after clearing legacy build paths', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );

  assert.match(scriptContent, /rewrite_cocos_archive_linker_flags/);
  assert.match(scriptContent, /OTHER_LDFLAGS/);
  assert.match(scriptContent, /archives\/#\{Regexp\.escape\(configuration\.name\)\}\/libcocos_engine\\\.a/);
  assert.match(scriptContent, /boost\/container\/archives\/#\{Regexp\.escape\(configuration\.name\)\}\/libboost_container\\\.a/);
  assert.match(scriptContent, /\$\(CONFIGURATION_BUILD_DIR\)\/libcocos_engine\.a/);
  assert.match(scriptContent, /\$\(CONFIGURATION_BUILD_DIR\)\/libboost_container\.a/);
  assert.match(scriptContent, /rewrite_cocos_archive_linker_flags\(target\)/);
});

test('ios integration script adds the app Frameworks runpath for embedded Swift package frameworks', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );

  assert.match(scriptContent, /ensure_app_frameworks_runpath/);
  assert.match(scriptContent, /LD_RUNPATH_SEARCH_PATHS/);
  assert.match(scriptContent, /@executable_path\/Frameworks/);
  assert.match(scriptContent, /ensure_app_frameworks_runpath\(target\)/);
});

test('ios integration script can remove simulator launch assets for local smoke builds', async () => {
  const scriptContent = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );

  assert.match(scriptContent, /SKIP_SIMULATOR_LAUNCH_ASSETS = ARGV\.include\?\('--skip-simulator-launch-assets'\)/);
  assert.match(scriptContent, /remove_simulator_launch_assets/);
  assert.match(scriptContent, /LaunchScreen\.storyboard/);
  assert.match(scriptContent, /Images\.xcassets/);
  assert.match(scriptContent, /target\.resources_build_phase\.files/);
  assert.match(scriptContent, /ASSETCATALOG_COMPILER_APPICON_NAME/);
  assert.match(scriptContent, /ASSETCATALOG_COMPILER_LAUNCHSTORYBOARD_NAME/);
  assert.match(
    scriptContent,
    /remove_simulator_launch_assets\(target\) if SKIP_SIMULATOR_LAUNCH_ASSETS/,
  );
});

test('ios bridge template manages native video canvas views for local and remote rendering', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /AgoraRtcVideoCanvas/);
  assert.match(bridgeContent, /setupLocalVideoView/);
  assert.match(bridgeContent, /setupRemoteVideoView/);
  assert.match(bridgeContent, /updateLocalVideoView/);
  assert.match(bridgeContent, /updateRemoteVideoView/);
  assert.match(bridgeContent, /removeLocalVideoView/);
  assert.match(bridgeContent, /removeRemoteVideoView/);
  assert.match(bridgeContent, /addSubview/);
  assert.match(bridgeContent, /removeFromSuperview/);
  assert.match(bridgeContent, /setLocalRenderMode/);
  assert.match(bridgeContent, /setRemoteRenderMode/);
  assert.match(bridgeContent, /CGRect/);
});

test('ios bridge template falls back unsupported render backends to surface-view and dispatches backend state', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  assert.match(bridgeContent, /renderBackend = "surface-view"/);
  assert.match(bridgeContent, /case "setRenderBackend":/);
  assert.match(bridgeContent, /if requestedBackend == "texture-view"/);
  assert.match(bridgeContent, /dispatchEvent\(name: "renderBackendState"/);
  assert.match(bridgeContent, /"phase": "fallback"/);
  assert.match(bridgeContent, /"fallbackBackend": renderBackend/);
  assert.match(bridgeContent, /"platform": "ios"/);
});

test('ios bridge template routes engine-texture through AgoraVideoFrameDelegate instead of UIView overlay', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );
  const slotBridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraEngineTextureSlotBridge.mm'),
    'utf8',
  );

  assert.match(bridgeContent, /AgoraVideoFrameDelegate/);
  assert.match(bridgeContent, /setVideoFrameDelegate\(self\)/);
  assert.match(bridgeContent, /onCapture\(/);
  assert.match(bridgeContent, /onRenderVideoFrame/);
  assert.match(bridgeContent, /localVideoTextureReady/);
  assert.match(bridgeContent, /remoteVideoTextureReady/);
  assert.match(bridgeContent, /localVideoTextureReleased/);
  assert.match(bridgeContent, /remoteVideoTextureReleased/);
  assert.match(bridgeContent, /"slotId": slot\.slotId/);
  assert.match(bridgeContent, /"width": slot\.width/);
  assert.match(bridgeContent, /"height": slot\.height/);
  assert.match(bridgeContent, /payload\["uid"\] = uid/);
  assert.match(bridgeContent, /private func handleUpdateLocalVideoView\(requestId: String, params: \[String: Any\]\) \{\n        if renderBackend == "engine-texture" \{[\s\S]*?ensureLocalTextureSlot\(\)/);
  assert.match(bridgeContent, /private func handleUpdateRemoteVideoView\(requestId: String, params: \[String: Any\]\) \{\n        let uid = params\["uid"\][\s\S]*?\n        if renderBackend == "engine-texture" \{[\s\S]*?ensureRemoteTextureSlot\(uid\)/);
  assert.match(slotBridgeContent, /case 12:/);
  assert.match(slotBridgeContent, /case 13:/);
  assert.match(slotBridgeContent, /case 14:/);
  assert.match(slotBridgeContent, /case 1:/);
  assert.match(slotBridgeContent, /update_agora_engine_texture_i420_slot/);
});

test('engine-texture backend uses DirectByteBuffer and slot-level reusable native staging buffers', async () => {
  const templateContent = await readFile(engineTextureBackendTemplate, 'utf8');
  const runtimeContent = await readFile(engineTextureBackendRuntime, 'utf8');
  const slotBridgeContent = await readFile(engineTextureSlotBridgeTemplate, 'utf8');
  const iosSlotBridgeHeaderContent = await readFile(iosEngineTextureSlotBridgeHeaderTemplate, 'utf8');
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');

  assert.match(templateContent, /nativeUpdateI420Slot\(/);
  assert.match(templateContent, /i420Buffer\.getDataY\(\)/);
  assert.match(templateContent, /i420Buffer\.getDataU\(\)/);
  assert.match(templateContent, /i420Buffer\.getDataV\(\)/);
  assert.match(runtimeContent, /nativeUpdateI420Slot\(/);
  assert.match(runtimeContent, /i420Buffer\.getDataY\(\)/);
  assert.match(runtimeContent, /i420Buffer\.getDataU\(\)/);
  assert.match(runtimeContent, /i420Buffer\.getDataV\(\)/);
  assert.doesNotMatch(templateContent, /byte\[] rgba = new byte/);
  assert.match(slotBridgeContent, /ByteBuffer dataY/);
  assert.match(slotBridgeContent, /ByteBuffer dataU/);
  assert.match(slotBridgeContent, /ByteBuffer dataV/);
  assert.match(iosSlotBridgeHeaderContent, /updateSlot:\(NSNumber \*\)slotId videoFrame:/);
  assert.match(iosSlotBridgeContent, /CVPixelBufferLockBaseAddress/);
  assert.match(iosSlotBridgeContent, /static_cast<const uint8_t \*>/);
});

test('engine-texture backend delegates YUV to RGBA conversion to native code', async () => {
  const templateContent = await readFile(engineTextureBackendTemplate, 'utf8');
  const runtimeContent = await readFile(engineTextureBackendRuntime, 'utf8');
  const slotBridgeContent = await readFile(engineTextureSlotBridgeTemplate, 'utf8');
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');

  assert.doesNotMatch(templateContent, /i420ToRgba/);
  assert.doesNotMatch(runtimeContent, /i420ToRgba/);
  assert.doesNotMatch(templateContent, /clampColor/);
  assert.doesNotMatch(runtimeContent, /clampColor/);
  assert.match(slotBridgeContent, /nativeUpdateI420Slot/);
  assert.match(iosSlotBridgeContent, /update_agora_engine_texture_i420_slot/);
  assert.match(iosSlotBridgeContent, /videoFrame\.yStride/);
  assert.match(iosSlotBridgeContent, /videoFrame\.uStride/);
  assert.match(iosSlotBridgeContent, /videoFrame\.vStride/);
});

test('engine texture slot bridge templates expose platform-specific native entrypoints', async () => {
  const androidSlotBridgeContent = await readFile(engineTextureSlotBridgeTemplate, 'utf8');
  const iosSlotBridgeContent = await readFile(iosEngineTextureSlotBridgeTemplate, 'utf8');

  assert.match(androidSlotBridgeContent, /static native int nativeCreateSlot/);
  assert.match(androidSlotBridgeContent, /static native void nativeUpdateSlot/);
  assert.match(androidSlotBridgeContent, /static native void nativeUpdateI420Slot/);
  assert.match(androidSlotBridgeContent, /static native void nativeReleaseSlot/);
  assert.match(iosSlotBridgeContent, /createSlotWithWidth/);
  assert.match(iosSlotBridgeContent, /updateSlot:\(NSNumber \*\)slotId videoFrame:/);
  assert.match(iosSlotBridgeContent, /releaseSlot:/);
});

test('android bridge template compiles against local stubs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-java-'));
  const srcRoot = path.join(root, 'src');
  const classesRoot = path.join(root, 'classes');
  await mkdir(srcRoot, { recursive: true });
  await mkdir(classesRoot, { recursive: true });

  await cp(
    path.join(repoRoot, 'sdk/agora-rtc/templates/android/src'),
    srcRoot,
    { recursive: true },
  );

  await mkdir(path.join(srcRoot, 'org/json'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/app'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/content'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/content/pm'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/os'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/util'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/view'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/widget'), { recursive: true });
  await mkdir(path.join(srcRoot, 'com/cocos/lib'), { recursive: true });
  await mkdir(path.join(srcRoot, 'io/agora/base'), { recursive: true });
  await mkdir(path.join(srcRoot, 'io/agora/rtc2'), { recursive: true });
  await mkdir(path.join(srcRoot, 'io/agora/rtc2/video'), { recursive: true });

  await writeFile(
    path.join(srcRoot, 'org/json/JSONException.java'),
    `package org.json;

public class JSONException extends Exception {
    public JSONException(String message) {
        super(message);
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'org/json/JSONObject.java'),
    `package org.json;

public class JSONObject {
    public JSONObject() {}
    public JSONObject(String payload) throws JSONException {}
    public boolean has(String key) { return false; }
    public boolean isNull(String key) { return true; }
    public Object opt(String key) { return null; }
    public String optString(String key) { return ""; }
    public String optString(String key, String defaultValue) { return defaultValue; }
    public JSONObject optJSONObject(String key) { return null; }
    public JSONArray optJSONArray(String key) { return null; }
    public int optInt(String key) { return 0; }
    public int optInt(String key, int defaultValue) { return defaultValue; }
    public double optDouble(String key, double defaultValue) { return defaultValue; }
    public boolean optBoolean(String key) { return false; }
    public boolean optBoolean(String key, boolean defaultValue) { return defaultValue; }
    public JSONObject put(String key, Object value) throws JSONException { return this; }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'org/json/JSONArray.java'),
    `package org.json;

public class JSONArray {
    public JSONArray put(Object value) { return this; }
    public int length() { return 0; }
    public JSONObject optJSONObject(int index) { return null; }
    public String optString(int index) { return ""; }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/Manifest.java'),
    `package android;

public final class Manifest {
    public static final class permission {
        public static final String CAMERA = "android.permission.CAMERA";
        public static final String RECORD_AUDIO = "android.permission.RECORD_AUDIO";
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/content/Context.java'),
    `package android.content;

public class Context {}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/content/pm/PackageManager.java'),
    `package android.content.pm;

public class PackageManager {
    public static final int PERMISSION_GRANTED = 0;
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/os/Build.java'),
    `package android.os;

public class Build {
    public static class VERSION {
        public static int SDK_INT = 35;
    }

    public static class VERSION_CODES {
        public static final int M = 23;
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/os/SystemClock.java'),
    `package android.os;

public class SystemClock {
    public static long elapsedRealtime() { return 0L; }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/util/Base64.java'),
    `package android.util;

public class Base64 {
    public static final int NO_WRAP = 2;

    public static String encodeToString(byte[] input, int flags) { return ""; }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/util/Log.java'),
    `package android.util;

public class Log {
    public static int i(String tag, String message) { return 0; }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/app/Activity.java'),
    `package android.app;

import android.content.Context;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import android.view.View;
import android.view.ViewGroup;

public class Activity extends Context {
    public final List<String[]> permissionRequests = new ArrayList<>();
    private final Set<String> grantedPermissions = new HashSet<>();

    public void runOnUiThread(Runnable runnable) {
        runnable.run();
    }

    public void addContentView(View view, ViewGroup.LayoutParams params) {}
    public int checkSelfPermission(String permission) {
        return grantedPermissions.contains(permission) ? 0 : -1;
    }
    public void requestPermissions(String[] permissions, int requestCode) {
        permissionRequests.add(permissions);
    }
    public void grantPermission(String permission) {
        grantedPermissions.add(permission);
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/view/ViewParent.java'),
    `package android.view;

public interface ViewParent {}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/view/View.java'),
    `package android.view;

import android.content.Context;

public class View {
    public static final int VISIBLE = 0x00000000;
    public static final int INVISIBLE = 0x00000004;
    public static final int GONE = 0x00000008;

    private ViewParent parent;
    private ViewGroup.LayoutParams layoutParams;

    public View() {}
    public View(Context context) {}

    public void setLayoutParams(ViewGroup.LayoutParams params) { this.layoutParams = params; }

    public ViewGroup.LayoutParams getLayoutParams() {
        return layoutParams;
    }

    public ViewParent getParent() {
        return parent;
    }

    public void setParent(ViewParent parent) {
        this.parent = parent;
    }

    public void setVisibility(int visibility) {}
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/view/SurfaceView.java'),
    `package android.view;

import android.content.Context;

public class SurfaceView extends View {
    public SurfaceView(Context context) {
        super(context);
    }

    public void setZOrderMediaOverlay(boolean isMediaOverlay) {}
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/view/TextureView.java'),
    `package android.view;

import android.content.Context;

public class TextureView extends View {
    public TextureView(Context context) {
        super(context);
    }

    public void setOpaque(boolean opaque) {}
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/view/ViewGroup.java'),
    `package android.view;

import android.content.Context;

public class ViewGroup extends View implements ViewParent {
    public static class LayoutParams {
        public static final int MATCH_PARENT = -1;
        public int width;
        public int height;

        public LayoutParams(int width, int height) {
            this.width = width;
            this.height = height;
        }
    }

    public ViewGroup() {}
    public ViewGroup(Context context) {
        super(context);
    }

    public void addView(View view) {
        view.setParent(this);
    }

    public void removeView(View view) {
        view.setParent(null);
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'android/widget/FrameLayout.java'),
    `package android.widget;

import android.content.Context;
import android.view.ViewGroup;

public class FrameLayout extends ViewGroup {
    public static class LayoutParams extends ViewGroup.LayoutParams {
        public int leftMargin;
        public int topMargin;

        public LayoutParams(int width, int height) {
            super(width, height);
        }
    }

    public FrameLayout(Context context) {
        super(context);
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'com/cocos/lib/CocosHelper.java'),
    `package com.cocos.lib;

public class CocosHelper {
    public static void runOnGameThread(Runnable runnable) {
        runnable.run();
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'com/cocos/lib/JsbBridgeWrapper.java'),
    `package com.cocos.lib;

public class JsbBridgeWrapper {
    public interface OnScriptEventListener {
        void onScriptEvent(String arg);
    }

    private static final JsbBridgeWrapper INSTANCE = new JsbBridgeWrapper();

    public static JsbBridgeWrapper getInstance() {
        return INSTANCE;
    }

    public void addScriptEventListener(String eventName, OnScriptEventListener listener) {}
    public void dispatchEventToScript(String eventName, String arg) {}
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'com/cocos/lib/GlobalObject.java'),
    `package com.cocos.lib;

import android.app.Activity;
import android.content.Context;

public class GlobalObject {
    private static Activity activity = new Activity();
    public static Activity getActivity() { return activity; }
    public static void setActivity(Activity nextActivity) { activity = nextActivity; }
    public static Context getContext() { return new Context(); }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/base/VideoFrame.java'),
    `package io.agora.base;

public class VideoFrame {
    public enum SourceType {
        kFrontCamera,
        kBackCamera,
        kUnspecified
    }

    public interface Buffer {
        int getWidth();
        int getHeight();
        I420Buffer toI420();
        Buffer cropAndScale(int x, int y, int width, int height, int scaledWidth, int scaledHeight);
        Buffer rotate(int rotation);
        Buffer mirror(int type);
        void release();
    }

    public interface I420Buffer extends Buffer {
        java.nio.ByteBuffer getDataY();
        java.nio.ByteBuffer getDataU();
        java.nio.ByteBuffer getDataV();
        int getStrideY();
        int getStrideU();
        int getStrideV();
    }

    public int getRotatedWidth() { return 0; }
    public int getRotatedHeight() { return 0; }
    public int getRotation() { return 0; }
    public SourceType getSourceType() { return SourceType.kUnspecified; }
    public Buffer getBuffer() { return null; }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/IRtcEngineEventHandler.java'),
    `package io.agora.rtc2;

public class IRtcEngineEventHandler {
    public static class AudioVolumeInfo {
        public int uid;
        public int volume;
        public int vad;
        public double voicePitch;
    }

    public static class RtcStats {
        public int totalDuration;
        public int txBytes;
        public int rxBytes;
        public int txKBitRate;
        public int txAudioBytes;
        public int rxAudioBytes;
        public int txVideoBytes;
        public int rxVideoBytes;
        public int rxKBitRate;
        public int txAudioKBitRate;
        public int rxAudioKBitRate;
        public int txVideoKBitRate;
        public int rxVideoKBitRate;
        public int lastmileDelay;
        public int cpuTotalUsage;
        public int gatewayRtt;
        public int cpuAppUsage;
        public int users;
        public int connectTimeMs;
        public int txPacketLossRate;
        public int rxPacketLossRate;
        public int memoryAppUsageRatio;
        public int memoryTotalUsageRatio;
        public int memoryAppUsageInKbytes;
    }

    public void onError(int code) {}
    public void onJoinChannelSuccess(String channel, int uid, int elapsed) {}
    public void onUserJoined(int uid, int elapsed) {}
    public void onUserOffline(int uid, int reason) {}
    public void onLeaveChannel(RtcStats stats) {}
    public void onRtcStats(RtcStats stats) {}
    public void onRejoinChannelSuccess(String channel, int uid, int elapsed) {}
    public void onConnectionInterrupted() {}
    public void onConnectionStateChanged(int state, int reason) {}
    public void onRemoteVideoStateChanged(int uid, int state, int reason, int elapsed) {}
    public void onFirstLocalAudioFramePublished(int elapsed) {}
    public void onAudioMixingStateChanged(int state, int reason) {}
    public void onAudioMixingFinished() {}
    public void onRemoteAudioStateChanged(int uid, int state, int reason, int elapsed) {}
    public void onLocalVideoStateChanged(io.agora.rtc2.Constants.VideoSourceType source, int state, int error) {}
    public void onContentInspectResult(int result) {}
    public void onAudioVolumeIndication(AudioVolumeInfo[] speakers, int totalVolume) {}
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/ChannelMediaOptions.java'),
    `package io.agora.rtc2;

public class ChannelMediaOptions {
    public Integer clientRoleType;
    public Integer channelProfile;
    public Boolean publishCameraTrack;
    public Boolean publishSecondaryCameraTrack;
    public Boolean publishThirdCameraTrack;
    public Boolean publishFourthCameraTrack;
    public Boolean publishMicrophoneTrack;
    public Boolean publishScreenCaptureVideo;
    public Boolean publishScreenCaptureAudio;
    public Boolean publishCustomAudioTrack;
    public Integer publishCustomAudioTrackId;
    public Boolean publishCustomVideoTrack;
    public Boolean publishEncodedVideoTrack;
    public Boolean publishMediaPlayerAudioTrack;
    public Boolean publishMediaPlayerVideoTrack;
    public Boolean publishTranscodedVideoTrack;
    public Boolean publishMixedAudioTrack;
    public Boolean publishLipSyncTrack;
    public Boolean autoSubscribeAudio;
    public Boolean autoSubscribeVideo;
    public Boolean enableAudioRecordingOrPlayout;
    public Integer publishMediaPlayerId;
    public Integer audienceLatencyLevel;
    public Integer defaultVideoStreamType;
    public Integer audioDelayMs;
    public Integer mediaPlayerAudioDelayMs;
    public Boolean enableBuiltInMediaEncryption;
    public Boolean publishRhythmPlayerTrack;
    public Boolean isInteractiveAudience;
    public Integer customVideoTrackId;
    public Boolean isAudioFilterable;
    public Boolean startPreview;
    public Boolean enableMultipath;
    public Integer uplinkMultipathMode;
    public Integer downlinkMultipathMode;
    public Integer preferMultipathType;
    public String token;
    public String parameters;
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/UserInfo.java'),
    `package io.agora.rtc2;

public class UserInfo {
    public int uid;
    public String userAccount;
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/Constants.java'),
    `package io.agora.rtc2;

public class Constants {
    public static final int RENDER_MODE_HIDDEN = 1;
    public static final int RENDER_MODE_FIT = 2;
    public static final int CHANNEL_PROFILE_COMMUNICATION = 0;
    public static final int CHANNEL_PROFILE_LIVE_BROADCASTING = 1;
    public static final int CLIENT_ROLE_BROADCASTER = 1;
    public static final int CLIENT_ROLE_AUDIENCE = 2;

    public enum VideoSourceType {
        VIDEO_SOURCE_CAMERA_PRIMARY
    }

    public enum VideoModulePosition {
        VIDEO_MODULE_POSITION_POST_CAPTURER,
        VIDEO_MODULE_POSITION_PRE_RENDERER,
        VIDEO_MODULE_POSITION_PRE_ENCODER,
        VIDEO_MODULE_POSITION_POST_CAPTURER_ORIGIN
    }
}
`,
    'utf8',
  );

  await mkdir(path.join(srcRoot, 'io/agora/rtc2/video'), { recursive: true });

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/ClientRoleOptions.java'),
    `package io.agora.rtc2;

public class ClientRoleOptions {
    public int audienceLatencyLevel;
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/RtcEngineConfig.java'),
    `package io.agora.rtc2;

import android.content.Context;

public class RtcEngineConfig {
    public IRtcEngineEventHandler mEventHandler;
    public Context mContext;
    public String mAppId;
    public int mAreaCode;
    public int mChannelProfile;
    public String mLicense;
    public int mAudioScenario;
    public boolean mAutoRegisterAgoraExtensions;
    public LogConfig mLogConfig;
    public Integer mThreadPriority;
    public String mNativeLibPath;
    public boolean mDomainLimit;

    public void addExtension(String extensionName) {}

    public static class LogConfig {
        public String filePath;
        public int fileSizeInKB;
        public int level;
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/video/BeautyOptions.java'),
    `package io.agora.rtc2.video;

public class BeautyOptions {
    public static final int LIGHTENING_CONTRAST_NORMAL = 1;
    public int lighteningContrastLevel;
    public float lighteningLevel;
    public float smoothnessLevel;
    public float rednessLevel;
    public float sharpnessLevel;
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/video/ContentInspectConfig.java'),
    `package io.agora.rtc2.video;

import io.agora.rtc2.Constants;

public class ContentInspectConfig {
    public static final int CONTENT_INSPECT_TYPE_MODERATION = 1;
    public String extraInfo;
    public String serverConfig;
    public ContentInspectModule[] modules;
    public int moduleCount;

    public static class ContentInspectModule {
        public int type;
        public int interval;
        public Constants.VideoModulePosition position;
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/video/VideoEncoderConfiguration.java'),
    `package io.agora.rtc2.video;

public class VideoEncoderConfiguration {
    public VideoDimensions dimensions;
    public int frameRate;
    public int minFrameRate;
    public int bitrate;
    public int minBitrate;
    public ORIENTATION_MODE orientationMode;
    public DEGRADATION_PREFERENCE degradationPrefer;
    public MIRROR_MODE_TYPE mirrorMode;
    public AdvanceOptions advanceOptions;
    public VIDEO_CODEC_TYPE codecType;

    public static class VideoDimensions {
        public int width;
        public int height;

        public VideoDimensions(int width, int height) {
            this.width = width;
            this.height = height;
        }
    }

    public enum ORIENTATION_MODE {
        ORIENTATION_MODE_ADAPTIVE,
        ORIENTATION_MODE_FIXED_LANDSCAPE,
        ORIENTATION_MODE_FIXED_PORTRAIT
    }

    public enum MIRROR_MODE_TYPE {
        MIRROR_MODE_AUTO,
        MIRROR_MODE_ENABLED,
        MIRROR_MODE_DISABLED
    }

    public enum DEGRADATION_PREFERENCE {
        MAINTAIN_AUTO,
        MAINTAIN_QUALITY,
        MAINTAIN_FRAMERATE,
        MAINTAIN_BALANCED,
        MAINTAIN_RESOLUTION,
        DISABLED
    }

    public enum VIDEO_CODEC_TYPE {
        VIDEO_CODEC_NONE,
        VIDEO_CODEC_VP8,
        VIDEO_CODEC_H264,
        VIDEO_CODEC_H265,
        VIDEO_CODEC_GENERIC,
        VIDEO_CODEC_AV1,
        VIDEO_CODEC_VP9,
        VIDEO_CODEC_GENERIC_JPEG
    }

    public enum ENCODING_PREFERENCE {
        PREFER_AUTO,
        PREFER_SOFTWARE,
        PREFER_HARDWARE
    }

    public enum COMPRESSION_PREFERENCE {
        PREFER_COMPRESSION_AUTO,
        PREFER_LOW_LATENCY,
        PREFER_QUALITY
    }

    public static class AdvanceOptions {
        public ENCODING_PREFERENCE encodingPreference;
        public COMPRESSION_PREFERENCE compressionPreference;
        public boolean encodeAlpha;
    }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/IAudioEffectManager.java'),
    `package io.agora.rtc2;

public interface IAudioEffectManager {
    int preloadEffect(int soundId, String path);
    int playEffect(int soundId, String path, int loopCount, double pitch, double pan, double gain, boolean publish, int startPos);
    int pauseEffect(int soundId);
    int resumeEffect(int soundId);
    int setEffectsVolume(double volume);
    int stopEffect(int soundId);
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/video/IVideoFrameObserver.java'),
    `package io.agora.rtc2.video;

import io.agora.base.VideoFrame;

public interface IVideoFrameObserver {
    int PROCESS_MODE_READ_ONLY = 0;
    int POSITION_POST_CAPTURER = 1;
    int POSITION_PRE_RENDERER = 2;
    int VIDEO_PIXEL_I420 = 1;

    boolean onCaptureVideoFrame(int sourceType, VideoFrame videoFrame);
    boolean onPreEncodeVideoFrame(int sourceType, VideoFrame videoFrame);
    boolean onMediaPlayerVideoFrame(VideoFrame videoFrame, int mediaPlayerId);
    int getVideoFrameProcessMode();
    int getVideoFormatPreference();
    boolean getRotationApplied();
    boolean getMirrorApplied();
    int getObservedFramePosition();
    boolean onRenderVideoFrame(String channelId, int uid, VideoFrame videoFrame);
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/video/VideoCanvas.java'),
    `package io.agora.rtc2.video;

import android.view.View;

public class VideoCanvas {
    public VideoCanvas(View view, int renderMode, int uid) {}
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/rtc2/RtcEngine.java'),
    `package io.agora.rtc2;

import android.content.Context;
import io.agora.rtc2.video.BeautyOptions;
import io.agora.rtc2.video.ContentInspectConfig;
import io.agora.rtc2.video.VideoCanvas;
import io.agora.rtc2.video.VideoEncoderConfiguration;

public class RtcEngine {
    public static String getSdkVersion() { return "stub"; }
    public static String getErrorDescription(int code) { return "stub"; }

    public static RtcEngine create(Context context, String appId, IRtcEngineEventHandler handler) throws Exception {
        return new RtcEngine();
    }

    public static RtcEngine create(RtcEngineConfig config) throws Exception {
        return new RtcEngine();
    }

    public static void destroy() {}

    public int setLogFilter(int level) { return 0; }
    public int setLogFile(String path) { return 0; }
    public int setChannelProfile(int profile) { return 0; }
    public int setClientRole(int role) { return 0; }
    public int setClientRole(int role, ClientRoleOptions options) { return 0; }
    public void setupLocalVideo(VideoCanvas canvas) {}
    public void setupRemoteVideo(VideoCanvas canvas) {}
    public int joinChannel(String token, String channelId, int uid, ChannelMediaOptions options) { return 0; }
    public int joinChannelWithUserAccount(String token, String channelId, String userAccount, ChannelMediaOptions options) { return 0; }
    public int getUserInfoByUserAccount(String userAccount, UserInfo userInfo) { return 0; }
    public void leaveChannel() {}
    public int renewToken(String token) { return 0; }
    public int enableAudio() { return 0; }
    public int disableAudio() { return 0; }
    public int muteLocalAudioStream(boolean muted) { return 0; }
    public int muteRemoteAudioStream(int uid, boolean muted) { return 0; }
    public int muteAllRemoteAudioStreams(boolean muted) { return 0; }
    public int setAudioProfile(int profile, int scenario) { return 0; }
    public int enableAudioVolumeIndication(int interval, int smooth, boolean reportVad) { return 0; }
    public int setDefaultAudioRoutetoSpeakerphone(boolean enabled) { return 0; }
    public boolean isSpeakerphoneEnabled() { return true; }
    public int setEnableSpeakerphone(boolean enabled) { return 0; }
    public int adjustPlaybackSignalVolume(int volume) { return 0; }
    public int adjustUserPlaybackSignalVolume(int uid, int volume) { return 0; }
    public int enableVideo() { return 0; }
    public int disableVideo() { return 0; }
    public int enableLocalAudio(boolean enabled) { return 0; }
    public int enableLocalVideo(boolean enabled) { return 0; }
    public int muteLocalVideoStream(boolean muted) { return 0; }
    public int muteRemoteVideoStream(int uid, boolean muted) { return 0; }
    public int muteAllRemoteVideoStreams(boolean muted) { return 0; }
    public int setVideoEncoderConfiguration(VideoEncoderConfiguration configuration) { return 0; }
    public int setBeautyEffectOptions(boolean enabled, BeautyOptions options) { return 0; }
    public int enableContentInspect(boolean enabled, ContentInspectConfig config) { return 0; }
    public int setParameters(String parameters) { return 0; }
    public int startAudioMixing(String path, boolean loopback, int cycle, int startPos) { return 0; }
    public int stopAudioMixing() { return 0; }
    public int pauseAudioMixing() { return 0; }
    public int resumeAudioMixing() { return 0; }
    public int adjustAudioMixingVolume(int volume) { return 0; }
    public int adjustAudioMixingPublishVolume(int volume) { return 0; }
    public int adjustAudioMixingPlayoutVolume(int volume) { return 0; }
    public int getAudioMixingCurrentPosition() { return 0; }
    public int setAudioMixingPosition(int position) { return 0; }
    public IAudioEffectManager getAudioEffectManager() { return null; }
    public int startPreview() { return 0; }
    public int stopPreview() { return 0; }
    public int switchCamera() { return 0; }
    public int registerVideoFrameObserver(io.agora.rtc2.video.IVideoFrameObserver observer) { return 0; }
}
`,
    'utf8',
  );

  const pluginFile = path.join(
    srcRoot,
    'main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
  );
  const pluginSource = await readFile(pluginFile, 'utf8');
  assert.match(pluginSource, /handleScriptRequest/);
  assert.match(pluginSource, /App ID is required/);
  assert.match(pluginSource, /GlobalObject\.getActivity\(\)/);
  assert.match(pluginSource, /setRenderBackend/);
  assert.match(pluginSource, /AgoraRenderBackendFactory/);
  const handleJoinChannelMatch = pluginSource.match(
    /private void handleJoinChannel[\s\S]*?private void handleSetupLocalVideoView/,
  );
  assert.ok(handleJoinChannelMatch);
  assert.match(handleJoinChannelMatch[0], /dispatchOk\(requestId\);/);

  const renderBackendFiles = (await readdir(
    path.join(srcRoot, 'main/java/io/agora/cocos/rtc/render'),
  )).map((file) => path.join(srcRoot, 'main/java/io/agora/cocos/rtc/render', file));

  const javaFiles = [
    path.join(srcRoot, 'org/json/JSONException.java'),
    path.join(srcRoot, 'org/json/JSONObject.java'),
    path.join(srcRoot, 'org/json/JSONArray.java'),
    path.join(srcRoot, 'android/Manifest.java'),
    path.join(srcRoot, 'android/app/Activity.java'),
    path.join(srcRoot, 'android/content/Context.java'),
    path.join(srcRoot, 'android/content/pm/PackageManager.java'),
    path.join(srcRoot, 'android/os/Build.java'),
    path.join(srcRoot, 'android/os/SystemClock.java'),
    path.join(srcRoot, 'android/util/Base64.java'),
    path.join(srcRoot, 'android/util/Log.java'),
    path.join(srcRoot, 'android/view/ViewParent.java'),
    path.join(srcRoot, 'android/view/View.java'),
    path.join(srcRoot, 'android/view/SurfaceView.java'),
    path.join(srcRoot, 'android/view/TextureView.java'),
    path.join(srcRoot, 'android/view/ViewGroup.java'),
    path.join(srcRoot, 'android/widget/FrameLayout.java'),
    path.join(srcRoot, 'com/cocos/lib/CocosHelper.java'),
    path.join(srcRoot, 'com/cocos/lib/JsbBridgeWrapper.java'),
    path.join(srcRoot, 'com/cocos/lib/GlobalObject.java'),
    path.join(srcRoot, 'io/agora/base/VideoFrame.java'),
    path.join(srcRoot, 'io/agora/rtc2/IRtcEngineEventHandler.java'),
    path.join(srcRoot, 'io/agora/rtc2/ChannelMediaOptions.java'),
    path.join(srcRoot, 'io/agora/rtc2/ClientRoleOptions.java'),
    path.join(srcRoot, 'io/agora/rtc2/RtcEngineConfig.java'),
    path.join(srcRoot, 'io/agora/rtc2/UserInfo.java'),
    path.join(srcRoot, 'io/agora/rtc2/IAudioEffectManager.java'),
    path.join(srcRoot, 'io/agora/rtc2/Constants.java'),
    path.join(srcRoot, 'io/agora/rtc2/video/BeautyOptions.java'),
    path.join(srcRoot, 'io/agora/rtc2/video/ContentInspectConfig.java'),
    path.join(srcRoot, 'io/agora/rtc2/video/VideoEncoderConfiguration.java'),
    path.join(srcRoot, 'io/agora/rtc2/video/IVideoFrameObserver.java'),
    path.join(srcRoot, 'io/agora/rtc2/video/VideoCanvas.java'),
    path.join(srcRoot, 'io/agora/rtc2/RtcEngine.java'),
    ...renderBackendFiles,
    pluginFile,
  ];

  await execFileAsync('/usr/bin/javac', ['-d', classesRoot, ...javaFiles]);

  const permissionQueueTestFile = path.join(srcRoot, 'PermissionQueueTest.java');
  await writeFile(
    permissionQueueTestFile,
    `import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import com.cocos.lib.GlobalObject;
import io.agora.cocos.rtc.AgoraRtcPlugin;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;

public class PermissionQueueTest {
    public static void main(String[] args) throws Exception {
        Activity activity = new Activity();
        GlobalObject.setActivity(activity);
        AgoraRtcPlugin plugin = AgoraRtcPlugin.getInstance();
        Class<?> pluginClass = plugin.getClass();

        Field pendingActionsField = pluginClass.getDeclaredField("pendingPermissionActions");
        pendingActionsField.setAccessible(true);
        ((Queue<?>) pendingActionsField.get(plugin)).clear();
        Field requestInFlightField = pluginClass.getDeclaredField("permissionRequestInFlight");
        requestInFlightField.setAccessible(true);
        requestInFlightField.setBoolean(plugin, false);
        Field requestCodeField = pluginClass.getDeclaredField("RTC_PERMISSION_REQUEST_CODE");
        requestCodeField.setAccessible(true);
        int requestCode = requestCodeField.getInt(null);

        Method ensurePermissions = pluginClass.getDeclaredMethod(
            "ensureRtcPermissions",
            String.class,
            boolean.class,
            boolean.class,
            Runnable.class
        );
        ensurePermissions.setAccessible(true);

        List<String> ranActions = new ArrayList<>();
        ensurePermissions.invoke(plugin, "mic-only", false, true, (Runnable) () -> ranActions.add("mic-only"));
        ensurePermissions.invoke(plugin, "camera-mic", true, true, (Runnable) () -> ranActions.add("camera-mic"));

        assertEquals(1, activity.permissionRequests.size(), "first action should request microphone");
        assertPermissions(activity.permissionRequests.get(0), Manifest.permission.RECORD_AUDIO);

        activity.grantPermission(Manifest.permission.RECORD_AUDIO);
        plugin.onRequestPermissionsResult(
            requestCode,
            new String[] { Manifest.permission.RECORD_AUDIO },
            new int[] { PackageManager.PERMISSION_GRANTED }
        );

        assertEquals(1, ranActions.size(), "only the microphone action should run after microphone grant");
        assertEquals("mic-only", ranActions.get(0), "microphone action should run first");
        assertEquals(2, activity.permissionRequests.size(), "camera action should request the missing camera permission");
        assertPermissions(activity.permissionRequests.get(1), Manifest.permission.CAMERA);

        activity.grantPermission(Manifest.permission.CAMERA);
        plugin.onRequestPermissionsResult(
            requestCode,
            new String[] { Manifest.permission.CAMERA },
            new int[] { PackageManager.PERMISSION_GRANTED }
        );

        assertEquals(2, ranActions.size(), "queued camera action should run after camera grant");
        assertEquals("camera-mic", ranActions.get(1), "camera action should run second");

        Activity partialDenialActivity = new Activity();
        GlobalObject.setActivity(partialDenialActivity);
        ((Queue<?>) pendingActionsField.get(plugin)).clear();
        requestInFlightField.setBoolean(plugin, false);

        List<String> partialDenialActions = new ArrayList<>();
        ensurePermissions.invoke(plugin, "camera-mic-denied", true, true, (Runnable) () -> partialDenialActions.add("camera-mic-denied"));
        ensurePermissions.invoke(plugin, "mic-only-granted", false, true, (Runnable) () -> partialDenialActions.add("mic-only-granted"));

        assertEquals(1, partialDenialActivity.permissionRequests.size(), "mixed queue should request camera and microphone");
        assertPermissions(
            partialDenialActivity.permissionRequests.get(0),
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        );

        partialDenialActivity.grantPermission(Manifest.permission.RECORD_AUDIO);
        plugin.onRequestPermissionsResult(
            requestCode,
            new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO },
            new int[] { -1, PackageManager.PERMISSION_GRANTED }
        );

        assertEquals(1, partialDenialActions.size(), "mic-only action should run when camera is denied but microphone is granted");
        assertEquals("mic-only-granted", partialDenialActions.get(0), "mic-only action should not be failed by camera denial");
        assertEquals(1, partialDenialActivity.permissionRequests.size(), "camera denial should not trigger another permission request");
    }

    private static void assertPermissions(String[] actual, String... expected) {
        assertEquals(expected.length, actual.length, "permission count");
        for (int index = 0; index < expected.length; index += 1) {
            assertEquals(expected[index], actual[index], "permission at index " + index);
        }
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!expected.equals(actual)) {
            throw new AssertionError(message + ": expected " + expected + " but got " + actual);
        }
    }
}
`,
    'utf8',
  );
  await execFileAsync('/usr/bin/javac', ['-cp', classesRoot, '-d', classesRoot, permissionQueueTestFile]);
  await execFileAsync('/usr/bin/java', ['-cp', classesRoot, 'PermissionQueueTest']);
});
