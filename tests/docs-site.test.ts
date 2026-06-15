import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { access, readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

async function assertExists(relativePath: string) {
  await access(path.join(repoRoot, relativePath));
}

test('gitignore keeps docs root committable and ignores only internal artifacts', async () => {
  const gitignore = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');

  assert.doesNotMatch(gitignore, /^docs\/$/m);
  assert.match(gitignore, /^docs\/superpowers\/reports\/$/m);
  assert.match(gitignore, /^\.superpowers\/$/m);
});

test('docs site scaffolding files exist for both locales', async () => {
  const expectedFiles = [
    'docs/assets/app.css',
    'docs/assets/app.js',
    'docs/zh/index.html',
    'docs/zh/quickstart.html',
    'docs/zh/core-apis.html',
    'docs/zh/rendering.html',
    'docs/zh/example.html',
    'docs/zh/platform-notes.html',
    'docs/zh/api-reference.html',
    'docs/en/index.html',
    'docs/en/quickstart.html',
    'docs/en/core-apis.html',
    'docs/en/rendering.html',
    'docs/en/example.html',
    'docs/en/platform-notes.html',
    'docs/en/api-reference.html',
  ];

  for (const file of expectedFiles) {
    await assertExists(file);
  }
});
