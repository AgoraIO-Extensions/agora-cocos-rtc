/**
 * Native {@link AgoraVideoSourceType} values used by preview, local canvas, and join+startPreview.
 *
 * These map to the iOS `AgoraVideoSourceType` / Android `Constants.VideoSourceType` enums.
 */
export const AgoraVideoSourceType = {
  /** Primary camera — the only source supported for local engine-texture rendering. */
  Camera: 0,
  /** Secondary camera source. */
  CameraSecondary: 1,
  /** Primary screen capture source. */
  ScreenPrimary: 2,
  /** Secondary screen capture source. */
  ScreenSecondary: 3,
  /** Transcoded mixed stream. */
  Transcoded: 10,
} as const;

export type AgoraVideoSourceTypeValue =
  (typeof AgoraVideoSourceType)[keyof typeof AgoraVideoSourceType] | number;

/**
 * Native {@link AgoraMediaSourceType} values used by beauty and related media APIs.
 *
 * These map to the iOS `AgoraMediaSourceType` / Android `Constants.MediaSourceType` enums.
 * They are not interchangeable with {@link AgoraVideoSourceType}.
 */
export const AgoraMediaSourceType = {
  /** Primary camera for beauty/content APIs. */
  PrimaryCamera: 2,
  /** Secondary camera for beauty/content APIs. */
  SecondaryCamera: 3,
} as const;

export type AgoraMediaSourceTypeValue =
  (typeof AgoraMediaSourceType)[keyof typeof AgoraMediaSourceType] | number;

export type VideoSourceTypeInput = {
  videoSourceType?: AgoraVideoSourceTypeValue;
  /** @deprecated Prefer {@link VideoSourceTypeInput.videoSourceType}. */
  sourceType?: AgoraVideoSourceTypeValue;
};

export type MediaSourceTypeInput = {
  mediaSourceType?: AgoraMediaSourceTypeValue;
  /** @deprecated Prefer {@link MediaSourceTypeInput.mediaSourceType}. */
  sourceType?: AgoraMediaSourceTypeValue;
};

export function resolveVideoSourceTypeParam(
  input: VideoSourceTypeInput | undefined,
): AgoraVideoSourceTypeValue | undefined {
  if (input?.videoSourceType !== undefined) {
    return input.videoSourceType;
  }
  return input?.sourceType;
}

export function resolveMediaSourceTypeParam(
  input: MediaSourceTypeInput | undefined,
): AgoraMediaSourceTypeValue | undefined {
  if (input?.mediaSourceType !== undefined) {
    return input.mediaSourceType;
  }
  return input?.sourceType;
}

export function applyVideoSourceTypeBridgeFields<T extends VideoSourceTypeInput>(
  input: T,
): T {
  const resolved = resolveVideoSourceTypeParam(input);
  if (resolved === undefined) {
    return input;
  }
  return {
    ...input,
    videoSourceType: resolved,
    sourceType: resolved,
  };
}

export function withVideoSourceTypeBridgeParams(
  videoSourceType: AgoraVideoSourceTypeValue,
): { videoSourceType: AgoraVideoSourceTypeValue; sourceType: AgoraVideoSourceTypeValue } {
  return {
    videoSourceType,
    sourceType: videoSourceType,
  };
}

export function withMediaSourceTypeBridgeParams(
  mediaSourceType: AgoraMediaSourceTypeValue,
): { mediaSourceType: AgoraMediaSourceTypeValue; sourceType: AgoraMediaSourceTypeValue } {
  return {
    mediaSourceType,
    sourceType: mediaSourceType,
  };
}

export function normalizeChannelMediaOptionsForBridge<T extends VideoSourceTypeInput>(
  options: T,
): T {
  return applyVideoSourceTypeBridgeFields(options);
}

export function normalizeVideoSourceTypeFields<T extends VideoSourceTypeInput>(
  input: T,
): T {
  return applyVideoSourceTypeBridgeFields(input);
}
