import { sys } from 'cc';

import { createAgoraRtcClient, type AgoraRtcClient } from '../../agora-rtc-sdk/agora.ts';
import { API_CALL_TESTCASES, type ApiCallCase, type ApiTestContext } from './api_call_testcases.ts';
import { getWritablePath, writeJsonReport, type ApiCaseReport, type ApiTestReport } from './api_test_report.ts';

const LOG_PREFIX = '[agora-cocos-test]';

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
    uid: Number(readEnv('TEST_UID', '1001')),
    logFilePath: `${writablePath}agora-cocos-api-test.log`,
    audioAssetPath: `${writablePath}Agora.io-Interactions.mp3`,
  };
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
    const allowsError = testcase.requiredEvidence.includes('error');
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
  const client = createAgoraRtcClient({ timeoutMs: 15000 });

  if (!context.appId) {
    throw new Error('TEST_APP_ID or APP_ID is required for Cocos API integration tests.');
  }

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

  void runAgoraCocosApiTests().catch((error) => {
    console.error(`${LOG_PREFIX} TEST_DONE status=fail error=${stringify(serializeError(error))}`);
  });
}
