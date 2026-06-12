import {
  Camera,
  director,
  native,
  RenderTexture,
  sys,
  view,
} from 'cc';

import { AgoraRtcExampleController } from '../../../example/basic-call/assets/scripts/AgoraRtcExampleController.ts';
import { RENDERING_SMOKE_TESTCASES, type RenderingSmokeCase } from './rendering_smoke_testcases.ts';

const LOG_PREFIX = '[agora-cocos-test]';
const CONTROLLER_READY_TIMEOUT_MS = 15000;
const EVIDENCE_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 100;
const SCREENSHOT_SUFFIX = 'rendering-report';

type RenderingCaseReport = {
  id: string;
  method: string;
  expectedParams: Record<string, unknown>;
  requiredEvidence: string[];
  startedAt: string;
  endedAt: string;
  status: 'passed' | 'failed';
  evidence?: {
    observedEvents: string[];
    screenshotPath?: string;
  };
  error?: {
    message: string;
  };
};

type RenderingReport = {
  platform: string;
  mode: string;
  startedAt: string;
  endedAt: string;
  totals: {
    passed: number;
    failed: number;
    total: number;
  };
  cases: RenderingCaseReport[];
};

function getWritablePath(): string {
  return (globalThis as any).jsb?.fileUtils?.getWritablePath?.() ?? '';
}

function writeRenderingReport(report: RenderingReport, filename = 'rendering-report.json'): string {
  const writablePath = getWritablePath();
  const outputPath = writablePath ? `${writablePath}${filename}` : filename;
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (sys.isNative && native.fileUtils) {
    native.fileUtils.writeStringToFile(json, outputPath);
  } else {
    console.log(LOG_PREFIX, json);
  }

  return outputPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForController(): Promise<AgoraRtcExampleController> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CONTROLLER_READY_TIMEOUT_MS) {
    const controller = director.getScene()
      ?.getChildByName('Canvas')
      ?.getComponent(AgoraRtcExampleController);
    if (controller) {
      return controller;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`AgoraRtcExampleController was not ready within ${CONTROLLER_READY_TIMEOUT_MS}ms.`);
}

function getExpectedEvidencePredicates(testcase: RenderingSmokeCase): Array<(events: string[]) => boolean> {
  return testcase.requiredEvidence
    .filter((evidence) => evidence !== 'screenshot')
    .map((evidence) => {
      if (evidence === 'backend-state') {
        return (events) => events.some((eventName) => eventName === 'renderBackendState');
      }
      if (evidence === 'texture-ready') {
        return (events) => events.some((eventName) => eventName === 'localVideoTextureReady');
      }
      return () => true;
    });
}

function patchControllerEventCapture(controller: AgoraRtcExampleController, observedEvents: string[]): void {
  const client = (controller as any).getClient?.call(controller);
  if (!client) {
    return;
  }
  for (const eventName of ['renderBackendState', 'localVideoTextureReady', 'remoteVideoTextureReady'] as const) {
    client.on(eventName, () => {
      observedEvents.push(eventName);
    });
  }
}

async function saveScreenshot(testcase: RenderingSmokeCase): Promise<string | undefined> {
  const writablePath = getWritablePath();
  if (!writablePath) {
    return undefined;
  }

  const canvasNode = director.getScene()?.getChildByName('Canvas');
  const camera = canvasNode?.getComponentInChildren(Camera);
  if (!camera) {
    return undefined;
  }

  const visibleSize = view.getVisibleSize();
  const width = Math.max(1, Math.floor(visibleSize.width));
  const height = Math.max(1, Math.floor(visibleSize.height));
  const renderTexture = new RenderTexture();
  renderTexture.reset({ width, height });
  camera.targetTexture = renderTexture;
  await sleep(150);
  camera.targetTexture = null;

  const pixelData = renderTexture.readPixels();
  if (!pixelData) {
    return undefined;
  }

  const filePath = `${writablePath}${SCREENSHOT_SUFFIX}.${testcase.screenshotName}`;
  await native.saveImageData(pixelData, width, height, filePath);
  return filePath;
}

