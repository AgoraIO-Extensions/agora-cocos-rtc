import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

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
  assert.match(
    testcasesContent,
    /id:\s*'channel\.join'[\s\S]*?expectedParams:[\s\S]*options:[\s\S]*clientRoleType:\s*'broadcaster'[\s\S]*publishCameraTrack:\s*true[\s\S]*publishMicrophoneTrack:\s*false[\s\S]*autoSubscribeAudio:\s*true[\s\S]*autoSubscribeVideo:\s*true/,
    'device join testcase should record TS-provided ChannelMediaOptions',
  );
  assert.match(
    testcasesContent,
    /id:\s*'channel\.join'[\s\S]*?run:\s*\(client, context\) => client\.joinChannel\([\s\S]*?\{[\s\S]*clientRoleType:\s*'broadcaster'/,
    'device join testcase should execute native joinChannel with options',
  );
  assert.match(
    testcasesContent,
    /id:\s*'mixing\.start'[\s\S]*?expectedParams:[\s\S]*?startPos:\s*0[\s\S]*?run:\s*\(client, context\) => client\.startAudioMixing\(\{[\s\S]*?startPos:\s*0,[\s\S]*?\}\)/,
    'device startAudioMixing testcase should exercise the supported 4.5.3 bridge signature',
  );
  const mixingStartCase = testcasesContent.match(/id:\s*'mixing\.start'[\s\S]*?id:\s*'mixing\.pause'/)?.[0] ?? '';
  assert.doesNotMatch(
    mixingStartCase,
    /\breplace\b/,
    'device startAudioMixing testcase must not pass unsupported replace, even when false',
  );
  assert.match(testcasesContent, /renderMode/);
});

