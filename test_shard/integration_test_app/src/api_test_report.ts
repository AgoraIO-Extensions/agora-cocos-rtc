import { native, sys } from 'cc';

export type ApiCaseReport = {
  id: string;
  method: string;
  expectedParams: Record<string, unknown>;
  requiredEvidence: string[];
  expectedEventNames?: string[];
  observedParams?: Record<string, unknown>;
  observedEvents?: string[];
  expectedParamsMatch?: boolean;
  requiredEvidenceSatisfied?: boolean;
  startedAt: string;
  endedAt: string;
  status: 'passed' | 'failed';
  result?: unknown;
  error?: {
    name?: string;
    message: string;
    code?: string;
    details?: Record<string, unknown>;
  };
};

export type ApiTestReport = {
  platform: string;
  mode: string;
  startedAt: string;
  endedAt: string;
  totals: {
    passed: number;
    failed: number;
    total: number;
  };
  cases: ApiCaseReport[];
};

export function getWritablePath(): string {
  return (globalThis as any).jsb?.fileUtils?.getWritablePath?.() ?? '';
}

export function writeJsonReport(report: ApiTestReport, filename = 'api-report.json'): string {
  const writablePath = getWritablePath();
  const outputPath = writablePath ? `${writablePath}${filename}` : filename;
  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (sys.isNative && native.fileUtils) {
    native.fileUtils.writeStringToFile(json, outputPath);
  } else {
    console.log('[agora-cocos-test]', json);
  }

  return outputPath;
}
