import {
  AgoraErrorCode,
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
