import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const platform = process.argv[2] || process.env.TEST_PLATFORM || 'unknown';
const sourcePath = process.argv[3] || '';
const sourceJson = process.env.TEST_REPORT_JSON || '';
const reportDir = path.join(repoRoot, 'test_shard/integration_test_app/reports');

await mkdir(reportDir, { recursive: true });

let report = {
  platform,
  mode: process.env.AGORA_COCOS_TEST_MODE || 'api',
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  totals: { passed: 0, failed: 1, total: 1 },
  cases: [
    {
      id: 'report.collection',
      method: 'collectReport',
      expectedParams: { sourcePath },
      requiredEvidence: ['response'],
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: 'failed',
      error: { message: 'No runtime report path was provided.' },
    },
  ],
};

if (sourceJson) {
  report = JSON.parse(sourceJson);
} else if (sourcePath) {
  report = JSON.parse(await readFile(sourcePath, 'utf8'));
}

const mode = report.mode || process.env.AGORA_COCOS_TEST_MODE || 'api';
const reportBaseName = mode === 'rendering' ? 'rendering-report' : 'api-report';
const jsonPath = path.join(reportDir, `${platform}-${reportBaseName}.json`);
const markdownPath = path.join(reportDir, `${platform}-${reportBaseName}.md`);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(
  markdownPath,
  [
    `# Cocos ${platform} ${mode === 'rendering' ? 'Rendering' : 'API'} Test Report`,
    '',
    `- Passed: ${report.totals.passed}`,
    `- Failed: ${report.totals.failed}`,
    `- Total: ${report.totals.total}`,
    '',
    '| Case | Method | Status |',
    '| --- | --- | --- |',
    ...report.cases.map((entry) => `| ${entry.id} | ${entry.method} | ${entry.status} |`),
    '',
  ].join('\n'),
  'utf8',
);

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${markdownPath}`);
