import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AgoraErrorCode,
  createAgoraEngineTextureViewController,
  createAgoraRtcClient,
  getAgoraEngineTextureBridge,
} from '../sdk/agora-rtc/js/agora.ts';
import {
  resolveEngineTextureMirror,
  isScreenLikeVideoSource,
} from '../sdk/agora-rtc/js/internal/engine_texture_mirror.ts';
import { resolveEngineEncoderMirrorMode } from '../sdk/agora-rtc/js/internal/engine_texture_encoder_mirror.ts';

const sdkTypesSource = readFileSync('sdk/agora-rtc/js/types.ts', 'utf8');

function extractInterfaceContent(interfaceName: string): string {
  const match = sdkTypesSource.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `${interfaceName} should exist in public types`);
  return match[1];
}

function extractInterfaceFields(interfaceName: string): string[] {
  return Array.from(
    extractInterfaceContent(interfaceName).matchAll(/^\s{2}([a-zA-Z]\w+)\??:/gm),
    (entry) => entry[1],
  );
}

function extractNestedInterfaceFields(interfaceName: string, propertyName: string): string[] {
  const content = extractInterfaceContent(interfaceName);
  const propertyIndex = content.indexOf(`${propertyName}?:`);
  assert.ok(propertyIndex >= 0, `${interfaceName}.${propertyName} should exist in public types`);
  const nestedContent = content.slice(propertyIndex);
  return Array.from(nestedContent.matchAll(/^\s{4}([a-zA-Z]\w+)\??:/gm), (entry) => entry[1]);
}

function assertFixtureCoversInterfaceFields(
  interfaceName: string,
  fixture: Record<string, unknown>,
  ignoredFields: string[] = [],
): void {
  const ignored = new Set(ignoredFields);
  const missing = extractInterfaceFields(interfaceName).filter(
    (field) => !ignored.has(field) && !Object.prototype.hasOwnProperty.call(fixture, field),
  );
  assert.deepEqual(missing, [], `${interfaceName} fixture should cover every public field`);
}

function assertFixtureCoversNestedInterfaceFields(
  interfaceName: string,
  propertyName: string,
  fixture: Record<string, unknown>,
): void {
  const missing = extractNestedInterfaceFields(interfaceName, propertyName).filter(
    (field) => !Object.prototype.hasOwnProperty.call(fixture, field),
  );
  assert.deepEqual(missing, [], `${interfaceName}.${propertyName} fixture should cover every public field`);
}

type SentMessage = { eventName: string; payload: string };
type RemovedListener = { eventName: string; listener: (payload: unknown) => void };

class MockTransport {
  sent: SentMessage[] = [];
  listeners = new Map<string, Array<(payload: unknown) => void>>();
  removed: RemovedListener[] = [];

  dispatchEventToNative(eventName, payload) {
    this.sent.push({ eventName, payload });
  }

  addNativeEventListener(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }

  removeNativeEventListener(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? [];
    this.removed.push({ eventName, listener });
    this.listeners.set(
      eventName,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  emit(eventName, payload) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(payload);
    }
  }
}

class MockIosStyleTransport {
  sent: SentMessage[] = [];
  listeners = new Map<string, Array<(payload: unknown) => void>>();
  removed: RemovedListener[] = [];

  dispatchEventToScript(eventName, payload) {
    this.sent.push({ eventName, payload });
  }

  addScriptEventListener(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }

  removeScriptEventListener(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? [];
    this.removed.push({ eventName, listener });
    this.listeners.set(
      eventName,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  emit(eventName, payload) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(payload);
    }
  }
}

test('initialize sends a native bridge request and resolves on matching response', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.initialize('test-app-id');

  assert.equal(transport.sent.length, 1);
  assert.equal(transport.sent[0].eventName, 'agora:request');

  const request = JSON.parse(transport.sent[0].payload);
  assert.equal(request.method, 'initialize');
  assert.deepEqual(request.params, {
    appId: 'test-app-id',
    parameters: '{"rtc.set_app_type":10}',
  });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
      result: null,
    }),
  );

  await pending;
});

test('initialize can dispatch native engine config options', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.initialize({
    appId: 'test-app-id',
    areaCode: 2,
    channelProfile: 1,
    license: 'license-key',
    audioScenario: 3,
    autoRegisterAgoraExtensions: false,
    domainLimit: true,
    threadPriority: 1,
    nativeLibPath: '/sdk/lib',
    extensions: ['agora_ai_noise_suppression'],
    logConfig: {
      filePath: '/tmp/agora.log',
      fileSizeInKB: 2048,
      level: 1,
    },
  });

  const request = JSON.parse(transport.sent[0].payload);
  assert.equal(request.method, 'initialize');
  assert.deepEqual(request.params, {
    appId: 'test-app-id',
    parameters: '{"rtc.set_app_type":10}',
    areaCode: 2,
    channelProfile: 1,
    license: 'license-key',
    audioScenario: 3,
    autoRegisterAgoraExtensions: false,
    domainLimit: true,
    threadPriority: 1,
    nativeLibPath: '/sdk/lib',
    extensions: ['agora_ai_noise_suppression'],
    logConfig: {
      filePath: '/tmp/agora.log',
      fileSizeInKB: 2048,
      level: 1,
    },
  });
  assertFixtureCoversInterfaceFields('AgoraRtcEngineConfig', request.params);
  assertFixtureCoversNestedInterfaceFields(
    'AgoraRtcEngineConfig',
    'logConfig',
    request.params.logConfig,
  );

  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
});

test('client surfaces native rtc events to subscribed listeners', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const joinedUsers = [];

  client.on('userJoined', (payload) => {
    joinedUsers.push(payload.uid);
  });

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'userJoined',
      payload: {
        uid: 42,
      },
    }),
  );

  assert.deepEqual(joinedUsers, [42]);
});

