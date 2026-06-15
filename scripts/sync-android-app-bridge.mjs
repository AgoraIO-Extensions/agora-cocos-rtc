import { cp, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { ensureAndroidAppActivityBridgeAttachment } = require('../sdk/agora-rtc/dist/hooks.js');

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const demoPermissionsSourcePath = path.join(
  repoRoot,
  'example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/demo/DemoPermissionsPlugin.java',
);
const candidates = [
  path.join(repoRoot, 'example/basic-call/native/engine/android'),
  path.join(repoRoot, 'example/basic-call/build-android/android/proj'),
];

let patched = 0;
for (const candidate of candidates) {
  const appActivityPath = await ensureAndroidAppActivityBridgeAttachment(candidate);
  if (appActivityPath) {
    const demoPermissionsDestinationDir = path.join(
      candidate,
      'app/src/main/java/io/agora/cocos/demo',
    );
    await mkdir(demoPermissionsDestinationDir, { recursive: true });
    await cp(
      demoPermissionsSourcePath,
      path.join(demoPermissionsDestinationDir, 'DemoPermissionsPlugin.java'),
    );
    patched += 1;
  }
}

if (patched === 0) {
  console.log('Skipped Android AppActivity bridge sync because AppActivity.java was not found.');
}
