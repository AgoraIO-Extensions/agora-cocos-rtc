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

test('cocos api testcases accept native error evidence for platform-sensitive calls', async () => {
  const testcasesContent = await readFile(
    `${repoRoot}/test_shard/integration_test_app/src/api_call_testcases.ts`,
    'utf8',
  );
  const platformSensitiveCaseIds = [
    'channel.renew-token',
    'audio.set-speakerphone',
    'audio.session-restriction',
    'video.beauty',
    'mixing.pause',
    'mixing.resume',
    'mixing.set-position',
  ];

  for (const caseId of platformSensitiveCaseIds) {
    assert.match(
      testcasesContent,
      new RegExp(`id:\\s*'${caseId}'[\\s\\S]*?requiredEvidence:\\s*\\['response',\\s*'error'\\]`),
      `${caseId} should accept native error evidence when the platform rejects the API after invocation`,
    );
  }
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
  assert.match(runnerContent, /sys\.OS\.IOS/);
  assert.match(runnerContent, /sys\.OS\.ANDROID/);
  assert.match(runnerContent, /waitForNativeBridge/);
  assert.match(runnerContent, /TEST_WAIT_BRIDGE/);
  assert.match(runnerContent, /TEST_BRIDGE_READY/);
  assert.match(runnerContent, /resolveBridgeTransport/);
  assert.match(runnerContent, /isNativeErrorEvidence/);
  assert.match(runnerContent, /serializedError\.code === 'native_failure'/);
  assert.match(runnerContent, /serializedError\.details\?\.method === testcase\.method/);
  assert.match(reportContent, /writeJsonReport/);
  assert.match(reportContent, /api-report\.json/);
});

