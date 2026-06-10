import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
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
  // The cleanup must kill the watchdog's whole tree (including its `sleep`
  // child); otherwise the orphaned sleep keeps the step's output pipe open and
  // the job hangs for ~the remaining timeout after the test already finished.
  assert.match(
    androidScript,
    /cleanup_android_test\(\)\s*\{[\s\S]*terminate_android_process_tree "\$ANDROID_TIMEOUT_WATCHDOG_PID"/,
  );
  assert.match(
    androidScript,
    /ANDROID_LAUNCH_ARGS=\(/,
    'android runner should build am start arguments explicitly',
  );
  assert.match(
    androidScript,
    /\[\[ -n "\$android_test_token" \]\][\s\S]*ANDROID_LAUNCH_ARGS\+=\(--es TEST_TOKEN "\$android_test_token"\)/,
    'android runner should not pass an empty TEST_TOKEN through adb shell am start',
  );
  assert.match(
    androidScript,
    /"\$ADB_BIN" "\$\{ANDROID_LAUNCH_ARGS\[@\]\}"/,
    'android runner should preserve launch argument boundaries with a bash array',
  );
  assert.match(androidScript, /SECONDS=0[\s\S]*while \[\[ \$SECONDS -lt \$TEST_TIMEOUT_SECONDS \]\]/);
  assert.match(androidScript, /while .*SECONDS/);
  assert.match(androidScript, /TEST_DONE status=/);
  assert.match(androidScript, /TEST_DONE status=fail/);
  assert.match(androidScript, /collect-cocos-test-report\.mjs/);
  assert.match(androidScript, /run-as "\$PACKAGE_NAME" cat "\$REPORT_REMOTE_PATH"/);
  assert.match(androidScript, /ANDROID_COCOS_BUILD_CONFIG=/);
  assert.match(androidScript, /ANDROID_TEST_NDK_HOME=/);
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
  // ccache: route the NDK build through a launcher when available so engine
  // objects are reused across CI runs. Flags appended after the task name.
  assert.match(androidScript, /CCACHE_INIT_SCRIPT/);
  assert.match(androidScript, /command -v ccache/);
  assert.match(androidScript, /GRADLE_CCACHE_ARGS=\(--init-script "\$CCACHE_INIT_SCRIPT"\)/);
  assert.match(androidScript, /assembleDebug \$\{GRADLE_CCACHE_ARGS\[@\]\+"\$\{GRADLE_CCACHE_ARGS\[@\]\}"\}/);
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
  assert.match(iosScript, /-target "\$SCHEME_NAME"/);
  assert.match(iosScript, /IOS_PRODUCTS_DIR="\$DERIVED_DATA_PATH\/Build\/Products"/);
  assert.match(iosScript, /IOS_INTERMEDIATES_DIR="\$DERIVED_DATA_PATH\/Build\/Intermediates\.noindex"/);
  assert.match(iosScript, /SYMROOT="\$IOS_PRODUCTS_DIR"/);
  assert.match(iosScript, /OBJROOT="\$IOS_INTERMEDIATES_DIR"/);
  assert.match(iosScript, /should_skip_simulator_launch_assets\(\)/);
  assert.match(iosScript, /simctl list runtimes -j/);
  assert.match(iosScript, /SDK_BUILD="\$sdk_build" node -e/);
  assert.match(iosScript, /runtime\.isAvailable === false/);
  assert.match(iosScript, /\/iOS\/i\.test\(identity\)/);
  assert.match(iosScript, /--skip-simulator-launch-assets/);
  assert.doesNotMatch(iosScript, /WORKSPACE_PATH=/);
  assert.doesNotMatch(iosScript, /TARGET_NAME=/);
  assert.doesNotMatch(iosScript, /-derivedDataPath "\$DERIVED_DATA_PATH"/);
  assert.doesNotMatch(iosScript, /generate-ios-podfile\.mjs/);
  assert.doesNotMatch(iosScript, /pod install/);
  assert.match(iosScript, /ios-diagnostic\.log/);
  assert.match(iosScript, /collect_ios_diagnostics/);
  assert.match(iosScript, /resolve_ios_simulator_udid\(\)/);
  assert.match(iosScript, /IOS_SIMULATOR_UDID="\$\(resolve_ios_simulator_udid\)"/);
  assert.match(iosScript, /simctl privacy "\$IOS_SIMULATOR_UDID" grant camera "\$IOS_BUNDLE_ID"/);
  assert.match(iosScript, /simctl privacy "\$IOS_SIMULATOR_UDID" grant microphone "\$IOS_BUNDLE_ID"/);
  assert.match(iosScript, /rm -f "\$IOS_REPORT_SIM_PATH"/);
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

test('ios simulator runtime filter uses piped simctl runtime json', async () => {
  const iosScript = await readFile(
    `${repoRoot}/scripts/run_cocos_integration_test_ios.sh`,
    'utf8',
  );
  const functionMatch = iosScript.match(
    /should_skip_simulator_launch_assets\(\) \{[\s\S]*?\n\}\n\nresolve_ios_simulator_udid/,
  );
  assert.ok(functionMatch, 'expected iOS simulator resource filter function');

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-runtime-filter-'));
  const binDir = path.join(tempRoot, 'bin');
  await mkdir(binDir, { recursive: true });
  await writeFile(
    path.join(binDir, 'xcodebuild'),
    `#!/usr/bin/env bash
if [[ "$*" == *"ProductBuildVersion"* ]]; then
  printf '%s\\n' "\${STUB_SDK_BUILD:-23F73}"
  exit 0
fi
exit 1
`,
    { encoding: 'utf8', mode: 0o755 },
  );
  await writeFile(
    path.join(binDir, 'xcrun'),
    `#!/usr/bin/env bash
if [[ "$1" == "simctl" && "$2" == "list" && "$3" == "runtimes" && "$4" == "-j" ]]; then
  printf '%s' "$STUB_RUNTIME_JSON"
  exit 0
fi
exit 1
`,
    { encoding: 'utf8', mode: 0o755 },
  );

  const functionSource = functionMatch[0].replace(/\n\nresolve_ios_simulator_udid$/, '');
  const runFilter = (runtimeData: unknown, sdkBuild = '23F73') =>
    spawnSync('bash', ['-c', `set -o pipefail\n${functionSource}\nshould_skip_simulator_launch_assets`], {
      encoding: 'utf8',
      env: {
        ...process.env,
        IOS_SIMULATOR_RESOURCE_MODE: 'auto',
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
        STUB_RUNTIME_JSON: JSON.stringify(runtimeData),
        STUB_SDK_BUILD: sdkBuild,
      },
    });

  assert.equal(
    runFilter({
      runtimes: [
        {
          name: 'iOS 26.5',
          identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5',
          isAvailable: true,
          buildversion: '23F73',
        },
      ],
    }).status,
    1,
    'matching available iOS runtime should keep simulator launch assets',
  );
  assert.equal(
    runFilter({
      runtimes: [
        {
          name: 'iOS 26.5',
          identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5',
          isAvailable: false,
          buildversion: '23F73',
        },
      ],
    }).status,
    0,
    'unavailable iOS runtime should skip simulator launch assets',
  );
  assert.equal(
    runFilter({
      runtimes: [
        {
          name: 'watchOS 26.5',
          identifier: 'com.apple.CoreSimulator.SimRuntime.watchOS-26-5',
          isAvailable: true,
          buildversion: '23F73',
        },
      ],
    }).status,
    0,
    'non-iOS runtime should skip simulator launch assets',
  );
});

test('android integration script prefers pinned test ndk over ambient ndk env', async () => {
  const androidScript = await readFile(
    `${repoRoot}/scripts/run_cocos_integration_test_android.sh`,
    'utf8',
  );
  const functionMatch = androidScript.match(
    /resolve_android_ndk_path\(\) \{[\s\S]*?\n\}\n\nwrite_android_cocos_build_config/,
  );
  assert.ok(functionMatch, 'expected Android NDK resolver function');

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-ndk-'));
  const sdkRoot = path.join(tempRoot, 'sdk');
  const ambientNdk = path.join(sdkRoot, 'ndk', '21.4.7075529');
  const pinnedNdk = path.join(sdkRoot, 'ndk', '23.1.7779620');
  const overrideNdk = path.join(sdkRoot, 'ndk', '25.1.8937393');

  await Promise.all([
    mkdir(ambientNdk, { recursive: true }),
    mkdir(pinnedNdk, { recursive: true }),
    mkdir(overrideNdk, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(ambientNdk, 'source.properties'), 'Pkg.Revision = 21.4.7075529\n', 'utf8'),
    writeFile(path.join(pinnedNdk, 'source.properties'), 'Pkg.Revision = 23.1.7779620\n', 'utf8'),
    writeFile(path.join(overrideNdk, 'source.properties'), 'Pkg.Revision = 25.1.8937393\n', 'utf8'),
  ]);

  const functionSource = functionMatch[0].replace(/\n\nwrite_android_cocos_build_config$/, '');
  const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const runResolver = (env: NodeJS.ProcessEnv) => {
    const shellEnv = [
      `ANDROID_SDK_ROOT=${shellQuote(env.ANDROID_SDK_ROOT ?? '')}`,
      `ANDROID_NDK_HOME=${shellQuote(env.ANDROID_NDK_HOME ?? '')}`,
      `ANDROID_NDK_ROOT=${shellQuote(env.ANDROID_NDK_ROOT ?? '')}`,
      `ANDROID_TEST_NDK_HOME=${shellQuote(env.ANDROID_TEST_NDK_HOME ?? '')}`,
    ].join('\n');

    return spawnSync('bash', ['-c', `${functionSource}\n${shellEnv}\nresolve_android_ndk_path`], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH ?? '',
      },
    });
  };

  const defaultResult = runResolver({
    ANDROID_SDK_ROOT: sdkRoot,
    ANDROID_NDK_HOME: ambientNdk,
  });
  assert.equal(defaultResult.status, 0);
  assert.equal(defaultResult.stdout.trim(), pinnedNdk);

  const overrideResult = runResolver({
    ANDROID_SDK_ROOT: sdkRoot,
    ANDROID_NDK_HOME: ambientNdk,
    ANDROID_TEST_NDK_HOME: overrideNdk,
  });
  assert.equal(overrideResult.status, 0);
  assert.equal(overrideResult.stdout.trim(), overrideNdk);
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
  // ccache wiring for the Android native build (cross-run object reuse).
  assert.match(workflow, /CCACHE_DIR: \$\{\{ github\.workspace \}\}\/\.ccache/);
  assert.match(workflow, /CCACHE_INIT_SCRIPT: \$\{\{ github\.workspace \}\}\/scripts\/ci\/ccache-init\.gradle/);
  assert.match(workflow, /brew install ccache/);
  assert.match(workflow, /name: Cache ccache objects[\s\S]*uses: actions\/cache@v4[\s\S]*\.ccache/);
  assert.match(workflow, /key: ccache-android-\$\{\{ runner\.os \}\}-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /restore-keys:[\s\S]*ccache-android-\$\{\{ runner\.os \}\}-/);
  assert.match(workflow, /bash scripts\/run_cocos_integration_test_android\.sh/);
  assert.match(workflow, /arch: x86_64/);
  assert.match(workflow, /integration_test_ios:/);
  assert.match(workflow, /futureware-tech\/simulator-action@v4/);
  assert.match(workflow, /bash scripts\/run_cocos_integration_test_ios\.sh/);
  assert.match(workflow, /test_shard\/integration_test_app\/reports/);
});

test('ccache gradle init script injects compiler launchers into native builds', async () => {
  const initScript = await readFile(`${repoRoot}/scripts/ci/ccache-init.gradle`, 'utf8');

  assert.match(initScript, /System\.getenv\('CCACHE_BIN'\)/);
  assert.match(initScript, /allprojects/);
  assert.match(initScript, /hasProperty\('android'\)/);
  assert.match(initScript, /-DCMAKE_C_COMPILER_LAUNCHER=/);
  assert.match(initScript, /-DCMAKE_CXX_COMPILER_LAUNCHER=/);
});
