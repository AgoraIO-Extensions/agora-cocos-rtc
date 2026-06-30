import type {
  ChannelProfile,
  ClientRole,
  VideoEncoderPresetName,
} from './demo/types.ts';
import type {
  AgoraAudioProfileValue,
  AgoraAudioScenarioValue,
  AgoraAudioMixingConfig,
  AgoraVideoEncoderConfiguration,
  AgoraBeautyOptions,
  AgoraContentInspectConfig,
  AgoraPlayEffectConfig,
  AgoraRtcVideoCanvas,
} from '../../extensions/agora-rtc/js/types.ts';

export type AgoraExampleRuntimeConfig = {
  appId?: string;
  token?: string;
  channelId?: string;
  uid?: number;
  renderBackend?: 'engine-texture';
  autoPreview?: boolean;
  autoJoin?: boolean;
  publishCameraTrack?: boolean;
  publishMicrophoneTrack?: boolean;
  autoSubscribeAudio?: boolean;
  autoSubscribeVideo?: boolean;
  channelProfile?: ChannelProfile;
  clientRole?: ClientRole;
  initialLocalAudioEnabled?: boolean;
  initialLocalAudioMuted?: boolean;
  videoEncoderPresetName?: VideoEncoderPresetName;
  previewSourceType?: number;
  localVideoCanvas?: Partial<AgoraRtcVideoCanvas>;
  remoteVideoCanvas?: Partial<AgoraRtcVideoCanvas>;
  beautyEffectSourceType?: number;
  beautyOptions?: AgoraBeautyOptions;
  contentInspectConfig?: AgoraContentInspectConfig;
  audioVolumeIndication?: {
    interval: number;
    smooth?: number;
    reportVad?: boolean;
  };
  audioProfile?: {
    profile: AgoraAudioProfileValue;
    scenario?: AgoraAudioScenarioValue;
  };
  audioMixing?: AgoraAudioMixingConfig;
  audioMixingSeekPositionMs?: number;
  audioMixingVolume?: number;
  preloadEffect?: {
    soundId: number;
    path: string;
    startPos?: number;
  };
  playEffect?: AgoraPlayEffectConfig;
  logFilter?: number;
  logFilePath?: string;
  debugParameters?: Record<string, unknown>;
  playbackVolume?: number;
  userPlaybackVolume?: number;
  videoEncoderConfiguration?: AgoraVideoEncoderConfiguration;
  beautyDemoOptions?: AgoraBeautyOptions;
  contentInspectDemoConfig?: AgoraContentInspectConfig;
};

export const keyAppId = 'TEST_APP_ID';
export const keyChannelId = 'TEST_CHANNEL_ID';
export const keyToken = 'TEST_TOKEN';

let gConfigOverride: ExampleConfigOverride | undefined;

export class ExampleConfigOverride {
  private readonly overridedConfig = new Map<string, string>();

  static shared() {
    gConfigOverride = gConfigOverride ?? new ExampleConfigOverride();
    return gConfigOverride;
  }

  getAppId() {
    return this.overridedConfig.get(keyAppId) ?? '';
  }

  getChannelId() {
    return this.overridedConfig.get(keyChannelId) ?? '';
  }

  getToken() {
    return this.overridedConfig.get(keyToken) ?? '';
  }

  set(name: string, value: string) {
    this.overridedConfig.set(name, value);
  }
}

function normalizeConfigValue(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>') ? '' : trimmed;
}

function resolveBooleanConfig(
  buildValue: unknown,
  baseValue: unknown,
  defaultValue: boolean,
) {
  if (typeof buildValue === 'boolean') {
    return buildValue;
  }
  if (typeof baseValue === 'boolean') {
    return baseValue;
  }
  return defaultValue;
}

function resolveEnumConfig<T extends string>(
  buildValue: unknown,
  baseValue: unknown,
  allowedValues: readonly T[],
) {
  if (typeof buildValue === 'string' && allowedValues.includes(buildValue as T)) {
    return buildValue as T;
  }
  if (typeof baseValue === 'string' && allowedValues.includes(baseValue as T)) {
    return baseValue as T;
  }
  return undefined;
}

