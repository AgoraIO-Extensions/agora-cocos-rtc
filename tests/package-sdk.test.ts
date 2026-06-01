import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();

function parseZipListing(stdout: string) {
  return stdout
    .split('\n')
    .map((line) => line.trim().match(/^\d+\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/)?.[1])
    .filter((entry): entry is string => Boolean(entry));
}

test('package-sdk script creates a distributable zip with plugin manifests', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-package-'));
  const script = path.join(repoRoot, 'scripts/package-sdk.sh');

  await execFileAsync('/bin/zsh', [script, outputDir], {
    cwd: repoRoot,
  });

  const archive = path.join(outputDir, 'agora-rtc-cocos-plugin.zip');
  const { stdout } = await execFileAsync('/usr/bin/unzip', ['-l', archive]);
  const entries = parseZipListing(stdout);

  assert.match(stdout, /agora-rtc\/package\.json/);
  assert.match(stdout, /agora-rtc\/cc_plugin\.json/);
  assert.match(stdout, /agora-rtc\/dist\/hooks\.js/);
  assert.match(stdout, /agora-rtc\/README\.md/);
  assert.ok(!entries.some((entry) => entry.endsWith('/.DS_Store')));
  assert.ok(!entries.some((entry) => entry.includes('/node_modules/')));
  assert.ok(!entries.some((entry) => entry.includes('/dist-cache/')));
  assert.ok(!entries.some((entry) => entry.includes('/docs/superpowers/')));
  assert.ok(!entries.some((entry) => /HANDOFF/i.test(entry)));

  const readme = await readFile(path.join(repoRoot, 'sdk/agora-rtc/README.md'), 'utf8');
  assert.match(readme, /第一阶段接口/);
});
