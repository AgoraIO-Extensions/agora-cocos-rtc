import test from 'node:test';
import assert from 'node:assert/strict';

import { createAgoraRtcClient } from '../sdk/agora-rtc/js/agora.ts';
import { ensureBridgeEventKeepAlive } from '../sdk/agora-rtc/js/internal/bridge.ts';
import {
  BRIDGE_CALLBACK_EVENT,
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
} from '../sdk/agora-rtc/js/types.ts';

/**
 * Regression coverage for CSD-80081 (`agora:event does not exist`).
 *
 * The error string is NOT ours. It comes from the Cocos engine's JS-side bridge
 * wrapper, `cocos/native-binding/impl.ts`:
 *
 *     triggerEvent(eventName, arg) {
 *         const arr = this.eventMap.get(eventName);
 *         if (!arr) {
 *             console.error(`${eventName} does not exist`);
 *             return;
 *         }
 *         arr.map((listener) => listener.call(null, arg));
 *     }
 *
 * Direction is native -> JS: native called `dispatchEventToScript("agora:event")`
 * while the JS-side `eventMap` had no key for it.
 *
 * IMPORTANT mechanism detail, verified against the engine source: the guard is
 * `if (!arr)`, and `removeNativeEventListener` removes a listener with `splice`.
 * So dropping the last listener leaves `[]` behind — a truthy value — and the
 * key REMAINS. That path is silent. The error fires only when the key is
 * genuinely absent from the map, i.e. when the JS VM never registered it.
 *
 * `CocosJsbBridgeWrapperStub` is a behavioural copy of that engine object so
 * these tests exercise the real contract instead of a convenient fake.
 */
class CocosJsbBridgeWrapperStub {
  /** Mirrors the engine's `eventMap`. A missing key is what triggers the error. */
  eventMap = new Map<string, Array<(payload: string) => void>>();
  /** Every `${eventName} does not exist` the engine would have logged. */
  engineErrors: string[] = [];
  /** Requests that reached the native side. */
  sentToNative: Array<{ eventName: string; payload: string }> = [];

  addNativeEventListener(eventName: string, listener: (payload: string) => void): void {
    if (!this.eventMap.get(eventName)) {
      this.eventMap.set(eventName, []);
    }
    const arr = this.eventMap.get(eventName)!;
    if (!arr.includes(listener)) {
      arr.push(listener);
    }
  }

  removeNativeEventListener(eventName: string, listener: (payload: string) => void): boolean {
    const arr = this.eventMap.get(eventName);
    if (!arr) {
      return false;
    }
    for (let i = 0, l = arr.length; i < l; i++) {
      if (arr[i] === listener) {
        arr.splice(i, 1);
        return true;
      }
    }
    return true;
  }

  dispatchEventToNative(eventName: string, payload: string): void {
    this.sentToNative.push({ eventName, payload });
  }

  /** The engine entry point native reaches via `bridge.onNative`. */
  triggerEvent(eventName: string, arg: string): void {
    const arr = this.eventMap.get(eventName);
    if (!arr) {
      this.engineErrors.push(`${eventName} does not exist`);
      return;
    }
    arr.map((listener) => listener.call(null, arg));
  }
}

/**
 * Models the Android `AgoraRtcPlugin` singleton
 * (`native/engine/android/app/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`).
 *
 * Three properties of the real Java code are preserved because they drive the bug:
 *
 *  1. `dispatchEvent()` posts via `CocosHelper.runOnGameThread(...)`, so delivery
 *     to JS is a queued async runnable, not a direct call.
 *  2. The plugin is a `static final` singleton; its `IRtcEngineEventHandler`
 *     stays registered until `RtcEngine.destroy()`, so it outlives any JS VM.
 */
class FakeNativePlugin {
  #wrapper: CocosJsbBridgeWrapperStub;
  #gameThreadQueue: Array<() => void> = [];
  #engineAlive = false;
  constructor(wrapper: CocosJsbBridgeWrapperStub) {
    this.#wrapper = wrapper;
  }

  /** Mirrors `handleInitialize`. */
  initialize(): void {
    this.#engineAlive = true;
  }

