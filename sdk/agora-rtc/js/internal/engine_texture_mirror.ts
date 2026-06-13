export type EngineTextureMirrorInput = {
  mirrorMode?: number;
  isLocal: boolean;
  isFrontCamera: boolean;
  sourceType?: number;
};

const MIRROR_MODE_AUTO = 0;
const MIRROR_MODE_ENABLED = 1;
const MIRROR_MODE_DISABLED = 2;
const SCREEN_SOURCE_PRIMARY = 2;
const SCREEN_SOURCE_SECONDARY = 3;
const TRANSCODED_SOURCE = 10;

export function shouldMirrorScreenLikeSource(sourceType?: number): boolean {
  return !(
    sourceType === SCREEN_SOURCE_PRIMARY
    || sourceType === SCREEN_SOURCE_SECONDARY
    || sourceType === TRANSCODED_SOURCE
  );
}

export function resolveEngineTextureMirror(input: EngineTextureMirrorInput): boolean {
  const mirrorMode = input.mirrorMode ?? MIRROR_MODE_AUTO;

  if (!shouldMirrorScreenLikeSource(input.sourceType)) {
    return false;
  }
  if (mirrorMode === MIRROR_MODE_ENABLED) {
    return true;
  }
  if (mirrorMode === MIRROR_MODE_DISABLED) {
    return false;
  }
  if (!input.isLocal) {
    return false;
  }
  return input.isFrontCamera;
}
