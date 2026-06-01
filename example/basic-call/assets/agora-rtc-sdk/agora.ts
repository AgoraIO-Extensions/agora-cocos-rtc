import {
  AgoraErrorCode,
  BRIDGE_CALLBACK_EVENT,
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  DEFAULT_TIMEOUT_MS,
  type AgoraAudioMixingConfig,
  type AgoraBeautyOptions,
  type AgoraRenderBackend,
  type AgoraContentInspectConfig,
  type AgoraPlayEffectConfig,
  type AgoraVideoEncoderConfiguration,
  type AgoraVideoViewRect,
  type AgoraBridgeEvent,
  type AgoraBridgeRequest,
  type AgoraBridgeResponse,
  type AgoraEventMap,
  type CocosBridgeRuntime,
  type CocosEngineTextureBridge,
  type CocosJsbBridgeTransport,
} from './types.ts';
import {
  AgoraSdkError,
  createRequestId,
  resolveBridgeTransport,
  resolveEngineTextureBridge,
} from './internal/bridge.ts';

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

type AnyAgoraEventListener = (payload: AgoraEventMap[keyof AgoraEventMap]) => void;

export { AgoraErrorCode, AgoraSdkError };

export type AgoraRtcClientOptions = {
  bridgeRuntime?: CocosBridgeRuntime;
  timeoutMs?: number;
  transport?: CocosJsbBridgeTransport | null;
};

