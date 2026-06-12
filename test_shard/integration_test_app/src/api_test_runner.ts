import { native, sys } from 'cc';

import { createAgoraRtcClient, type AgoraRtcClient } from '../../agora-rtc-sdk/agora.ts';
import {
  BRIDGE_CALLBACK_EVENT,
  BRIDGE_REQUEST_EVENT,
  BRIDGE_RESPONSE_EVENT,
  type CocosJsbBridgeTransport,
} from '../../agora-rtc-sdk/types.ts';
import { resolveBridgeTransport } from '../../agora-rtc-sdk/internal/bridge.ts';
import { API_CALL_TESTCASES, type ApiCallCase, type ApiTestContext } from './api_call_testcases.ts';
import { getWritablePath, writeJsonReport, type ApiCaseReport, type ApiTestReport } from './api_test_report.ts';

const LOG_PREFIX = '[agora-cocos-test]';
const BRIDGE_READY_TIMEOUT_MS = 30000;
const BRIDGE_READY_POLL_MS = 250;
const EVENT_SETTLE_MS = 200;

type RecordedRequest = {
  method: string;
  params: Record<string, unknown>;
};

type CaseEvidence = {
  observedEvents: string[];
  observedParams: Record<string, unknown> | null;
  observedRequestValue: unknown;
};

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

function createNativeBridgeRuntime(transport?: CocosJsbBridgeTransport | null) {
  return {
    native: {
      ...native,
      jsbBridgeWrapper: transport ?? native.jsbBridgeWrapper,
    },
    sys,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForNativeBridge(): Promise<CocosJsbBridgeTransport> {
  const startedAt = Date.now();
  let lastLoggedSecond = -1;

  while (Date.now() - startedAt < BRIDGE_READY_TIMEOUT_MS) {
    const transport = resolveBridgeTransport(createNativeBridgeRuntime());
    if (transport) {
      console.log(`${LOG_PREFIX} TEST_BRIDGE_READY waitedMs=${Date.now() - startedAt}`);
      return transport;
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

function normalizeExpectedValue(value: unknown, context: ApiTestContext): unknown {
  if (value === '<TEST_APP_ID>') {
    return context.appId;
  }
  if (value === '<TEST_TOKEN>') {
    return context.token;
  }
  if (value === '<TEST_CHANNEL_ID>') {
    return context.channelId;
  }
  if (value === '<TEST_UID>') {
    return context.uid;
  }
  if (value === '<WRITABLE>/agora-cocos-api-test.log') {
    return context.logFilePath;
  }
  if (value === '<AUDIO_ASSET>') {
    return context.audioAssetPath;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeExpectedValue(entry, context));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeExpectedValue(entry, context),
      ]),
    );
  }
  return value;
}

function shallowCloneParams(params: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(params)) as Record<string, unknown>;
}

