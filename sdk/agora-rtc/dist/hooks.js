const path = require('node:path');
const { access, copyFile, cp, mkdir, readFile, writeFile } = require('node:fs/promises');
const sdkConfig = require('./sdk-config.js');

const IOS_GUIDE_RELATIVE_PATH = 'AGORA_RTC_SPM_SETUP.md';
const IOS_APP_DELEGATE_FORWARD_DECLARATION = `@interface AgoraRtcPlugin : NSObject
+ (instancetype)sharedInstance;
- (void)attachBridge;
@end`;
const IOS_APP_DELEGATE_ATTACH_CALL = '    [[AgoraRtcPlugin sharedInstance] attachBridge];';

function applyAndroidGradleDependencies(content) {
  const dependencyLines = sdkConfig.android.dependencies.map(
    (dependency) => `implementation '${dependency}'`,
  );

  if (dependencyLines.every((dependency) => content.includes(dependency))) {
    return content;
  }

  const injection = dependencyLines.map((dependency) => `    ${dependency}`).join('\n');

  if (/dependencies\s*\{/.test(content)) {
    return content.replace(/dependencies\s*\{/, (match) => `${match}\n${injection}`);
  }

  return `${content.trimEnd()}\n\ndependencies {\n${injection}\n}\n`;
}

function ensureAgoraLocalMavenRepository(content) {
  if (content.includes('local-maven')) {
    return content;
  }

  const localMavenPath = sdkConfig.android.localMavenRelativePath;
  const header = `def localAgoraRepo = new File(NATIVE_DIR, "${localMavenPath}")\n\n`;
  const repositoryInjection = [
    `        if (new File(NATIVE_DIR, "${localMavenPath}").exists()) {`,
    `            maven { url uri(new File(NATIVE_DIR, "${localMavenPath}")) }`,
    '        }',
  ].join('\n');

  let next = content;
  if (!next.includes('def localAgoraRepo')) {
    next = header + next;
  }
  next = next.replace(/repositories\s*\{/g, (match) => `${match}\n${repositoryInjection}`);
  return next;
}

function rewriteAndroidGradlePluginVersion(content) {
  return content.replace(
    /com\.android\.tools\.build:gradle:[0-9.]+/g,
    `com.android.tools.build:gradle:${sdkConfig.android.gradlePluginVersion}`,
  );
}

function rewriteGradleDistributionUrl(content) {
  return content.replace(
    /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[^\\]+-bin\.zip/g,
    `distributionUrl=${sdkConfig.android.gradleDistributionUrl}`,
  );
}

async function findFirstExistingPath(rootDir, candidates) {
  for (const candidate of candidates) {
    const absolutePath = path.join(rootDir, candidate);
    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }

  return null;
}

async function ensureIosSetupGuide(rootDir) {
  const filePath = path.join(rootDir, IOS_GUIDE_RELATIVE_PATH);
  await mkdir(path.dirname(filePath), { recursive: true });

  const content = `# Agora RTC iOS Swift Package Manager Setup

Repository: ${sdkConfig.ios.packageUrl}
Version: ${sdkConfig.ios.packageVersion}
Package: ${sdkConfig.ios.packageProduct}

## Steps

1. Open the exported Xcode project.
2. Add a Swift Package dependency from the repository above.
3. Pin the dependency to tag ${sdkConfig.ios.packageVersion}.
4. Link the package product to the app target.
5. Copy the bridge sources from the plugin template into the exported iOS project if they are not already present.
`;

  await writeFile(filePath, content, 'utf8');
  return filePath;
}

async function copyTemplateFile(rootDir, sourceRelativePath, destinationRelativePath) {
  const sourcePath = path.resolve(__dirname, '..', sourceRelativePath);
  const destinationPath = path.join(rootDir, destinationRelativePath);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return destinationPath;
}

async function copyTemplateDirectory(rootDir, sourceRelativePath, destinationRelativePath) {
  const sourcePath = path.resolve(__dirname, '..', sourceRelativePath);
  const destinationPath = path.join(rootDir, destinationRelativePath);

  await mkdir(destinationPath, { recursive: true });
  await cp(sourcePath, destinationPath, {
    recursive: true,
    force: true,
  });
  return destinationPath;
}

async function copyIosTemplateFiles(destinationRoot, nestedInNativeSourceDir = false) {
  const iosTemplateFiles = [
    'AgoraRtcBridge.swift',
    'AgoraRtcPlugin.mm',
    'AgoraEngineTextureSlotBridge.h',
    'AgoraEngineTextureSlotBridge.mm',
  ];

  for (const filename of iosTemplateFiles) {
    await copyTemplateFile(
      destinationRoot,
      `templates/ios/${filename}`,
      nestedInNativeSourceDir ? `agora-rtc/${filename}` : filename,
    );
  }
}

function patchIosAppDelegateBridgeAttachment(content) {
  let next = content;

  if (!next.includes('@interface AgoraRtcPlugin : NSObject')) {
    const importAnchor = '#import "service/SDKWrapper.h"';
    if (next.includes(importAnchor)) {
      next = next.replace(
        importAnchor,
        `${importAnchor}\n\n${IOS_APP_DELEGATE_FORWARD_DECLARATION}`,
      );
    } else {
      next = `${IOS_APP_DELEGATE_FORWARD_DECLARATION}\n\n${next}`;
    }
  }

  if (!next.includes('[[AgoraRtcPlugin sharedInstance] attachBridge]')) {
    const launchAnchor = '[appDelegateBridge application:application didFinishLaunchingWithOptions:launchOptions];';
    if (!next.includes(launchAnchor)) {
      throw new Error('Unable to patch iOS AppDelegate: launch anchor not found.');
    }
    next = next.replace(launchAnchor, `${launchAnchor}\n${IOS_APP_DELEGATE_ATTACH_CALL}`);
  }

  return next;
}

async function ensureIosAppDelegateBridgeAttachment(nativeSourceDir) {
  const appDelegatePath = path.join(nativeSourceDir, 'AppDelegate.mm');
  try {
    await access(appDelegatePath);
  } catch {
    return null;
  }

  const original = await readFile(appDelegatePath, 'utf8');
  const patched = patchIosAppDelegateBridgeAttachment(original);

  if (patched !== original) {
    await writeFile(appDelegatePath, patched, 'utf8');
  }

  return appDelegatePath;
}

async function integrateAndroidExport(rootDir) {
  const appGradleFile = await findFirstExistingPath(rootDir, [
    'native/engine/android/app/build.gradle',
    '../../native/engine/android/app/build.gradle',
    '../native/engine/android/app/build.gradle',
    'proj/app/build.gradle',
    'proj/android/app/build.gradle',
    'build/android/proj/app/build.gradle',
    'android/app/build.gradle',
  ]);

  if (appGradleFile) {
    const original = await readFile(appGradleFile, 'utf8');
    await writeFile(appGradleFile, applyAndroidGradleDependencies(original), 'utf8');
  }

  const rootGradleFiles = [
    await findFirstExistingPath(rootDir, ['native/engine/android/build.gradle']),
    await findFirstExistingPath(rootDir, ['../../native/engine/android/build.gradle']),
    await findFirstExistingPath(rootDir, ['proj/build.gradle']),
  ].filter(Boolean);

  for (const gradleFile of rootGradleFiles) {
    const original = await readFile(gradleFile, 'utf8');
    const withVersion = rewriteAndroidGradlePluginVersion(original);
    const withRepo = ensureAgoraLocalMavenRepository(withVersion);
    await writeFile(gradleFile, withRepo, 'utf8');
  }

  const wrapperProperties = await findFirstExistingPath(rootDir, [
    'proj/gradle/wrapper/gradle-wrapper.properties',
  ]);
  if (wrapperProperties) {
    const original = await readFile(wrapperProperties, 'utf8');
    await writeFile(wrapperProperties, rewriteGradleDistributionUrl(original), 'utf8');
  }

  await copyTemplateDirectory(
    rootDir,
    'templates/android/src/main/java/io/agora/cocos/rtc',
    '../../native/engine/android/app/src/main/java/io/agora/cocos/rtc',
  );
}

async function integrateIosExport(rootDir) {
  await ensureIosSetupGuide(rootDir);

  const iosProjectDir = await findFirstExistingPath(rootDir, ['proj']);
  const nativeSourceDir = await findFirstExistingPath(rootDir, [
    '../../native/engine/ios',
    '../native/engine/ios',
    'native/engine/ios',
  ]);

  const destinations = [];
  if (nativeSourceDir) {
    destinations.push(nativeSourceDir);
  }
  if (iosProjectDir) {
    destinations.push(path.join(iosProjectDir, 'agora-rtc'));
  }

  for (const destinationRoot of destinations) {
    await copyIosTemplateFiles(destinationRoot, destinationRoot === nativeSourceDir);
  }

  if (nativeSourceDir) {
    await ensureIosAppDelegateBridgeAttachment(nativeSourceDir);
  }
}

function resolveBuildDirectory(options = {}, result = {}) {
  return (
    result?.paths?.output ||
    result?.paths?.dir ||
    result?.dest ||
    options.dest ||
    options.outputDir ||
    options.buildPath ||
    options.projectPath ||
    process.cwd()
  );
}

async function onAfterBuild(options = {}, result = {}) {
  const buildDir = resolveBuildDirectory(options, result);
  const platform = String(
    options.platform || options.actualPlatform || options.name || '',
  ).toLowerCase();

  if (platform === 'android') {
    await integrateAndroidExport(buildDir);
  }

  if (platform === 'ios') {
    await integrateIosExport(buildDir);
  }
}

module.exports = {
  applyAndroidGradleDependencies,
  ensureAgoraLocalMavenRepository,
  ensureIosSetupGuide,
  findFirstExistingPath,
  integrateAndroidExport,
  integrateIosExport,
  copyIosTemplateFiles,
  ensureIosAppDelegateBridgeAttachment,
  onAfterBuild,
  patchIosAppDelegateBridgeAttachment,
  rewriteAndroidGradlePluginVersion,
  rewriteGradleDistributionUrl,
  sdkConfig,
};
