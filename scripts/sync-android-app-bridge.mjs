import { createRequire } from 'node:module';
import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  ANDROID_ENGINE_DIR_NAMES,
  ensureAndroidAppActivityBridgeAttachment,
} = require('../sdk/agora-rtc/dist/hooks.js');

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const exampleRoot = path.join(repoRoot, 'example/basic-call');
const demoSourceDir = path.join(
  exampleRoot,
  'native/agora-rtc/android/src/main/java/io/agora/cocos/demo',
);

function exampleAndroidEngineRoots() {
  const roots = [];
  for (const engineDir of ANDROID_ENGINE_DIR_NAMES) {
    roots.push(path.join(exampleRoot, 'native/engine', engineDir));
    roots.push(path.join(exampleRoot, `build-${engineDir}`, engineDir, 'proj'));
  }
  return roots;
}

function exampleDemoDestRoots() {
  return exampleAndroidEngineRoots().map((rootDir) =>
    path.join(rootDir, 'app/src/main/java/io/agora/cocos/demo'),
  );
}

const AGORA_IMPORT = 'import io.agora.cocos.rtc.AgoraRtcPlugin;';
const DEMO_IMPORT = 'import io.agora.cocos.demo.DemoPermissionsPlugin;';
const AGORA_ATTACH = '        AgoraRtcPlugin.getInstance().attachBridge();';
const DEMO_ATTACH = '        DemoPermissionsPlugin.getInstance().attachBridge();';
const DEMO_PERMISSIONS_RESULT =
  '        DemoPermissionsPlugin.getInstance().onRequestPermissionsResult(requestCode, permissions, grantResults);';

function patchExampleDemoPermissions(content) {
  if (!content.includes(AGORA_ATTACH) && !content.includes('DemoPermissionsPlugin.getInstance().attachBridge()')) {
    return content;
  }

  let next = content;

  if (!next.includes(DEMO_IMPORT)) {
    if (next.includes(AGORA_IMPORT)) {
      next = next.replace(AGORA_IMPORT, `${AGORA_IMPORT}\n${DEMO_IMPORT}`);
    } else {
      next = next.replace(/^(package\s+[\w.]+;\s*)$/m, `$1\n${DEMO_IMPORT}`);
    }
  }

  if (!next.includes('DemoPermissionsPlugin.getInstance().attachBridge()') && next.includes(AGORA_ATTACH)) {
    next = next.replace(AGORA_ATTACH, `${AGORA_ATTACH}\n${DEMO_ATTACH}`);
  }

  next = next.replace(
    /AgoraRtcPlugin\.getInstance\(\)\.onRequestPermissionsResult\(requestCode, permissions, grantResults\);/g,
    DEMO_PERMISSIONS_RESULT,
  );

  if (!next.includes('DemoPermissionsPlugin.getInstance().onRequestPermissionsResult')) {
    next = next.replace(
      /\n}\s*$/,
      `
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
${DEMO_PERMISSIONS_RESULT}
    }
}
`,
    );
  }

  return next;
}

async function hasAndroidEngineSkeleton() {
  for (const engineDir of ANDROID_ENGINE_DIR_NAMES) {
    const appActivityPath = path.join(
      exampleRoot,
      'native/engine',
      engineDir,
      'app/src/com/cocos/game/AppActivity.java',
    );

    try {
      await access(appActivityPath);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function syncExampleDemoJava() {
  try {
    await access(demoSourceDir);
  } catch {
    return;
  }

  if (!(await hasAndroidEngineSkeleton())) {
    console.warn(
      'Skipped Example demo Java sync because native/engine/android or native/engine/google-play skeleton is missing. Run Cocos export first.',
    );
    return;
  }

  for (const demoDestDir of exampleDemoDestRoots()) {
    try {
      await mkdir(path.dirname(demoDestDir), { recursive: true });
      await cp(demoSourceDir, demoDestDir, { recursive: true, force: true });
    } catch (error) {
      if (demoDestDir.includes(`${path.sep}build-`)) {
        continue;
      }
      throw error;
    }
  }
}

let patched = 0;
for (const rootDir of exampleAndroidEngineRoots()) {
  const appActivityPath = await ensureAndroidAppActivityBridgeAttachment(rootDir);
  if (!appActivityPath) {
    continue;
  }

  patched += 1;
  const original = await readFile(appActivityPath, 'utf8');
  const demoPatched = patchExampleDemoPermissions(original);
  if (demoPatched !== original) {
    await writeFile(appActivityPath, demoPatched, 'utf8');
  }
}

await syncExampleDemoJava();

if (patched === 0) {
  console.log('Skipped Android AppActivity bridge sync because AppActivity.java was not found.');
}
