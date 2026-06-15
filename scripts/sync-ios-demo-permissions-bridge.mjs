import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const sourceDir = path.join(repoRoot, 'example/basic-call/native/agora-rtc/ios');
const destinationDir = path.join(repoRoot, 'example/basic-call/native/engine/ios/agora-rtc');
const demoOwnedFiles = [
  'DemoPermissionsPlugin.mm',
];

await mkdir(destinationDir, { recursive: true });

for (const filename of demoOwnedFiles) {
  await cp(
    path.join(sourceDir, filename),
    path.join(destinationDir, filename),
  );
}
