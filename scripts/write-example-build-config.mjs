import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgoraExampleBuildConfig } from '../example/basic-call/assets/scripts/agoraRtcConfigOverride.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baseConfigPath = process.env.AGORA_CONFIG_PATH ||
  path.join(repoRoot, 'example/basic-call/assets/resources/agora-config.json');
const buildConfigPath = process.env.AGORA_BUILD_CONFIG_PATH ||
  path.join(repoRoot, 'example/basic-call/assets/resources/agora-config.build.json');
const buildConfigMetaPath = `${buildConfigPath}.meta`;

function parseOptionalBoolean(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  console.error(`${name} must be a boolean value.`);
  process.exit(1);
}

function parseOptionalInteger(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    console.error(`${name} must be a non-negative integer.`);
    process.exit(1);
  }
  return parsed;
}

function setIfDefined(target, name, value) {
  if (value !== undefined) {
    target[name] = value;
  }
}

function parseOptionalEnum(name, allowedValues) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!allowedValues.includes(trimmed)) {
    console.error(`${name} must be one of: ${allowedValues.join(', ')}.`);
    process.exit(1);
  }
  return trimmed;
}

function firstNonEmptyEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function nonPlaceholderString(value) {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || /^<YOUR_[A-Z0-9_]+>$/.test(trimmed)) {
    return undefined;
  }
  return value;
}

const baseConfig = JSON.parse(await readFile(baseConfigPath, 'utf8'));
const appId = firstNonEmptyEnv('APP_ID', 'TEST_APP_ID') ?? nonPlaceholderString(baseConfig.appId);
if (!appId) {
  console.error('APP_ID or TEST_APP_ID is required when writing the example build config unless agora-config.json contains a real appId.');
  process.exit(1);
}

const overrides = {
  appId,
  channelId: firstNonEmptyEnv('CHANNEL_ID', 'TEST_CHANNEL_ID') ?? nonPlaceholderString(baseConfig.channelId) ?? 'testapi',
  token: firstNonEmptyEnv('TOKEN', 'TEST_TOKEN') ?? (typeof baseConfig.token === 'string' ? baseConfig.token : ''),
};
setIfDefined(overrides, 'uid', parseOptionalInteger('TEST_UID') ?? parseOptionalInteger('UID'));
setIfDefined(overrides, 'autoPreview', parseOptionalBoolean('AUTO_PREVIEW'));
setIfDefined(overrides, 'autoJoin', parseOptionalBoolean('AUTO_JOIN'));
setIfDefined(overrides, 'publishCameraTrack', parseOptionalBoolean('PUBLISH_CAMERA_TRACK'));
setIfDefined(overrides, 'publishMicrophoneTrack', parseOptionalBoolean('PUBLISH_MICROPHONE_TRACK'));
setIfDefined(overrides, 'autoSubscribeAudio', parseOptionalBoolean('AUTO_SUBSCRIBE_AUDIO'));
setIfDefined(overrides, 'autoSubscribeVideo', parseOptionalBoolean('AUTO_SUBSCRIBE_VIDEO'));
setIfDefined(
  overrides,
  'channelProfile',
  parseOptionalEnum('CHANNEL_PROFILE', ['communication', 'liveBroadcasting']),
);
setIfDefined(
  overrides,
  'clientRole',
  parseOptionalEnum('CLIENT_ROLE', ['broadcaster', 'audience']),
);
setIfDefined(
  overrides,
  'videoEncoderPresetName',
  parseOptionalEnum('VIDEO_ENCODER_PRESET_NAME', ['360p', '540p', '720p']),
);
const buildConfig = createAgoraExampleBuildConfig(baseConfig, overrides);
const buildConfigMeta = {
  ver: '2.0.1',
  importer: 'json',
  imported: true,
  uuid: '79f7de91-c7f1-4f3d-bf3c-7bcfc6d64a02',
  files: ['.json'],
  subMetas: {},
  userData: {},
};

await writeFile(buildConfigPath, `${JSON.stringify(buildConfig, null, 2)}\n`, 'utf8');
await writeFile(buildConfigMetaPath, `${JSON.stringify(buildConfigMeta, null, 2)}\n`, 'utf8');
