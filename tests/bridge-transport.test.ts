import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  isNativeBridgeRuntime,
  resolveBridgeTransport,
  resolveEngineTextureBridge,
} from '../sdk/agora-rtc/js/internal/bridge.ts';

const bridgeSource = readFileSync('sdk/agora-rtc/js/internal/bridge.ts', 'utf8');

// Regression: on a real Cocos native device `sys.isNative === true`. The native
// runtime detection MUST stay true in that case even when the deprecated global
// `jsb` is not visible here. A previous implementation used
// `runtime?.sys?.isNative ?? typeof globalJsb !== 'undefined'` together with
// `if (!isNativeRuntime)`, which the Cocos build minifier mis-optimized from
// `!(a ?? b)` into `a ?? !b`, inverting the guard and making the bridge resolve
// to null (surfacing as AgoraErrorCode.BridgeUnavailable on initialize/join).
test('isNativeBridgeRuntime treats explicit sys.isNative=true as native', () => {
  assert.equal(isNativeBridgeRuntime({ sys: { isNative: true } }, undefined), true);
  assert.equal(isNativeBridgeRuntime({ sys: { isNative: true } }, {}), true);
});

test('isNativeBridgeRuntime treats explicit sys.isNative=false as non-native', () => {
  assert.equal(isNativeBridgeRuntime({ sys: { isNative: false } }, {}), false);
  assert.equal(isNativeBridgeRuntime({ sys: { isNative: false } }, undefined), false);
});

test('isNativeBridgeRuntime falls back to global jsb presence when isNative is undefined', () => {
  assert.equal(isNativeBridgeRuntime(undefined, {}), true);
  assert.equal(isNativeBridgeRuntime({}, {}), true);
  assert.equal(isNativeBridgeRuntime(undefined, undefined), false);
  assert.equal(isNativeBridgeRuntime({}, undefined), false);
});

test('resolveBridgeTransport returns runtime.native.jsbBridgeWrapper on native device', () => {
  const transport = { dispatchEventToNative() {} };
  const resolved = resolveBridgeTransport({
    native: { jsbBridgeWrapper: transport },
    sys: { isNative: true },
  });
  assert.equal(resolved, transport);
});

test('resolveBridgeTransport returns null when runtime is explicitly non-native', () => {
  const transport = { dispatchEventToNative() {} };
  const resolved = resolveBridgeTransport({
    native: { jsbBridgeWrapper: transport },
    sys: { isNative: false },
  });
  assert.equal(resolved, null);
});

test('resolveEngineTextureBridge returns runtime.native.agoraEngineTexture on native device', () => {
  const engineTexture = { getTexture: () => null };
  const resolved = resolveEngineTextureBridge({
    native: { agoraEngineTexture: engineTexture },
    sys: { isNative: true },
  });
  assert.equal(resolved, engineTexture);
});

// Source guard: keep the minifier-safe shape. The native detection must live in
// a dedicated helper with explicit boolean checks and must NOT reintroduce the
// inline `?? typeof globalJsb !== 'undefined'` + `if (!isNativeRuntime)` pattern.
test('bridge source avoids the minifier-unsafe negated nullish pattern', () => {
  assert.match(bridgeSource, /export function isNativeBridgeRuntime\(/);
  assert.ok(
    !bridgeSource.includes("?? typeof globalJsb !== 'undefined'"),
    'must not reintroduce the inline nullish native-runtime guard',
  );
  assert.ok(
    !/if \(!isNativeRuntime\)/.test(bridgeSource),
    'must not negate an inlined `a ?? b` runtime flag',
  );
});
