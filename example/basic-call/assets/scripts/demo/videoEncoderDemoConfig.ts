import type { AgoraVideoEncoderConfiguration } from '../../../extensions/agora-rtc/js/types.ts';

export const SET_VIDEO_ENCODER_CASE_NAME = 'SetVideoEncoderConfiguration';

/** Matches Agora Flutter example `join_channel_video` defaults. */
export const DEMO_VIDEO_ENCODER_DEFAULTS: AgoraVideoEncoderConfiguration = {
  width: 960,
  height: 540,
  frameRate: 15,
  bitrate: 1000,
};

export function mergeVideoEncoderConfiguration(
  partial?: Partial<AgoraVideoEncoderConfiguration>,
): AgoraVideoEncoderConfiguration {
  return {
    ...DEMO_VIDEO_ENCODER_DEFAULTS,
    ...partial,
    width: partial?.width ?? DEMO_VIDEO_ENCODER_DEFAULTS.width,
    height: partial?.height ?? DEMO_VIDEO_ENCODER_DEFAULTS.height,
  };
}

export function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
