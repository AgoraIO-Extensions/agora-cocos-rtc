import {
  AgoraErrorCode,
  BRIDGE_CALLBACK_EVENT,
  BRIDGE_RESPONSE_EVENT,
  type CocosBridgeRuntime,
  type CocosEngineTextureBridge,
  type CocosJsbBridgeTransport,
} from '../types.ts';

let requestCounter = 0;

export class AgoraSdkError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(
    code: AgoraErrorCode | string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AgoraSdkError';
    this.code = code;
    this.details = details;
  }
}

export function createRequestId(): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}`;
  requestCounter += 1;
  return `${randomPart}-${requestCounter}`;
}

/**
 * Determine whether the SDK is running inside a Cocos native runtime.
 *
 * IMPORTANT: this is intentionally written with explicit early returns instead
 * of `runtime?.sys?.isNative ?? (typeof globalJsb !== 'undefined')`.
 * The Cocos build minifier mis-optimizes the `!(a ?? b)` pattern that the
 * latter produces into `a ?? !b`, which inverts the guard on real devices
 * (where `sys.isNative === true`) and makes the native bridge resolve to
 * `null` — surfacing as `AgoraErrorCode.BridgeUnavailable` on initialize/join.
 * Keeping the boolean logic inside a plain function with `=== true/false`
 * checks prevents that mis-optimization.
 */
export function isNativeBridgeRuntime(
  runtime: CocosBridgeRuntime | undefined,
  globalJsb: unknown,
): boolean {
  const explicit = runtime?.sys?.isNative;
  if (explicit === true) {
    return true;
  }
  if (explicit === false) {
    return false;
  }
  return typeof globalJsb !== 'undefined';
}

export function resolveBridgeTransport(
  runtime?: CocosBridgeRuntime,
): CocosJsbBridgeTransport | null {
  const globalJsb = (globalThis as any).jsb;
  if (!isNativeBridgeRuntime(runtime, globalJsb)) {
    return null;
  }

  return (
    runtime?.native?.jsbBridgeWrapper ??
    globalJsb?.jsbBridgeWrapper ??
    null
  );
}

export function resolveEngineTextureBridge(
  runtime?: CocosBridgeRuntime,
): CocosEngineTextureBridge | null {
  const globalJsb = (globalThis as any).jsb;
  if (!isNativeBridgeRuntime(runtime, globalJsb)) {
    return null;
  }

  return (
    runtime?.native?.agoraEngineTexture ??
    globalJsb?.agoraEngineTexture ??
    null
  );
}

/**
 * Transports that already hold a keep-alive sink, so at most one is installed
 * per transport no matter how many clients are created or destroyed.
 */
const keepAliveSinks = new WeakMap<
  CocosJsbBridgeTransport,
  Record<string, (payload: string) => void>
>();

/**
 * Guards against CSD-80081: `agora:event does not exist`.
 *
 * The Cocos engine's JS-side bridge wrapper (`cocos/native-binding/impl.ts`)
 * dispatches native events like this:
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
 * The error fires only when the eventMap has **no key** for the event. Note
 * that `removeNativeEventListener` uses `splice`, so removing the last listener
 * leaves an empty array behind and the key stays present — that path is already
 * silent. The error therefore means native dispatched while the JS side had
 * never registered the key at all, which is what happens when the native
 * `AgoraRtcPlugin` singleton and its live `RtcEngine` outlive the JS VM (scene
 * reload, `game.restart()`, Activity recreation): native keeps calling
 * `dispatchEventToScript` into a fresh VM whose eventMap is empty until a new
 * client attaches.
 *
 * A permanent no-op sink keeps the key present for the whole lifetime of the JS
 * VM, so early or late native dispatches are dropped silently instead of
 * spamming `console.error`. Real listeners are appended after this sink and are
 * unaffected.
 */
export function ensureBridgeEventKeepAlive(
  transport: CocosJsbBridgeTransport | null | undefined,
): void {
  if (!transport || keepAliveSinks.has(transport)) {
    return;
  }

  const add =
    typeof transport.addNativeEventListener === 'function'
      ? transport.addNativeEventListener.bind(transport)
      : typeof transport.addScriptEventListener === 'function'
        ? transport.addScriptEventListener.bind(transport)
        : null;

  if (!add) {
    return;
  }

  const sinks: Record<string, (payload: string) => void> = {};
  for (const eventName of [BRIDGE_CALLBACK_EVENT, BRIDGE_RESPONSE_EVENT]) {
    // Intentionally does nothing: its only job is to keep the eventMap key alive.
    const sink = (): void => {};
    sinks[eventName] = sink;
    add(eventName, sink);
  }

  keepAliveSinks.set(transport, sinks);
}
