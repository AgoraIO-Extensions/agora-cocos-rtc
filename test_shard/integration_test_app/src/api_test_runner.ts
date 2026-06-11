import { native, sys } from 'cc';

import { createAgoraRtcClient, type AgoraRtcClient } from '../../../extensions/agora-rtc/js/agora.ts';
import { resolveBridgeTransport } from '../../../extensions/agora-rtc/js/internal/bridge.ts';
import { API_CALL_TESTCASES, type ApiCallCase, type ApiTestContext } from './api_call_testcases.ts';
import { getWritablePath, writeJsonReport, type ApiCaseReport, type ApiTestReport } from './api_test_report.ts';

const LOG_PREFIX = '[agora-cocos-test]';
const BRIDGE_READY_TIMEOUT_MS = 30000;
const BRIDGE_READY_POLL_MS = 250;

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readEnv(name: string, fallback = ''): string {
  const globalValue = (globalThis as any)[name];
  if (typeof globalValue === 'string' && globalValue.length > 0) {
    return globalValue;
  }
  return fallback;
}

function createContext(): ApiTestContext {
  const writablePath = getWritablePath();
  return {
    appId: readEnv('TEST_APP_ID', readEnv('APP_ID')),
    token: readEnv('TEST_TOKEN'),
    channelId: readEnv('TEST_CHANNEL_ID', 'testapi'),
    uid: Number(readEnv('TEST_UID', '0')),
    logFilePath: `${writablePath}agora-cocos-api-test.log`,
    audioAssetPath: `${writablePath}Agora.io-Interactions.mp3`,
  };
}

function createNativeBridgeRuntime() {
  return {
    native,
    sys,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForNativeBridge(): Promise<void> {
  const startedAt = Date.now();
  let lastLoggedSecond = -1;

  while (Date.now() - startedAt < BRIDGE_READY_TIMEOUT_MS) {
    if (resolveBridgeTransport(createNativeBridgeRuntime())) {
      console.log(`${LOG_PREFIX} TEST_BRIDGE_READY waitedMs=${Date.now() - startedAt}`);
      return;
    }

    const elapsedSecond = Math.floor((Date.now() - startedAt) / 1000);
    if (elapsedSecond !== lastLoggedSecond) {
      lastLoggedSecond = elapsedSecond;
      console.log(`${LOG_PREFIX} TEST_WAIT_BRIDGE elapsedMs=${Date.now() - startedAt}`);
    }

    await sleep(BRIDGE_READY_POLL_MS);
  }

  throw new Error(`Cocos native bridge was not ready within ${BRIDGE_READY_TIMEOUT_MS}ms.`);
}

function serializeError(error: unknown): ApiCaseReport['error'] {
  const candidate = error as {
    name?: string;
    message?: string;
    code?: string;
    details?: Record<string, unknown>;
  };
  return {
    name: candidate?.name,
    message: candidate?.message ?? String(error),
    code: candidate?.code,
    details: candidate?.details,
  };
}

function isNativeErrorEvidence(
  serializedError: ApiCaseReport['error'],
  testcase: ApiCallCase,
): boolean {
  return serializedError.code === 'native_failure' && serializedError.details?.method === testcase.method;
}

async function runCase(client: AgoraRtcClient, context: ApiTestContext, testcase: ApiCallCase): Promise<ApiCaseReport> {
  const startedAt = new Date().toISOString();
  console.log(`${LOG_PREFIX} CASE_START id=${testcase.id} method=${testcase.method} expectedParams=${stringify(testcase.expectedParams)}`);

  try {
    const result = await testcase.run(client, context);
    const endedAt = new Date().toISOString();
    console.log(`${LOG_PREFIX} CASE_PASS id=${testcase.id} method=${testcase.method} result=${stringify(result ?? null)}`);
    return {
      id: testcase.id,
      method: testcase.method,
      expectedParams: testcase.expectedParams,
      requiredEvidence: testcase.requiredEvidence,
      startedAt,
      endedAt,
      status: 'passed',
      result: result ?? null,
    };
  } catch (error) {
    const endedAt = new Date().toISOString();
    const serializedError = serializeError(error);
    const allowsError = testcase.requiredEvidence.includes('error') && isNativeErrorEvidence(serializedError, testcase);
    console.log(`${LOG_PREFIX} CASE_${allowsError ? 'PASS' : 'FAIL'} id=${testcase.id} method=${testcase.method} error=${stringify(serializedError)}`);
    return {
      id: testcase.id,
      method: testcase.method,
      expectedParams: testcase.expectedParams,
      requiredEvidence: testcase.requiredEvidence,
      startedAt,
      endedAt,
      status: allowsError ? 'passed' : 'failed',
      error: serializedError,
    };
  }
}

export async function runAgoraCocosApiTests(): Promise<ApiTestReport> {
  const context = createContext();
  const startedAt = new Date().toISOString();

  if (!context.appId) {
    throw new Error('TEST_APP_ID or APP_ID is required for Cocos API integration tests.');
  }

  await waitForNativeBridge();
  const client = createAgoraRtcClient({
    bridgeRuntime: createNativeBridgeRuntime(),
    timeoutMs: 15000,
  });

  console.log(`${LOG_PREFIX} TEST_START mode=api platform=${sys.os} cases=${API_CALL_TESTCASES.length}`);

  const cases: ApiCaseReport[] = [];
  for (const testcase of API_CALL_TESTCASES) {
    cases.push(await runCase(client, context, testcase));
  }

  const failed = cases.filter((entry) => entry.status === 'failed').length;
  const passed = cases.length - failed;
  const report: ApiTestReport = {
    platform: String(sys.os),
    mode: 'api',
    startedAt,
    endedAt: new Date().toISOString(),
    totals: {
      passed,
      failed,
      total: cases.length,
    },
    cases,
  };
  const reportPath = writeJsonReport(report);
  const status = failed === 0 ? 'pass' : 'fail';
  console.log(`${LOG_PREFIX} TEST_DONE status=${status} passed=${passed} failed=${failed} total=${cases.length} report=${reportPath}`);
  return report;
}

export function maybeRunAgoraCocosApiTests(): void {
  const mode = readEnv('AGORA_COCOS_TEST_MODE');
  if (mode !== 'api') {
    return;
  }
  if (sys.os !== sys.OS.IOS && sys.os !== sys.OS.ANDROID) {
    console.log(`${LOG_PREFIX} TEST_SKIP reason=unsupported-platform platform=${sys.os}`);
    return;
  }

  void runAgoraCocosApiTests().catch((error) => {
    console.error(`${LOG_PREFIX} TEST_DONE status=fail error=${stringify(serializeError(error))}`);
  });
}
