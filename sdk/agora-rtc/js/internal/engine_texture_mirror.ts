export type EngineTextureMirrorInput = {
  mirrorMode?: number;
  sourceType?: number;
};

const MIRROR_MODE_AUTO = 0;
const MIRROR_MODE_DISABLED = 2;
const SCREEN_SOURCE_PRIMARY = 2;
const SCREEN_SOURCE_SECONDARY = 3;
const TRANSCODED_SOURCE = 10;

export function isScreenLikeVideoSource(sourceType?: number): boolean {
  return sourceType === SCREEN_SOURCE_PRIMARY
    || sourceType === SCREEN_SOURCE_SECONDARY
    || sourceType === TRANSCODED_SOURCE;
}

/**
 * Flutter Texture path: mirror on the view (Transform.scale), not on the texture.
 * Mirrors when mirrorMode is AUTO/ENABLED; disabled for DISABLED and screen-like sources.
 */
export function resolveEngineTextureMirror(input: EngineTextureMirrorInput): boolean {
  const mirrorMode = input.mirrorMode ?? MIRROR_MODE_AUTO;

  if (mirrorMode === MIRROR_MODE_DISABLED) {
    return false;
  }
  if (isScreenLikeVideoSource(input.sourceType)) {
    return false;
  }
  return true;
}
