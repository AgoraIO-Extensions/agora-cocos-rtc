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

const baseConfig = JSON.parse(await readFile(baseConfigPath, 'utf8'));
const buildConfig = {
  ...baseConfig,
  appId,
  channelId: process.env.CHANNEL_ID || process.env.TEST_CHANNEL_ID || 'testapi',
  token: process.env.TOKEN || process.env.TEST_TOKEN || '',
};
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
