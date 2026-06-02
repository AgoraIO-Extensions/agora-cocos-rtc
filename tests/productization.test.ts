import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8'));
}

function isPublishableSourceFile(relativePath: string) {
  if (relativePath === '.gitignore') {
    return false;
  }

  if (relativePath === 'tests/productization.test.ts') {
    return false;
  }

  if (/HANDOFF/i.test(relativePath)) {
    return false;
  }

  return true;
}

async function listTrackedSourceFiles(
  root: string,
  options: { includePlatformMetadata?: boolean } = {},
) {
  const ignoredPathParts = new Set([
    '.git',
    '.gemini',
    '.github',
    'node_modules',
    'dist',
    'tmp',
    '.worktrees',
    'library',
    'local',
    'temp',
    'profiles',
    'build',
    'build-android',
    'build-ios',
    'build-logs',
    'build-android-logs',
    'build-ios-logs',
    'local-maven',
    'native/engine',
    'superpowers',
  ]);
  const results: string[] = [];

  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store' && !options.includePlatformMetadata) {
        continue;
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);

      const pathParts = relativePath.split(path.sep);
      if (
        ignoredPathParts.has(entry.name) ||
        ignoredPathParts.has(pathParts.join('/'))
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  }

  await walk(root);
  return results;
}

test('root package exposes productization scripts and clean repository name', async () => {
  const packageJson = await readJson('package.json');

  assert.equal(packageJson.name, 'agora-cocos-rtc');
  assert.equal(packageJson.scripts.typecheck, 'tsc --noEmit');
  assert.equal(packageJson.scripts['sync:version'], 'node ./scripts/sync-sdk-version.mjs');
  assert.match(packageJson.scripts.verify, /npm run typecheck/);
  assert.match(packageJson.scripts.verify, /npm run test/);
  assert.equal(packageJson.scripts.release, 'release-it');
  assert.ok(packageJson.devDependencies['release-it']);
  assert.ok(packageJson.devDependencies['@release-it/bumper']);
  assert.ok(packageJson.devDependencies['@release-it/conventional-changelog']);
});

test('sync-sdk-version copies the sdk package version into plugin manifests', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-version-'));
  const sdkRoot = path.join(fixtureRoot, 'sdk/agora-rtc');
  const examplePluginRoot = path.join(fixtureRoot, 'example/basic-call/native/agora-rtc');
  await mkdir(sdkRoot, { recursive: true });
  await mkdir(examplePluginRoot, { recursive: true });
  await writeFile(
    path.join(sdkRoot, 'package.json'),
    JSON.stringify({ name: 'agora-rtc', version: '9.8.7' }, null, 2),
    'utf8',
  );
  await writeFile(
    path.join(sdkRoot, 'cc_plugin.json'),
    JSON.stringify({ name: 'agora-rtc', version: '0.0.0' }, null, 2),
    'utf8',
  );
  await writeFile(
    path.join(examplePluginRoot, 'cc_plugin.json'),
    JSON.stringify({ name: 'agora-rtc', version: '0.0.0' }, null, 2),
    'utf8',
  );

  await execFileAsync('node', [
    path.join(repoRoot, 'scripts/sync-sdk-version.mjs'),
    '--root',
    fixtureRoot,
  ]);

  const sdkManifest = JSON.parse(await readFile(path.join(sdkRoot, 'cc_plugin.json'), 'utf8'));
  const exampleManifest = JSON.parse(
    await readFile(path.join(examplePluginRoot, 'cc_plugin.json'), 'utf8'),
  );
  assert.equal(sdkManifest.version, '9.8.7');
  assert.equal(exampleManifest.version, '9.8.7');
});

test('sdk package version is the checked-in manifest version source', async () => {
  const sdkPackage = await readJson('sdk/agora-rtc/package.json');
  const sdkManifest = await readJson('sdk/agora-rtc/cc_plugin.json');

  assert.equal(sdkManifest.version, sdkPackage.version);
});