test('client surfaces expanded native rtc callback events to subscribed listeners', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const states = [];
  const stats = [];

  client.on('audioMixingStateChanged', (payload) => {
    states.push(`${payload.state}:${payload.reason}`);
  });
  client.on('rtcStats', (payload) => {
    stats.push(`${payload.duration}:${payload.users}:${payload.txAudioBytes}`);
  });

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'audioMixingStateChanged',
      payload: {
        state: 710,
        reason: 0,
      },
    }),
  );

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'rtcStats',
      payload: {
        duration: 12,
        users: 2,
        txAudioBytes: 34,
      },
    }),
  );

  assert.deepEqual(states, ['710:0']);
  assert.deepEqual(stats, ['12:2:34']);
});

test('public event types expose full stats payload for leaveChannel and rtcStats', () => {
  assert.match(sdkTypesSource, /export interface AgoraRtcStatsPayload \{/);
  assert.match(sdkTypesSource, /leaveChannel:\s*AgoraRtcStatsPayload;/);
  assert.match(sdkTypesSource, /rtcStats:\s*AgoraRtcStatsPayload;/);
});

test('public event types expose optional render backend fallback payload fields', () => {
  assert.match(sdkTypesSource, /renderBackendState:\s*\{/);
  assert.match(sdkTypesSource, /fallbackBackend\?: string;/);
  assert.match(sdkTypesSource, /platform\?: string;/);
});

test('public event types do not expose fake warning callbacks', () => {
  assert.doesNotMatch(sdkTypesSource, /\n\s+warning:\s*\{/);
});

test('video encoder configuration documents platform-specific fields', () => {
  assert.match(
    sdkTypesSource,
    /\/\*\* Android VideoEncoderConfiguration only\. iOS ObjC 4\.5\.3 does not expose minFrameRate\. \*\/\n\s+minFrameRate\?: number;/,
  );
  assert.match(sdkTypesSource, /minBitrate\?: number;/);
});

test('content inspect config exposes module position in the top-level shorthand', () => {
  const contentInspectFields = extractInterfaceContent('AgoraContentInspectConfig');
  assert.match(contentInspectFields, /^\s{2}position\?: number;/m);
});

test('leave channel options expose native rtc fields', () => {
  const leaveChannelFields = extractInterfaceContent('AgoraLeaveChannelOptions');
  assert.match(leaveChannelFields, /^\s{2}stopAudioMixing\?: boolean;/m);
  assert.match(leaveChannelFields, /^\s{2}stopAllEffect\?: boolean;/m);
  assert.match(leaveChannelFields, /^\s{2}unloadAllEffect\?: boolean;/m);
  assert.match(leaveChannelFields, /^\s{2}stopMicrophoneRecording\?: boolean;/m);
});

test('public video canvas types keep the old rect alias as a compatibility layer', () => {
  assert.match(sdkTypesSource, /export type AgoraVideoViewRect = AgoraRtcVideoCanvas;/);
});

test('client surfaces error and volume indication events to subscribed listeners', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const errors = [];
  const volumes = [];

  client.on('error', (payload) => {
    errors.push(payload.code);
  });
  client.on('volumeIndication', (payload) => {
    volumes.push(payload.totalVolume);
  });

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'error',
      payload: {
        code: 42,
        message: 'error',
      },
    }),
  );

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'volumeIndication',
      payload: {
        speakers: [{ uid: 42421, volume: 90, vad: 1, voicePitch: 233.0 }],
        totalVolume: 90,
      },
    }),
  );

  assert.deepEqual(errors, [42]);
  assert.deepEqual(volumes, [90]);
});

test('client surfaces remote audio state change events', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const events: Array<string> = [];

  client.on('remoteAudioStateChanged', (payload) => {
    events.push(`${payload.uid}:${payload.state}:${payload.reason}:${payload.elapsed}`);
  });

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'remoteAudioStateChanged',
      payload: {
        uid: 42422,
        state: 2,
        reason: 5,
        elapsed: 123,
      },
    }),
  );

  assert.deepEqual(events, ['42422:2:5:123']);
});

test('engine texture bridge resolves from global jsb namespace', () => {
  const originalJsb = globalThis.jsb;
  const bridge = {
    getTexture(slotId) {
      return { slotId };
    },
  };

  globalThis.jsb = {
    agoraEngineTexture: bridge,
  };

  try {
    assert.equal(getAgoraEngineTextureBridge(), bridge);
  } finally {
    if (originalJsb === undefined) {
      delete globalThis.jsb;
    } else {
      globalThis.jsb = originalJsb;
    }
  }
});

test('client engine texture helpers pass slotId to the native texture bridge', () => {
  const observedTextureSlots: number[] = [];
  const observedReadySlots: number[] = [];
  const client = createAgoraRtcClient({
    bridgeRuntime: {
      native: {
        agoraEngineTexture: {
          getTexture(slotId: number) {
            observedTextureSlots.push(slotId);
            return { slotId };
          },
          isSlotReady(slotId: number) {
            observedReadySlots.push(slotId);
            return slotId === 7;
          },
        },
      },
      sys: {
        isNative: true,
      },
    },
    transport: new MockTransport(),
  });

  assert.deepEqual(client.getEngineTexture(7), { slotId: 7 });
  assert.equal(client.isEngineTextureReady(7), true);
  assert.deepEqual(observedTextureSlots, [7]);
  assert.deepEqual(observedReadySlots, [7]);
});

