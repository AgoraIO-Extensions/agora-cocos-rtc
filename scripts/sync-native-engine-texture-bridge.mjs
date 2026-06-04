import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ensureNativeEngineTextureBridge } = require('../sdk/agora-rtc/dist/hooks.js');

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const nativeCommonDir = path.join(
  repoRoot,
  'example/basic-call/native/engine/common',
);

await ensureNativeEngineTextureBridge(nativeCommonDir);
