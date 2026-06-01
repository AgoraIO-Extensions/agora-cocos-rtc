import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, '..');

function parseArgs(argv) {
  const args = { root: defaultRoot };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      args.root = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return args;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const { root } = parseArgs(process.argv.slice(2));
const sdkPackagePath = path.join(root, 'sdk/agora-rtc/package.json');
const sdkPackage = await readJson(sdkPackagePath);
const sdkVersion = sdkPackage.version;

if (!sdkVersion || typeof sdkVersion !== 'string') {
  throw new Error(`Missing SDK version in ${sdkPackagePath}`);
}

const manifestPaths = [
  path.join(root, 'sdk/agora-rtc/cc_plugin.json'),
  path.join(root, 'example/basic-call/native/agora-rtc/cc_plugin.json'),
];
const synced = [];

for (const manifestPath of manifestPaths) {
  if (!(await fileExists(manifestPath))) {
    continue;
  }

  const manifest = await readJson(manifestPath);
  manifest.version = sdkVersion;
  await writeJson(manifestPath, manifest);
  synced.push(path.relative(root, manifestPath));
}

console.log(`Synced SDK version ${sdkVersion} to ${synced.join(', ')}`);