test('client rejects native failures with an sdk error', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.joinChannel('demo-token', 'demo-channel', 7);
  const request = JSON.parse(transport.sent[0].payload);

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: false,
      error: {
        code: AgoraErrorCode.NativeFailure,
        message: 'joinChannel failed',
        details: {
          agoraCode: -17,
        },
      },
    }),
  );

  await assert.rejects(
    pending,
    (error: { code: string; details: { agoraCode: number } }) =>
      error.code === AgoraErrorCode.NativeFailure &&
      error.details.agoraCode === -17,
  );
});

test('joinChannel dispatches optional channel media options from TypeScript', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.joinChannel('demo-token', 'demo-channel', 42421, {
    clientRoleType: 'broadcaster',
    channelProfile: 'liveBroadcasting',
    publishCameraTrack: true,
    publishMicrophoneTrack: true,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
    enableAudioRecordingOrPlayout: true,
    startPreview: true,
    publishSecondaryCameraTrack: true,
    publishThirdCameraTrack: false,
    publishFourthCameraTrack: false,
    publishScreenCaptureVideo: true,
    publishScreenCaptureAudio: true,
    publishCustomAudioTrack: true,
    publishCustomAudioTrackId: 3,
    publishCustomVideoTrack: true,
    publishEncodedVideoTrack: true,
    publishMediaPlayerAudioTrack: true,
    publishMediaPlayerVideoTrack: true,
    publishTranscodedVideoTrack: true,
    publishMixedAudioTrack: true,
    publishLipSyncTrack: true,
    publishMediaPlayerId: 5,
    audienceLatencyLevel: 1,
    defaultVideoStreamType: 0,
    audioDelayMs: 50,
    mediaPlayerAudioDelayMs: 60,
    sourceType: 1,
    enableBuiltInMediaEncryption: true,
    publishRhythmPlayerTrack: true,
    isInteractiveAudience: true,
    customVideoTrackId: 7,
    isAudioFilterable: false,
    enableMultipath: true,
    uplinkMultipathMode: 1,
    downlinkMultipathMode: 2,
    preferMultipathType: 3,
    token: 'override-token',
    parameters: '{"rtc.video.enabled":true}',
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'joinChannel');
  assert.deepEqual(request.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    uid: 42421,
    options: {
      clientRoleType: 'broadcaster',
      channelProfile: 'liveBroadcasting',
      publishCameraTrack: true,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
      enableAudioRecordingOrPlayout: true,
      startPreview: true,
      publishSecondaryCameraTrack: true,
      publishThirdCameraTrack: false,
      publishFourthCameraTrack: false,
      publishScreenCaptureVideo: true,
      publishScreenCaptureAudio: true,
      publishCustomAudioTrack: true,
      publishCustomAudioTrackId: 3,
      publishCustomVideoTrack: true,
      publishEncodedVideoTrack: true,
      publishMediaPlayerAudioTrack: true,
      publishMediaPlayerVideoTrack: true,
      publishTranscodedVideoTrack: true,
      publishMixedAudioTrack: true,
      publishLipSyncTrack: true,
      publishMediaPlayerId: 5,
      audienceLatencyLevel: 1,
      defaultVideoStreamType: 0,
      audioDelayMs: 50,
      mediaPlayerAudioDelayMs: 60,
      sourceType: 1,
      enableBuiltInMediaEncryption: true,
      publishRhythmPlayerTrack: true,
      isInteractiveAudience: true,
      customVideoTrackId: 7,
      isAudioFilterable: false,
      enableMultipath: true,
      uplinkMultipathMode: 1,
      downlinkMultipathMode: 2,
      preferMultipathType: 3,
      token: 'override-token',
      parameters: '{"rtc.video.enabled":true}',
    },
  });
  assertFixtureCoversInterfaceFields('AgoraChannelMediaOptions', request.params.options);

  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
});

test('joinChannel keeps the existing payload when options are omitted', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.joinChannel('demo-token', 'demo-channel', 7);
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'joinChannel');
  assert.deepEqual(request.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    uid: 7,
  });

  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
});

test('joinChannelWithUserAccount keeps the existing payload when options are omitted', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.joinChannelWithUserAccount('demo-token', 'demo-channel', 'user-7');
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'joinChannelWithUserAccount');
  assert.deepEqual(request.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    userAccount: 'user-7',
  });

  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
});

test('client preserves native validation error details for bad api calls', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setRenderBackend('bad-backend' as any);
  const request = JSON.parse(transport.sent[0].payload);

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: false,
      error: {
        code: 'invalid_argument',
        message: 'Unsupported render backend: bad-backend',
        details: {
          method: 'setRenderBackend',
          backend: 'bad-backend',
        },
      },
    }),
  );

  await assert.rejects(
    pending,
    (error: { code: string; message: string; details: Record<string, unknown> }) =>
      error.code === 'invalid_argument' &&
      error.message === 'Unsupported render backend: bad-backend' &&
      error.details.method === 'setRenderBackend' &&
      error.details.backend === 'bad-backend',
  );
});

test('client dispatches string uid account APIs through the native bridge', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const joinOptions = {
    clientRoleType: 'broadcaster' as const,
    publishCameraTrack: false,
    publishMicrophoneTrack: false,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
  };
  const joinPending = client.joinChannelWithUserAccount(
    'demo-token',
    'demo-channel',
    'cocos-user-0',
    joinOptions,
  );
  const joinRequest = JSON.parse(transport.sent[0].payload);
  assert.equal(joinRequest.method, 'joinChannelWithUserAccount');
  assert.deepEqual(joinRequest.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    userAccount: 'cocos-user-0',
    options: joinOptions,
  });
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: joinRequest.requestId,
      ok: true,
    }),
  );
  await joinPending;

  const infoPending = client.getUserInfoByUserAccount('cocos-user-0');
  const infoRequest = JSON.parse(transport.sent[1].payload);
  assert.equal(infoRequest.method, 'getUserInfoByUserAccount');
  assert.deepEqual(infoRequest.params, {
    userAccount: 'cocos-user-0',
  });
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: infoRequest.requestId,
      ok: true,
      result: {
        uid: 42421,
        userAccount: 'cocos-user-0',
      },
    }),
  );
  assert.deepEqual(await infoPending, {
    uid: 42421,
    userAccount: 'cocos-user-0',
  });
});