test('release-it bumps the sdk package and syncs derived version files', async () => {
  const releaseConfig = await readJson('.release-it.json');

  assert.equal(releaseConfig.git.commitMessage, 'chore: release ${version}');
  assert.equal(releaseConfig.git.tagName, '${version}');
  assert.equal(releaseConfig.npm, false);
  assert.equal(releaseConfig.hooks['after:bump'], 'npm run sync:version');
  assert.equal(
    releaseConfig.plugins['@release-it/bumper'].out,
    'sdk/agora-rtc/package.json',
  );
  assert.equal(
    releaseConfig.plugins['@release-it/conventional-changelog'].infile,
    'CHANGELOG.md',
  );
});

test('strict typecheck is scoped to sdk TypeScript sources', async () => {
  const tsconfig = await readJson('tsconfig.json');

  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.deepEqual(tsconfig.include, ['sdk/agora-rtc/js/**/*.ts']);
  assert.ok(tsconfig.exclude.includes('example'));
  assert.ok(tsconfig.exclude.includes('tests'));
});

test('github workflows mirror update deps, build example, and release responsibilities', async () => {
  const updateDeps = await readFile(
    path.join(repoRoot, '.github/workflows/run_update_deps.yml'),
    'utf8',
  );
  const buildExample = await readFile(
    path.join(repoRoot, '.github/workflows/run_build_example.yml'),
    'utf8',
  );
  const release = await readFile(path.join(repoRoot, '.github/workflows/release.yml'), 'utf8');

  assert.match(updateDeps, /name: 'run: update dependencies'/);
  assert.match(updateDeps, /scripts\/update-native-deps\.mjs/);
  assert.match(updateDeps, /peter-evans\/create-pull-request/);

  assert.match(buildExample, /name: 'run: build example'/);
  assert.match(buildExample, /npm run verify/);
  assert.match(buildExample, /scripts\/package-customer-delivery\.sh/);
  assert.match(buildExample, /actions\/upload-artifact/);

  assert.match(release, /name: 'Release to GitHub'/);
  assert.match(release, /npm run verify/);
  assert.match(release, /npm run release/);
  assert.match(release, /gh release create/);
});

test('github release workflow defaults to dry-run and gates real publishing', async () => {
  const release = await readFile(path.join(repoRoot, '.github/workflows/release.yml'), 'utf8');

  assert.match(release, /dry-run:[\s\S]*?default: true/);
  assert.match(release, /if: \$\{\{ inputs\.dry-run == false \}\}[\s\S]*?gh release create/);
  assert.match(release, /if: \$\{\{ inputs\.dry-run == true \}\}[\s\S]*?actions\/upload-artifact/);
  assert.doesNotMatch(release, /gh release create[\s\S]*?--draft/);
});

test('update dependency workflow does not print secrets or publish directly', async () => {
  const updateDeps = await readFile(
    path.join(repoRoot, '.github/workflows/run_update_deps.yml'),
    'utf8',
  );

  assert.doesNotMatch(updateDeps, /echo\s+.*secrets\./i);
  assert.doesNotMatch(updateDeps, /gh release create|npm publish|git push/i);
  assert.match(updateDeps, /peter-evans\/create-pull-request/);
});

