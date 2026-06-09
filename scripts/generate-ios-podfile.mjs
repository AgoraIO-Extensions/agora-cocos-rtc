import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { renderPodfile } = require('../sdk/agora-rtc/dist/ios-podfile.js');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const outputPath = path.join(repoRoot, 'example/basic-call/build-ios/ios/proj/Podfile');

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, renderPodfile(), 'utf8');

console.log(`Generated iOS Podfile at ${outputPath}`);