test('client ignores unknown and malformed native responses without poisoning pending requests', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const observedErrors: string[] = [];
  client.on('error', (payload) => {
    observedErrors.push(payload.message);
  });

  const pending = client.initialize('demo-app-id');
  const request = JSON.parse(transport.sent[0].payload);

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: 'unknown-request-id',
      ok: false,
      error: {
        message: 'late response',
      },
    }),
  );
  transport.emit('agora:response', '{bad json');

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
  assert.equal(observedErrors.length, 1);
  assert.match(observedErrors[0], /Invalid response payload/);
});

test('client isolates malformed events and throwing listeners from later native events', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const observedErrors: string[] = [];
  const joinedUsers: number[] = [];

  client.on('error', (payload) => {
    observedErrors.push(payload.message);
  });
  client.on('userJoined', () => {
    throw new Error('listener failed');
  });
  client.on('userJoined', (payload) => {
    joinedUsers.push(payload.uid);
  });

  assert.doesNotThrow(() => transport.emit('agora:event', '{bad json'));
  assert.doesNotThrow(() =>
    transport.emit(
      'agora:event',
      JSON.stringify({
        eventName: 'userJoined',
        payload: {
          uid: 77,
        },
      }),
    ),
  );

  assert.deepEqual(joinedUsers, [77]);
  assert.equal(observedErrors.length, 2);
  assert.match(observedErrors[0], /Invalid event payload/);
  assert.match(observedErrors[1], /Event listener failed for userJoined/);
});

test('client falls back to global jsbBridgeWrapper when runtime.native omits it', async () => {
  const transport = new MockTransport();
  const originalJsb = globalThis.jsb;
  globalThis.jsb = {
    jsbBridgeWrapper: transport,
  };

  try {
    const client = createAgoraRtcClient({
      bridgeRuntime: {
        native: {},
        sys: {
          isNative: true,
        },
      },
      timeoutMs: 50,
    });

    const pending = client.initialize('fallback-app-id');
    assert.equal(transport.sent.length, 1);
    const request = JSON.parse(transport.sent[0].payload);
    transport.emit(
      'agora:response',
      JSON.stringify({
        requestId: request.requestId,
        ok: true,
      }),
    );
    await pending;
  } finally {
    if (originalJsb === undefined) {
      delete globalThis.jsb;
    } else {
      globalThis.jsb = originalJsb;
    }
  }
});

test('client resolves global jsbBridgeWrapper when no runtime options are supplied', async () => {
  const transport = new MockTransport();
  const originalJsb = globalThis.jsb;
  globalThis.jsb = {
    jsbBridgeWrapper: transport,
  };

  try {
    const client = createAgoraRtcClient({
      timeoutMs: 50,
    });

    const pending = client.initialize('global-bridge-app-id');
    assert.equal(transport.sent.length, 1);
    const request = JSON.parse(transport.sent[0].payload);
    assert.equal(request.method, 'initialize');

    transport.emit(
      'agora:response',
      JSON.stringify({
        requestId: request.requestId,
        ok: true,
      }),
    );

    await pending;
  } finally {
    if (originalJsb === undefined) {
      delete globalThis.jsb;
    } else {
      globalThis.jsb = originalJsb;
    }
  }
});

test('client supports ios jsb bridge wrapper method names', async () => {
  const transport = new MockIosStyleTransport();
  const client = createAgoraRtcClient({
    transport: transport,
    timeoutMs: 50,
  });

  const pending = client.setRenderBackend('engine-texture');

  assert.equal(transport.sent.length, 1);
  assert.equal(transport.sent[0].eventName, 'agora:request');

  const request = JSON.parse(transport.sent[0].payload);
  assert.equal(request.method, 'setRenderBackend');

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
      result: null,
    }),
  );

  await pending;
});

test('client resolves the native bridge lazily when it becomes available after construction', async () => {
  const transport = new MockTransport();
  const originalJsb = globalThis.jsb;

  delete globalThis.jsb;

  try {
    const client = createAgoraRtcClient({
      bridgeRuntime: {
        native: {},
        sys: {
          isNative: true,
        },
      },
      timeoutMs: 50,
    });

    globalThis.jsb = {
      jsbBridgeWrapper: transport,
    };

    const pending = client.initialize('late-bridge-app-id');

    assert.equal(transport.sent.length, 1);
    const request = JSON.parse(transport.sent[0].payload);
    assert.equal(request.method, 'initialize');

    transport.emit(
      'agora:response',
      JSON.stringify({
        requestId: request.requestId,
        ok: true,
      }),
    );

    await pending;
  } finally {
    if (originalJsb === undefined) {
      delete globalThis.jsb;
    } else {
      globalThis.jsb = originalJsb;
    }
  }
});

test('leaveChannel dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.leaveChannel();
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'leaveChannel');
  assert.deepEqual(request.params, {});

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;

  const optionsPending = client.leaveChannel({
    stopAudioMixing: false,
    stopAllEffect: false,
    unloadAllEffect: true,
    stopMicrophoneRecording: false,
  });
  const optionsRequest = JSON.parse(transport.sent[1].payload);
  assert.equal(optionsRequest.method, 'leaveChannel');
  assert.deepEqual(optionsRequest.params, {
    stopAudioMixing: false,
    stopAllEffect: false,
    unloadAllEffect: true,
    stopMicrophoneRecording: false,
  });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: optionsRequest.requestId,
      ok: true,
    }),
  );

  await optionsPending;
});

