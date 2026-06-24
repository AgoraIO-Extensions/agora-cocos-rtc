import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

test('ios debug build config uses the requested agora example bundle identifier', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/build-configs/ios-debug.json`,
    'utf8',
  );

  assert.match(content, /"packageName": "io\.agora\.cocos\.example"/);
});

test('agora native plugin manifest remains disabled because this project uses manual native integration', async () => {
  const content = await readFile(
    `${repoRoot}/sdk/agora-rtc/cc_plugin.json`,
    'utf8',
  );

  assert.match(content, /"disabled":\s*true/);
  assert.match(content, /"engine-version":\s*">=3\.8\.0"/);
  assert.match(content, /"platforms":\s*\[/);
});
