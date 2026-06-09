const path = require('node:path');
const { access, copyFile, cp, mkdir, readFile, writeFile } = require('node:fs/promises');
const sdkConfig = require('./sdk-config.js');

const IOS_GUIDE_RELATIVE_PATH = 'AGORA_RTC_SPM_SETUP.md';
const IOS_APP_DELEGATE_FORWARD_DECLARATION = `@interface AgoraRtcPlugin : NSObject
+ (instancetype)sharedInstance;
- (void)attachBridge;
@end`;
const IOS_APP_DELEGATE_ATTACH_CALL = '    [[AgoraRtcPlugin sharedInstance] attachBridge];';
const ANDROID_APP_ACTIVITY_IMPORT = 'import io.agora.cocos.rtc.AgoraRtcPlugin;';
const ANDROID_APP_ACTIVITY_ATTACH_CALL = '        AgoraRtcPlugin.getInstance().attachBridge();';
const ANDROID_APP_ACTIVITY_PERMISSION_FORWARDER = `    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        AgoraRtcPlugin.getInstance().onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
`;
const ANDROID_APP_ACTIVITY_PERMISSION_FORWARD_CALL = '        AgoraRtcPlugin.getInstance().onRequestPermissionsResult(requestCode, permissions, grantResults);';
const ANDROID_RTC_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];
const IOS_RTC_USAGE_DESCRIPTIONS = {
  NSCameraUsageDescription: 'Agora RTC needs camera access for local video preview and calls.',
  NSMicrophoneUsageDescription: 'Agora RTC needs microphone access for voice calls.',
};
const COMMON_ENGINE_TEXTURE_BRIDGE_FILES = [
  'AgoraEngineTextureBridge.h',
  'AgoraEngineTextureBridge.cpp',
];
const COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK = `list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.cpp
)`;
const IOS_RTC_BRIDGE_CMAKE_BLOCK = `list(APPEND CC_PROJ_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcBridge.swift
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcPlugin.mm
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraEngineTextureSlotBridge.mm
)

set_source_files_properties(
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcBridge.swift
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcPlugin.mm
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraEngineTextureSlotBridge.mm
    PROPERTIES
    GENERATED FALSE
)

set(CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "${sdkConfig.ios.swiftVersion}")`;

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

function patchNativeCommonCMakeTextureBridge(content) {
  if (content.includes('Classes/agora/AgoraEngineTextureBridge.cpp')) {
    const guardedBlockPattern = /if\(NOT APPLE\)\s*list\(APPEND CC_COMMON_SOURCES\s+\$\{CMAKE_CURRENT_LIST_DIR\}\/Classes\/agora\/AgoraEngineTextureBridge\.h\s+\$\{CMAKE_CURRENT_LIST_DIR\}\/Classes\/agora\/AgoraEngineTextureBridge\.cpp\s*\)\s*endif\(\)/;
    if (guardedBlockPattern.test(content)) {
      return content.replace(guardedBlockPattern, COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK);
    }
    if (content.includes(COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK)) {
      return content;
    }
    return content;
  }

  return `${content.trimEnd()}

${COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK}
`;
}

function patchIosCMakeRtcBridgeSources(content) {
  const next = content;

  if (next.includes('agora-rtc/AgoraRtcPlugin.mm')) {
    return next.includes('CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION')
      ? next
      : `${next.trimEnd()}

set(CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "${sdkConfig.ios.swiftVersion}")
`;
  }

  const includeAnchor = 'include(${CC_PROJECT_DIR}/../common/CMakeLists.txt)';
  if (next.includes(includeAnchor)) {
    return next.replace(includeAnchor, `${includeAnchor}

${IOS_RTC_BRIDGE_CMAKE_BLOCK}`);
  }

  return `${next.trimEnd()}

${IOS_RTC_BRIDGE_CMAKE_BLOCK}
`;
}

function patchNativeGameTextureBridgeRegistration(content) {
  let next = content;

  if (!next.includes('#include "agora/AgoraEngineTextureBridge.h"')) {
    const importAnchor = '#include "Game.h"';
    next = next.includes(importAnchor)
      ? next.replace(importAnchor, `${importAnchor}\n\n#include "agora/AgoraEngineTextureBridge.h"`)
      : `#include "agora/AgoraEngineTextureBridge.h"\n\n${next}`;
  }

  if (!next.includes('register_all_agora_engine_texture')) {
    const initAnchor = '  BaseGame::init();';
    const registration = `  auto *seengine = se::ScriptEngine::getInstance();
  seengine->addRegisterCallback(agora::cocos::register_all_agora_engine_texture);
  seengine->addBeforeCleanupHook([]() {
    agora::cocos::reset_agora_engine_texture_registry();
  });
`;

    if (!next.includes(initAnchor)) {
      throw new Error('Unable to patch native Game.cpp: BaseGame::init anchor not found.');
    }
    next = next.replace(initAnchor, `${registration}\n${initAnchor}`);
  }

  return next;
}