test('getSdkVersion dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.getSdkVersion();
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'getSdkVersion');
  assert.deepEqual(request.params, {});

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
      result: '4.5.3',
    }),
  );

  await assert.doesNotReject(pending);
});

test('getErrorDescription dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.getErrorDescription(42);
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'getErrorDescription');
  assert.deepEqual(request.params, { code: 42 });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
      result: 'warning description',
    }),
  );

  await assert.doesNotReject(pending);
});

test('isSpeakerphoneEnabled dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.isSpeakerphoneEnabled();
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'isSpeakerphoneEnabled');
  assert.deepEqual(request.params, {});

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
      result: true,
    }),
  );

  await assert.doesNotReject(pending);
});

test('setChannelProfile dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setChannelProfile('liveBroadcasting');
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setChannelProfile');
  assert.deepEqual(request.params, { profile: 'liveBroadcasting' });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('startAudioMixing dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.startAudioMixing({
    path: 'assets/bgm.mp3',
    loopback: false,
    cycle: 1,
    startPos: 0,
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'startAudioMixing');
  assert.deepEqual(request.params, {
    path: 'assets/bgm.mp3',
    loopback: false,
    cycle: 1,
    startPos: 0,
  });
  assertFixtureCoversInterfaceFields('AgoraAudioMixingConfig', request.params);

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('startAudioMixing forwards unknown extra fields without client-side rejection', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.startAudioMixing({
    path: 'audio/demo.mp3',
    loopback: false,
    cycle: 1,
    replace: false,
  } as any);
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'startAudioMixing');
  assert.deepEqual(request.params, {
    path: 'audio/demo.mp3',
    loopback: false,
    cycle: 1,
    replace: false,
  });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('startAudioMixing no longer advertises replace in the public config contract', () => {
  assert.ok(!extractInterfaceFields('AgoraAudioMixingConfig').includes('replace'));
});

test('AudioEffectMixing extra APIs dispatch expected native requests', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  async function expectRequest(
    action: () => Promise<unknown>,
    method: string,
    expectedParams: Record<string, unknown>,
  ) {
    const pending = action();
    const request = JSON.parse(transport.sent.at(-1)!.payload);
    assert.equal(request.method, method);
    assert.deepEqual(request.params, expectedParams);

    transport.emit(
      'agora:response',
      JSON.stringify({
        requestId: request.requestId,
        ok: true,
      }),
    );

    await pending;
  }

  await expectRequest(() => client.pauseEffect(7), 'pauseEffect', { soundId: 7 });
  await expectRequest(() => client.resumeEffect(7), 'resumeEffect', { soundId: 7 });
  await expectRequest(() => client.setEffectsVolume(60), 'setEffectsVolume', { volume: 60 });
  await expectRequest(
    () => client.adjustAudioMixingPublishVolume(70),
    'adjustAudioMixingPublishVolume',
    { volume: 70 },
  );
  await expectRequest(
    () => client.adjustAudioMixingPlayoutVolume(80),
    'adjustAudioMixingPlayoutVolume',
    { volume: 80 },
  );
});

test('enableLocalAudio dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.enableLocalAudio(false);
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'enableLocalAudio');
  assert.deepEqual(request.params, { enabled: false });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('enableLocalVideo dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.enableLocalVideo(true);
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'enableLocalVideo');
  assert.deepEqual(request.params, { enabled: true });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('destroy dispatches the expected native request and detaches listeners', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.destroy();
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'destroy');
  assert.deepEqual(request.params, {});

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
  assert.equal(transport.removed.length, 2);
});

test('setupLocalVideoView dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setupLocalVideoView({
    uid: 0,
    subviewUid: 0,
    x: 10,
    y: 20,
    width: 300,
    height: 400,
    renderMode: 'adaptive',
    mirrorMode: 1,
    setupMode: 1,
    sourceType: 0,
    mediaPlayerId: 7,
    cropArea: { x: 1, y: 2, width: 3, height: 4 },
    backgroundColor: 0x11223344,
    enableAlphaMask: true,
    position: 2,
    textureWidth: 640,
    textureHeight: 360,
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setupLocalVideoView');
  assert.deepEqual(request.params, {
    uid: 0,
    subviewUid: 0,
    x: 10,
    y: 20,
    width: 300,
    height: 400,
    renderMode: 'adaptive',
    mirrorMode: 1,
    setupMode: 1,
    sourceType: 0,
    mediaPlayerId: 7,
    cropArea: { x: 1, y: 2, width: 3, height: 4 },
    backgroundColor: 0x11223344,
    enableAlphaMask: true,
    position: 2,
    textureWidth: 640,
    textureHeight: 360,
  });
  assertFixtureCoversInterfaceFields('AgoraRtcVideoCanvas', request.params, ['displayNode']);

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('setupRemoteVideoView dispatches AgoraRtcVideoCanvas fields to native', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setupRemoteVideoView(42, {
    uid: 99,
    subviewUid: 5,
    x: 30,
    y: 40,
    width: 500,
    height: 600,
    renderMode: 'fit',
    mirrorMode: 2,
    setupMode: 1,
    sourceType: 0,
    mediaPlayerId: 11,
    cropArea: { x: 4, y: 3, width: 2, height: 1 },
    backgroundColor: 0x55667788,
    enableAlphaMask: false,
    position: 4,
    textureWidth: 1280,
    textureHeight: 720,
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setupRemoteVideoView');
  assert.deepEqual(request.params, {
    uid: 42,
    subviewUid: 5,
    x: 30,
    y: 40,
    width: 500,
    height: 600,
    renderMode: 'fit',
    mirrorMode: 2,
    setupMode: 1,
    sourceType: 0,
    mediaPlayerId: 11,
    cropArea: { x: 4, y: 3, width: 2, height: 1 },
    backgroundColor: 0x55667788,
    enableAlphaMask: false,
    position: 4,
    textureWidth: 1280,
    textureHeight: 720,
  });
  assertFixtureCoversInterfaceFields('AgoraRtcVideoCanvas', request.params, ['displayNode']);

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('startPreview and switchCamera dispatch the expected native requests', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const previewPending = client.startPreview();
  const previewRequest = JSON.parse(transport.sent[0].payload);
  assert.equal(previewRequest.method, 'startPreview');
  assert.deepEqual(previewRequest.params, {});
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: previewRequest.requestId,
      ok: true,
    }),
  );
  await previewPending;

  const secondaryPreviewPending = client.startPreview(1);
  const secondaryPreviewRequest = JSON.parse(transport.sent[1].payload);
  assert.equal(secondaryPreviewRequest.method, 'startPreview');
  assert.deepEqual(secondaryPreviewRequest.params, { sourceType: 1 });
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: secondaryPreviewRequest.requestId,
      ok: true,
    }),
  );
  await secondaryPreviewPending;

  const switchPending = client.switchCamera();
  const switchRequest = JSON.parse(transport.sent[2].payload);
  assert.equal(switchRequest.method, 'switchCamera');
  assert.deepEqual(switchRequest.params, {});
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: switchRequest.requestId,
      ok: true,
    }),
  );
  await switchPending;
});

