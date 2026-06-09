import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceDir = path.join(repoRoot, 'test_shard/integration_test_app/src');
const targetDir = path.join(repoRoot, 'example/basic-call/assets/scripts/cocos-device-tests');
const bootstrapPath = path.join(repoRoot, 'example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts');
const mode = process.env.AGORA_COCOS_TEST_MODE || 'api';
const runtimeGlobals = {
  AGORA_COCOS_TEST_MODE: mode,
  TEST_APP_ID: process.env.TEST_APP_ID || process.env.APP_ID || '',
  TEST_TOKEN: process.env.TEST_TOKEN || process.env.TOKEN || '',
  TEST_CHANNEL_ID: process.env.TEST_CHANNEL_ID || process.env.CHANNEL_ID || 'testapi',
  TEST_UID: process.env.TEST_UID || '1001',
};

await mkdir(targetDir, { recursive: true });
await cp(sourceDir, targetDir, { recursive: true });
await writeFile(
  path.join(targetDir, 'test-mode.ts'),
  [
    `import { maybeRunAgoraCocosApiTests } from './api_test_runner.ts';`,
    `Object.assign(globalThis as any, ${JSON.stringify(runtimeGlobals, null, 2)});`,
    `console.log('[agora-cocos-test] TEST_MODE_LOADED mode=' + (globalThis as any).AGORA_COCOS_TEST_MODE);`,
    `const runApiTests = maybeRunAgoraCocosApiTests;`,
    `export function runAgoraCocosDeviceTestsWhenReady(): void {`,
    `  runApiTests();`,
    `}`,
    '',
  ].join('\n'),
  'utf8',
);

const legacyBootstrapImport = `import './cocos-device-tests/test-mode.ts';`;
const bootstrapImport = `import { runAgoraCocosDeviceTestsWhenReady } from './cocos-device-tests/test-mode.ts';`;
const bootstrapContent = await readFile(bootstrapPath, 'utf8');
let nextBootstrapContent = bootstrapContent.replace(`${legacyBootstrapImport}\n`, '');
nextBootstrapContent = nextBootstrapContent.replace(legacyBootstrapImport, '');
if (!nextBootstrapContent.includes(bootstrapImport)) {
  nextBootstrapContent = `${bootstrapImport}\n${nextBootstrapContent}`;
}

const testRunCall = 'runAgoraCocosDeviceTestsWhenReady();';
if (!nextBootstrapContent.includes(testRunCall)) {
  const mountAnchor = "console.log('[agora-rtc] bootstrap canvas child count', canvas.children.length);";
  if (!nextBootstrapContent.includes(mountAnchor)) {
    throw new Error('Unable to inject Cocos test runner: bootstrap mount anchor not found.');
  }
  nextBootstrapContent = nextBootstrapContent.replace(
    mountAnchor,
    `${mountAnchor}\n  ${testRunCall}`,
  );
}

if (nextBootstrapContent !== bootstrapContent) {
  await writeFile(bootstrapPath, nextBootstrapContent, 'utf8');
}

function metaFor(uuid) {
  return `${JSON.stringify({
    ver: '4.0.23',
    importer: 'typescript',
    imported: true,
    uuid,
    files: [],
    subMetas: {},
    userData: {
      simulateGlobals: [],
    },
  }, null, 2)}\n`;
}

const tsFiles = (await readdir(targetDir)).filter((entry) => entry.endsWith('.ts')).sort();
await writeFile(
  `${targetDir}.meta`,
  `${JSON.stringify({
    ver: '1.1.0',
    importer: 'directory',
    imported: true,
    uuid: '2eae89cb-6f8e-4615-ac44-0012f1201001',
    files: [],
    subMetas: {},
    userData: {
      compressionType: {},
      isRemoteBundle: {},
    },
  }, null, 2)}\n`,
  'utf8',
);
for (const [index, filename] of tsFiles.entries()) {
  const metaPath = path.join(targetDir, `${filename}.meta`);
  await writeFile(metaPath, metaFor(`6f0fce55-2000-42b8-8b7b-1aaf80000${String(index).padStart(3, '0')}`), 'utf8');
}

console.log(`Injected Cocos test runner into ${targetDir}`);
