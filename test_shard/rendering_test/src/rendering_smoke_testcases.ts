export type RenderingSmokeCase = {
  id: string;
  backend: 'engine-texture';
  localRect: {
    uid?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    renderMode: 'hidden' | 'fit' | 'adaptive';
    mirrorMode?: number;
    setupMode?: number;
    sourceType?: number;
    textureWidth?: number;
    textureHeight?: number;
  };
  screenshotName: string;
  requiredEvidence: Array<'backend-state' | 'texture-ready' | 'screenshot'>;
};

export const RENDERING_SMOKE_TESTCASES: RenderingSmokeCase[] = [
  {
    id: 'rendering.engine-texture.local-fit',
    backend: 'engine-texture',
    localRect: {
      uid: 0,
      x: 24,
      y: 32,
      width: 320,
      height: 240,
      renderMode: 'fit',
      mirrorMode: 0,
      setupMode: 0,
      sourceType: 0,
      textureWidth: 320,
      textureHeight: 240,
    },
    screenshotName: 'cocos.engine_texture.local.fit.png',
    requiredEvidence: ['backend-state', 'texture-ready', 'screenshot'],
  },
];
