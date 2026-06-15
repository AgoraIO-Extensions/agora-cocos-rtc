import {
  type Node,
  Sprite,
  SpriteFrame,
  Texture2D,
} from 'cc';

import type { AgoraRtcClient } from '../agora.ts';
import type {
  AgoraCocosDisplayNode,
  AgoraEngineTextureCameraFacing,
  AgoraVideoEncoderConfiguration,
  CocosBridgeRuntime,
} from '../types.ts';
import { resolveEngineTextureBridge } from './bridge.ts';
import { resolveEngineEncoderMirrorMode } from './engine_texture_encoder_mirror.ts';
import { AgoraEngineTextureViewController } from './engine_texture_view.ts';

const LOCAL_VIEW_ID = 'local';
const MAX_TEXTURE_BIND_RETRIES = 600;
const TEXTURE_BIND_RETRY_MS = 100;
const DEFAULT_REMOTE_VIEW_MIRROR_MODE = 2;

type DisplayMirrorScale = {
  x: number;
  y: number;
  z: number;
};

type EngineTextureDisplayState = {
  viewId: string;
  displayNode: Node;
  mirrorMode?: number;
  sourceType?: number;
  isLocal: boolean;
  uid?: number;
  slotId: number | null;
  spriteFrame: SpriteFrame;
};

export class AgoraEngineTextureViewManager {
  #client: AgoraRtcClient;
  #bridgeRuntime?: CocosBridgeRuntime;
  #viewController: AgoraEngineTextureViewController;
  #views = new Map<string, EngineTextureDisplayState>();
  #mirrorBaseScales = new Map<string, DisplayMirrorScale>();
  #textureBindRetryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #listenersAttached = false;

  constructor(client: AgoraRtcClient, bridgeRuntime?: CocosBridgeRuntime) {
    this.#client = client;
    this.#bridgeRuntime = bridgeRuntime;
    this.#viewController = new AgoraEngineTextureViewController(client);
    this.#attachEventListeners();
  }

  getViewController(): AgoraEngineTextureViewController {
    return this.#viewController;
  }

