import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AgoraErrorCode,
  createAgoraRtcClient,
  getAgoraEngineTextureBridge,
} from '../sdk/agora-rtc/js/agora.ts';

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
  assert.deepEqual(request.params, { appId: 'test-app-id' });

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
    stats.push(`${payload.duration}:${payload.users}`);
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
      },
    }),
  );

  assert.deepEqual(states, ['710:0']);
  assert.deepEqual(stats, ['12:2']);
});

test('client surfaces warning and volume indication events to subscribed listeners', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const warnings = [];
  const volumes = [];

  client.on('warning', (payload) => {
    warnings.push(payload.code);
  });
  client.on('volumeIndication', (payload) => {
    volumes.push(payload.totalVolume);
  });

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'warning',
      payload: {
        code: 42,
        message: 'warning',
      },
    }),
  );

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'volumeIndication',
      payload: {
        speakers: [{ uid: 1001, volume: 90, vad: 1, voicePitch: 233.0 }],
        totalVolume: 90,
      },
    }),
  );

  assert.deepEqual(warnings, [42]);
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
        uid: 2002,
        state: 2,
        reason: 5,
        elapsed: 123,
      },
    }),
  );

  assert.deepEqual(events, ['2002:2:5:123']);
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

  const pending = client.joinChannel('demo-token', 'demo-channel', 1001, {
    clientRoleType: 'broadcaster',
    channelProfile: 'liveBroadcasting',
    publishCameraTrack: true,
    publishMicrophoneTrack: true,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
    enableAudioRecordingOrPlayout: true,
    startPreview: true,
    token: 'override-token',
    parameters: '{"rtc.video.enabled":true}',
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'joinChannel');
  assert.deepEqual(request.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    uid: 1001,
    options: {
      clientRoleType: 'broadcaster',
      channelProfile: 'liveBroadcasting',
      publishCameraTrack: true,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
      enableAudioRecordingOrPlayout: true,
      startPreview: true,
      token: 'override-token',
      parameters: '{"rtc.video.enabled":true}',
    },
  });

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

  const pending = client.setRenderBackend('surface-view');

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

  transport.emit(
    'agora:response',
    JSON.stringify({
      requestId: request.requestId,
      ok: true,
    }),
  );

  await pending;
});

test('startAudioMixing rejects replace because RTC 4.5.3 bridge signatures do not support it', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  await assert.rejects(
    client.startAudioMixing({
      path: 'audio/demo.mp3',
      loopback: false,
      cycle: 1,
      replace: false,
    } as any),
    (error: { code: string; message: string; details: Record<string, unknown> }) =>
      error.code === AgoraErrorCode.ProtocolError &&
      error.message === 'startAudioMixing.replace is not supported by the Agora RTC 4.5.3 native bridge.' &&
      error.details.method === 'startAudioMixing' &&
      error.details.parameter === 'replace',
  );
  assert.equal(transport.sent.length, 0);
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
    x: 10,
    y: 20,
    width: 300,
    height: 400,
    renderMode: 'hidden',
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setupLocalVideoView');
  assert.deepEqual(request.params, {
    x: 10,
    y: 20,
    width: 300,
    height: 400,
    renderMode: 'hidden',
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

test('setupRemoteVideoView dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setupRemoteVideoView(42, {
    x: 30,
    y: 40,
    width: 500,
    height: 600,
    renderMode: 'fit',
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setupRemoteVideoView');
  assert.deepEqual(request.params, {
    uid: 42,
    x: 30,
    y: 40,
    width: 500,
    height: 600,
    renderMode: 'fit',
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

  const switchPending = client.switchCamera();
  const switchRequest = JSON.parse(transport.sent[1].payload);
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

test('setRenderBackend dispatches the expected native request', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.setRenderBackend('texture-view');
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'setRenderBackend');
  assert.deepEqual(request.params, {
    backend: 'texture-view',
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

  const joinPending = client.joinChannel('', 'demo', 1001);
  request = JSON.parse(transport.sent.at(-1).payload);
  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'joinChannelSuccess',
      payload: {
        channelId: 'demo',
        uid: 1001,
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
        uid: 2002,
      },
    }),
  );
  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'userOffline',
      payload: {
        uid: 2002,
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
    ['joinChannelSuccess', 'demo', 1001],
    ['userJoined', 2002],
    ['userOffline', 2002],
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
  await testApi('setVideoEncoderConfiguration', () => client.setVideoEncoderConfiguration({ width: 640, height: 360, frameRate: 15, bitrate: 0 }), { width: 640, height: 360, frameRate: 15, bitrate: 0 });
  await testApi('setParameters', () => client.setParameters('{"key":"value"}'), { parameters: '{"key":"value"}' });
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
  await testApi('setClientRole', () => client.setClientRole('audience'), { role: 'audience' });
  await testApi('setBeautyEffectOptions', () => client.setBeautyEffectOptions(true, { lighteningLevel: 0.5, smoothnessLevel: 0.5, rednessLevel: 0.5, sharpnessLevel: 0.5 }), { enabled: true, options: { lighteningLevel: 0.5, smoothnessLevel: 0.5, rednessLevel: 0.5, sharpnessLevel: 0.5 } });
  await testApi('enableContentInspect', () => client.enableContentInspect(true, {}), { enabled: true, config: {} });
  await testApi('pauseAudioMixing', () => client.pauseAudioMixing(), {});
  await testApi('resumeAudioMixing', () => client.resumeAudioMixing(), {});
  await testApi('stopAudioMixing', () => client.stopAudioMixing(), {});
  
  const pos = await testApi('getAudioMixingCurrentPosition', () => client.getAudioMixingCurrentPosition(), {});
  assert.equal(pos, 100);

  await testApi('setAudioMixingPosition', () => client.setAudioMixingPosition(1000), { positionMs: 1000 });
  await testApi('adjustAudioMixingVolume', () => client.adjustAudioMixingVolume(50), { volume: 50 });
  await testApi('preloadEffect', () => client.preloadEffect(1, '/path'), { soundId: 1, path: '/path' });
  await testApi('playEffect', () => client.playEffect({ soundId: 1, path: '/path', loopCount: 1, pitch: 1, pan: 0, gain: 100, publish: false, startPos: 0 }), { soundId: 1, path: '/path', loopCount: 1, pitch: 1, pan: 0, gain: 100, publish: false, startPos: 0 });
  await testApi('stopEffect', () => client.stopEffect(1), { soundId: 1 });
  await testApi('updateLocalVideoView', () => client.updateLocalVideoView({ x: 0, y: 0, width: 100, height: 100, renderMode: 'fit' }), { x: 0, y: 0, width: 100, height: 100, renderMode: 'fit' });
  await testApi('updateRemoteVideoView', () => client.updateRemoteVideoView(123, { x: 0, y: 0, width: 100, height: 100, renderMode: 'fit' }), { uid: 123, x: 0, y: 0, width: 100, height: 100, renderMode: 'fit' });
  await testApi('removeLocalVideoView', () => client.removeLocalVideoView(), {});
  await testApi('removeRemoteVideoView', () => client.removeRemoteVideoView(123), { uid: 123 });
  await testApi('setNativeVideoOverlaySuspended', () => client.setNativeVideoOverlaySuspended(true), { suspended: true });
  await testApi('stopPreview', () => client.stopPreview(), {});
  await testApi('renewToken', () => client.renewToken('token123'), { token: 'token123' });
});
