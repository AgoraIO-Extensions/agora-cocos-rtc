import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = process.cwd();

function extractAgoraMethods(typesContent: string): string[] {
  const match = typesContent.match(/export type AgoraMethod =([\s\S]*?);/);
  assert.ok(match, 'AgoraMethod union should exist');
  return Array.from(match[1].matchAll(/\|\s+'([^']+)'/g), (entry) => entry[1]).sort();
}

test('cocos device test shard mirrors flutter-style integration and rendering layout', async () => {
  const files = await Promise.all([
    readFile(`${repoRoot}/test_shard/integration_test_app/src/api_call_testcases.ts`, 'utf8'),
    readFile(`${repoRoot}/test_shard/integration_test_app/src/api_test_runner.ts`, 'utf8'),
    readFile(`${repoRoot}/test_shard/integration_test_app/src/api_test_report.ts`, 'utf8'),
    readFile(`${repoRoot}/test_shard/rendering_test/src/rendering_smoke_testcases.ts`, 'utf8'),
    readFile(`${repoRoot}/scripts/inject-cocos-test-runner.mjs`, 'utf8'),
    readFile(`${repoRoot}/scripts/collect-cocos-test-report.mjs`, 'utf8'),
    readFile(`${repoRoot}/scripts/run_cocos_integration_test_android.sh`, 'utf8'),
    readFile(`${repoRoot}/scripts/run_cocos_integration_test_ios.sh`, 'utf8'),
  ]);

  assert.equal(files.length, 8);
});

test('cocos api test matrix covers every native Agora method and records parameter evidence', async () => {
  const typesContent = await readFile(`${repoRoot}/sdk/agora-rtc/js/types.ts`, 'utf8');
  const testcasesContent = await readFile(
    `${repoRoot}/test_shard/integration_test_app/src/api_call_testcases.ts`,
    'utf8',
  );
  const methods = extractAgoraMethods(typesContent);

  for (const method of methods) {
    assert.match(
      testcasesContent,
      new RegExp(`method:\\s*'${method}'`),
      `missing device API testcase for ${method}`,
    );
  }

  assert.match(testcasesContent, /expectedParams:/);
  assert.match(testcasesContent, /requiredEvidence:/);
  assert.match(testcasesContent, /lighteningContrastLevel/);
  assert.match(testcasesContent, /orientationMode/);
  assert.match(testcasesContent, /loopback/);
  assert.match(testcasesContent, /publish/);
  assert.match(testcasesContent, /renderMode/);
});

test('cocos device runner emits structured logs and writes a json report', async () => {
  const runnerContent = await readFile(
    `${repoRoot}/test_shard/integration_test_app/src/api_test_runner.ts`,
    'utf8',
  );
  const reportContent = await readFile(
    `${repoRoot}/test_shard/integration_test_app/src/api_test_report.ts`,
    'utf8',
  );

  assert.match(runnerContent, /\[agora-cocos-test\]/);
  assert.match(runnerContent, /TEST_DONE status=/);
  assert.match(runnerContent, /runAgoraCocosApiTests/);
  assert.match(reportContent, /writeJsonReport/);
  assert.match(reportContent, /api-report\.json/);
});

test('cocos runner injection imports test mode from the example bootstrap', async () => {
  const injectScript = await readFile(`${repoRoot}/scripts/inject-cocos-test-runner.mjs`, 'utf8');

  assert.match(injectScript, /AgoraRtcExampleBootstrap\.ts/);
  assert.match(injectScript, /cocos-device-tests\/test-mode\.ts/);
  assert.match(injectScript, /AGORA_COCOS_TEST_MODE/);
});

test('cocos integration scripts build and launch android and ios test apps', async () => {
  const androidScript = await readFile(
    `${repoRoot}/scripts/run_cocos_integration_test_android.sh`,
    'utf8',
  );
  const iosScript = await readFile(
    `${repoRoot}/scripts/run_cocos_integration_test_ios.sh`,
    'utf8',
  );

  assert.match(androidScript, /TEST_APP_ID/);
  assert.match(androidScript, /AGORA_COCOS_TEST_MODE=api/);
  assert.match(androidScript, /adb/);
  assert.match(androidScript, /logcat/);
  assert.match(androidScript, /TEST_TIMEOUT_SECONDS/);
  assert.match(androidScript, /while .*SECONDS/);
  assert.match(androidScript, /TEST_DONE status=/);
  assert.match(androidScript, /TEST_DONE status=fail/);
  assert.match(androidScript, /collect-cocos-test-report\.mjs/);

  assert.match(iosScript, /TEST_APP_ID/);
  assert.match(iosScript, /AGORA_COCOS_TEST_MODE=api/);
  assert.match(iosScript, /xcrun simctl/);
  assert.match(iosScript, /TEST_TIMEOUT_SECONDS/);
  assert.match(iosScript, /while .*SECONDS/);
  assert.match(iosScript, /TEST_DONE status=/);
  assert.match(iosScript, /TEST_DONE status=fail/);
  assert.match(iosScript, /collect-cocos-test-report\.mjs/);
});

test('cocos run_test workflow exposes unit and device integration jobs', async () => {
  const workflow = await readFile(`${repoRoot}/.github/workflows/run_test.yml`, 'utf8');

  assert.match(workflow, /name: 'run: test'/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_call:/);
  assert.match(workflow, /APP_ID:/);
  assert.match(workflow, /cocos_ut:/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /integration_test_android:/);
  assert.match(workflow, /reactivecircus\/android-emulator-runner@v2/);
  assert.match(workflow, /bash scripts\/run_cocos_integration_test_android\.sh/);
  assert.match(workflow, /integration_test_ios:/);
  assert.match(workflow, /futureware-tech\/simulator-action@v4/);
  assert.match(workflow, /bash scripts\/run_cocos_integration_test_ios\.sh/);
  assert.match(workflow, /test_shard\/integration_test_app\/reports/);
});
