import path from 'node:path';
import { cp, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceMainDir = path.join(
  repoRoot,
  'example/basic-call/build/android/data/assets/main',
);
const targetMainDir = path.join(
  repoRoot,
  'example/basic-call/build-android/android/data/assets/main',
);

try {
  await access(sourceMainDir);
  await access(targetMainDir);
} catch {
  console.log('Skipped Android runtime main asset sync because one of the export directories is missing.');
  process.exit(0);
}

await cp(sourceMainDir, targetMainDir, {
  recursive: true,
  force: true,
});

console.log(`Synced Android runtime main assets from ${sourceMainDir} to ${targetMainDir}`);
