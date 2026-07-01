import { readFile } from 'node:fs/promises';
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

const { root } = parseArgs(process.argv.slice(2));
const sdkPackagePath = path.join(root, 'sdk/agora-rtc/package.json');
const sdkPackage = await readJson(sdkPackagePath);
const sdkVersion = sdkPackage.version;

if (!sdkVersion || typeof sdkVersion !== 'string') {
  throw new Error(`Missing SDK version in ${sdkPackagePath}`);
}

console.log(`SDK version source is sdk/agora-rtc/package.json (${sdkVersion})`);