test('engine texture view controller tracks camera facing across switchCamera', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({ transport, timeoutMs: 50 });
  const controller = createAgoraEngineTextureViewController(client);

  assert.equal(controller.getLocalCameraFacing(), 'front');

  const pending = client.switchCamera();
  const request = JSON.parse(transport.sent.at(-1)!.payload);
  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
  controller.setLocalCameraFacing('rear');

  assert.equal(controller.getLocalCameraFacing(), 'rear');
});

test('engine texture view controller shares camera facing across controllers without double wrapping switchCamera', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({ transport, timeoutMs: 50 });
  const firstController = createAgoraEngineTextureViewController(client);
  const secondController = createAgoraEngineTextureViewController(client);

  assert.equal(firstController.getLocalCameraFacing(), 'front');
  assert.equal(secondController.getLocalCameraFacing(), 'front');

  const pending = client.switchCamera();
  const request = JSON.parse(transport.sent.at(-1)!.payload);
  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
  firstController.setLocalCameraFacing('rear');

  assert.equal(firstController.getLocalCameraFacing(), 'rear');
  assert.equal(secondController.getLocalCameraFacing(), 'rear');
});

test('engine texture view controller keeps camera facing unchanged when switchCamera fails', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({ transport, timeoutMs: 50 });
  const controller = createAgoraEngineTextureViewController(client);

  assert.equal(controller.getLocalCameraFacing(), 'front');

  const pending = client.switchCamera();
  const request = JSON.parse(transport.sent.at(-1)!.payload);
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: false,
      error: {
        code: AgoraErrorCode.NativeFailure,
        message: 'switchCamera failed',
      },
    }),
  );

  await assert.rejects(
    pending,
    (error: { code: string; message: string }) =>
      error.code === AgoraErrorCode.NativeFailure &&
      error.message === 'switchCamera failed',
  );
  assert.equal(controller.getLocalCameraFacing(), 'front');
});

test('engine texture view controller mirrors local auto like flutter texture view', () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({ transport, timeoutMs: 50 });
  const controller = createAgoraEngineTextureViewController(client);

  controller.registerLocalView({
    viewId: 'local',
    mirrorMode: 0,
    sourceType: 0,
  });
  assert.equal(controller.getViewMirror('local'), true);

  controller.setLocalCameraFacing('rear');
  assert.equal(controller.getViewMirror('local'), true);
});

test('engine texture view controller mirrors remote auto like flutter texture view', () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({ transport, timeoutMs: 50 });
  const controller = createAgoraEngineTextureViewController(client);

  controller.registerRemoteView({
    viewId: 'remote:42',
    uid: 42,
    mirrorMode: 0,
    sourceType: 0,
  });

  assert.equal(controller.getViewMirror('remote:42'), true);
});

