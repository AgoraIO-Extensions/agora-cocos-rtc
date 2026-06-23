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

// The dependencies content is meant to be forgiving: users paste whatever a
// release note hands them, in any order, with any separators (newlines, spaces,
// pipes, quotes). Each field is detected by its own shape instead of by a
// rigid layout, so messy input still resolves correctly.

// Android Maven coordinate (group:artifact:version). The `implementation`/`api`
// keyword and the surrounding quotes are optional — the group:artifact:version
// shape is distinctive enough to match on its own, anywhere in the text.
//   implementation 'io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1'
//   io.agora.rtc:agora-special-voice:4.5.3.1.BASIC1
const mavenCoordinateRegex =
  /\b((?:cn|io)\.(?:agora|shengwang)(?:\.[a-z]+)?:[A-Za-z0-9_-]+:[A-Za-z0-9_.+-]+)/g;

// iOS Swift Package GitHub source, in any form: https, http, or SCP-style SSH
// (git@github.com:Owner/Repo.git), with or without a `github:` label and with
// or without a trailing `.git`. We capture owner/repo and rebuild the canonical
// https URL stored in sdk-config.json.
//   github:git@github.com:AgoraIO/AgoraAudio_iOS.git
//   https://github.com/AgoraIO/AgoraAudio_iOS.git
const githubSourceRegex =
  /github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?(?=$|[\s|,'")])/i;

// iOS Swift Package version. This is the one field that needs an explicit label
// (`tag:` or `version:`), because a bare version number is indistinguishable
// from the Android coordinate's own version (e.g. iOS 4.5.3-a1 vs Android
// 4.5.3.1.BASIC1). The separator may be `:` or `=` with any spacing.
//   tag:4.5.3-a1
const tagRegex = /(?:tag|version)\s*[:=]\s*([A-Za-z0-9_.+-]+)/i;

// iOS Swift Package products to link. A product name is just a bare identifier
// (RtcBasic, AINS, ...) with no distinctive shape of its own, so — unlike the
// other fields — it cannot be detected by pattern alone without guessing. We
// therefore require an explicit `products:` (or `product:`) label and take the
// comma-separated identifier list that follows it verbatim. This means the set
// of valid products is NOT hardcoded here: whatever names a future Package.swift
// exports can be selected without touching this script. The list is captured up
// to the first token that is not a comma-joined identifier, so a trailing Maven
// coordinate or keyword on the same single-line input is left alone.
//   products:RtcBasic,AINS,AudioBeauty
//   product: RtcBasic , AINS
const productsRegex =
  /products?\s*[:=]\s*([A-Za-z0-9_]+(?:\s*,\s*[A-Za-z0-9_]+)*)/i;

// Parses a free-form dependencies block into the fields we maintain in
// sdk-config.json. Returns only the values that were actually found.
function parseDependenciesContent(content) {
  const parsed = {};

  const mavenDependencies = [...content.matchAll(mavenCoordinateRegex)].map(
    (match) => match[1],
  );
  if (mavenDependencies.length > 0) {
    parsed.androidDependencies = mavenDependencies;
  }

  const githubMatch = content.match(githubSourceRegex);
  if (githubMatch) {
    parsed.iosPackageUrl = `https://github.com/${githubMatch[1]}.git`;
  }

  const tagMatch = content.match(tagRegex);
  if (tagMatch) {
    parsed.iosVersion = tagMatch[1].trim();
  }

  // Select the products listed after a `products:` label, verbatim. No fixed
  // list of valid names is assumed here, so new Package.swift products work
  // without changing this script.
  const productsMatch = content.match(productsRegex);
  if (productsMatch) {
    const products = productsMatch[1]
      .split(',')
      .map((product) => product.trim())
      .filter(Boolean);
    if (products.length > 0) {
      parsed.iosPackageProducts = products;
    }
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
const iosPackageProducts =
  fromContent.iosPackageProducts && fromContent.iosPackageProducts.length > 0
    ? fromContent.iosPackageProducts
    : null;

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

if (iosPackageProducts) {
  sdkConfig.ios.packageProducts = iosPackageProducts;
}

await writeFile(configPath, `${JSON.stringify(sdkConfig, null, 2)}\n`, 'utf8');

console.log(`Updated native dependency config at ${path.relative(repoRoot, configPath)}`);
