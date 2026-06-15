import { AgoraVideoSourceType } from '../source_types.ts';

export type EngineTextureMirrorInput = {
  mirrorMode?: number;
  sourceType?: number;
  videoSourceType?: number;
};

/** @deprecated Use {@link AgoraVideoSourceType.Camera}. */
export const ENGINE_TEXTURE_PRIMARY_CAMERA_SOURCE_TYPE = AgoraVideoSourceType.Camera;

const MIRROR_MODE_AUTO = 0;
const MIRROR_MODE_DISABLED = 2;

export function isScreenLikeVideoSource(sourceType?: number): boolean {
  return sourceType === AgoraVideoSourceType.ScreenPrimary
    || sourceType === AgoraVideoSourceType.ScreenSecondary
    || sourceType === AgoraVideoSourceType.Transcoded;
}

export function isSupportedEngineTextureLocalSourceType(sourceType?: number): boolean {
  return sourceType === undefined
    || sourceType === AgoraVideoSourceType.Camera;
}

/**
 * Flutter Texture path: mirror on the view (Transform.scale), not on the texture.
 * Mirrors when mirrorMode is AUTO/ENABLED; disabled for DISABLED and screen-like sources.
 */
export function resolveEngineTextureMirror(input: EngineTextureMirrorInput): boolean {
  const mirrorMode = input.mirrorMode ?? MIRROR_MODE_AUTO;
  const sourceType = input.videoSourceType ?? input.sourceType;

  if (mirrorMode === MIRROR_MODE_DISABLED) {
    return false;
  }
  if (isScreenLikeVideoSource(sourceType)) {
    return false;
  }
  return true;
}
