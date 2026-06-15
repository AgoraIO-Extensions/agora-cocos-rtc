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

async function readDoc(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const localePages = [
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

test('all locale pages share the docs shell hooks', async () => {
  for (const file of localePages) {
    const content = await readDoc(file);

    assert.match(content, /class="doc-header"/);
    assert.match(content, /id="nav-toggle"/);
    assert.match(content, /class="doc-nav"/);
    assert.match(content, /class="doc-main"/);
    assert.match(content, /id="page-toc"/);
    assert.match(content, /data-locale-target=/);
    assert.match(content, /\.\.\/assets\/app\.css/);
    assert.match(content, /\.\.\/assets\/app\.js/);
  }
});

test('shared app.js handles locale switch, mobile nav, and toc activation', async () => {
  const content = await readDoc('docs/assets/app.js');

  assert.match(content, /querySelectorAll\('\[data-locale-target\]'\)/);
  assert.match(content, /replace\('\/zh\/', '\/en\/'\)/);
  assert.match(content, /replace\('\/en\/', '\/zh\/'\)/);
  assert.match(content, /nav-toggle/);
  assert.match(content, /IntersectionObserver/);
  assert.match(content, /page-toc/);
});

test('shared app.css defines desktop and mobile docs layout', async () => {
  const content = await readDoc('docs/assets/app.css');

  assert.match(content, /\.doc-shell/);
  assert.match(content, /\.doc-header/);
  assert.match(content, /\.doc-nav/);
  assert.match(content, /\.doc-main/);
  assert.match(content, /\.doc-toc/);
  assert.match(content, /@media \(max-width: 960px\)/);
});
