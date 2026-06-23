import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultConfigPath = path.join(repoRoot, 'sdk/agora-rtc/sdk-config.json');

function parseArgs(argv) {
  const args = {
    androidVersion: '',
    androidDependencies: '',
    iosVersion: '',
    dependenciesContent: '',
    configPath: defaultConfigPath,
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
    } else if (arg === '--dependencies-content') {
      args.dependenciesContent = next;
      index += 1;
    } else if (arg === '--config') {
      args.configPath = path.resolve(next);
      index += 1;
    }
  }

  return args;
}

// Matches Android Maven coordinates declared in Gradle style, e.g.
//   implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'
const mavenCoordinateRegex =
  /(?:implementation|api)\s+['"]((?:cn|io)\.(?:agora|shengwang)(?:\.[a-z]+)?:[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+)['"]/g;

// Matches a Swift Package source declared as `github:<git-url>`, e.g.
//   github:git@github.com:AgoraIO/AgoraAudio_iOS.git
const githubSourceRegex = /github:\s*(\S+)/;

// Matches a Swift Package tag declared as `tag:<version>`, e.g.
//   tag:4.5.3-a1
const tagRegex = /tag:\s*(\S+)/;

function normalizeGithubUrl(rawUrl) {
  const url = rawUrl.trim();
  // Convert SCP-style SSH remotes (git@github.com:Owner/Repo.git) to https,
  // matching the packageUrl style stored in sdk-config.json.
  const sshMatch = url.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  return url;
}

// Parses a free-form dependencies block into the fields we maintain in
// sdk-config.json. Returns only the values that were actually found.
function parseDependenciesContent(content) {
  const parsed = {};

  const mavenDependencies = [];
  for (const match of content.matchAll(mavenCoordinateRegex)) {
    mavenDependencies.push(match[1]);
  }
  if (mavenDependencies.length > 0) {
    parsed.androidDependencies = mavenDependencies;
  }

  const githubMatch = content.match(githubSourceRegex);
  if (githubMatch) {
    parsed.iosPackageUrl = normalizeGithubUrl(githubMatch[1]);
  }

  const tagMatch = content.match(tagRegex);
  if (tagMatch) {
    parsed.iosVersion = tagMatch[1].trim();
  }

  return parsed;
}

function withMavenVersion(coordinate, version) {
  const segments = coordinate.split(':');
  if (segments.length !== 3) {
    throw new Error(`Invalid Maven coordinate: ${coordinate}`);
  }

  return `${segments[0]}:${segments[1]}:${version}`;
}

const args = parseArgs(process.argv.slice(2));
const configPath = args.configPath;
const sdkConfig = JSON.parse(await readFile(configPath, 'utf8'));

// A single `--dependencies-content` block takes precedence: it carries both the
// Android Maven coordinates and the iOS Swift Package source/tag in one input.
const fromContent = args.dependenciesContent.trim()
  ? parseDependenciesContent(args.dependenciesContent)
  : {};

const androidDependencies =
  fromContent.androidDependencies && fromContent.androidDependencies.length > 0
    ? fromContent.androidDependencies
    : null;
const iosPackageUrl = fromContent.iosPackageUrl ?? null;
const iosVersion = fromContent.iosVersion || args.iosVersion;

if (androidDependencies) {
  sdkConfig.android.dependencies = androidDependencies;
} else if (args.androidDependencies) {
  sdkConfig.android.dependencies = args.androidDependencies
    .split(',')
    .map((dependency) => dependency.trim())
    .filter(Boolean);
} else if (args.androidVersion) {
  sdkConfig.android.dependencies = sdkConfig.android.dependencies.map((dependency) =>
    withMavenVersion(dependency, args.androidVersion),
  );
}

if (iosPackageUrl) {
  sdkConfig.ios.packageUrl = iosPackageUrl;
}

if (iosVersion) {
  sdkConfig.ios.packageVersion = iosVersion;
}

await writeFile(configPath, `${JSON.stringify(sdkConfig, null, 2)}\n`, 'utf8');

console.log(`Updated native dependency config at ${path.relative(repoRoot, configPath)}`);
