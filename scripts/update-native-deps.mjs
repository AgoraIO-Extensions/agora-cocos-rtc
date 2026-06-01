import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const configPath = path.join(repoRoot, 'sdk/agora-rtc/sdk-config.json');

function parseArgs(argv) {
  const args = {
    androidVersion: '',
    androidDependencies: '',
    iosVersion: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? '';

    if (arg === '--android-version') {
      args.androidVersion = next.trim();
      index += 1;
    } else if (arg === '--android-dependencies') {
      args.androidDependencies = next.trim();
      index += 1;
    } else if (arg === '--ios-version') {
      args.iosVersion = next.trim();
      index += 1;
    }
  }

  return args;
}

function withMavenVersion(coordinate, version) {
  const segments = coordinate.split(':');
  if (segments.length !== 3) {
    throw new Error(`Invalid Maven coordinate: ${coordinate}`);
  }

  return `${segments[0]}:${segments[1]}:${version}`;
}

const args = parseArgs(process.argv.slice(2));
const sdkConfig = JSON.parse(await readFile(configPath, 'utf8'));

if (args.androidDependencies) {
  sdkConfig.android.dependencies = args.androidDependencies
    .split(',')
    .map((dependency) => dependency.trim())
    .filter(Boolean);
} else if (args.androidVersion) {
  sdkConfig.android.dependencies = sdkConfig.android.dependencies.map((dependency) =>
    withMavenVersion(dependency, args.androidVersion),
  );
}

if (args.iosVersion) {
  sdkConfig.ios.packageVersion = args.iosVersion;
}

await writeFile(configPath, `${JSON.stringify(sdkConfig, null, 2)}\n`, 'utf8');

console.log(`Updated native dependency config at ${path.relative(repoRoot, configPath)}`);
