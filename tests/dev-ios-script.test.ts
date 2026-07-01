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

test('agora extension registers Cocos builder hooks through package manifest', async () => {
  const content = await readFile(`${repoRoot}/sdk/agora-rtc/package.json`, 'utf8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.package_version, 2);
  assert.equal(manifest.contributions.builder, './dist/builder.js');
});