test('cocos api test mode isolates the demo runtime from the device runner', async () => {
  const demoRootContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const sessionServiceContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  assert.match(demoRootContent, /AGORA_COCOS_TEST_MODE/);
  assert.match(
    demoRootContent,
    /if\s*\(\s*this\.isCocosTestMode\(\)\s*\)[\s\S]*?return;/,
    'demo root should not initialize or preview RTC while API tests own the native engine',
  );
  assert.match(
    sessionServiceContent,
    /this\.setupRemoteVideoView\(uid\)\.catch/,
    'background remote view setup should not produce unhandled promise rejections',
  );
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
    'mixing.position-value',
    'mixing.set-position',
    'effect.pause',
    'effect.resume',
    'mixing.adjust-publish-volume',
    'mixing.adjust-playout-volume',
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

test('cocos runner injection supports the dynamic prefab bootstrap mount point', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-inject-'));
  await mkdir(`${fixtureRoot}/scripts`, { recursive: true });
  await mkdir(`${fixtureRoot}/example/basic-call/assets/scripts`, { recursive: true });
  await mkdir(`${fixtureRoot}/test_shard/integration_test_app`, { recursive: true });
  await cp(
    `${repoRoot}/test_shard/integration_test_app/src`,
    `${fixtureRoot}/test_shard/integration_test_app/src`,
    { recursive: true },
  );
  await writeFile(
    `${fixtureRoot}/scripts/inject-cocos-test-runner.mjs`,
    await readFile(`${repoRoot}/scripts/inject-cocos-test-runner.mjs`, 'utf8'),
    'utf8',
  );
  await writeFile(
    `${fixtureRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`,
    await readFile(`${repoRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`, 'utf8'),
    'utf8',
  );

  await execFileAsync('node', ['./scripts/inject-cocos-test-runner.mjs'], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      AGORA_COCOS_TEST_MODE: 'api',
      TEST_APP_ID: 'test-app-id',
    },
  });

  const bootstrapContent = await readFile(
    `${fixtureRoot}/example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`,
    'utf8',
  );
  const injectedRunnerContent = await readFile(
    `${fixtureRoot}/example/basic-call/assets/scripts/cocos-device-tests/api_test_runner.ts`,
    'utf8',
  );
  const injectedTestcasesContent = await readFile(
    `${fixtureRoot}/example/basic-call/assets/scripts/cocos-device-tests/api_call_testcases.ts`,
    'utf8',
  );
  assert.match(
    bootstrapContent,
    /import \{ runAgoraCocosDeviceTestsWhenReady \} from '\.\/cocos-device-tests\/test-mode\.ts';/,
  );
  assert.match(bootstrapContent, /runAgoraCocosDeviceTestsWhenReady\(\);\n\n  return true;/);
  assert.doesNotMatch(injectedRunnerContent, /\.\.\/\.\.\/agora-rtc-sdk/);
  assert.doesNotMatch(injectedTestcasesContent, /\.\.\/\.\.\/agora-rtc-sdk/);
  assert.match(injectedRunnerContent, /\.\.\/\.\.\/\.\.\/extensions\/agora-rtc\/js\/agora\.ts/);
  assert.match(injectedRunnerContent, /\.\.\/\.\.\/\.\.\/extensions\/agora-rtc\/js\/internal\/bridge\.ts/);
  assert.match(injectedTestcasesContent, /\.\.\/\.\.\/\.\.\/extensions\/agora-rtc\/js\/agora\.ts/);
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
  assert.match(androidScript, /cocos-android-\$\{GITHUB_RUN_ID:-local\}-\$\{GITHUB_RUN_ATTEMPT:-1\}/);
  assert.match(androidScript, /TEST_CHANNEL_ID="\$\{TEST_CHANNEL_ID:-\$\{CHANNEL_ID:-\$DEFAULT_TEST_CHANNEL_ID\}\}"/);
  assert.match(androidScript, /TEST_UID="\$\{TEST_UID:-1001\}"/);
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
  assert.match(iosScript, /cocos-ios-\$\{GITHUB_RUN_ID:-local\}-\$\{GITHUB_RUN_ATTEMPT:-1\}/);
  assert.match(iosScript, /TEST_CHANNEL_ID="\$\{TEST_CHANNEL_ID:-\$\{CHANNEL_ID:-\$DEFAULT_TEST_CHANNEL_ID\}\}"/);
  assert.match(iosScript, /TEST_UID="\$\{TEST_UID:-1002\}"/);
  assert.match(iosScript, /xcrun simctl/);
  assert.match(iosScript, /TEST_TIMEOUT_SECONDS/);
  assert.match(iosScript, /SECONDS=0[\s\S]*while \[\[ \$SECONDS -lt \$TEST_TIMEOUT_SECONDS \]\]/);
  assert.match(iosScript, /while .*SECONDS/);
  assert.match(iosScript, /TEST_DONE status=/);
  assert.match(iosScript, /TEST_DONE status=fail/);
  assert.match(iosScript, /collect-cocos-test-report\.mjs/);
  assert.match(iosScript, /run_cocos_build "\$COCOS_BUILD_CONFIG" "iOS"/);
  assert.match(iosScript, /exit_code -ne 0 && \$exit_code -ne 36/);
  assert.match(iosScript, /PROJECT_PATH="\$IOS_PROJECT_DIR\/agora-cocos-basic-call\.xcodeproj"/);
  assert.match(iosScript, /SCHEME_NAME="agora-cocos-basic-call-mobile"/);
  assert.match(iosScript, /xcodebuild -project "\$PROJECT_PATH"/);
  assert.match(iosScript, /-scheme "\$SCHEME_NAME"/);
  assert.match(iosScript, /-derivedDataPath "\$DERIVED_DATA_PATH"/);
  assert.doesNotMatch(iosScript, /WORKSPACE_PATH=/);
  assert.doesNotMatch(iosScript, /TARGET_NAME=/);
  assert.doesNotMatch(iosScript, /\s-target(\s|=)/);
  assert.doesNotMatch(iosScript, /generate-ios-podfile\.mjs/);
  assert.doesNotMatch(iosScript, /pod install/);
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
