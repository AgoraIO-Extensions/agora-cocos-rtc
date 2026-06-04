export type AgoraExampleRuntimeConfig = {
  appId?: string;
  token?: string;
  channelId?: string;
  uid?: number;
  renderBackend?: 'surface-view' | 'texture-view' | 'engine-texture';
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
  const renderBackend = buildConfig?.renderBackend ?? baseConfig?.renderBackend;

  return {
    appId,
    channelId,
    token,
    uid,
    renderBackend,
  };
}