test('setRenderBackend dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setRenderBackend('engine-texture');
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setRenderBackend');
  assert.deepEqual(request.params, {
    backend: 'engine-texture',
  });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('setParameters serializes object payloads before dispatching the native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setParameters({
    'rtc.debug': true,
    nested: {
      bitrate: 1200,
    },
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setParameters');
  assert.deepEqual(request.params, {
    parameters: '{"rtc.debug":true,"nested":{"bitrate":1200},"rtc.set_app_type":10}',
  });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('setParameters overrides a caller-provided rtc.set_app_type with the protected cocos value', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setParameters({
    'rtc.set_app_type': 4,
    'rtc.debug': true,
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setParameters');
  assert.deepEqual(request.params, {
    parameters: '{"rtc.set_app_type":10,"rtc.debug":true}',
  });

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('api smoke flow resolves initialize -> join -> local toggles -> leave -> destroy in sequence', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const observedEvents = [];

  client.on('joinChannelSuccess', (payload) => {
    observedEvents.push(['joinChannelSuccess', payload.channelId, payload.uid]);
  });
  client.on('userJoined', (payload) => {
    observedEvents.push(['userJoined', payload.uid]);
  });
  client.on('userOffline', (payload) => {
    observedEvents.push(['userOffline', payload.uid]);
  });

  const initializePending = client.initialize('demo-app-id');
  let request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );
  await initializePending;

  const joinPending = client.joinChannel('', 'demo', 42421);
  request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'joinChannelSuccess',
      payload: {
        channelId: 'demo',
        uid: 42421,
      },
    }),
  );
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );
  await joinPending;

  const mutePending = client.enableLocalAudio(false);
  request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );
  await mutePending;

  const videoPending = client.enableLocalVideo(true);
  request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );
  await videoPending;

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'userJoined',
      payload: {
        uid: 42422,
      },
    }),
  );
  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'userOffline',
      payload: {
        uid: 42422,
      },
    }),
  );

  const leavePending = client.leaveChannel();
  request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );
  await leavePending;

  const destroyPending = client.destroy();
  request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );
  await destroyPending;

  assert.deepEqual(observedEvents, [
    ['joinChannelSuccess', 'demo', 42421],
    ['userJoined', 42422],
    ['userOffline', 42422],
  ]);
});
test('client dispatches expected native requests for all expanded public APIs', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({ transport, timeoutMs: 50 });

  const testApi = async (method: string, fn: () => Promise<any>, expectedParams: any) => {
    const pending = fn();
    const request = JSON.parse(transport.sent.at(-1).payload);
    assert.equal(request.method, method);
    assert.deepEqual(request.params, expectedParams);
    transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true, result: 100 }));
    return await pending;
  };

  await testApi('setLogFilter', () => client.setLogFilter(15), { level: 15 });
  await testApi('setLogFile', () => client.setLogFile('/path/to/log'), { path: '/path/to/log' });
  const fullVideoEncoderConfig = {
    width: 640,
    height: 360,
    frameRate: 15,
    bitrate: 0,
    minFrameRate: 10,
    minBitrate: 120,
    orientationMode: 1,
    mirrorMode: 2,
    degradationPreference: 1,
    codecType: 2,
    advancedVideoOptions: {
      encodingPreference: 1,
      compressionPreference: 2,
      encodeAlpha: true,
    },
  };
  await testApi(
    'setVideoEncoderConfiguration',
    () => client.setVideoEncoderConfiguration(fullVideoEncoderConfig),
    fullVideoEncoderConfig,
  );
  assertFixtureCoversInterfaceFields('AgoraVideoEncoderConfiguration', fullVideoEncoderConfig);
  assertFixtureCoversNestedInterfaceFields(
    'AgoraVideoEncoderConfiguration',
    'advancedVideoOptions',
    fullVideoEncoderConfig.advancedVideoOptions,
  );
  await testApi('setParameters', () => client.setParameters({ key: 'value' }), { parameters: '{"key":"value","rtc.set_app_type":10}' });
  await testApi('enableVideo', () => client.enableVideo(true), { enabled: true });
  await testApi('muteLocalVideoStream', () => client.muteLocalVideoStream(true), { muted: true });
  await testApi('muteRemoteVideoStream', () => client.muteRemoteVideoStream(123, true), { uid: 123, muted: true });
  await testApi('muteAllRemoteVideoStreams', () => client.muteAllRemoteVideoStreams(true), { muted: true });
  await testApi('enableAudio', () => client.enableAudio(true), { enabled: true });
  await testApi('muteLocalAudioStream', () => client.muteLocalAudioStream(true), { muted: true });
  await testApi('muteRemoteAudioStream', () => client.muteRemoteAudioStream(123, true), { uid: 123, muted: true });
  await testApi('muteAllRemoteAudioStreams', () => client.muteAllRemoteAudioStreams(true), { muted: true });
  await testApi('enableAudioVolumeIndication', () => client.enableAudioVolumeIndication(200, 3, true), { interval: 200, smooth: 3, reportVad: true });
  await testApi('setAudioProfile', () => client.setAudioProfile(0, 1), { profile: 0, scenario: 1 });
  await testApi('setDefaultAudioRouteToSpeakerphone', () => client.setDefaultAudioRouteToSpeakerphone(true), { enabled: true });
  await testApi('setEnableSpeakerphone', () => client.setEnableSpeakerphone(true), { enabled: true });
  await testApi('adjustPlaybackSignalVolume', () => client.adjustPlaybackSignalVolume(50), { volume: 50 });
  await testApi('adjustUserPlaybackSignalVolume', () => client.adjustUserPlaybackSignalVolume(123, 50), { uid: 123, volume: 50 });
  await testApi('setAudioSessionOperationRestriction', () => client.setAudioSessionOperationRestriction(1), { restriction: 1 });
  const clientRoleOptions = { audienceLatencyLevel: 1 };
  await testApi('setClientRole', () => client.setClientRole('audience', clientRoleOptions), { role: 'audience', options: clientRoleOptions });
  assertFixtureCoversInterfaceFields('AgoraClientRoleOptions', clientRoleOptions);

  const fullBeautyOptions = {
    lighteningContrastLevel: 1,
    lighteningLevel: 0.5,
    smoothnessLevel: 0.5,
    rednessLevel: 0.5,
    sharpnessLevel: 0.5,
  };
  await testApi('setBeautyEffectOptions', () => client.setBeautyEffectOptions(true, fullBeautyOptions, 2), { enabled: true, options: fullBeautyOptions, sourceType: 2 });
  assertFixtureCoversInterfaceFields('AgoraBeautyOptions', fullBeautyOptions);

  const fullContentInspectConfig = {
    module: 0,
    interval: 10,
    position: 2,
    extraInfo: 'moderation-extra',
    serverConfig: '{"region":"ap"}',
    modules: [
      { type: 1, interval: 2, position: 1 },
      { type: 3, interval: 5 },
    ],
  };
  await testApi(
    'enableContentInspect',
    () => client.enableContentInspect(true, fullContentInspectConfig),
    { enabled: true, config: fullContentInspectConfig },
  );
  assertFixtureCoversInterfaceFields('AgoraContentInspectConfig', fullContentInspectConfig);
  assertFixtureCoversNestedInterfaceFields(
    'AgoraContentInspectConfig',
    'modules',
    fullContentInspectConfig.modules[0],
  );
  await testApi('pauseAudioMixing', () => client.pauseAudioMixing(), {});
  await testApi('resumeAudioMixing', () => client.resumeAudioMixing(), {});
  await testApi('stopAudioMixing', () => client.stopAudioMixing(), {});
  
  const pos = await testApi('getAudioMixingCurrentPosition', () => client.getAudioMixingCurrentPosition(), {});
  assert.equal(pos, 100);

  await testApi('setAudioMixingPosition', () => client.setAudioMixingPosition(1000), { positionMs: 1000 });
  await testApi('adjustAudioMixingVolume', () => client.adjustAudioMixingVolume(50), { volume: 50 });
  await testApi('preloadEffect', () => client.preloadEffect(1, '/path', 250), { soundId: 1, path: '/path', startPos: 250 });
  const fullPlayEffectConfig = { soundId: 1, path: '/path', loopCount: 1, pitch: 1, pan: 0, gain: 100, publish: false, startPos: 0 };
  await testApi('playEffect', () => client.playEffect(fullPlayEffectConfig), fullPlayEffectConfig);
  assertFixtureCoversInterfaceFields('AgoraPlayEffectConfig', fullPlayEffectConfig);
  await testApi('stopEffect', () => client.stopEffect(1), { soundId: 1 });
  await testApi(
    'updateLocalVideoView',
    () => client.updateLocalVideoView({
      uid: 0,
      subviewUid: 0,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      renderMode: 'fit',
      mirrorMode: 1,
      setupMode: 1,
      sourceType: 0,
      mediaPlayerId: 7,
      cropArea: { x: 1, y: 2, width: 3, height: 4 },
      backgroundColor: 0x11223344,
      enableAlphaMask: true,
      position: 2,
      textureWidth: 640,
      textureHeight: 360,
    }),
    {
      uid: 0,
      subviewUid: 0,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      renderMode: 'fit',
      mirrorMode: 1,
      setupMode: 1,
      sourceType: 0,
      mediaPlayerId: 7,
      cropArea: { x: 1, y: 2, width: 3, height: 4 },
      backgroundColor: 0x11223344,
      enableAlphaMask: true,
      position: 2,
      textureWidth: 640,
      textureHeight: 360,
    },
  );
  await testApi(
    'updateRemoteVideoView',
    () => client.updateRemoteVideoView(123, {
      uid: 999,
      subviewUid: 5,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      renderMode: 'fit',
      mirrorMode: 2,
      setupMode: 1,
      sourceType: 0,
      mediaPlayerId: 11,
      cropArea: { x: 4, y: 3, width: 2, height: 1 },
      backgroundColor: 0x55667788,
      enableAlphaMask: false,
      position: 4,
      textureWidth: 1280,
      textureHeight: 720,
    }),
    {
      uid: 123,
      subviewUid: 5,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      renderMode: 'fit',
      mirrorMode: 2,
      setupMode: 1,
      sourceType: 0,
      mediaPlayerId: 11,
      cropArea: { x: 4, y: 3, width: 2, height: 1 },
      backgroundColor: 0x55667788,
      enableAlphaMask: false,
      position: 4,
      textureWidth: 1280,
      textureHeight: 720,
    },
  );
  await testApi('removeLocalVideoView', () => client.removeLocalVideoView(), {});
  await testApi('removeRemoteVideoView', () => client.removeRemoteVideoView(123), { uid: 123 });
  await testApi('setNativeVideoOverlaySuspended', () => client.setNativeVideoOverlaySuspended(true), { suspended: true });
  await testApi('stopPreview', () => client.stopPreview(1), { sourceType: 1 });
  await testApi('renewToken', () => client.renewToken('token123'), { token: 'token123' });
});