async function ensureNativeEngineTextureBridge(nativeCommonDir) {
  const destinationDir = path.join(nativeCommonDir, 'Classes', 'agora');
  await mkdir(destinationDir, { recursive: true });

  for (const filename of COMMON_ENGINE_TEXTURE_BRIDGE_FILES) {
    await copyTemplateFile(
      nativeCommonDir,
      `templates/common/Classes/agora/${filename}`,
      `Classes/agora/${filename}`,
    );
  }

  const cmakePath = path.join(nativeCommonDir, 'CMakeLists.txt');
  try {
    const original = await readFile(cmakePath, 'utf8');
    const patched = patchNativeCommonCMakeTextureBridge(original);
    if (patched !== original) {
      await writeFile(cmakePath, patched, 'utf8');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const gamePath = path.join(nativeCommonDir, 'Classes', 'Game.cpp');
  try {
    const original = await readFile(gamePath, 'utf8');
    const patched = patchNativeGameTextureBridgeRegistration(original);
    if (patched !== original) {
      await writeFile(gamePath, patched, 'utf8');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function ensureNativeEngineTextureBridgeForExport(rootDir) {
  const nativeCommonDir = await findFirstExistingPath(rootDir, [
    '../../native/engine/common',
    '../../../native/engine/common',
    '../native/engine/common',
    'native/engine/common',
  ]);

  if (nativeCommonDir) {
    await ensureNativeEngineTextureBridge(nativeCommonDir);
  }
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

async function ensureIosCMakeRtcBridgeSources(nativeSourceDir) {
  const cmakePath = path.join(nativeSourceDir, 'CMakeLists.txt');
  try {
    const original = await readFile(cmakePath, 'utf8');
    const patched = patchIosCMakeRtcBridgeSources(original);
    if (patched !== original) {
      await writeFile(cmakePath, patched, 'utf8');
    }
    return cmakePath;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return null;
  }
}

function patchAndroidAppActivityBridgeAttachment(content) {
  let next = content;

  if (!next.includes(ANDROID_APP_ACTIVITY_IMPORT)) {
    const packageMatch = next.match(/^(package\s+[\w.]+;\s*)$/m);
    if (packageMatch) {
      next = next.replace(packageMatch[0], `${packageMatch[0]}\n${ANDROID_APP_ACTIVITY_IMPORT}`);
    } else {
      next = `${ANDROID_APP_ACTIVITY_IMPORT}\n\n${next}`;
    }
  }

  if (!next.includes('AgoraRtcPlugin.getInstance().attachBridge()')) {
    const launchAnchor = 'SDKWrapper.shared().init(this);';
    if (!next.includes(launchAnchor)) {
      throw new Error('Unable to patch Android AppActivity: SDKWrapper init anchor not found.');
    }
    next = next.replace(launchAnchor, `${launchAnchor}\n${ANDROID_APP_ACTIVITY_ATTACH_CALL}`);
  }

  if (!next.includes('AgoraRtcPlugin.getInstance().onRequestPermissionsResult')) {
    const permissionCallbackMatch = next.match(
      /public\s+void\s+onRequestPermissionsResult\s*\(\s*int\s+requestCode\s*,\s*String\[\]\s+permissions\s*,\s*int\[\]\s+grantResults\s*\)\s*\{/,
    );
    if (permissionCallbackMatch) {
      const superCall = 'super.onRequestPermissionsResult(requestCode, permissions, grantResults);';
      next = next.includes(superCall)
        ? next.replace(superCall, `${superCall}\n${ANDROID_APP_ACTIVITY_PERMISSION_FORWARD_CALL}`)
        : next.replace(
          permissionCallbackMatch[0],
          `${permissionCallbackMatch[0]}\n${ANDROID_APP_ACTIVITY_PERMISSION_FORWARD_CALL}`,
        );
    } else {
      const classEndIndex = next.lastIndexOf('}');
      if (classEndIndex < 0) {
        throw new Error('Unable to patch Android AppActivity: class closing brace not found.');
      }
      next = `${next.slice(0, classEndIndex).trimEnd()}\n\n${ANDROID_APP_ACTIVITY_PERMISSION_FORWARDER}${next.slice(classEndIndex)}`;
    }
  }

  return next;
}

async function ensureAndroidAppActivityBridgeAttachment(androidRootDir) {
  const appActivityPath = await findFirstExistingPath(androidRootDir, [
    'app/src/com/cocos/game/AppActivity.java',
    'app/src/main/java/com/cocos/game/AppActivity.java',
    'src/com/cocos/game/AppActivity.java',
    'src/main/java/com/cocos/game/AppActivity.java',
    'AppActivity.java',
  ]);

  if (!appActivityPath) {
    return null;
  }

  const original = await readFile(appActivityPath, 'utf8');
  const patched = patchAndroidAppActivityBridgeAttachment(original);

  if (patched !== original) {
    await writeFile(appActivityPath, patched, 'utf8');
  }

  return appActivityPath;
}

function patchAndroidRtcPermissions(content) {
  const missingPermissions = ANDROID_RTC_PERMISSIONS.filter(
    (permission) => !content.includes(`android:name="${permission}"`),
  );

  if (missingPermissions.length === 0) {
    return content;
  }

  const permissionBlock = missingPermissions
    .map((permission) => `    <uses-permission android:name="${permission}" />`)
    .join('\n');

  if (content.includes('<application')) {
    return content.replace(/(\s*<application\b)/, `\n${permissionBlock}\n$1`);
  }

  return content.replace(/(<manifest\b[^>]*>)/, `$1\n\n${permissionBlock}`);
}

async function ensureAndroidRtcPermissions(androidRootDir) {
  const manifestPath = await findFirstExistingPath(androidRootDir, [
    'app/src/main/AndroidManifest.xml',
    'app/AndroidManifest.xml',
    'native/engine/android/app/AndroidManifest.xml',
    '../../native/engine/android/app/AndroidManifest.xml',
    '../../../native/engine/android/app/AndroidManifest.xml',
    '../native/engine/android/app/AndroidManifest.xml',
  ]);

  if (!manifestPath) {
    return null;
  }

  const original = await readFile(manifestPath, 'utf8');
  const patched = patchAndroidRtcPermissions(original);

  if (patched !== original) {
    await writeFile(manifestPath, patched, 'utf8');
  }

  return manifestPath;
}

function patchIosRtcUsageDescriptions(content) {
  const missingEntries = Object.entries(IOS_RTC_USAGE_DESCRIPTIONS).filter(
    ([key]) => !content.includes(`<key>${key}</key>`),
  );

  if (missingEntries.length === 0) {
    return content;
  }

  const usageBlock = missingEntries
    .map(([key, value]) => `\t<key>${key}</key>\n\t<string>${value}</string>`)
    .join('\n');

  const dictEndIndex = content.lastIndexOf('</dict>');
  if (dictEndIndex >= 0) {
    return `${content.slice(0, dictEndIndex).trimEnd()}\n${usageBlock}\n${content.slice(dictEndIndex)}`;
  }

  return content;
}

async function ensureIosRtcUsageDescriptions(rootDir) {
  const infoPlistPath = await findFirstExistingPath(rootDir, [
    'Info.plist',
    'proj/Info.plist',
    'native/engine/ios/Info.plist',
    '../../native/engine/ios/Info.plist',
    '../../../native/engine/ios/Info.plist',
    '../native/engine/ios/Info.plist',
  ]);

  if (!infoPlistPath) {
    return null;
  }

  const original = await readFile(infoPlistPath, 'utf8');
  const patched = patchIosRtcUsageDescriptions(original);

  if (patched !== original) {
    await writeFile(infoPlistPath, patched, 'utf8');
  }

  return infoPlistPath;
}

async function integrateAndroidExport(rootDir) {
  await ensureNativeEngineTextureBridgeForExport(rootDir);

  const androidSourceDir = await findFirstExistingPath(rootDir, [
    '../../native/engine/android',
    '../../../native/engine/android',
    '../native/engine/android',
    'native/engine/android',
    'proj',
    'android/proj',
  ]);
  if (androidSourceDir) {
    await ensureAndroidAppActivityBridgeAttachment(androidSourceDir);
    await ensureAndroidRtcPermissions(androidSourceDir);
  }

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
  await ensureNativeEngineTextureBridgeForExport(rootDir);

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
    await ensureIosCMakeRtcBridgeSources(nativeSourceDir);
    await ensureIosRtcUsageDescriptions(nativeSourceDir);
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
  ensureAndroidAppActivityBridgeAttachment,
  ensureAndroidRtcPermissions,
  ensureIosRtcUsageDescriptions,
  ensureIosCMakeRtcBridgeSources,
  ensureNativeEngineTextureBridge,
  ensureIosAppDelegateBridgeAttachment,
  onAfterBuild,
  patchAndroidAppActivityBridgeAttachment,
  patchAndroidRtcPermissions,
  patchIosRtcUsageDescriptions,
  patchIosCMakeRtcBridgeSources,
  patchIosAppDelegateBridgeAttachment,
  patchNativeCommonCMakeTextureBridge,
  patchNativeGameTextureBridgeRegistration,
  rewriteAndroidGradlePluginVersion,
  rewriteGradleDistributionUrl,
  sdkConfig,
};