function createObservedTransport(
  baseTransport: CocosJsbBridgeTransport,
  requests: RecordedRequest[],
  observedEvents: string[],
): CocosJsbBridgeTransport {
  const wrapped: CocosJsbBridgeTransport = {
    ...baseTransport,
    dispatchEventToNative(eventName, payload) {
      if (eventName === BRIDGE_REQUEST_EVENT) {
        try {
          const parsed = JSON.parse(payload) as { method?: string; params?: Record<string, unknown> };
          if (parsed.method) {
            requests.push({
              method: parsed.method,
              params: shallowCloneParams((parsed.params ?? {}) as Record<string, unknown>),
            });
          }
        } catch {
          // Ignore malformed test instrumentation payloads and let the real bridge fail them.
        }
      }
      baseTransport.dispatchEventToNative?.(eventName, payload);
    },
    dispatchEventToScript(eventName, payload) {
      if (eventName === BRIDGE_REQUEST_EVENT) {
        try {
          const parsed = JSON.parse(payload) as { method?: string; params?: Record<string, unknown> };
          if (parsed.method) {
            requests.push({
              method: parsed.method,
              params: shallowCloneParams((parsed.params ?? {}) as Record<string, unknown>),
            });
          }
        } catch {
          // Ignore malformed test instrumentation payloads and let the real bridge fail them.
        }
      }
      baseTransport.dispatchEventToScript?.(eventName, payload);
    },
    addNativeEventListener(eventName, listener) {
      if (eventName === BRIDGE_CALLBACK_EVENT) {
        baseTransport.addNativeEventListener?.(eventName, (payload) => {
          try {
            const parsed = JSON.parse(payload) as { eventName?: string };
            if (parsed.eventName) {
              observedEvents.push(parsed.eventName);
            }
          } catch {
            // Keep the original listener behavior for malformed payloads.
          }
          listener(payload);
        });
        return;
      }
      baseTransport.addNativeEventListener?.(eventName, listener);
    },
    addScriptEventListener(eventName, listener) {
      if (eventName === BRIDGE_CALLBACK_EVENT) {
        baseTransport.addScriptEventListener?.(eventName, (payload) => {
          try {
            const parsed = JSON.parse(payload) as { eventName?: string };
            if (parsed.eventName) {
              observedEvents.push(parsed.eventName);
            }
          } catch {
            // Keep the original listener behavior for malformed payloads.
          }
          listener(payload);
        });
        return;
      }
      baseTransport.addScriptEventListener?.(eventName, listener);
    },
  };

  if (baseTransport.removeNativeEventListener) {
    wrapped.removeNativeEventListener = baseTransport.removeNativeEventListener.bind(baseTransport);
  }
  if (baseTransport.removeScriptEventListener) {
    wrapped.removeScriptEventListener = baseTransport.removeScriptEventListener.bind(baseTransport);
  }

  return wrapped;
}

function collectCaseEvidence(
  testcase: ApiCallCase,
  context: ApiTestContext,
  requests: RecordedRequest[],
  observedEvents: string[],
  requestValue: unknown,
): {
  observedParams: Record<string, unknown> | null;
  observedEvents: string[];
  observedRequestValue: unknown;
  expectedParamsMatch: boolean;
  requiredEvidenceSatisfied: boolean;
} {
  const request = [...requests].reverse().find((entry) => entry.method === testcase.method) ?? null;
  const observedParams = request?.params ?? null;
  const normalizedExpectedParams = normalizeExpectedValue(testcase.expectedParams, context) as Record<string, unknown>;
  const expectedParamsMatch = observedParams !== null && stringify(observedParams) === stringify(normalizedExpectedParams);
  const expectedEventNames = testcase.expectedEventNames ?? [];

  const requiredEvidenceSatisfied = testcase.requiredEvidence.every((evidenceKind) => {
    switch (evidenceKind) {
      case 'response':
        return observedParams !== null;
      case 'event':
        return expectedEventNames.length > 0
          ? expectedEventNames.every((eventName) => observedEvents.includes(eventName))
          : observedEvents.length > 0;
      case 'value':
        return requestValue !== null && requestValue !== undefined;
      case 'error':
        return false;
      default:
        return false;
    }
  });

  return {
    observedParams,
    observedEvents: [...observedEvents],
    observedRequestValue: requestValue,
    expectedParamsMatch,
    requiredEvidenceSatisfied,
  };
}