test('playEffect rejects non-integer gain values before bridge dispatch', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  await assert.rejects(
    client.playEffect({
      soundId: 1,
      path: '/path',
      gain: 12.5,
    } as any),
    (error: { code: string; details: Record<string, unknown> }) =>
      error.code === AgoraErrorCode.ProtocolError &&
      error.details.method === 'playEffect' &&
      error.details.parameter === 'gain',
  );
  assert.equal(transport.sent.length, 0);
});

test('engine-texture mirror auto matches flutter texture view semantics', () => {
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 0,
      sourceType: 0,
    }),
    true,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 0,
      sourceType: 0,
    }),
    true,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 0,
      sourceType: 0,
    }),
    true,
  );
});

test('engine-texture mirror explicit modes override auto for local and remote views', () => {
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 1,
      sourceType: 0,
    }),
    true,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 2,
      sourceType: 0,
    }),
    false,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 1,
      sourceType: 0,
    }),
    true,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 2,
      sourceType: 0,
    }),
    false,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 1,
      sourceType: 2,
    }),
    false,
  );
});

test('engine-texture encoder mirror resolves facing-specific defaults', () => {
  assert.equal(resolveEngineEncoderMirrorMode('front'), 2);
  assert.equal(resolveEngineEncoderMirrorMode('rear'), 1);
  assert.equal(resolveEngineEncoderMirrorMode('front', 1), 1);
});

test('engine-texture mirror never mirrors screen-like sources in auto mode', () => {
  assert.equal(isScreenLikeVideoSource(2), true);
  assert.equal(isScreenLikeVideoSource(3), true);
  assert.equal(isScreenLikeVideoSource(10), true);
  assert.equal(isScreenLikeVideoSource(0), false);
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 0,
      sourceType: 2,
    }),
    false,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 0,
      sourceType: 3,
    }),
    false,
  );
  assert.equal(
    resolveEngineTextureMirror({
      mirrorMode: 0,
      sourceType: 10,
    }),
    false,
  );
});