async function runRenderingCase(controller: AgoraRtcExampleController, testcase: RenderingSmokeCase): Promise<RenderingCaseReport> {
  const startedAt = new Date().toISOString();
  const observedEvents: string[] = [];

  try {
    await (controller as any).teardownRtc?.call(controller);
    (controller as any).renderBackend = testcase.backend;
    (controller as any).localTextureReadySeen = false;
    (controller as any).remoteTextureReadySeen = false;
    patchControllerEventCapture(controller, observedEvents);

    if (testcase.backend === 'surface-view') {
      await controller.setSurfaceViewBackend();
    } else if (testcase.backend === 'texture-view') {
      await controller.setTextureViewBackend();
    } else {
      await controller.setEngineTextureBackend();
    }

    await controller.initializeRtc();
    const client = (controller as any).getClient?.call(controller);
    if (client) {
      await client.updateLocalVideoView(testcase.localRect);
    }

    const predicates = getExpectedEvidencePredicates(testcase);
    const evidenceStartedAt = Date.now();
    while (Date.now() - evidenceStartedAt < EVIDENCE_TIMEOUT_MS) {
      if (predicates.every((predicate) => predicate(observedEvents))) {
        break;
      }
      await sleep(POLL_INTERVAL_MS);
    }

    const screenshotPath = testcase.requiredEvidence.includes('screenshot')
      ? await saveScreenshot(testcase)
      : undefined;

    const missingEvidence = [
      ...(!predicates.every((predicate) => predicate(observedEvents)) ? ['event evidence'] : []),
      ...(testcase.requiredEvidence.includes('screenshot') && !screenshotPath ? ['screenshot'] : []),
    ];

    return {
      id: testcase.id,
      method: 'renderingSmoke',
      expectedParams: {
        backend: testcase.backend,
        localRect: testcase.localRect,
        screenshotName: testcase.screenshotName,
      },
      requiredEvidence: testcase.requiredEvidence,
      startedAt,
      endedAt: new Date().toISOString(),
      status: missingEvidence.length === 0 ? 'passed' : 'failed',
      evidence: {
        observedEvents,
        screenshotPath,
      },
      error: missingEvidence.length === 0
        ? undefined
        : { message: `Missing rendering evidence: ${missingEvidence.join(', ')}` },
    };
  } catch (error) {
    return {
      id: testcase.id,
      method: 'renderingSmoke',
      expectedParams: {
        backend: testcase.backend,
        localRect: testcase.localRect,
        screenshotName: testcase.screenshotName,
      },
      requiredEvidence: testcase.requiredEvidence,
      startedAt,
      endedAt: new Date().toISOString(),
      status: 'failed',
      evidence: {
        observedEvents,
      },
      error: {
        message: String(error),
      },
    };
  }
}

export async function runAgoraCocosRenderingSmokeTests(): Promise<RenderingReport> {
  const startedAt = new Date().toISOString();
  console.log(`${LOG_PREFIX} TEST_START mode=rendering platform=${sys.os} cases=${RENDERING_SMOKE_TESTCASES.length}`);

  const controller = await waitForController();
  const cases: RenderingCaseReport[] = [];
  for (const testcase of RENDERING_SMOKE_TESTCASES) {
    cases.push(await runRenderingCase(controller, testcase));
  }

  const failed = cases.filter((entry) => entry.status === 'failed').length;
  const report: RenderingReport = {
    platform: String(sys.os),
    mode: 'rendering',
    startedAt,
    endedAt: new Date().toISOString(),
    totals: {
      passed: cases.length - failed,
      failed,
      total: cases.length,
    },
    cases,
  };
  const reportPath = writeRenderingReport(report);
  console.log(`${LOG_PREFIX} TEST_DONE status=${failed === 0 ? 'pass' : 'fail'} passed=${cases.length - failed} failed=${failed} total=${cases.length} report=${reportPath}`);
  return report;
}

export function maybeRunAgoraCocosRenderingSmokeTests(): void {
  const mode = (globalThis as any).AGORA_COCOS_TEST_MODE;
  if (mode !== 'rendering') {
    return;
  }

  void runAgoraCocosRenderingSmokeTests().catch((error) => {
    console.error(`${LOG_PREFIX} TEST_DONE status=fail error=${String(error)}`);
  });
}
