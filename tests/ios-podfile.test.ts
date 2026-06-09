import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { renderPodfile } = require('../sdk/agora-rtc/dist/ios-podfile.js');
const repoRoot = process.cwd();

test('ios podfile renderer rejects the current Swift Package Manager integration mode', () => {
  assert.throws(
    () =>
      renderPodfile({
        targetName: 'agora-cocos-basic-call-mobile',
        projectName: 'agora-cocos-basic-call.xcodeproj',
      }),
    /iOS integrationMode is swift-package-manager; use Swift Package Manager integration instead\./,
  );
});

test('ios podfile generator creates the exported project directory before writing', async () => {
  const content = await readFile(`${repoRoot}/scripts/generate-ios-podfile.mjs`, 'utf8');

  assert.match(content, /import \{ mkdir, writeFile \} from 'node:fs\/promises';/);
  assert.match(content, /await mkdir\(path\.dirname\(outputPath\), \{ recursive: true \}\);/);
  assertPatternBefore(
    content,
    /await mkdir\(path\.dirname\(outputPath\), \{ recursive: true \}\);/,
    /await writeFile\(outputPath, renderPodfile\(\), 'utf8'\);/,
    'podfile generator must create the directory before writing the Podfile',
  );
});

function assertPatternBefore(
  content: string,
  beforePattern: RegExp,
  afterPattern: RegExp,
  message: string,
) {
  const beforeIndex = content.search(beforePattern);
  const afterIndex = content.search(afterPattern);

  assert.ok(beforeIndex >= 0, `Missing before pattern for ${message}`);
  assert.ok(afterIndex >= 0, `Missing after pattern for ${message}`);
  assert.ok(
    beforeIndex < afterIndex,
    `Expected ${message}: ${beforePattern} before ${afterPattern}`,
  );
}