  /** Mirrors an `IRtcEngineEventHandler` callback invoking `dispatchEvent(...)`. */
  emitSdkCallback(eventName: string, payload: Record<string, unknown> = {}): void {
    if (!this.#engineAlive) {
      return;
    }
    const event = JSON.stringify({ eventName, payload });
    this.#gameThreadQueue.push(() => {
      this.#wrapper.triggerEvent(BRIDGE_CALLBACK_EVENT, event);
    });
  }

  /** Mirrors `handleDestroy`. */
  handleDestroy(requestId: string): void {
    this.#engineAlive = false;
    this.respondOk(requestId);
  }

  respondOk(requestId: string): void {
    const response = JSON.stringify({ requestId, ok: true, result: null });
    this.#gameThreadQueue.push(() => {
      this.#wrapper.triggerEvent(BRIDGE_RESPONSE_EVENT, response);
    });
  }

  /** Drains the game-thread queue, as Cocos does each frame. */
  drainGameThread(): void {
    while (this.#gameThreadQueue.length > 0) {
      const runnable = this.#gameThreadQueue.shift()!;
      runnable();
    }
  }

  get engineAlive(): boolean {
    return this.#engineAlive;
  }
}

function lastRequestId(wrapper: CocosJsbBridgeWrapperStub): string {
  const last = wrapper.sentToNative.at(-1);
  assert.ok(last, 'expected a request to have been sent to native');
  assert.equal(last.eventName, BRIDGE_REQUEST_EVENT);
  return JSON.parse(last.payload).requestId as string;
}

/** A fresh VM: nothing has registered any bridge listener yet. */
function freshJsVm(): CocosJsbBridgeWrapperStub {
  return new CocosJsbBridgeWrapperStub();
}

// ---------------------------------------------------------------------------
// 1. Mechanism: pin down exactly when the engine logs the error.
// ---------------------------------------------------------------------------

test('engine logs `does not exist` only when the eventMap key is absent', () => {
  const wrapper = freshJsVm();

  // Absent key -> error. This is the CSD-80081 condition.
  wrapper.triggerEvent(BRIDGE_CALLBACK_EVENT, '{}');
  assert.deepEqual(wrapper.engineErrors, ['agora:event does not exist']);

  // Key present but list empty (what removeNativeEventListener leaves behind)
  // -> silent, because `![]` is false.
  const listener = () => {};
  wrapper.addNativeEventListener(BRIDGE_CALLBACK_EVENT, listener);
  wrapper.removeNativeEventListener(BRIDGE_CALLBACK_EVENT, listener);
  assert.equal(wrapper.eventMap.has(BRIDGE_CALLBACK_EVENT), true);
  assert.deepEqual(wrapper.eventMap.get(BRIDGE_CALLBACK_EVENT), []);

  wrapper.triggerEvent(BRIDGE_CALLBACK_EVENT, '{}');
  assert.equal(
    wrapper.engineErrors.length,
    1,
    'an empty-but-present listener array must NOT log; only a missing key does',
  );
});

// ---------------------------------------------------------------------------
// 2. Reproduction of the production failure, and proof the fix removes it.
// ---------------------------------------------------------------------------

/**
 * The real-world trigger: the native singleton's RtcEngine outlives the JS VM
 * (scene reload, `game.restart()`, Activity recreation). Native keeps firing
 * SDK callbacks into a brand-new VM whose eventMap is still empty, because no
 * `AgoraRtcClient` has been constructed yet. Every callback in that window logs
 * the error — which is why it reached top-1 volume for the customer.
 */
test('CSD-80081 reproduction: native dispatch into a fresh JS VM logs the error', () => {
  const wrapper = freshJsVm();
  // Pre-fix native: dispatches unconditionally.
  const native = new FakeNativePlugin(wrapper);
  native.initialize();

  assert.equal(
    wrapper.eventMap.has(BRIDGE_CALLBACK_EVENT),
    false,
    'fresh VM has no agora:event key until something registers one',
  );

  for (let i = 0; i < 5; i++) {
    native.emitSdkCallback('rtcStats', { duration: i });
  }
  native.drainGameThread();

  assert.equal(wrapper.engineErrors.length, 5, 'each dispatch in the gap logs the error');
  assert.deepEqual(new Set(wrapper.engineErrors), new Set(['agora:event does not exist']));
});