  registerLocalDisplay(options: {
    displayNode: AgoraCocosDisplayNode;
    mirrorMode?: number;
    sourceType?: number;
  }): void {
    const displayNode = options.displayNode as Node;
    this.#registerDisplay({
      viewId: LOCAL_VIEW_ID,
      displayNode,
      mirrorMode: options.mirrorMode ?? 0,
      sourceType: options.sourceType,
      isLocal: true,
    });
    this.#viewController.registerLocalView({
      viewId: LOCAL_VIEW_ID,
      mirrorMode: options.mirrorMode ?? 0,
      sourceType: options.sourceType,
    });
    this.applyDisplayMirror(LOCAL_VIEW_ID);
    this.applyCachedTextureSlot('local');
  }

  registerRemoteDisplay(uid: number, options: {
    displayNode: AgoraCocosDisplayNode;
    mirrorMode?: number;
    sourceType?: number;
  }): void {
    const viewId = this.#remoteViewId(uid);
    const displayNode = options.displayNode as Node;
    const mirrorMode = options.mirrorMode ?? DEFAULT_REMOTE_VIEW_MIRROR_MODE;
    this.#registerDisplay({
      viewId,
      displayNode,
      mirrorMode,
      sourceType: options.sourceType,
      isLocal: false,
      uid,
    });
    this.#viewController.registerRemoteView({
      viewId,
      uid,
      mirrorMode,
      sourceType: options.sourceType,
    });
    this.applyDisplayMirror(viewId);
    this.applyCachedTextureSlot('remote', uid);
  }

  syncLocalDisplayFromCanvas(canvas: {
    displayNode?: AgoraCocosDisplayNode;
    mirrorMode?: number;
    sourceType?: number;
  }): void {
    if (canvas.displayNode) {
      this.registerLocalDisplay({
        displayNode: canvas.displayNode,
        mirrorMode: canvas.mirrorMode,
        sourceType: canvas.sourceType,
      });
      return;
    }
    const view = this.#views.get(LOCAL_VIEW_ID);
    if (!view) {
      return;
    }
    if (canvas.mirrorMode !== undefined) {
      view.mirrorMode = canvas.mirrorMode;
    }
    if (canvas.sourceType !== undefined) {
      view.sourceType = canvas.sourceType;
    }
    this.#viewController.registerLocalView({
      viewId: LOCAL_VIEW_ID,
      mirrorMode: view.mirrorMode ?? 0,
      sourceType: view.sourceType,
    });
    this.applyDisplayMirror(LOCAL_VIEW_ID);
  }

  syncRemoteDisplayFromCanvas(uid: number, canvas: {
    displayNode?: AgoraCocosDisplayNode;
    mirrorMode?: number;
    sourceType?: number;
  }): void {
    const viewId = this.#remoteViewId(uid);
    if (canvas.displayNode) {
      this.registerRemoteDisplay(uid, {
        displayNode: canvas.displayNode,
        mirrorMode: canvas.mirrorMode,
        sourceType: canvas.sourceType,
      });
      return;
    }
    const view = this.#views.get(viewId);
    if (!view) {
      return;
    }
    if (canvas.mirrorMode !== undefined) {
      view.mirrorMode = canvas.mirrorMode;
    }
    if (canvas.sourceType !== undefined) {
      view.sourceType = canvas.sourceType;
    }
    this.#viewController.registerRemoteView({
      viewId,
      uid,
      mirrorMode: view.mirrorMode ?? DEFAULT_REMOTE_VIEW_MIRROR_MODE,
      sourceType: view.sourceType,
    });
    this.applyDisplayMirror(viewId);
  }

  applyCachedTextureSlot(kind: 'local' | 'remote', uid?: number): void {
    const cached = kind === 'local'
      ? this.#client.takeCachedLocalTextureSlot()
      : uid !== undefined
        ? this.#client.takeCachedRemoteTextureSlot(uid)
        : null;
    if (!cached) {
      return;
    }
    const viewId = kind === 'local' ? LOCAL_VIEW_ID : this.#remoteViewId(uid!);
    const view = this.#views.get(viewId);
    if (!view) {
      return;
    }
    view.slotId = cached.slotId;
    this.#bindTextureSlot(viewId, cached.slotId);
  }

  unregisterLocalDisplay(): void {
    this.#unregisterDisplay(LOCAL_VIEW_ID);
    this.#viewController.unregisterView(LOCAL_VIEW_ID);
  }

  unregisterRemoteDisplay(uid: number): void {
    const viewId = this.#remoteViewId(uid);
    this.#unregisterDisplay(viewId);
    this.#viewController.unregisterView(viewId);
  }

  applyDisplayMirror(viewId: string): void {
    const view = this.#views.get(viewId);
    if (!view) {
      return;
    }
    const baseScale = this.#resolveMirrorBaseScale(viewId, view.displayNode);
    const shouldMirror = this.#viewController.getViewMirror(viewId);
    const nextScaleX = shouldMirror ? -baseScale.x : baseScale.x;
    view.displayNode.setScale(nextScaleX, baseScale.y, baseScale.z);
  }

  applyLocalDisplayMirror(): void {
    this.applyDisplayMirror(LOCAL_VIEW_ID);
  }

  getLocalCameraFacing(): AgoraEngineTextureCameraFacing {
    return this.#viewController.getLocalCameraFacing();
  }

  #encoderBase: Partial<AgoraVideoEncoderConfiguration> | null = null;

  async onCameraSwitched(): Promise<void> {
    const facing = this.#viewController.getLocalCameraFacing();
    this.#viewController.setLocalCameraFacing(facing === 'front' ? 'rear' : 'front');
    this.applyLocalDisplayMirror();
    if (this.#encoderBase) {
      await this.applyEncoderConfiguration(this.#encoderBase);
    }
  }

  resolveEncoderConfiguration(
    override?: Partial<AgoraVideoEncoderConfiguration>,
  ): AgoraVideoEncoderConfiguration {
    const base = override as AgoraVideoEncoderConfiguration;
    const facing = this.getLocalCameraFacing();
    return {
      ...base,
      mirrorMode: resolveEngineEncoderMirrorMode(facing, base?.mirrorMode),
    };
  }

  async applyEncoderConfiguration(
    override?: Partial<AgoraVideoEncoderConfiguration>,
  ): Promise<void> {
    if (!override?.width || !override?.height) {
      throw new Error('Video encoder width and height are required.');
    }
    this.#encoderBase = { ...override };
    await this.#client.setVideoEncoderConfiguration(
      this.resolveEncoderConfiguration(override),
    );
  }

  release(): void {
    for (const viewId of [...this.#views.keys()]) {
      this.#unregisterDisplay(viewId);
    }
    this.#clearTextureBindRetries();
  }

  #registerDisplay(state: Omit<EngineTextureDisplayState, 'slotId' | 'spriteFrame'>): void {
    const sprite = this.#resolveSprite(state.displayNode);
    if (!sprite) {
      return;
    }
    this.#views.set(state.viewId, {
      ...state,
      slotId: null,
      spriteFrame: sprite.spriteFrame ?? new SpriteFrame(),
    });
    const registered = this.#views.get(state.viewId);
    if (registered && registered.slotId !== null) {
      this.#bindTextureSlot(state.viewId, registered.slotId);
    }
  }

  #unregisterDisplay(viewId: string): void {
    const view = this.#views.get(viewId);
    if (!view) {
      return;
    }
    this.#resetDisplayMirror(viewId, view.displayNode);
    view.spriteFrame.texture = null;
    const sprite = this.#resolveSprite(view.displayNode);
    if (sprite) {
      sprite.spriteFrame = null;
    }
    this.#clearTextureBindRetriesForView(viewId);
    this.#views.delete(viewId);
  }

  #attachEventListeners(): void {
    if (this.#listenersAttached) {
      return;
    }
    this.#listenersAttached = true;
    this.#client.on('localVideoTextureReady', ({ slotId }) => {
      const view = this.#views.get(LOCAL_VIEW_ID);
      if (!view) {
        return;
      }
      view.slotId = slotId;
      this.#bindTextureSlot(LOCAL_VIEW_ID, slotId);
    });
    this.#client.on('remoteVideoTextureReady', ({ uid, slotId }) => {
      const viewId = this.#remoteViewId(uid);
      const view = this.#views.get(viewId);
      if (!view) {
        return;
      }
      view.slotId = slotId;
      this.#bindTextureSlot(viewId, slotId);
    });
    this.#client.on('localVideoTextureReleased', () => {
      const view = this.#views.get(LOCAL_VIEW_ID);
      if (view) {
        view.slotId = null;
        view.spriteFrame.texture = null;
      }
    });
    this.#client.on('remoteVideoTextureReleased', ({ uid }) => {
      const view = this.#views.get(this.#remoteViewId(uid));
      if (view) {
        view.slotId = null;
        view.spriteFrame.texture = null;
      }
    });
  }

  #bindTextureSlot(viewId: string, slotId: number, retryCount = 0): void {
    const view = this.#views.get(viewId);
    if (!view) {
      return;
    }
    const bridge = resolveEngineTextureBridge(this.#bridgeRuntime);
    if (!bridge) {
      this.#scheduleTextureBindRetry(viewId, slotId, retryCount);
      return;
    }
    const texture = bridge.getTexture(slotId) as Texture2D | null;
    const slotReady = bridge.isSlotReady?.(slotId) ?? texture !== null;
    if (!texture || !slotReady) {
      this.#scheduleTextureBindRetry(viewId, slotId, retryCount);
      return;
    }
    this.#clearTextureBindRetry(viewId, slotId);
    texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    texture.setMipFilter(Texture2D.Filter.NONE);
    texture.setWrapMode(
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
    );
    view.spriteFrame.texture = texture;
    const sprite = this.#resolveSprite(view.displayNode);
    if (sprite) {
      sprite.spriteFrame = view.spriteFrame;
    }
    this.applyDisplayMirror(viewId);
  }

  #scheduleTextureBindRetry(viewId: string, slotId: number, retryCount: number): void {
    const key = `${viewId}:${slotId}`;
    if (this.#textureBindRetryTimers.has(key)) {
      return;
    }
    if (retryCount >= MAX_TEXTURE_BIND_RETRIES) {
      return;
    }
    const timer = setTimeout(() => {
      this.#textureBindRetryTimers.delete(key);
      this.#bindTextureSlot(viewId, slotId, retryCount + 1);
    }, TEXTURE_BIND_RETRY_MS);
    this.#textureBindRetryTimers.set(key, timer);
  }

  #clearTextureBindRetry(viewId: string, slotId: number): void {
    const key = `${viewId}:${slotId}`;
    const timer = this.#textureBindRetryTimers.get(key);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.#textureBindRetryTimers.delete(key);
  }

  #clearTextureBindRetriesForView(viewId: string): void {
    for (const [key, timer] of this.#textureBindRetryTimers.entries()) {
      if (!key.startsWith(`${viewId}:`)) {
        continue;
      }
      clearTimeout(timer);
      this.#textureBindRetryTimers.delete(key);
    }
  }

  #clearTextureBindRetries(): void {
    for (const timer of this.#textureBindRetryTimers.values()) {
      clearTimeout(timer);
    }
    this.#textureBindRetryTimers.clear();
  }

  #resolveSprite(displayNode: Node): Sprite | null {
    const ownSprite = displayNode.getComponent(Sprite);
    if (ownSprite) {
      return ownSprite;
    }
    const videoSpriteChild = displayNode.getChildByName('VideoSprite');
    if (videoSpriteChild) {
      return videoSpriteChild.getComponent(Sprite) ?? null;
    }
    for (const child of displayNode.children) {
      const childSprite = child.getComponent(Sprite);
      if (childSprite) {
        return childSprite;
      }
    }
    return null;
  }

  #resolveMirrorBaseScale(viewId: string, displayNode: Node): DisplayMirrorScale {
    const existingScale = this.#mirrorBaseScales.get(viewId);
    if (existingScale) {
      return existingScale;
    }
    const scale = displayNode.getScale();
    const baseScale = { x: scale.x, y: scale.y, z: scale.z };
    this.#mirrorBaseScales.set(viewId, baseScale);
    return baseScale;
  }

  #resetDisplayMirror(viewId: string, displayNode: Node): void {
    const baseScale = this.#mirrorBaseScales.get(viewId);
    if (baseScale) {
      displayNode.setScale(baseScale.x, baseScale.y, baseScale.z);
    }
    this.#mirrorBaseScales.delete(viewId);
  }

  #remoteViewId(uid: number): string {
    return `remote:${uid}`;
  }
}

export function stripDisplayNodeFromCanvas<T extends { displayNode?: AgoraCocosDisplayNode }>(
  canvas: T,
): Omit<T, 'displayNode'> {
  const { displayNode: _displayNode, ...nativeCanvas } = canvas;
  return nativeCanvas;
}
