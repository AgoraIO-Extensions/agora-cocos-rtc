export type EngineTextureMirrorInput = {
  mirrorMode?: number;
  sourceType?: number;
};

/** Agora VideoSourceType primary camera — the only supported local engine-texture source. */
export const ENGINE_TEXTURE_PRIMARY_CAMERA_SOURCE_TYPE = 0;

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

export function isSupportedEngineTextureLocalSourceType(sourceType?: number): boolean {
  return sourceType === undefined
    || sourceType === ENGINE_TEXTURE_PRIMARY_CAMERA_SOURCE_TYPE;
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