export class AgoraRtcClient {
  #listeners = new Map<keyof AgoraEventMap, Set<AnyAgoraEventListener>>();
  #pending = new Map<string, PendingRequest>();
  #responseListener = (payload: string) => {
    this.#handleResponse(payload);
  };
  #eventListener = (payload: string) => {
    this.#handleEvent(payload);
  };
  #timeoutMs: number;
  #bridgeRuntime?: CocosBridgeRuntime;
  #transport: CocosJsbBridgeTransport | null;
  #transportListenersAttached = false;

  constructor(options: AgoraRtcClientOptions = {}) {
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#bridgeRuntime = options.bridgeRuntime;
    this.#transport = options.transport ?? null;
    this.#attachTransport(
      options.transport ?? resolveBridgeTransport(options.bridgeRuntime),
    );
  }

  on<K extends keyof AgoraEventMap>(
    eventName: K,
    listener: (payload: AgoraEventMap[K]) => void,
  ): () => void {
    const listeners = this.#listeners.get(eventName) ?? new Set<AnyAgoraEventListener>();
    listeners.add(listener as AnyAgoraEventListener);
    this.#listeners.set(eventName, listeners);
    return () => this.off(eventName, listener);
  }

  off<K extends keyof AgoraEventMap>(
    eventName: K,
    listener: (payload: AgoraEventMap[K]) => void,
  ): void {
    this.#listeners.get(eventName)?.delete(listener as AnyAgoraEventListener);
  }

  setRenderBackend(backend: AgoraRenderBackend): Promise<void> {
    return this.#invoke('setRenderBackend', { backend }) as Promise<void>;
  }

  initialize(appId: string): Promise<void> {
    return this.#invoke('initialize', { appId }) as Promise<void>;
  }

  getSdkVersion(): Promise<string> {
    return this.#invoke('getSdkVersion', {}) as Promise<string>;
  }

  getErrorDescription(code: number): Promise<string> {
    return this.#invoke('getErrorDescription', { code }) as Promise<string>;
  }

  setLogFilter(level: number): Promise<void> {
    return this.#invoke('setLogFilter', { level }) as Promise<void>;
  }

  setLogFile(path: string): Promise<void> {
    return this.#invoke('setLogFile', { path }) as Promise<void>;
  }

  setChannelProfile(profile: 'communication' | 'liveBroadcasting'): Promise<void> {
    return this.#invoke('setChannelProfile', { profile }) as Promise<void>;
  }

  setClientRole(role: 'broadcaster' | 'audience'): Promise<void> {
    return this.#invoke('setClientRole', { role }) as Promise<void>;
  }

  joinChannel(token: string, channelId: string, uid: number): Promise<void> {
    return this.#invoke('joinChannel', { token, channelId, uid }) as Promise<void>;
  }

  leaveChannel(): Promise<void> {
    return this.#invoke('leaveChannel', {}) as Promise<void>;
  }

  renewToken(token: string): Promise<void> {
    return this.#invoke('renewToken', { token }) as Promise<void>;
  }

  enableAudio(enabled: boolean): Promise<void> {
    return this.#invoke('enableAudio', { enabled }) as Promise<void>;
  }

  enableLocalAudio(enabled: boolean): Promise<void> {
    return this.#invoke('enableLocalAudio', { enabled }) as Promise<void>;
  }

  muteLocalAudioStream(muted: boolean): Promise<void> {
    return this.#invoke('muteLocalAudioStream', { muted }) as Promise<void>;
  }

  muteRemoteAudioStream(uid: number, muted: boolean): Promise<void> {
    return this.#invoke('muteRemoteAudioStream', { uid, muted }) as Promise<void>;
  }

  muteAllRemoteAudioStreams(muted: boolean): Promise<void> {
    return this.#invoke('muteAllRemoteAudioStreams', { muted }) as Promise<void>;
  }

  setAudioProfile(profile: number, scenario?: number): Promise<void> {
    return this.#invoke('setAudioProfile', { profile, scenario }) as Promise<void>;
  }

  enableAudioVolumeIndication(interval: number, smooth?: number, reportVad?: boolean): Promise<void> {
    return this.#invoke('enableAudioVolumeIndication', { interval, smooth, reportVad }) as Promise<void>;
  }

  setDefaultAudioRouteToSpeakerphone(enabled: boolean): Promise<void> {
    return this.#invoke('setDefaultAudioRouteToSpeakerphone', { enabled }) as Promise<void>;
  }

  setEnableSpeakerphone(enabled: boolean): Promise<void> {
    return this.#invoke('setEnableSpeakerphone', { enabled }) as Promise<void>;
  }

  isSpeakerphoneEnabled(): Promise<boolean> {
    return this.#invoke('isSpeakerphoneEnabled', {}) as Promise<boolean>;
  }

  adjustPlaybackSignalVolume(volume: number): Promise<void> {
    return this.#invoke('adjustPlaybackSignalVolume', { volume }) as Promise<void>;
  }

  adjustUserPlaybackSignalVolume(uid: number, volume: number): Promise<void> {
    return this.#invoke('adjustUserPlaybackSignalVolume', { uid, volume }) as Promise<void>;
  }

  setAudioSessionOperationRestriction(restriction: number): Promise<void> {
    return this.#invoke('setAudioSessionOperationRestriction', { restriction }) as Promise<void>;
  }

  enableVideo(enabled: boolean): Promise<void> {
    return this.#invoke('enableVideo', { enabled }) as Promise<void>;
  }

  enableLocalVideo(enabled: boolean): Promise<void> {
    return this.#invoke('enableLocalVideo', { enabled }) as Promise<void>;
  }

  muteLocalVideoStream(muted: boolean): Promise<void> {
    return this.#invoke('muteLocalVideoStream', { muted }) as Promise<void>;
  }

  muteRemoteVideoStream(uid: number, muted: boolean): Promise<void> {
    return this.#invoke('muteRemoteVideoStream', { uid, muted }) as Promise<void>;
  }

  muteAllRemoteVideoStreams(muted: boolean): Promise<void> {
    return this.#invoke('muteAllRemoteVideoStreams', { muted }) as Promise<void>;
  }

  setVideoEncoderConfiguration(config: AgoraVideoEncoderConfiguration): Promise<void> {
    return this.#invoke('setVideoEncoderConfiguration', { ...config }) as Promise<void>;
  }

  setupLocalVideoView(rect: AgoraVideoViewRect): Promise<void> {
    return this.#invoke('setupLocalVideoView', { ...rect }) as Promise<void>;
  }

  setupRemoteVideoView(uid: number, rect: AgoraVideoViewRect): Promise<void> {
    return this.#invoke('setupRemoteVideoView', { uid, ...rect }) as Promise<void>;
  }

  updateLocalVideoView(rect: AgoraVideoViewRect): Promise<void> {
    return this.#invoke('updateLocalVideoView', { ...rect }) as Promise<void>;
  }

  updateRemoteVideoView(uid: number, rect: AgoraVideoViewRect): Promise<void> {
    return this.#invoke('updateRemoteVideoView', { uid, ...rect }) as Promise<void>;
  }

  removeLocalVideoView(): Promise<void> {
    return this.#invoke('removeLocalVideoView', {}) as Promise<void>;
  }

  removeRemoteVideoView(uid: number): Promise<void> {
    return this.#invoke('removeRemoteVideoView', { uid }) as Promise<void>;
  }

  setNativeVideoOverlaySuspended(suspended: boolean): Promise<void> {
    return this.#invoke('setNativeVideoOverlaySuspended', { suspended }) as Promise<void>;
  }

  startPreview(): Promise<void> {
    return this.#invoke('startPreview', {}) as Promise<void>;
  }

  stopPreview(): Promise<void> {
    return this.#invoke('stopPreview', {}) as Promise<void>;
  }

  switchCamera(): Promise<void> {
    return this.#invoke('switchCamera', {}) as Promise<void>;
  }

  setBeautyEffectOptions(enabled: boolean, options: AgoraBeautyOptions): Promise<void> {
    return this.#invoke('setBeautyEffectOptions', { enabled, options }) as Promise<void>;
  }

  enableContentInspect(enabled: boolean, config?: AgoraContentInspectConfig): Promise<void> {
    return this.#invoke('enableContentInspect', { enabled, config }) as Promise<void>;
  }

  startAudioMixing(config: AgoraAudioMixingConfig): Promise<void> {
    return this.#invoke('startAudioMixing', { ...config }) as Promise<void>;
  }

  pauseAudioMixing(): Promise<void> {
    return this.#invoke('pauseAudioMixing', {}) as Promise<void>;
  }

  resumeAudioMixing(): Promise<void> {
    return this.#invoke('resumeAudioMixing', {}) as Promise<void>;
  }

  stopAudioMixing(): Promise<void> {
    return this.#invoke('stopAudioMixing', {}) as Promise<void>;
  }

  getAudioMixingCurrentPosition(): Promise<number> {
    return this.#invoke('getAudioMixingCurrentPosition', {}) as Promise<number>;
  }

  setAudioMixingPosition(positionMs: number): Promise<void> {
    return this.#invoke('setAudioMixingPosition', { positionMs }) as Promise<void>;
  }

  adjustAudioMixingVolume(volume: number): Promise<void> {
    return this.#invoke('adjustAudioMixingVolume', { volume }) as Promise<void>;
  }

  preloadEffect(soundId: number, path: string): Promise<void> {
    return this.#invoke('preloadEffect', { soundId, path }) as Promise<void>;
  }

  playEffect(config: AgoraPlayEffectConfig): Promise<void> {
    return this.#invoke('playEffect', { ...config }) as Promise<void>;
  }

  stopEffect(soundId: number): Promise<void> {
    return this.#invoke('stopEffect', { soundId }) as Promise<void>;
  }

  setParameters(parameters: string | Record<string, unknown>): Promise<void> {
    return this.#invoke('setParameters', {
      parameters,
    }) as Promise<void>;
  }

  getEngineTexture(slotId: number): unknown | null {
    return resolveEngineTextureBridge(this.#bridgeRuntime)?.getTexture(slotId) ?? null;
  }

  isEngineTextureReady(slotId: number): boolean {
    return resolveEngineTextureBridge(this.#bridgeRuntime)?.isSlotReady?.(slotId) ?? false;
  }

  async destroy(): Promise<void> {
    try {
      await this.#invoke('destroy', {});
    } finally {
      this.#teardown();
    }
  }

  #invoke(method: AgoraBridgeRequest['method'], params: Record<string, unknown>) {
    const transport = this.#resolveTransport();
    if (!transport) {
      return Promise.reject(
        new AgoraSdkError(
          AgoraErrorCode.BridgeUnavailable,
          'Cocos native bridge is unavailable in the current runtime.',
        ),
      );
    }

    const request: AgoraBridgeRequest = {
      requestId: createRequestId(),
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(request.requestId);
        reject(
          new AgoraSdkError(
            AgoraErrorCode.Timeout,
            `Native request timed out: ${method}`,
            { method, requestId: request.requestId },
          ),
        );
      }, this.#timeoutMs);

      this.#pending.set(request.requestId, {
        resolve,
        reject,
        timer,
      });

      if (typeof transport.dispatchEventToNative === 'function') {
        transport.dispatchEventToNative(
          BRIDGE_REQUEST_EVENT,
          JSON.stringify(request),
        );
        return;
      }

      transport.dispatchEventToScript?.(
        BRIDGE_REQUEST_EVENT,
        JSON.stringify(request),
      );
    });
  }

  #handleResponse(payload: string): void {
    let response: AgoraBridgeResponse;

    try {
      response = JSON.parse(payload) as AgoraBridgeResponse;
    } catch (error) {
      this.#emit('error', {
        message: `Invalid response payload: ${String(error)}`,
      });
      return;
    }

    const pending = this.#pending.get(response.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.#pending.delete(response.requestId);

    if (response.ok) {
      pending.resolve(response.result ?? null);
      return;
    }

    pending.reject(
      new AgoraSdkError(
        response.error?.code ?? AgoraErrorCode.NativeFailure,
        response.error?.message ?? 'Native Agora request failed.',
        response.error?.details ?? {},
      ),
    );
  }

  #handleEvent(payload: string): void {
    let event: AgoraBridgeEvent;

    try {
      event = JSON.parse(payload) as AgoraBridgeEvent;
    } catch (error) {
      this.#emit('error', {
        message: `Invalid event payload: ${String(error)}`,
      });
      return;
    }

    this.#emit(
      event.eventName as keyof AgoraEventMap,
      (event.payload ?? {}) as AgoraEventMap[keyof AgoraEventMap],
    );
  }

  #emit<K extends keyof AgoraEventMap>(eventName: K, payload: AgoraEventMap[K]): void {
    for (const listener of this.#listeners.get(eventName) ?? []) {
      listener(payload as AgoraEventMap[keyof AgoraEventMap]);
    }
  }

  #teardown(): void {
    if (this.#transportListenersAttached) {
      if (typeof this.#transport?.removeNativeEventListener === 'function') {
        this.#transport.removeNativeEventListener(
          BRIDGE_RESPONSE_EVENT,
          this.#responseListener,
        );
        this.#transport.removeNativeEventListener(
          BRIDGE_CALLBACK_EVENT,
          this.#eventListener,
        );
      } else {
        this.#transport?.removeScriptEventListener?.(
          BRIDGE_RESPONSE_EVENT,
          this.#responseListener,
        );
        this.#transport?.removeScriptEventListener?.(
          BRIDGE_CALLBACK_EVENT,
          this.#eventListener,
        );
      }
      this.#transportListenersAttached = false;
    }
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
    }
    this.#pending.clear();
  }

  #resolveTransport(): CocosJsbBridgeTransport | null {
    if (this.#transport) {
      return this.#transport;
    }

    const resolved = resolveBridgeTransport(this.#bridgeRuntime);
    this.#attachTransport(resolved);
    return this.#transport;
  }

  #attachTransport(transport: CocosJsbBridgeTransport | null): void {
    if (!transport || this.#transportListenersAttached) {
      this.#transport = transport ?? this.#transport;
      return;
    }

    this.#transport = transport;
    if (typeof this.#transport.addNativeEventListener === 'function') {
      this.#transport.addNativeEventListener(
        BRIDGE_RESPONSE_EVENT,
        this.#responseListener,
      );
      this.#transport.addNativeEventListener(
        BRIDGE_CALLBACK_EVENT,
        this.#eventListener,
      );
    } else {
      this.#transport.addScriptEventListener?.(
        BRIDGE_RESPONSE_EVENT,
        this.#responseListener,
      );
      this.#transport.addScriptEventListener?.(
        BRIDGE_CALLBACK_EVENT,
        this.#eventListener,
      );
    }
    this.#transportListenersAttached = true;
  }
}

export function createAgoraRtcClient(options: AgoraRtcClientOptions = {}) {
  return new AgoraRtcClient(options);
}

export function getAgoraEngineTextureBridge(
  runtime?: CocosBridgeRuntime,
): CocosEngineTextureBridge | null {
  return resolveEngineTextureBridge(runtime ?? {
    native: (globalThis as any).jsb ? {} : undefined,
    sys: {
      isNative: typeof (globalThis as any).jsb !== 'undefined',
    },
  });
}
