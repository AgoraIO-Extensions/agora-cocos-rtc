import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, '..');
const MAVEN_BASE = 'https://repo.maven.apache.org/maven2';
const sdkConfig = JSON.parse(
  await readFile(path.join(REPO_ROOT, 'sdk/agora-rtc/sdk-config.json'), 'utf8'),
);
const OUTPUT_ROOT = path.resolve(
  REPO_ROOT,
  'example/basic-call/native/engine/android',
  sdkConfig.android.localMavenRelativePath,
);
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

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(arrayBuffer));
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
  const pomUrl = `${MAVEN_BASE}/${pomRelativePath}`;
  const pomDestination = path.join(OUTPUT_ROOT, pomRelativePath);

  const pomResponse = await fetch(pomUrl);
  if (!pomResponse.ok) {
    throw new Error(`Failed to fetch POM ${pomUrl}: ${pomResponse.status} ${pomResponse.statusText}`);
  }
  const pomText = await pomResponse.text();
  await mkdir(path.dirname(pomDestination), { recursive: true });
  await writeFile(pomDestination, pomText, 'utf8');

  const packaging = tagValue(pomText, 'packaging') ?? 'jar';
  const artifactName = `${coordinate.artifactId}-${coordinate.version}.${packaging}`;
  const artifactRelativePath = mavenPath(
    coordinate.groupId,
    coordinate.artifactId,
    coordinate.version,
    artifactName,
  );
  const artifactUrl = `${MAVEN_BASE}/${artifactRelativePath}`;
  const artifactDestination = path.join(OUTPUT_ROOT, artifactRelativePath);
  await download(artifactUrl, artifactDestination);

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
