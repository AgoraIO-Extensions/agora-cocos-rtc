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

async function readEngineTextureLimits(filePath: string) {
  const content = await readFile(filePath, 'utf8');
  const frameIntervalMatch = content.match(/FRAME_INTERVAL_MS = (\d+)L;/);
  const remoteWidthMatch = content.match(/REMOTE_TARGET_WIDTH = (\d+);/);
  const remoteHeightMatch = content.match(/REMOTE_TARGET_HEIGHT = (\d+);/);
  const localWidthMatch = content.match(/LOCAL_TARGET_WIDTH = (\d+);/);
  const localHeightMatch = content.match(/LOCAL_TARGET_HEIGHT = (\d+);/);

  assert.ok(frameIntervalMatch, `Missing FRAME_INTERVAL_MS in ${filePath}`);
  assert.ok(remoteWidthMatch, `Missing REMOTE_TARGET_WIDTH in ${filePath}`);
  assert.ok(remoteHeightMatch, `Missing REMOTE_TARGET_HEIGHT in ${filePath}`);
  assert.ok(localWidthMatch, `Missing LOCAL_TARGET_WIDTH in ${filePath}`);
  assert.ok(localHeightMatch, `Missing LOCAL_TARGET_HEIGHT in ${filePath}`);

  return {
    frameIntervalMs: Number(frameIntervalMatch[1]),
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
    templateLimits.frameIntervalMs <= 100,
    `Expected FRAME_INTERVAL_MS <= 100, got ${templateLimits.frameIntervalMs}`,
  );
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
  assert.match(slotBridgeContent, /nativeCreateSlot/);
  assert.match(slotBridgeContent, /nativeUpdateSlot/);
  assert.match(slotBridgeContent, /nativeReleaseSlot/);
  assert.match(iosSlotBridgeContent, /create_agora_engine_texture_slot/);
  assert.match(iosSlotBridgeContent, /update_agora_engine_texture_slot/);
  assert.match(iosSlotBridgeContent, /release_agora_engine_texture_slot/);
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
  assert.match(bridgeContent, /stopEffect/);
  assert.match(bridgeContent, /dispatchUnsupported\(requestId, "setDefaultAudioRouteToSpeakerphone"\)/);
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
  assert.match(bridgeContent, /stats != null \? stats\.totalDuration : 0/);
  assert.match(bridgeContent, /onRtcStats/);
  assert.match(bridgeContent, /dispatchEvent\("rtcStats"/);
  assert.match(bridgeContent, /onRejoinChannelSuccess/);
  assert.match(bridgeContent, /dispatchEvent\("rejoinChannelSuccess"/);
  assert.match(bridgeContent, /onConnectionInterrupted/);
  assert.match(bridgeContent, /dispatchEvent\("connectionInterrupted"/);
  assert.match(bridgeContent, /onConnectionStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("connectionStateChanged"/);
  assert.match(bridgeContent, /onRemoteVideoStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("remoteVideoStateChanged"/);
  assert.match(bridgeContent, /onLocalVideoStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("localVideoStateChanged"/);
  assert.match(bridgeContent, /onAudioMixingFinished/);
  assert.match(bridgeContent, /dispatchEvent\("audioMixingFinished"/);
  assert.match(bridgeContent, /onAudioMixingStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("audioMixingStateChanged"/);
  assert.match(bridgeContent, /onContentInspectResult/);
  assert.match(bridgeContent, /dispatchEvent\("contentInspectResult"/);
  assert.match(bridgeContent, /onAudioVolumeIndication/);
  assert.match(bridgeContent, /dispatchEvent\("volumeIndication"/);
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
  assert.match(scriptContent, /ensure_app_delegate_attaches_bridge/);
  assert.match(scriptContent, /\[\[AgoraRtcPlugin sharedInstance\] attachBridge\]/);
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
  await mkdir(path.join(srcRoot, 'android/app'), { recursive: true });
  await mkdir(path.join(srcRoot, 'android/content'), { recursive: true });
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
    public String optString(String key) { return ""; }
    public String optString(String key, String defaultValue) { return defaultValue; }
    public JSONObject optJSONObject(String key) { return null; }
    public int optInt(String key) { return 0; }
    public int optInt(String key, int defaultValue) { return defaultValue; }
    public double optDouble(String key, double defaultValue) { return defaultValue; }
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
    path.join(srcRoot, 'android/app/Activity.java'),
    `package android.app;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;

public class Activity extends Context {
    public void runOnUiThread(Runnable runnable) {
        runnable.run();
    }

    public void addContentView(View view, ViewGroup.LayoutParams params) {}
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
    public static Activity getActivity() { return new Activity(); }
    public static Context getContext() { return new Context(); }
}
`,
    'utf8',
  );

  await writeFile(
    path.join(srcRoot, 'io/agora/base/VideoFrame.java'),
    `package io.agora.base;

public class VideoFrame {
    public interface Buffer {
        int getWidth();
        int getHeight();
        I420Buffer toI420();
        Buffer cropAndScale(int x, int y, int width, int height, int scaledWidth, int scaledHeight);
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
        public int rxKBitRate;
        public int users;
        public int txPacketLossRate;
        public int rxPacketLossRate;
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

public class ChannelMediaOptions {}
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
        VIDEO_MODULE_POSITION_PRE_RENDERER
    }
}
`,
    'utf8',
  );

  await mkdir(path.join(srcRoot, 'io/agora/rtc2/video'), { recursive: true });

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
    public int bitrate;
    public ORIENTATION_MODE orientationMode;

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

    public static void destroy() {}

    public int setLogFilter(int level) { return 0; }
    public int setLogFile(String path) { return 0; }
    public int setChannelProfile(int profile) { return 0; }
    public int setClientRole(int role) { return 0; }
    public void setupLocalVideo(VideoCanvas canvas) {}
    public void setupRemoteVideo(VideoCanvas canvas) {}
    public int joinChannel(String token, String channelId, int uid, ChannelMediaOptions options) { return 0; }
    public void leaveChannel() {}
    public int renewToken(String token) { return 0; }
    public int enableAudio() { return 0; }
    public int disableAudio() { return 0; }
    public int muteLocalAudioStream(boolean muted) { return 0; }
    public int muteRemoteAudioStream(int uid, boolean muted) { return 0; }
    public int muteAllRemoteAudioStreams(boolean muted) { return 0; }
    public int setAudioProfile(int profile, int scenario) { return 0; }
    public int enableAudioVolumeIndication(int interval, int smooth, boolean reportVad) { return 0; }
    public int setDefaultAudioRouteToSpeakerphone(boolean enabled) { return 0; }
    public boolean isSpeakerphoneEnabled() { return true; }
    public int setEnableSpeakerphone(boolean enabled) { return 0; }
    public int adjustPlaybackSignalVolume(int volume) { return 0; }
    public int adjustUserPlaybackSignalVolume(int uid, int volume) { return 0; }
    public int enableVideo() { return 0; }
    public int disableVideo() { return 0; }
    public void enableLocalAudio(boolean enabled) {}
    public void enableLocalVideo(boolean enabled) {}
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
    path.join(srcRoot, 'android/app/Activity.java'),
    path.join(srcRoot, 'android/content/Context.java'),
    path.join(srcRoot, 'android/os/SystemClock.java'),
    path.join(srcRoot, 'android/util/Base64.java'),
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
});
