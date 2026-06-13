import type { AgoraRtcClient } from '../agora.ts';
import type { AgoraEngineTextureCameraFacing } from '../types.ts';
import { resolveEngineTextureMirror } from './engine_texture_mirror.ts';

type EngineTextureViewState = {
  viewId: string;
  uid?: number;
  mirrorMode?: number;
  sourceType?: number;
  isLocal: boolean;
};

type EngineTextureClientState = {
  localCameraFacing: AgoraEngineTextureCameraFacing;
};

const engineTextureClientStates = new WeakMap<AgoraRtcClient, EngineTextureClientState>();

function getEngineTextureClientState(client: AgoraRtcClient): EngineTextureClientState {
  const existingState = engineTextureClientStates.get(client);
  if (existingState) {
    return existingState;
  }

  const state: EngineTextureClientState = {
    localCameraFacing: 'front',
  };

  const originalSwitchCamera = client.switchCamera.bind(client);
  client.switchCamera = async () => {
    await originalSwitchCamera();
    state.localCameraFacing = state.localCameraFacing === 'front' ? 'rear' : 'front';
  };

  engineTextureClientStates.set(client, state);
  return state;
}

export class AgoraEngineTextureViewController {
  #clientState: EngineTextureClientState;
  #views = new Map<string, EngineTextureViewState>();

  constructor(client: AgoraRtcClient) {
    this.#clientState = getEngineTextureClientState(client);
  }

  registerLocalView(view: Omit<EngineTextureViewState, 'isLocal'>): void {
    this.#views.set(view.viewId, { ...view, isLocal: true });
  }

  registerRemoteView(view: Omit<EngineTextureViewState, 'isLocal'>): void {
    this.#views.set(view.viewId, { ...view, isLocal: false });
  }

  unregisterView(viewId: string): void {
    this.#views.delete(viewId);
  }

  setLocalCameraFacing(facing: AgoraEngineTextureCameraFacing): void {
    this.#clientState.localCameraFacing = facing;
  }

  getLocalCameraFacing(): AgoraEngineTextureCameraFacing {
    return this.#clientState.localCameraFacing;
  }

  getViewMirror(viewId: string): boolean {
    const view = this.#views.get(viewId);
    if (!view) {
      return false;
    }
    return resolveEngineTextureMirror({
      mirrorMode: view.mirrorMode,
      isLocal: view.isLocal,
      isFrontCamera: this.#clientState.localCameraFacing === 'front',
      sourceType: view.sourceType,
    });
  }
}
