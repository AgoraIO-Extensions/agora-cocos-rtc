import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, '..');
const MAVEN_CENTRAL_BASE = 'https://repo.maven.apache.org/maven2';
const LOCAL_AGORA_MAVEN_RELATIVE_PATH = 'example/basic-call/local-maven';
const sdkConfig = JSON.parse(
  await readFile(path.join(REPO_ROOT, 'sdk/agora-rtc/sdk-config.json'), 'utf8'),
);

// Agora-hosted releases are not always mirrored to Maven Central: the special
// voice builds ship only to the Agora repository. Try the configured hosted
// repository first, then fall back to Central so transitive third-party
// dependencies (androidx, kotlin, ...) keep resolving.
const MAVEN_BASES = [
  sdkConfig.android.mavenRepositoryUrl?.replace(/\/+$/, ''),
  MAVEN_CENTRAL_BASE,
].filter(Boolean);
const OUTPUT_ROOT = path.resolve(REPO_ROOT, LOCAL_AGORA_MAVEN_RELATIVE_PATH);
const seeds = sdkConfig.android.dependencies.map((coordinate) => {
  const [groupId, artifactId, version] = coordinate.split(':');
  return { groupId, artifactId, version };
});

const seen = new Set();

function tagValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}>([^<]+)</${tagName}>`));
  return match?.[1]?.trim() ?? null;
}

function dependencyBlocks(xml) {
  return [...xml.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)].map((match) => match[1]);
}

function parseDependency(xml) {
  const groupId = tagValue(xml, 'groupId');
  const artifactId = tagValue(xml, 'artifactId');
  const version = tagValue(xml, 'version');
  const scope = tagValue(xml, 'scope');
  const optional = tagValue(xml, 'optional');

  if (!groupId || !artifactId || !version) {
    return null;
  }

  if (scope === 'test' || scope === 'provided' || optional === 'true') {
    return null;
  }

  return { groupId, artifactId, version };
}

function mavenPath(groupId, artifactId, version, filename) {
  return path.join(...groupId.split('.'), artifactId, version, filename);
}

/**
 * Fetch a repository-relative path from the first base that serves it.
 *
 * Returns the successful response together with the URL it came from so the
 * caller can report which repository supplied the artifact.
 */
async function fetchFromAnyBase(relativePath) {
  const failures = [];

  for (const base of MAVEN_BASES) {
    const url = `${base}/${relativePath}`;
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
      continue;
    }

    if (response.ok) {
      return { response, url };
    }

    failures.push(`${url}: ${response.status} ${response.statusText}`);
  }

  throw new Error(`Failed to fetch ${relativePath} from any repository:\n  ${failures.join('\n  ')}`);
}

async function download(relativePath, destination) {
  const { response, url } = await fetchFromAnyBase(relativePath);

  const arrayBuffer = await response.arrayBuffer();
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(arrayBuffer));
  return url;
}

async function mirrorArtifact(coordinate) {
  const key = `${coordinate.groupId}:${coordinate.artifactId}:${coordinate.version}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);

  const pomName = `${coordinate.artifactId}-${coordinate.version}.pom`;
  const pomRelativePath = mavenPath(
    coordinate.groupId,
    coordinate.artifactId,
    coordinate.version,
    pomName,
  );
  const pomDestination = path.join(OUTPUT_ROOT, pomRelativePath);

  const { response: pomResponse, url: pomUrl } = await fetchFromAnyBase(pomRelativePath);
  const pomText = await pomResponse.text();
  await mkdir(path.dirname(pomDestination), { recursive: true });
  await writeFile(pomDestination, pomText, 'utf8');
  console.log(`mirrored ${pomUrl}`);

  const packaging = tagValue(pomText, 'packaging') ?? 'jar';
  const artifactName = `${coordinate.artifactId}-${coordinate.version}.${packaging}`;
  const artifactRelativePath = mavenPath(
    coordinate.groupId,
    coordinate.artifactId,
    coordinate.version,
    artifactName,
  );
  const artifactDestination = path.join(OUTPUT_ROOT, artifactRelativePath);
  const artifactUrl = await download(artifactRelativePath, artifactDestination);
  console.log(`mirrored ${artifactUrl}`);

  for (const block of dependencyBlocks(pomText)) {
    const dependency = parseDependency(block);
    if (dependency) {
      await mirrorArtifact(dependency);
    }
  }
}

await mkdir(OUTPUT_ROOT, { recursive: true });

for (const seed of seeds) {
  await mirrorArtifact(seed);
}

console.log(`Agora local Maven mirror is ready at ${OUTPUT_ROOT}`);
