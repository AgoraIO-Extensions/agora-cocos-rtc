import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { access, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repoRoot = process.cwd();

async function listFiles(root: string) {
  const results: string[] = [];

  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);

      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  }

  await walk(root);
  return results.sort();
}

test('package-customer-delivery script assembles sdk zip and example assets without local docs', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-delivery-'));
  const script = path.join(repoRoot, 'scripts/package-customer-delivery.sh');

  await execFileAsync('/bin/zsh', [script, outputDir], {
    cwd: repoRoot,
  });

  const checks = [
    'agora-rtc-cocos-plugin.zip',
    'example-basic-call/README.md',
    'example-basic-call/assets',
    'example-basic-call/build-configs',
  ];

  for (const relativePath of checks) {
    const absolutePath = path.join(outputDir, relativePath);
    await access(absolutePath);
  }

  const files = await listFiles(outputDir);
  const forbiddenPatterns = [
    /(?:^|\/)\.DS_Store$/,
    /(?:^|\/)node_modules\//,
    /(?:^|\/)dist-cache\//,
    /^docs\//,
    /HANDOFF/i,
    /^example-basic-call\/build(?:-|\/)(?!configs\/)/,
    /^example-basic-call\/library\//,
    /^example-basic-call\/temp\//,
    /^example-basic-call\/native\/engine\//,
    /\.(?:mobileprovision|p12|jks|keystore)$/,
  ];

  const forbiddenFiles = files.filter((file) =>
    forbiddenPatterns.some((pattern) => pattern.test(file)),
  );
  assert.deepEqual(forbiddenFiles, []);

  for (const file of files) {
    const absolutePath = path.join(outputDir, file);
    const content = await readFile(absolutePath, 'utf8').catch(() => '');
    assert.doesNotMatch(content, /(?:file:\/\/)?\/Users\/[^)\s"'`]+/);
    assert.doesNotMatch(content, /\bappId["']?\s*[:=]\s*["'][0-9a-f]{32}["']/i);
    assert.doesNotMatch(content, /\btoken["']?\s*[:=]\s*["'](?!\s*["'])[A-Za-z0-9_=-]{40,}["']/);
  }
});