test('source files no longer refer to the old poc repository name', async () => {
  const files = await listTrackedSourceFiles(repoRoot);
  const oldRepositoryName = ['agora', 'cocos', 'rtc', 'poc'].join('-');
  const offenders: string[] = [];

  for (const relativePath of files) {
    const content = await readFile(path.join(repoRoot, relativePath), 'utf8');
    if (content.includes(oldRepositoryName)) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
});

test('publishable sources do not contain machine-local absolute paths', async () => {
  const files = (await listTrackedSourceFiles(repoRoot)).filter(isPublishableSourceFile);
  const offenders: string[] = [];
  const localPathPattern = /(?:file:\/\/)?\/Users\/[^)\s"'`]+/;

  for (const relativePath of files) {
    const content = await readFile(path.join(repoRoot, relativePath), 'utf8');
    if (localPathPattern.test(content)) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
});

test('publishable sources do not contain checked-in secrets or signing identities', async () => {
  const files = (await listTrackedSourceFiles(repoRoot)).filter(isPublishableSourceFile);
  const allowedSecretPlaceholders = [
    '<YOUR_AGORA_APP_ID>',
    'test-app-id',
    'TEST_APP_ID',
    'IOS_DEVELOPMENT_TEAM',
    'IOS_PROVISIONING_PROFILE_SPECIFIER',
    'BUILD_PROVISION_PROFILE',
    'GITHUB_TOKEN',
  ];
  const offenders: string[] = [];
  const suspiciousPatterns = [
    /\bappId["']?\s*[:=]\s*["'][0-9a-f]{32}["']/i,
    /\btoken["']?\s*[:=]\s*["'](?!\s*["'])[A-Za-z0-9_=-]{40,}["']/,
    /\b[A-Z0-9]{10}\b.*(?:DEVELOPMENT_TEAM|Team ID|team_id)/,
    /BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY/,
    /\.mobileprovision\b|\.p12\b|\.jks\b|\.keystore\b/,
  ];

  for (const relativePath of files) {
    const content = await readFile(path.join(repoRoot, relativePath), 'utf8');
    const sanitized = allowedSecretPlaceholders.reduce(
      (current, placeholder) => current.replaceAll(placeholder, ''),
      content,
    );

    if (suspiciousPatterns.some((pattern) => pattern.test(sanitized))) {
      offenders.push(relativePath);
    }
  }

  assert.deepEqual(offenders, []);
});

test('sdk version is single-sourced from sdk package manifest', async () => {
  const sdkPackage = await readJson('sdk/agora-rtc/package.json');
  const sdkManifest = await readJson('sdk/agora-rtc/cc_plugin.json');
  const runtimeManifest = await readJson('example/basic-call/native/agora-rtc/cc_plugin.json');
  const rootPackage = await readJson('package.json');

  assert.equal(sdkManifest.version, sdkPackage.version);
  assert.equal(runtimeManifest.version, sdkPackage.version);
  assert.notEqual(rootPackage.version, sdkPackage.version);
});

test('gitignore keeps generated cocos output and local docs out of commits', async () => {
  const gitignore = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');

  assert.match(gitignore, /example\/basic-call\/library\//);
  assert.match(gitignore, /example\/basic-call\/temp\//);
  assert.match(gitignore, /example\/basic-call\/build\//);
  assert.match(gitignore, /example\/basic-call\/build-android\//);
  assert.match(gitignore, /example\/basic-call\/build-ios\//);
  assert.match(gitignore, /example\/basic-call\/native\/engine\//);
  assert.match(gitignore, /example\/basic-call\/extensions\/agora-rtc/);
  assert.match(gitignore, /^docs\/$/m);
});

test('gitignore behavior matches the intended commit boundary', async () => {
  const ignoredPaths = [
    'example/basic-call/library/file.txt',
    'example/basic-call/temp/file.txt',
    'example/basic-call/build/file.txt',
    'example/basic-call/build-android/file.txt',
    'example/basic-call/build-ios/file.txt',
    'example/basic-call/build-logs',
    'example/basic-call/extensions/agora-rtc',
    'example/basic-call/native/engine/android/app/build.gradle',
    '.DS_Store',
    'docs/customer-integration.md',
    'docs/architecture.md',
    'docs/.DS_Store',
    'sdk/agora-rtc/.DS_Store',
    'example/basic-call/assets/.DS_Store',
    'docs/superpowers/plans/example.md',
    'docs/PROJECT_HANDOFF.md',
    'dist/agora-rtc-cocos-plugin.zip',
    'node_modules/release-it/package.json',
  ];
  const committedPaths = [
    'sdk/agora-rtc/package.json',
    'example/basic-call/assets/scripts/AgoraRtcExampleController.ts',
  ];

  const ignoredResult = await execFileAsync('git', ['check-ignore', ...ignoredPaths], {
    cwd: repoRoot,
  });
  const ignoredOutput = ignoredResult.stdout.trim().split('\n').sort();
  assert.deepEqual(ignoredOutput, ignoredPaths.sort());

  for (const committedPath of committedPaths) {
    await assert.rejects(
      execFileAsync('git', ['check-ignore', committedPath], { cwd: repoRoot }),
      /Command failed/,
      `${committedPath} should not be ignored`,
    );
  }
});
