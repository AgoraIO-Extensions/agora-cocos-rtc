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

export function resolveBridgeTransport(
  runtime?: CocosBridgeRuntime,
): CocosJsbBridgeTransport | null {
  if (!runtime?.sys?.isNative) {
    return null;
  }

  return (
    runtime.native?.jsbBridgeWrapper ??
    (globalThis as any).jsb?.jsbBridgeWrapper ??
    null
  );
}

export function resolveEngineTextureBridge(
  runtime?: CocosBridgeRuntime,
): CocosEngineTextureBridge | null {
  if (!runtime?.sys?.isNative) {
    return null;
  }

  return (
    runtime.native?.agoraEngineTexture ??
    (globalThis as any).jsb?.agoraEngineTexture ??
    null
  );
}
