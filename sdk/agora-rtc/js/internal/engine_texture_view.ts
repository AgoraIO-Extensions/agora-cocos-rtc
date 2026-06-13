import type { AgoraRtcClient } from '../agora.ts';
import { resolveEngineTextureMirror } from './engine_texture_mirror.ts';

export type EngineTextureCameraFacing = 'front' | 'rear';

type EngineTextureViewState = {
  viewId: string;
  uid?: number;
  mirrorMode?: number;
  sourceType?: number;
  isLocal: boolean;
};

export class AgoraEngineTextureViewController {
  #client: AgoraRtcClient;
  #localCameraFacing: EngineTextureCameraFacing = 'front';
  #views = new Map<string, EngineTextureViewState>();

  constructor(client: AgoraRtcClient) {
    this.#client = client;
    const originalSwitchCamera = client.switchCamera.bind(client);
    client.switchCamera = async () => {
      await originalSwitchCamera();
      this.#localCameraFacing = this.#localCameraFacing === 'front' ? 'rear' : 'front';
    };
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

  setLocalCameraFacing(facing: EngineTextureCameraFacing): void {
    this.#localCameraFacing = facing;
  }

  getLocalCameraFacing(): EngineTextureCameraFacing {
    return this.#localCameraFacing;
  }

  getViewMirror(viewId: string): boolean {
    const view = this.#views.get(viewId);
    if (!view) {
      return false;
    }
    return resolveEngineTextureMirror({
      mirrorMode: view.mirrorMode,
      isLocal: view.isLocal,
      isFrontCamera: this.#localCameraFacing === 'front',
      sourceType: view.sourceType,
    });
  }
}
