import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  integrateAndroidExport,
  integrateIosExport,
} = require('../sdk/agora-rtc/dist/hooks.js');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const exampleRoot = path.join(repoRoot, 'example/basic-call');

await integrateAndroidExport(exampleRoot);
await integrateIosExport(exampleRoot);

console.log(`Synced SDK build config into ${exampleRoot}`);