test('FIX: keep-alive sink installed at SDK load silences dispatch into a fresh VM', () => {
  const wrapper = freshJsVm();
  const native = new FakeNativePlugin(wrapper);

  // This is what the SDK's module-load keep-alive install does, with the
  // transport passed explicitly so the test does not depend on globals.
  ensureBridgeEventKeepAlive(wrapper as never);
  native.initialize();

  assert.equal(
    wrapper.eventMap.has(BRIDGE_CALLBACK_EVENT),
    true,
    'the sink must register the key before any client exists',
  );

  for (let i = 0; i < 5; i++) {
    native.emitSdkCallback('rtcStats', { duration: i });
  }
  native.drainGameThread();

  assert.deepEqual(wrapper.engineErrors, [], 'no CSD-80081 errors after the fix');
});

test('FIX: key survives a client being destroyed while native still dispatches', async () => {
  const wrapper = freshJsVm();
  const native = new FakeNativePlugin(wrapper);
  const client = createAgoraRtcClient({ transport: wrapper as never });
  native.initialize();

  const destroyPromise = client.destroy();
  native.handleDestroy(lastRequestId(wrapper));
  native.drainGameThread();
  await destroyPromise;

  assert.equal(
    wrapper.eventMap.has(BRIDGE_CALLBACK_EVENT),
    true,
    'destroy() must not delete the eventMap key',
  );

  // A stray late callback from native must stay silent.
  native.initialize();
  native.emitSdkCallback('leaveChannel', {});
  native.drainGameThread();

  assert.deepEqual(wrapper.engineErrors, []);
});

// ---------------------------------------------------------------------------
// 3. The fix must not break normal event delivery.
// ---------------------------------------------------------------------------

test('FIX does not disturb real event delivery or ordering', () => {
  const wrapper = freshJsVm();
  const native = new FakeNativePlugin(wrapper);
  const client = createAgoraRtcClient({ transport: wrapper as never });
  native.initialize();

  const received: Array<Record<string, unknown>> = [];
  client.on('rtcStats', (payload) => {
    received.push(payload as Record<string, unknown>);
  });

  native.emitSdkCallback('rtcStats', { duration: 1 });
  native.emitSdkCallback('rtcStats', { duration: 2 });
  native.drainGameThread();

  assert.equal(received.length, 2, 'listeners still fire with the sink installed');
  assert.deepEqual(
    received.map((entry) => entry.duration),
    [1, 2],
    'ordering is preserved',
  );
  assert.deepEqual(wrapper.engineErrors, []);
});

test('FIX: sink is installed at most once per transport', () => {
  const wrapper = freshJsVm();

  ensureBridgeEventKeepAlive(wrapper as never);
  ensureBridgeEventKeepAlive(wrapper as never);
  ensureBridgeEventKeepAlive(wrapper as never);
  createAgoraRtcClient({ transport: wrapper as never });
  createAgoraRtcClient({ transport: wrapper as never });

  const callbackListeners = wrapper.eventMap.get(BRIDGE_CALLBACK_EVENT) ?? [];
  const responseListeners = wrapper.eventMap.get(BRIDGE_RESPONSE_EVENT) ?? [];

  // 1 sink + 1 listener per client.
  assert.equal(callbackListeners.length, 3, 'exactly one sink plus one listener per client');
  assert.equal(responseListeners.length, 3);
});

test('FIX: request/response round trip still resolves after the sink is installed', async () => {
  const wrapper = freshJsVm();
  const native = new FakeNativePlugin(wrapper);
  const client = createAgoraRtcClient({ transport: wrapper as never });

  const pending = client.getSdkVersion();
  native.respondOk(lastRequestId(wrapper));
  native.drainGameThread();

  await pending;
  assert.deepEqual(wrapper.engineErrors, []);
});

test('keep-alive install is safe off-device and idempotent', () => {
  // Importing the SDK in Node already ran the module-load install with no native
  // transport resolvable; reaching this line at all proves it did not throw.
  assert.doesNotThrow(() => ensureBridgeEventKeepAlive(null));
  assert.doesNotThrow(() => ensureBridgeEventKeepAlive(undefined));
  // A transport exposing neither add API must also be tolerated.
  assert.doesNotThrow(() => ensureBridgeEventKeepAlive({} as never));
});
