import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();
const { ensureSwiftCompilationConditions, PRODUCT_COMPILATION_FLAGS } = require(
  '../sdk/agora-rtc/dist/hooks.js',
);

// The single source of truth for the product -> compilation-flag mapping.
const sourceConfig = JSON.parse(
  readFileSync(path.join(repoRoot, 'sdk/agora-rtc/sdk-config.json'), 'utf8'),
);

const bridgePath = path.join(
  repoRoot,
  'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift',
);

// --- Guard test: this is the one that would have caught the CI link failure. ---
//
// Every native symbol that lives in an OPTIONAL Swift Package product must be
// wrapped in the matching `#if <FLAG>` block. Otherwise, trimming that product
// from packageProducts produces an "Undefined symbols" link error at Xcode time
// that no JS-level unit test can see. Here we statically prove that every
// ContentInspect symbol reference sits inside an AGORA_HAS_CONTENT_INSPECT block.

// Returns the set of compilation-condition flags active at each line of the
// file, by tracking #if / #endif nesting. Only flags we manage are tracked.
function activeFlagsByLine(source: string): Set<string>[] {
  const managed = new Set<string>(Object.values(PRODUCT_COMPILATION_FLAGS));
  const lines = source.split('\n');
  const stack: string[] = [];
  const perLine: Set<string>[] = [];

  for (const line of lines) {
    const ifMatch = line.match(/^\s*#if\s+([A-Za-z0-9_]+)\s*$/);
    const endifMatch = /^\s*#endif\b/.test(line);

    if (ifMatch) {
      stack.push(ifMatch[1]);
      // The #if line itself is part of the guard.
      perLine.push(new Set(stack.filter((flag) => managed.has(flag))));
      continue;
    }

    if (endifMatch) {
      // The #endif line still belongs to the block it closes.
      perLine.push(new Set(stack.filter((flag) => managed.has(flag))));
      stack.pop();
      continue;
    }

    perLine.push(new Set(stack.filter((flag) => managed.has(flag))));
  }

  return perLine;
}

test('every ContentInspect native symbol in the iOS bridge is gated by AGORA_HAS_CONTENT_INSPECT', async () => {
  const source = await readFile(bridgePath, 'utf8');
  const lines = source.split('\n');
  const flags = activeFlagsByLine(source);

  // Any reference to an AgoraContentInspect* class, or to enableContentInspect,
  // pulls in symbols from the optional ContentInspect product.
  const symbolPattern = /AgoraContentInspect|enableContentInspect/;
  const offenders: string[] = [];

  lines.forEach((line, index) => {
    if (!symbolPattern.test(line)) {
      return;
    }
    if (!flags[index].has('AGORA_HAS_CONTENT_INSPECT')) {
      offenders.push(`${index + 1}: ${line.trim()}`);
    }
  });

  assert.deepEqual(
    offenders,
    [],
    `these ContentInspect symbol references are not gated and would break a trimmed-product link:\n${offenders.join('\n')}`,
  );
});

test('the gated ContentInspect symbols are actually present (guard is not vacuous)', async () => {
  // If someone deletes the gated code, the guard test above would trivially
  // pass. This keeps it honest: the symbols must still exist in the file.
  const source = await readFile(bridgePath, 'utf8');
  assert.match(source, /AgoraContentInspectConfig/);
  assert.match(source, /enableContentInspect/);
  assert.match(source, /#if AGORA_HAS_CONTENT_INSPECT/);
});

test('every #if guard in the bridge is balanced by an #endif', async () => {
  const source = await readFile(bridgePath, 'utf8');
  const ifs = [...source.matchAll(/^\s*#if\b/gm)].length;
  const endifs = [...source.matchAll(/^\s*#endif\b/gm)].length;
  assert.equal(ifs, endifs, 'unbalanced #if/#endif in AgoraRtcBridge.swift');
});

// --- hooks.js: the flag tracks packageProducts in both directions. ---

test('selecting ContentInspect adds the flag to SWIFT_ACTIVE_COMPILATION_CONDITIONS', () => {
  const body = '\t\t\tSWIFT_VERSION = 5.0;\n';
  const patched = ensureSwiftCompilationConditions(body, ['AGORA_HAS_CONTENT_INSPECT']);

  assert.match(patched, /SWIFT_ACTIVE_COMPILATION_CONDITIONS = \(/);
  assert.match(patched, /AGORA_HAS_CONTENT_INSPECT/);
  assert.match(patched, /\$\(inherited\)/);
});

test('not selecting ContentInspect leaves the body without the managed flag', () => {
  const body = '\t\t\tSWIFT_VERSION = 5.0;\n';
  const patched = ensureSwiftCompilationConditions(body, []);

  assert.doesNotMatch(patched, /AGORA_HAS_CONTENT_INSPECT/);
});

test('deselecting ContentInspect removes a previously injected flag', () => {
  const body = [
    '\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = (',
    '\t\t\t\t"$(inherited)",',
    '\t\t\t\tAGORA_HAS_CONTENT_INSPECT,',
    '\t\t\t);',
    '',
  ].join('\n');
  const patched = ensureSwiftCompilationConditions(body, []);

  assert.doesNotMatch(patched, /AGORA_HAS_CONTENT_INSPECT/);
  assert.match(patched, /\$\(inherited\)/);
});

test('unrelated compilation conditions (e.g. DEBUG) are preserved', () => {
  const body = [
    '\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = (',
    '\t\t\t\t"$(inherited)",',
    '\t\t\t\tDEBUG,',
    '\t\t\t);',
    '',
  ].join('\n');
  const patched = ensureSwiftCompilationConditions(body, ['AGORA_HAS_CONTENT_INSPECT']);

  assert.match(patched, /DEBUG/);
  assert.match(patched, /AGORA_HAS_CONTENT_INSPECT/);
});

test('applying the same flags twice is idempotent', () => {
  const body = '\t\t\tSWIFT_VERSION = 5.0;\n';
  const once = ensureSwiftCompilationConditions(body, ['AGORA_HAS_CONTENT_INSPECT']);
  const twice = ensureSwiftCompilationConditions(once, ['AGORA_HAS_CONTENT_INSPECT']);

  assert.equal(once, twice);
  assert.equal(
    [...once.matchAll(/AGORA_HAS_CONTENT_INSPECT/g)].length,
    1,
    'flag must not be duplicated on re-run',
  );
});

// --- Single source of truth: the product -> flag map lives in one place. ---
//
// The gating mechanism spans three files:
//   1. AgoraRtcBridge.swift      — wraps code in `#if <FLAG>`
//   2. sdk-config.json           — ios.productCompilationFlags maps product -> <FLAG>
//   3. hooks.js / integrate-ios-project.rb — both READ that map (no hardcoding)
// The map is defined once in sdk-config.json, so the two build scripts cannot
// drift from each other. These tests pin the bridge's `#if` flags to that map,
// and prove the scripts read it rather than carrying their own copy.

test('every #if flag in the iOS bridge is declared in sdk-config productCompilationFlags', async () => {
  const bridgeSource = await readFile(bridgePath, 'utf8');
  const declaredFlags = new Set<string>(
    Object.values(sourceConfig.ios.productCompilationFlags ?? {}),
  );
  const bridgeFlags = new Set(
    [...bridgeSource.matchAll(/^\s*#if\s+([A-Za-z0-9_]+)\s*$/gm)].map((m) => m[1]),
  );

  for (const flag of bridgeFlags) {
    assert.ok(
      declaredFlags.has(flag),
      `bridge uses #if ${flag} but sdk-config.json ios.productCompilationFlags does not declare it`,
    );
  }
});

test('hooks.js loads the product->flag map from sdk-config (not a private copy)', () => {
  assert.deepEqual(
    PRODUCT_COMPILATION_FLAGS,
    sourceConfig.ios.productCompilationFlags ?? {},
    'hooks.js PRODUCT_COMPILATION_FLAGS must come from sdk-config.json, not be hardcoded',
  );
});

test('integrate-ios-project.rb reads the map from config instead of hardcoding it', async () => {
  const rubySource = await readFile(
    path.join(repoRoot, 'scripts/integrate-ios-project.rb'),
    'utf8',
  );

  // It must source the map from the config object...
  assert.match(
    rubySource,
    /PRODUCT_COMPILATION_FLAGS = \(IOS_CONFIG\['productCompilationFlags'\]/,
    'integrate-ios-project.rb must read productCompilationFlags from sdk-config.json',
  );
  // ...and must NOT carry an inline literal table that could drift.
  assert.doesNotMatch(
    rubySource,
    /PRODUCT_COMPILATION_FLAGS = \{[^}]*=>/,
    'integrate-ios-project.rb must not hardcode a product->flag table',
  );
});
