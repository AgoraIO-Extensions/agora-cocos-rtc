import type { AgoraEngineTextureCameraFacing } from '../types.ts';

export const VIDEO_ENCODER_MIRROR_MODE_AUTO = 0;
export const VIDEO_ENCODER_MIRROR_MODE_ENABLED = 1;
export const VIDEO_ENCODER_MIRROR_MODE_DISABLED = 2;

export function resolveEngineEncoderMirrorMode(
  facing: AgoraEngineTextureCameraFacing,
  mirrorMode?: number,
): number {
  if (mirrorMode !== undefined) {
    return mirrorMode;
  }
  return facing === 'front'
    ? VIDEO_ENCODER_MIRROR_MODE_DISABLED
    : VIDEO_ENCODER_MIRROR_MODE_ENABLED;
}
