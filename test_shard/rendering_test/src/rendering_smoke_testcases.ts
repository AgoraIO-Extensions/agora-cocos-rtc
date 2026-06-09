export type RenderingSmokeCase = {
  id: string;
  backend: 'surface-view' | 'texture-view' | 'engine-texture';
  localRect: {
    x: number;
    y: number;
    width: number;
    height: number;
    renderMode: 'hidden' | 'fit';
  };
  screenshotName: string;
  requiredEvidence: Array<'backend-state' | 'texture-ready' | 'screenshot'>;
};

export const RENDERING_SMOKE_TESTCASES: RenderingSmokeCase[] = [
  {
    id: 'rendering.engine-texture.local-fit',
    backend: 'engine-texture',
    localRect: { x: 24, y: 32, width: 320, height: 240, renderMode: 'fit' },
    screenshotName: 'cocos.engine_texture.local.fit.png',
    requiredEvidence: ['backend-state', 'texture-ready', 'screenshot'],
  },
  {
    id: 'rendering.surface-view.local-hidden',
    backend: 'surface-view',
    localRect: { x: 24, y: 32, width: 320, height: 240, renderMode: 'hidden' },
    screenshotName: 'cocos.surface_view.local.hidden.png',
    requiredEvidence: ['backend-state', 'screenshot'],
  },
];
