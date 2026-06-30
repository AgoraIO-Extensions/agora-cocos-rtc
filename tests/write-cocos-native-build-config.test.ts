import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

test('write-cocos-native-build-config injects sdk and ndk paths for google-play', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-google-play-config-'));
  const sourcePath = path.join(tempRoot, 'google-play-debug.json');
  const outputPath = path.join(tempRoot, 'google-play-debug.local.json');

  await writeFile(
    sourcePath,
    `${JSON.stringify(
      {
        platform: 'google-play',
        packages: {
          'google-play': {
            packageName: 'io.agora.cocos.example',
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  await execFileAsync('node', ['./scripts/write-cocos-native-build-config.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      COCOS_BUILD_SOURCE_CONFIG: sourcePath,
      COCOS_BUILD_OUTPUT_CONFIG: outputPath,
      ANDROID_SDK_ROOT: '/tmp/android-sdk',
      ANDROID_NDK_HOME: '/tmp/android-ndk',
    },
  });

  const output = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(output.packages['google-play'].sdkPath, '/tmp/android-sdk');
  assert.equal(output.packages['google-play'].ndkPath, '/tmp/android-ndk');
});
