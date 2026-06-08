import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const baseConfigPath = path.join(repoRoot, 'example/basic-call/assets/resources/agora-config.json');
const buildConfigPath = path.join(repoRoot, 'example/basic-call/assets/resources/agora-config.build.json');
const buildConfigMetaPath = `${buildConfigPath}.meta`;

const appId = process.env.APP_ID || process.env.TEST_APP_ID || '';
if (!appId) {
  console.error('APP_ID or TEST_APP_ID is required when writing the example build config.');
  process.exit(1);
}

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
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`${name} must be a non-negative integer.`);
    process.exit(1);
  }
  return Math.floor(parsed);
}

function setIfDefined(target, name, value) {
  if (value !== undefined) {
    target[name] = value;
  }
}

const baseConfig = JSON.parse(await readFile(baseConfigPath, 'utf8'));
const buildConfig = {
  ...baseConfig,
  appId,
  channelId: process.env.CHANNEL_ID || process.env.TEST_CHANNEL_ID || 'testapi',
  token: process.env.TOKEN || process.env.TEST_TOKEN || '',
};
setIfDefined(buildConfig, 'uid', parseOptionalInteger('TEST_UID') ?? parseOptionalInteger('UID'));
setIfDefined(buildConfig, 'autoPreview', parseOptionalBoolean('AUTO_PREVIEW'));
setIfDefined(buildConfig, 'autoJoin', parseOptionalBoolean('AUTO_JOIN'));
setIfDefined(buildConfig, 'publishCameraTrack', parseOptionalBoolean('PUBLISH_CAMERA_TRACK'));
setIfDefined(buildConfig, 'publishMicrophoneTrack', parseOptionalBoolean('PUBLISH_MICROPHONE_TRACK'));
setIfDefined(buildConfig, 'autoSubscribeAudio', parseOptionalBoolean('AUTO_SUBSCRIBE_AUDIO'));
setIfDefined(buildConfig, 'autoSubscribeVideo', parseOptionalBoolean('AUTO_SUBSCRIBE_VIDEO'));
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