export function resolveAgoraExampleConfig(
  baseConfig: AgoraExampleRuntimeConfig | null | undefined,
  buildConfig?: AgoraExampleRuntimeConfig | null,
): AgoraExampleRuntimeConfig {
  const override = ExampleConfigOverride.shared();
  const appId =
    override.getAppId() || normalizeConfigValue(buildConfig?.appId) || normalizeConfigValue(baseConfig?.appId);
  const channelId =
    override.getChannelId() ||
    normalizeConfigValue(buildConfig?.channelId) ||
    normalizeConfigValue(baseConfig?.channelId);
  const token = override.getToken() || normalizeConfigValue(buildConfig?.token) || normalizeConfigValue(baseConfig?.token);
  const uid = typeof buildConfig?.uid === 'number' ? buildConfig.uid : baseConfig?.uid;
  const renderBackend = 'engine-texture';
  const autoPreview = resolveBooleanConfig(buildConfig?.autoPreview, baseConfig?.autoPreview, true);
  const autoJoin = resolveBooleanConfig(buildConfig?.autoJoin, baseConfig?.autoJoin, false);
  const publishCameraTrack = resolveBooleanConfig(buildConfig?.publishCameraTrack, baseConfig?.publishCameraTrack, true);
  const publishMicrophoneTrack = resolveBooleanConfig(
    buildConfig?.publishMicrophoneTrack,
    baseConfig?.publishMicrophoneTrack,
    true,
  );
  const autoSubscribeAudio = resolveBooleanConfig(buildConfig?.autoSubscribeAudio, baseConfig?.autoSubscribeAudio, true);
  const autoSubscribeVideo = resolveBooleanConfig(buildConfig?.autoSubscribeVideo, baseConfig?.autoSubscribeVideo, true);
  const channelProfile = resolveEnumConfig(
    buildConfig?.channelProfile,
    baseConfig?.channelProfile,
    ['communication', 'liveBroadcasting'] as const,
  );
  const clientRole = resolveEnumConfig(
    buildConfig?.clientRole,
    baseConfig?.clientRole,
    ['broadcaster', 'audience'] as const,
  );
  const initialLocalAudioEnabled = resolveBooleanConfig(
    buildConfig?.initialLocalAudioEnabled,
    baseConfig?.initialLocalAudioEnabled,
    true,
  );
  const initialLocalAudioMuted = resolveBooleanConfig(
    buildConfig?.initialLocalAudioMuted,
    baseConfig?.initialLocalAudioMuted,
    false,
  );
  const videoEncoderPresetName = resolveEnumConfig(
    buildConfig?.videoEncoderPresetName,
    baseConfig?.videoEncoderPresetName,
    ['360p', '540p', '720p'] as const,
  );
  const previewSourceType = typeof buildConfig?.previewSourceType === 'number'
    ? buildConfig.previewSourceType
    : typeof baseConfig?.previewSourceType === 'number'
      ? baseConfig.previewSourceType
      : undefined;
  const localVideoCanvas = buildConfig?.localVideoCanvas ?? baseConfig?.localVideoCanvas;
  const remoteVideoCanvas = buildConfig?.remoteVideoCanvas ?? baseConfig?.remoteVideoCanvas;
  const beautyEffectSourceType = typeof buildConfig?.beautyEffectSourceType === 'number'
    ? buildConfig.beautyEffectSourceType
    : typeof baseConfig?.beautyEffectSourceType === 'number'
      ? baseConfig.beautyEffectSourceType
      : undefined;
  const beautyOptions = buildConfig?.beautyOptions ?? baseConfig?.beautyOptions;
  const contentInspectConfig = buildConfig?.contentInspectConfig ?? baseConfig?.contentInspectConfig;
  const audioVolumeIndication = buildConfig?.audioVolumeIndication ?? baseConfig?.audioVolumeIndication;
  const audioProfile = buildConfig?.audioProfile ?? baseConfig?.audioProfile;
  const audioMixing = buildConfig?.audioMixing ?? baseConfig?.audioMixing;
  const audioMixingSeekPositionMs = typeof buildConfig?.audioMixingSeekPositionMs === 'number'
    ? buildConfig.audioMixingSeekPositionMs
    : typeof baseConfig?.audioMixingSeekPositionMs === 'number'
      ? baseConfig.audioMixingSeekPositionMs
      : undefined;
  const audioMixingVolume = typeof buildConfig?.audioMixingVolume === 'number'
    ? buildConfig.audioMixingVolume
    : typeof baseConfig?.audioMixingVolume === 'number'
      ? baseConfig.audioMixingVolume
      : undefined;
  const preloadEffect = buildConfig?.preloadEffect ?? baseConfig?.preloadEffect;
  const playEffect = buildConfig?.playEffect ?? baseConfig?.playEffect;
  const logFilter = typeof buildConfig?.logFilter === 'number'
    ? buildConfig.logFilter
    : typeof baseConfig?.logFilter === 'number'
      ? baseConfig.logFilter
      : undefined;
  const logFilePath = typeof buildConfig?.logFilePath === 'string'
    ? normalizeConfigValue(buildConfig.logFilePath) || buildConfig.logFilePath
    : typeof baseConfig?.logFilePath === 'string'
      ? normalizeConfigValue(baseConfig.logFilePath) || baseConfig.logFilePath
      : undefined;
  const debugParameters = buildConfig?.debugParameters ?? baseConfig?.debugParameters;
  const playbackVolume = typeof buildConfig?.playbackVolume === 'number'
    ? buildConfig.playbackVolume
    : typeof baseConfig?.playbackVolume === 'number'
      ? baseConfig.playbackVolume
      : undefined;
  const userPlaybackVolume = typeof buildConfig?.userPlaybackVolume === 'number'
    ? buildConfig.userPlaybackVolume
    : typeof baseConfig?.userPlaybackVolume === 'number'
      ? baseConfig.userPlaybackVolume
      : undefined;
  const videoEncoderConfiguration = buildConfig?.videoEncoderConfiguration ?? baseConfig?.videoEncoderConfiguration;
  const beautyDemoOptions = buildConfig?.beautyDemoOptions ?? baseConfig?.beautyDemoOptions;
  const contentInspectDemoConfig = buildConfig?.contentInspectDemoConfig ?? baseConfig?.contentInspectDemoConfig;

  return {
    appId,
    channelId,
    token,
    uid,
    renderBackend,
    autoPreview,
    autoJoin,
    publishCameraTrack,
    publishMicrophoneTrack,
    autoSubscribeAudio,
    autoSubscribeVideo,
    channelProfile,
    clientRole,
    initialLocalAudioEnabled,
    initialLocalAudioMuted,
    videoEncoderPresetName,
    previewSourceType,
    localVideoCanvas,
    remoteVideoCanvas,
    beautyEffectSourceType,
    beautyOptions,
    contentInspectConfig,
    audioVolumeIndication,
    audioProfile,
    audioMixing,
    audioMixingSeekPositionMs,
    audioMixingVolume,
    preloadEffect,
    playEffect,
    logFilter,
    logFilePath,
    debugParameters,
    playbackVolume,
    userPlaybackVolume,
    videoEncoderConfiguration,
    beautyDemoOptions,
    contentInspectDemoConfig,
  };
}