test('cocos runner injection imports test mode from the example bootstrap', async () => {
  const injectScript = await readFile(`${repoRoot}/scripts/inject-cocos-test-runner.mjs`, 'utf8');

  assert.match(injectScript, /AgoraRtcExampleBootstrap\.ts/);
  assert.match(injectScript, /cocos-device-tests\/test-mode\.ts/);
  assert.match(injectScript, /AGORA_COCOS_TEST_MODE/);
  assert.match(injectScript, /TEST_MODE_LOADED/);
  assert.match(injectScript, /runAgoraCocosDeviceTestsWhenReady/);
  assert.doesNotMatch(injectScript, /maybeRunAgoraCocosApiTests\(\);/);
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

  assert.match(androidScript, /^#!\/usr\/bin\/env bash/);
  assert.match(androidScript, /TEST_APP_ID/);
  assert.match(androidScript, /AGORA_COCOS_TEST_MODE=api/);
  assert.match(androidScript, /adb/);
  assert.match(androidScript, /logcat/);
  assert.match(androidScript, /TEST_TIMEOUT_SECONDS/);
  assert.match(androidScript, /ANDROID_DIAGNOSTIC_LOG_PATH/);
  assert.match(androidScript, /ANDROID_SCRIPT_TIMEOUT_SECONDS/);
  assert.match(androidScript, /ANDROID_TEST_SCRIPT_PID/);
  assert.match(androidScript, /ANDROID_TIMEOUT_WATCHDOG_PID/);
  assert.match(androidScript, /collect_android_diagnostics/);
  assert.match(androidScript, /terminate_android_process_tree/);
  assert.match(androidScript, /run_android_script_with_timeout/);
  assert.match(androidScript, /sleep "\$ANDROID_SCRIPT_TIMEOUT_SECONDS"/);
  assert.match(androidScript, /kill -TERM "\$target_pid"/);
  assert.match(androidScript, /trap cleanup_android_test EXIT/);
  assert.match(androidScript, /SECONDS=0[\s\S]*while \[\[ \$SECONDS -lt \$TEST_TIMEOUT_SECONDS \]\]/);
  assert.match(androidScript, /while .*SECONDS/);
  assert.match(androidScript, /TEST_DONE status=/);
  assert.match(androidScript, /TEST_DONE status=fail/);
  assert.match(androidScript, /collect-cocos-test-report\.mjs/);
  assert.match(androidScript, /ANDROID_COCOS_BUILD_CONFIG=/);
  assert.match(androidScript, /ANDROID_TEST_ABI=/);
  assert.match(androidScript, /appABIs/);
  assert.match(androidScript, /android-apk-contents\.txt/);
  assert.match(androidScript, /lib\/\$required_abi\//);
  assert.match(androidScript, /write_android_cocos_build_config\(\)/);
  assert.match(androidScript, /sdkPath/);
  assert.match(androidScript, /ndkPath/);
  assert.match(androidScript, /run_cocos_build "\$ANDROID_COCOS_BUILD_CONFIG" "Android"/);
  assert.match(androidScript, /exit_code -ne 0 && \$exit_code -ne 36/);
  assert.match(androidScript, /ANDROID_GRADLE_OFFLINE=/);
  assert.match(androidScript, /\.\/gradlew :agora-cocos-basic-call:assembleDebug/);
  assert.match(androidScript, /\.\/gradlew --offline :agora-cocos-basic-call:assembleDebug/);
  assert.doesNotMatch(androidScript, /\$\{\(@f\)/);

  assert.match(iosScript, /^#!\/usr\/bin\/env bash/);
  assert.match(iosScript, /TEST_APP_ID/);
  assert.match(iosScript, /AGORA_COCOS_TEST_MODE=api/);
  assert.match(iosScript, /xcrun simctl/);
  assert.match(iosScript, /TEST_TIMEOUT_SECONDS/);
  assert.match(iosScript, /SECONDS=0[\s\S]*while \[\[ \$SECONDS -lt \$TEST_TIMEOUT_SECONDS \]\]/);
  assert.match(iosScript, /while .*SECONDS/);
  assert.match(iosScript, /TEST_DONE status=/);
  assert.match(iosScript, /TEST_DONE status=fail/);
  assert.match(iosScript, /collect-cocos-test-report\.mjs/);
  assert.match(iosScript, /run_cocos_build "\$COCOS_BUILD_CONFIG" "iOS"/);
  assert.match(iosScript, /exit_code -ne 0 && \$exit_code -ne 36/);
  assert.match(iosScript, /ios-diagnostic\.log/);
  assert.match(iosScript, /collect_ios_diagnostics/);
  assert.match(iosScript, /resolve_ios_simulator_udid\(\)/);
  assert.match(iosScript, /IOS_SIMULATOR_UDID="\$\(resolve_ios_simulator_udid\)"/);
  assert.match(iosScript, /simctl privacy "\$IOS_SIMULATOR_UDID" grant camera "\$IOS_BUNDLE_ID"/);
  assert.match(iosScript, /simctl privacy "\$IOS_SIMULATOR_UDID" grant microphone "\$IOS_BUNDLE_ID"/);
  assert.match(iosScript, /simctl install "\$IOS_SIMULATOR_UDID" "\$APP_PATH"/);
  assert.match(iosScript, /simctl get_app_container "\$IOS_SIMULATOR_UDID" "\$IOS_BUNDLE_ID" data/);
  assert.doesNotMatch(iosScript, /simctl (spawn|install|privacy|launch|get_app_container|io) booted/);
  assert.match(iosScript, /IOS_REPORT_SIM_PATH="\$IOS_CONTAINER_PATH\/Documents\/api-report\.json"/);
  assert.match(iosScript, /\[\[ -n "\$IOS_REPORT_SIM_PATH" && -s "\$IOS_REPORT_SIM_PATH" \]\]/);
  assert.match(iosScript, /ios_report_has_failures "\$IOS_REPORT_SIM_PATH"/);
  assert.match(iosScript, /ios-launch\.log/);
  assert.match(iosScript, /ios-stdout\.log/);
  assert.match(iosScript, /ios-stderr\.log/);
  assert.match(iosScript, /--stdout="\$IOS_STDOUT_LOG_PATH"/);
  assert.match(iosScript, /--stderr="\$IOS_STDERR_LOG_PATH"/);
  assert.match(iosScript, /append_ios_runtime_logs/);
  assert.match(iosScript, /ios-timeout-screenshot\.png/);
});

test('cocos run_test workflow exposes unit and device integration jobs', async () => {
  const workflow = await readFile(`${repoRoot}/.github/workflows/run_test.yml`, 'utf8');

  assert.match(workflow, /name: 'run: test'/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /workflow_call:/);
  assert.match(workflow, /APP_ID:/);
  assert.match(workflow, /cocos_ut:/);
  assert.match(workflow, /cocos_ut:[\s\S]*runs-on: macos-latest/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /integration_test_android:/);
  assert.match(workflow, /integration_test_android:[\s\S]*runs-on: macos-15-intel/);
  assert.match(workflow, /ANDROID_TEST_ABI: x86_64/);
  assert.match(workflow, /name: Setup Android SDK for Cocos/);
  assert.match(workflow, /cmdline-tools\/latest\/bin\/sdkmanager/);
  assert.match(workflow, /ndk;23\.1\.7779620/);
  assert.match(workflow, /ANDROID_NDK_HOME=/);
  assert.match(workflow, /reactivecircus\/android-emulator-runner@v2/);
  assert.match(workflow, /Run Android Cocos API tests[\s\S]*timeout-minutes: 45/);
  assert.match(workflow, /bash scripts\/run_cocos_integration_test_android\.sh/);
  assert.match(workflow, /arch: x86_64/);
  assert.match(workflow, /integration_test_ios:/);
  assert.match(workflow, /futureware-tech\/simulator-action@v4/);
  assert.match(workflow, /bash scripts\/run_cocos_integration_test_ios\.sh/);
  assert.match(workflow, /test_shard\/integration_test_app\/reports/);
});