async function runCase(
  client: AgoraRtcClient,
  context: ApiTestContext,
  testcase: ApiCallCase,
  requests: RecordedRequest[],
  observedEvents: string[],
): Promise<ApiCaseReport> {
  const startedAt = new Date().toISOString();
  const requestStartIndex = requests.length;
  const eventStartIndex = observedEvents.length;
  console.log(`${LOG_PREFIX} CASE_START id=${testcase.id} method=${testcase.method} expectedParams=${stringify(testcase.expectedParams)}`);

  try {
    const result = await testcase.run(client, context);
    await sleep(EVENT_SETTLE_MS);
    const evidence = collectCaseEvidence(
      testcase,
      context,
      requests.slice(requestStartIndex),
      observedEvents.slice(eventStartIndex),
      result ?? null,
    );
    const endedAt = new Date().toISOString();
    const passed = evidence.expectedParamsMatch && evidence.requiredEvidenceSatisfied;
    console.log(
      `${LOG_PREFIX} CASE_${passed ? 'PASS' : 'FAIL'} id=${testcase.id} method=${testcase.method} result=${stringify(result ?? null)} observedParams=${stringify(evidence.observedParams)} observedEvents=${stringify(evidence.observedEvents)} expectedParamsMatch=${evidence.expectedParamsMatch} requiredEvidenceSatisfied=${evidence.requiredEvidenceSatisfied}`,
    );
    return {
      id: testcase.id,
      method: testcase.method,
      expectedParams: testcase.expectedParams,
      requiredEvidence: testcase.requiredEvidence,
      expectedEventNames: testcase.expectedEventNames,
      observedParams: evidence.observedParams ?? undefined,
      observedEvents: evidence.observedEvents,
      expectedParamsMatch: evidence.expectedParamsMatch,
      requiredEvidenceSatisfied: evidence.requiredEvidenceSatisfied,
      startedAt,
      endedAt,
      status: passed ? 'passed' : 'failed',
      result: result ?? null,
      error: passed
        ? undefined
        : {
            message: `Integration evidence mismatch for ${testcase.method}`,
            details: {
              observedRequestValue: evidence.observedRequestValue,
              expectedParamsMatch: evidence.expectedParamsMatch,
              requiredEvidenceSatisfied: evidence.requiredEvidenceSatisfied,
            },
          },
    };
  } catch (error) {
    await sleep(EVENT_SETTLE_MS);
    const serializedError = serializeError(error);
    const allowsError = testcase.requiredEvidence.includes('error') && isNativeErrorEvidence(serializedError, testcase);
    const evidence = collectCaseEvidence(
      testcase,
      context,
      requests.slice(requestStartIndex),
      observedEvents.slice(eventStartIndex),
      null,
    );
    const passed = allowsError && evidence.expectedParamsMatch;
    const endedAt = new Date().toISOString();
    console.log(
      `${LOG_PREFIX} CASE_${passed ? 'PASS' : 'FAIL'} id=${testcase.id} method=${testcase.method} error=${stringify(serializedError)} observedParams=${stringify(evidence.observedParams)} observedEvents=${stringify(evidence.observedEvents)} expectedParamsMatch=${evidence.expectedParamsMatch} requiredEvidenceSatisfied=${evidence.requiredEvidenceSatisfied}`,
    );
    return {
      id: testcase.id,
      method: testcase.method,
      expectedParams: testcase.expectedParams,
      requiredEvidence: testcase.requiredEvidence,
      expectedEventNames: testcase.expectedEventNames,
      observedParams: evidence.observedParams ?? undefined,
      observedEvents: evidence.observedEvents,
      expectedParamsMatch: evidence.expectedParamsMatch,
      requiredEvidenceSatisfied: allowsError,
      startedAt,
      endedAt,
      status: passed ? 'passed' : 'failed',
      error: passed
        ? serializedError
        : {
            ...serializedError,
            details: {
              ...(serializedError.details ?? {}),
              expectedParamsMatch: evidence.expectedParamsMatch,
              observedParams: evidence.observedParams ?? null,
            },
          },
    };
  }
}

export async function runAgoraCocosApiTests(): Promise<ApiTestReport> {
  const context = createContext();
  const startedAt = new Date().toISOString();

  if (!context.appId) {
    throw new Error('TEST_APP_ID or APP_ID is required for Cocos API integration tests.');
  }

  const baseTransport = await waitForNativeBridge();
  const requests: RecordedRequest[] = [];
  const observedEvents: string[] = [];
  const observedTransport = createObservedTransport(baseTransport, requests, observedEvents);
  const client = createAgoraRtcClient({
    bridgeRuntime: createNativeBridgeRuntime(observedTransport),
    timeoutMs: 15000,
  });

  console.log(`${LOG_PREFIX} TEST_START mode=api platform=${sys.os} cases=${API_CALL_TESTCASES.length}`);

  const cases: ApiCaseReport[] = [];
  for (const testcase of API_CALL_TESTCASES) {
    cases.push(await runCase(client, context, testcase, requests, observedEvents));
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
