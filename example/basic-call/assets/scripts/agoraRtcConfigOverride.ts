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
  };
}
