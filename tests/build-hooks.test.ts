import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {
  applyAndroidGradleDependencies,
  copyIosTemplateFiles,
  ensureAndroidAppActivityBridgeAttachment,
  ensureAndroidRtcPermissions,
  ensureIosCMakeRtcBridgeSources,
  ensureIosXcodeProjectNativeSources,
  ensureIosRtcUsageDescriptions,
  ensureIosXcodeProjectSwiftPackage,
  ensureIosAppDelegateBridgeAttachment,
  ensureIosSetupGuide,
  ensureNativeEngineTextureBridge,
  findFirstExistingPath,
  onBeforeMake,
  patchIosXcodeProjectBuildSettingsForSwiftPackage,
  patchAndroidAppActivityBridgeAttachment,
  patchIosAppDelegateBridgeAttachment,
  patchIosCMakeRtcBridgeSources,
  patchIosXcodeProjectNativeSources,
  patchIosWorkspaceSettingsForSwiftPackage,
  patchIosXcodeProjectSwiftPackage,
  patchNativeCommonCMakeTextureBridge,
  patchNativeGameTextureBridgeRegistration,
  sdkConfig,
} = require('../sdk/agora-rtc/dist/hooks.js');

test('applyAndroidGradleDependencies injects Agora artifacts once', () => {
  const original = `plugins {
    id 'com.android.application'
  }

  dependencies {
      implementation "com.google.code.gson:gson:2.10.1"
  }
  `;

  const once = applyAndroidGradleDependencies(original);
  const twice = applyAndroidGradleDependencies(once);

  for (const dependency of sdkConfig.android.dependencies) {
    assert.match(once, new RegExp(dependency.replaceAll('.', '\\.')));
  }
  assert.equal(once, twice);
});

test('findFirstExistingPath returns the first matching candidate', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-paths-'));
  const target = path.join(root, 'proj', 'android', 'app', 'build.gradle');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, 'dependencies {}', 'utf8');

  const result = await findFirstExistingPath(root, [
    'missing/file.txt',
    'proj/android/app/build.gradle',
  ]);

  assert.equal(result, target);
});

test('ensureIosSetupGuide writes an actionable SPM guide', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-'));

  const filePath = await ensureIosSetupGuide(root);
  const content = await readFile(filePath, 'utf8');

  // The guide must list exactly the products the config selects, however many
  // that is. Asserting against the live config (instead of hardcoded names)
  // means the test stays correct when the update-deps workflow narrows the
  // product set down to a subset such as just RtcBasic.
  assert.ok(
    Array.isArray(sdkConfig.ios.packageProducts) && sdkConfig.ios.packageProducts.length > 0,
    'expected sdkConfig.ios.packageProducts to be a non-empty array',
  );
  for (const product of sdkConfig.ios.packageProducts) {
    assert.match(content, new RegExp(`\\b${product}\\b`));
  }
  assert.match(content, new RegExp(sdkConfig.ios.packageVersion.replaceAll('.', '\\.')));
  assert.match(content, /Swift Package Manager/);
});

test('copyIosTemplateFiles includes rtc bridge and engine texture slot bridge files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-templates-'));

  await copyIosTemplateFiles(root);

  for (const filename of [
    'AgoraRtcBridge.swift',
    'AgoraRtcPlugin.mm',
    'AgoraEngineTextureSlotBridge.h',
    'AgoraEngineTextureSlotBridge.mm',
  ]) {
    const content = await readFile(path.join(root, filename), 'utf8');
    assert.ok(content.length > 0, `${filename} should be copied`);
  }
});

test('patchNativeCommonCMakeTextureBridge registers common engine texture bridge sources once', () => {
  const original = `list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.cpp
)
`;

  const once = patchNativeCommonCMakeTextureBridge(original);
  const twice = patchNativeCommonCMakeTextureBridge(once);

  assert.match(once, /list\(APPEND CC_COMMON_SOURCES[\s\S]*Classes\/agora\/AgoraEngineTextureBridge\.h[\s\S]*Classes\/agora\/AgoraEngineTextureBridge\.cpp[\s\S]*\)/);
  assert.doesNotMatch(once, /if\(NOT APPLE\)/);
  assert.equal(once, twice);
});

test('patchNativeCommonCMakeTextureBridge upgrades platform-guarded texture bridge sources', () => {
  const original = `list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.cpp
)

if(NOT APPLE)
list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.cpp
)
endif()
`;

  const patched = patchNativeCommonCMakeTextureBridge(original);

  assert.doesNotMatch(patched, /if\(NOT APPLE\)/);
  assert.equal(
    [...patched.matchAll(/Classes\/agora\/AgoraEngineTextureBridge\.cpp/g)].length,
    1,
  );
});

test('patchNativeGameTextureBridgeRegistration attaches texture bridge registration once', () => {
  const original = `#include "Game.h"

int Game::init() {
  _xxteaKey = SCRIPT_XXTEAKEY;

  BaseGame::init();
  return 0;
}
`;

  const once = patchNativeGameTextureBridgeRegistration(original);
  const twice = patchNativeGameTextureBridgeRegistration(once);

  assert.match(once, /#include "agora\/AgoraEngineTextureBridge\.h"/);
  assert.match(once, /se::ScriptEngine::getInstance\(\)/);
  assert.match(once, /register_all_agora_engine_texture/);
  assert.match(once, /reset_agora_engine_texture_registry/);
  assert.equal(once, twice);
});

test('ensureNativeEngineTextureBridge copies templates and patches exported common native sources', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-native-common-'));
  await mkdir(path.join(root, 'Classes'), { recursive: true });
  await writeFile(
    path.join(root, 'CMakeLists.txt'),
    `list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.cpp
)
`,
    'utf8',
  );
  await writeFile(
    path.join(root, 'Classes/Game.cpp'),
    `#include "Game.h"

int Game::init() {
  _xxteaKey = SCRIPT_XXTEAKEY;

  BaseGame::init();
  return 0;
}
`,
    'utf8',
  );

  await ensureNativeEngineTextureBridge(root);

  const headerContent = await readFile(
    path.join(root, 'Classes/agora/AgoraEngineTextureBridge.h'),
    'utf8',
  );
  const sourceContent = await readFile(
    path.join(root, 'Classes/agora/AgoraEngineTextureBridge.cpp'),
    'utf8',
  );
  const cmakeContent = await readFile(path.join(root, 'CMakeLists.txt'), 'utf8');
  const gameContent = await readFile(path.join(root, 'Classes/Game.cpp'), 'utf8');

  assert.match(headerContent, /create_agora_engine_texture_slot/);
  assert.match(sourceContent, /register_all_agora_engine_texture/);
  assert.match(cmakeContent, /AgoraEngineTextureBridge\.cpp/);
  assert.match(gameContent, /register_all_agora_engine_texture/);
});

test('patchIosAppDelegateBridgeAttachment attaches the native bridge at app launch once', () => {
  const original = `#import "AppDelegate.h"
#import "service/SDKWrapper.h"

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [appDelegateBridge application:application didFinishLaunchingWithOptions:launchOptions];
    return YES;
}
`;

  const once = patchIosAppDelegateBridgeAttachment(original);
  const twice = patchIosAppDelegateBridgeAttachment(once);

  assert.match(once, /@interface AgoraRtcPlugin : NSObject/);
  assert.match(once, /\+ \(instancetype\)sharedInstance;/);
  assert.match(once, /- \(void\)attachBridge;/);
  assert.match(once, /\[\[AgoraRtcPlugin sharedInstance\] attachBridge\];/);
  assert.equal(once, twice);
});

test('ensureIosAppDelegateBridgeAttachment patches an exported native source file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-appdelegate-'));
  const appDelegatePath = path.join(root, 'AppDelegate.mm');
  await writeFile(
    appDelegatePath,
    `#import "service/SDKWrapper.h"

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
    [appDelegateBridge application:application didFinishLaunchingWithOptions:launchOptions];
    return YES;
}
`,
    'utf8',
  );

  await ensureIosAppDelegateBridgeAttachment(root);
  const content = await readFile(appDelegatePath, 'utf8');

  assert.match(content, /@interface AgoraRtcPlugin : NSObject/);
  assert.match(content, /\[\[AgoraRtcPlugin sharedInstance\] attachBridge\];/);
});

test('ensureIosAppDelegateBridgeAttachment skips exports without AppDelegate.mm', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-no-appdelegate-'));

  const result = await ensureIosAppDelegateBridgeAttachment(root);

  assert.equal(result, null);
});

test('patchIosCMakeRtcBridgeSources registers Objective-C++ bridge sources without enabling Swift in CMake', () => {
  const original = `cmake_minimum_required(VERSION 3.8)

project(\${APP_NAME} CXX)

set(CC_PROJ_SOURCES)

include(\${CC_PROJECT_DIR}/../common/CMakeLists.txt)
set(EXECUTABLE_NAME \${APP_NAME}-mobile)

cc_ios_before_target(\${EXECUTABLE_NAME})
add_executable(\${EXECUTABLE_NAME} \${CC_ALL_SOURCES})
cc_ios_after_target(\${EXECUTABLE_NAME})
`;

  const once = patchIosCMakeRtcBridgeSources(original);
  const twice = patchIosCMakeRtcBridgeSources(once);

  assert.doesNotMatch(once, /agora-rtc\/AgoraRtcBridge\.swift/);
  assert.match(once, /agora-rtc\/AgoraRtcPlugin\.mm/);
  assert.match(once, /agora-rtc\/AgoraEngineTextureSlotBridge\.mm/);
  assert.match(once, /project\(\$\{APP_NAME\} CXX\)/);
  assert.doesNotMatch(once, /project\([^)]*\bSwift\b[^)]*\)/);
  assert.match(once, /CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "5\.0"/);
  assert.equal(
    [...once.matchAll(/agora-rtc\/AgoraRtcPlugin\.mm/g)].length,
    2,
  );
  assert.equal(once, twice);
});

test('patchIosCMakeRtcBridgeSources removes stale Swift bridge CMake entries', () => {
  const original = `cmake_minimum_required(VERSION 3.8)

project(\${APP_NAME} CXX Swift)

set(CC_PROJ_SOURCES)

include(\${CC_PROJECT_DIR}/../common/CMakeLists.txt)

list(APPEND CC_PROJ_SOURCES
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

set(CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "5.0")
`;

  const once = patchIosCMakeRtcBridgeSources(original);
  const twice = patchIosCMakeRtcBridgeSources(once);

  assert.match(once, /project\(\$\{APP_NAME\} CXX\)/);
  assert.doesNotMatch(once, /project\([^)]*\bSwift\b[^)]*\)/);
  assert.doesNotMatch(once, /agora-rtc\/AgoraRtcBridge\.swift/);
  assert.match(once, /agora-rtc\/AgoraRtcPlugin\.mm/);
  assert.match(once, /agora-rtc\/AgoraEngineTextureSlotBridge\.mm/);
  assert.equal(once, twice);
});

test('ensureIosCMakeRtcBridgeSources patches exported iOS CMakeLists', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-cmake-'));
  await writeFile(
    path.join(root, 'CMakeLists.txt'),
    `project(\${APP_NAME} CXX)
set(CC_PROJ_SOURCES)
include(\${CC_PROJECT_DIR}/../common/CMakeLists.txt)
add_executable(\${EXECUTABLE_NAME} \${CC_ALL_SOURCES})
`,
    'utf8',
  );

  const result = await ensureIosCMakeRtcBridgeSources(root);
  const content = await readFile(path.join(root, 'CMakeLists.txt'), 'utf8');

  assert.equal(result, path.join(root, 'CMakeLists.txt'));
  assert.doesNotMatch(content, /agora-rtc\/AgoraRtcBridge\.swift/);
  assert.match(content, /agora-rtc\/AgoraRtcPlugin\.mm/);
  assert.match(content, /project\(\$\{APP_NAME\} CXX\)/);
  assert.doesNotMatch(content, /project\([^)]*\bSwift\b[^)]*\)/);
  assert.match(content, /CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION/);
});

function createIosPbxprojFixture() {
  return `// !$*UTF8*$!
{
  archiveVersion = 1;
  classes = {
  };
  objectVersion = 77;
  objects = {

/* Begin PBXBuildFile section */
/* End PBXBuildFile section */

/* Begin PBXFrameworksBuildPhase section */
    DDB65CEEFE634E74A23CD384 /* Frameworks */ = {
      isa = PBXFrameworksBuildPhase;
      buildActionMask = 2147483647;
      files = (
      );
      runOnlyForDeploymentPostprocessing = 0;
    };
/* End PBXFrameworksBuildPhase section */

/* Begin PBXNativeTarget section */
    1570BE6E069448BFA13F8BDA /* agora-cocos-basic-call-mobile */ = {
      isa = PBXNativeTarget;
      buildConfigurationList = 7E280B21576347D0A0675D31 /* Build configuration list for PBXNativeTarget "agora-cocos-basic-call-mobile" */;
      buildPhases = (
        DDB65CEEFE634E74A23CD384 /* Frameworks */,
      );
      dependencies = (
      );
      name = "agora-cocos-basic-call-mobile";
      productName = "agora-cocos-basic-call-mobile";
      productReference = F1A74941342B40C9AE80CC7A /* agora-cocos-basic-call.app */;
      productType = "com.apple.product-type.application";
    };
/* End PBXNativeTarget section */

/* Begin PBXProject section */
    F133864AD5934D1C837F0D69 /* Project object */ = {
      isa = PBXProject;
      attributes = {
        LastUpgradeCheck = 1600;
      };
      buildConfigurationList = 70C6AC196D0D4F5C86BD4257 /* Build configuration list for PBXProject "agora-cocos-basic-call" */;
      compatibilityVersion = "Xcode 14.0";
      developmentRegion = en;
      hasScannedForEncodings = 0;
      knownRegions = (
        en,
        Base,
      );
      mainGroup = 705052939DB94DD6B4F44731;
      productRefGroup = 951E98A53DB744218999E631 /* Products */;
      projectDirPath = "";
      projectRoot = "";
      targets = (
        1570BE6E069448BFA13F8BDA /* agora-cocos-basic-call-mobile */,
      );
    };
/* End PBXProject section */

/* Begin XCBuildConfiguration section */
    A1B2C3D4E5F60718293A4B5C /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        CODE_SIGN_IDENTITY = "iPhone Developer";
        CODE_SIGN_STYLE = Manual;
        CONFIGURATION_BUILD_DIR = "/tmp/agora-cocos-basic-call/build/ios/proj/archives/Debug";
        CONFIGURATION_TEMP_DIR = "/tmp/agora-cocos-basic-call/build/ios/proj/tmp/Debug";
        DEVELOPMENT_TEAM = ABCDE12345;
        LD_RUNPATH_SEARCH_PATHS = "$(inherited)";
        OBJROOT = "/tmp/agora-cocos-basic-call/build/ios/proj/obj";
        OTHER_LDFLAGS = (
          "$(inherited)",
          "/tmp/agora-cocos-basic-call/build/ios/proj/archives/Debug/libcocos_engine.a",
          "/tmp/agora-cocos-basic-call/build/ios/proj/boost/container/archives/Debug/libboost_container.a",
        );
        PRODUCT_BUNDLE_IDENTIFIER = io.agora.cocosbasiccall;
        PROVISIONING_PROFILE_SPECIFIER = "Agora Dev Profile";
        SYMROOT = "/tmp/agora-cocos-basic-call/build/ios/proj";
      };
      name = Debug;
    };
/* End XCBuildConfiguration section */
  };
  rootObject = F133864AD5934D1C837F0D69 /* Project object */;
}
`;
}

function createIosWorkspaceSettingsFixture(buildLocationStyle = 'UseTargetSettings') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>BuildSystemType</key>
\t<string>Latest</string>
\t<key>BuildLocationStyle</key>
\t<string>${buildLocationStyle}</string>
</dict>
</plist>
`;
}

test('patchIosXcodeProjectSwiftPackage adds Agora iOS SPM product to the app target once', () => {
  const original = createIosPbxprojFixture();
  const once = patchIosXcodeProjectSwiftPackage(original);
  const twice = patchIosXcodeProjectSwiftPackage(once);
  const packageName = sdkConfig.ios.packageUrl.split('/').pop()?.replace(/\.git$/, '') ?? '';

  assert.match(once, /XCRemoteSwiftPackageReference/);
  assert.match(once, new RegExp(sdkConfig.ios.packageUrl.replaceAll('.', '\\.')));
  assert.match(once, /kind = exactVersion;/);
  assert.match(once, new RegExp(`version = ${sdkConfig.ios.packageVersion.replaceAll('.', '\\.')};`));
  assert.match(once, /XCSwiftPackageProductDependency/);
  for (const product of sdkConfig.ios.packageProducts) {
    assert.match(once, new RegExp(`productName = ${product};`));
  }
  assert.match(
    once,
    new RegExp(
      `packageReferences = \\(\\s*A90A00000000000000000101 \\/\\* XCRemoteSwiftPackageReference "${packageName}" \\*\\/,\\s*\\);`,
    ),
  );
  for (const product of sdkConfig.ios.packageProducts) {
    assert.match(once, new RegExp(`\\/\\* ${product} \\*\\/,`));
    assert.match(once, new RegExp(`\\/\\* ${product} in Frameworks \\*\\/,`));
  }
  assert.equal(
    [...once.matchAll(new RegExp(`repositoryURL = "${sdkConfig.ios.packageUrl.replaceAll('.', '\\.')}";`, 'g'))].length,
    1,
  );
  assert.equal(once, twice);
});

test('patchIosXcodeProjectBuildSettingsForSwiftPackage clears legacy build locations and preserves signing', () => {
  const original = createIosPbxprojFixture();
  const once = patchIosXcodeProjectBuildSettingsForSwiftPackage(original);
  const twice = patchIosXcodeProjectBuildSettingsForSwiftPackage(once);

  assert.doesNotMatch(once, /^\s*SYMROOT = /m);
  assert.doesNotMatch(once, /^\s*OBJROOT = /m);
  assert.doesNotMatch(once, /^\s*CONFIGURATION_BUILD_DIR = /m);
  assert.doesNotMatch(once, /^\s*CONFIGURATION_TEMP_DIR = /m);
  assert.match(once, /\$\(CONFIGURATION_BUILD_DIR\)\/libcocos_engine\.a/);
  assert.match(once, /\$\(CONFIGURATION_BUILD_DIR\)\/libboost_container\.a/);
  assert.doesNotMatch(once, /\/archives\/Debug\/libcocos_engine\.a/);
  assert.doesNotMatch(once, /\/boost\/container\/archives\/Debug\/libboost_container\.a/);
  assert.match(once, /LD_RUNPATH_SEARCH_PATHS = \(\s*"\$\(inherited\)",\s*"@executable_path\/Frameworks",\s*\);/);
  assert.match(once, /CODE_SIGN_STYLE = Manual;/);
  assert.match(once, /DEVELOPMENT_TEAM = ABCDE12345;/);
  assert.match(once, /PROVISIONING_PROFILE_SPECIFIER = "Agora Dev Profile";/);
  assert.match(once, /PRODUCT_BUNDLE_IDENTIFIER = io\.agora\.cocosbasiccall;/);
  assert.match(once, /SWIFT_VERSION = 5\.0;/);
  assert.equal(once, twice);
});

test('patchIosXcodeProjectNativeSources adds Agora native bridge files to app sources once', () => {
  const original = createIosPbxprojFixture();
  const once = patchIosXcodeProjectNativeSources(original);
  const twice = patchIosXcodeProjectNativeSources(once);

  for (const source of [
    'AgoraRtcBridge.swift',
    'AgoraRtcPlugin.mm',
    'AgoraEngineTextureSlotBridge.mm',
    'AgoraEngineTextureBridge.cpp',
  ]) {
    const escapedSource = source.replaceAll('.', '\\.');
    assert.match(once, new RegExp(`${escapedSource} \\*/ = \\{isa = PBXFileReference;`));
    assert.match(once, new RegExp(`${escapedSource} in Sources \\*/ = \\{isa = PBXBuildFile;`));
    assert.match(once, new RegExp(`${escapedSource} in Sources \\*/,`));
    assert.equal([...once.matchAll(new RegExp(`${escapedSource} in Sources`, 'g'))].length, 2);
  }
  assert.equal(once, twice);
});

test('patchIosWorkspaceSettingsForSwiftPackage forces unique build locations once', () => {
  const original = createIosWorkspaceSettingsFixture();
  const once = patchIosWorkspaceSettingsForSwiftPackage(original);
  const twice = patchIosWorkspaceSettingsForSwiftPackage(once);

  assert.match(once, /<key>BuildLocationStyle<\/key>\s*<string>Unique<\/string>/);
  assert.doesNotMatch(once, /UseTargetSettings/);
  assert.equal(once, twice);

  const withoutBuildLocationStyle = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
\t<key>BuildSystemType</key>
\t<string>Latest</string>
</dict>
</plist>
`;
  const patched = patchIosWorkspaceSettingsForSwiftPackage(withoutBuildLocationStyle);
  assert.match(patched, /<key>BuildLocationStyle<\/key>\s*<string>Unique<\/string>/);
});

test('ensureIosXcodeProjectSwiftPackage patches generated Xcode project files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-pbxproj-'));
  const pbxprojPath = path.join(
    root,
    'proj/agora-cocos-basic-call.xcodeproj/project.pbxproj',
  );
  const userWorkspaceSettingsPath = path.join(
    root,
    'proj/agora-cocos-basic-call.xcodeproj/project.xcworkspace/xcuserdata/test.xcuserdatad/WorkspaceSettings.xcsettings',
  );
  await mkdir(path.dirname(pbxprojPath), { recursive: true });
  await mkdir(path.dirname(userWorkspaceSettingsPath), { recursive: true });
  await writeFile(pbxprojPath, createIosPbxprojFixture(), 'utf8');
  await writeFile(userWorkspaceSettingsPath, createIosWorkspaceSettingsFixture(), 'utf8');

  const patchedPaths = await ensureIosXcodeProjectSwiftPackage(root);
  const content = await readFile(pbxprojPath, 'utf8');
  const userWorkspaceSettings = await readFile(userWorkspaceSettingsPath, 'utf8');
  const sharedWorkspaceSettings = await readFile(
    path.join(
      root,
      'proj/agora-cocos-basic-call.xcodeproj/project.xcworkspace/xcshareddata/WorkspaceSettings.xcsettings',
    ),
    'utf8',
  );

  assert.equal(patchedPaths.includes(pbxprojPath), true);
  assert.equal(patchedPaths.includes(userWorkspaceSettingsPath), true);
  assert.match(content, /XCRemoteSwiftPackageReference/);
  assert.match(content, /productName = RtcBasic;/);
  assert.doesNotMatch(content, /^\s*CONFIGURATION_BUILD_DIR = /m);
  assert.match(content, /@executable_path\/Frameworks/);
  assert.match(userWorkspaceSettings, /<key>BuildLocationStyle<\/key>\s*<string>Unique<\/string>/);
  assert.match(sharedWorkspaceSettings, /<key>BuildLocationStyle<\/key>\s*<string>Unique<\/string>/);
});

test('ensureIosXcodeProjectNativeSources patches generated Xcode project source phases', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-native-sources-'));
  const pbxprojPath = path.join(
    root,
    'proj/agora-cocos-basic-call.xcodeproj/project.pbxproj',
  );
  await mkdir(path.dirname(pbxprojPath), { recursive: true });
  await writeFile(pbxprojPath, createIosPbxprojFixture(), 'utf8');

  const patchedPaths = await ensureIosXcodeProjectNativeSources(root);
  const content = await readFile(pbxprojPath, 'utf8');

  assert.deepEqual(patchedPaths, [pbxprojPath]);
  assert.match(content, /AgoraRtcPlugin\.mm in Sources/);
  assert.match(content, /AgoraEngineTextureSlotBridge\.mm in Sources/);
  assert.match(content, /AgoraEngineTextureBridge\.cpp in Sources/);
  assert.match(content, /AgoraRtcBridge\.swift in Sources/);
});

test('onBeforeMake patches generated iOS Xcode project before native compilation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-before-make-'));
  const pbxprojPath = path.join(root, 'agora-cocos-basic-call.xcodeproj/project.pbxproj');
  const userWorkspaceSettingsPath = path.join(
    root,
    'agora-cocos-basic-call.xcodeproj/project.xcworkspace/xcuserdata/test.xcuserdatad/WorkspaceSettings.xcsettings',
  );
  await mkdir(path.dirname(pbxprojPath), { recursive: true });
  await mkdir(path.dirname(userWorkspaceSettingsPath), { recursive: true });
  await writeFile(pbxprojPath, createIosPbxprojFixture(), 'utf8');
  await writeFile(userWorkspaceSettingsPath, createIosWorkspaceSettingsFixture(), 'utf8');

  await onBeforeMake(root, { platform: 'ios' });
  const content = await readFile(pbxprojPath, 'utf8');
  const userWorkspaceSettings = await readFile(userWorkspaceSettingsPath, 'utf8');

  assert.match(content, /XCRemoteSwiftPackageReference/);
  assert.match(content, /RtcBasic in Frameworks/);
  assert.doesNotMatch(content, /^\s*SYMROOT = /m);
  assert.match(content, /@executable_path\/Frameworks/);
  assert.match(userWorkspaceSettings, /<key>BuildLocationStyle<\/key>\s*<string>Unique<\/string>/);
});

test('onBeforeMake patches generated iOS Info.plist usage descriptions before native compilation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-before-make-plist-'));
  const pbxprojPath = path.join(root, 'agora-cocos-basic-call.xcodeproj/project.pbxproj');
  const infoPlistPath = path.join(root, 'CMakeFiles/agora-cocos-basic-call-mobile.dir/Info.plist');
  await mkdir(path.dirname(pbxprojPath), { recursive: true });
  await mkdir(path.dirname(infoPlistPath), { recursive: true });
  await writeFile(pbxprojPath, createIosPbxprojFixture(), 'utf8');
  await writeFile(
    infoPlistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Agora Cocos RTC</string>
</dict>
</plist>
`,
    'utf8',
  );

  await onBeforeMake(root, { platform: 'ios' });
  const content = await readFile(infoPlistPath, 'utf8');

  assert.match(content, /NSCameraUsageDescription/);
  assert.match(content, /NSMicrophoneUsageDescription/);
});

test('patchAndroidAppActivityBridgeAttachment attaches the native bridge after SDK init once', () => {
  const original = `package com.cocos.game;

import android.os.Bundle;

import com.cocos.service.SDKWrapper;
import com.cocos.lib.CocosActivity;

public class AppActivity extends CocosActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SDKWrapper.shared().init(this);
    }
}
`;

  const once = patchAndroidAppActivityBridgeAttachment(original);
  const twice = patchAndroidAppActivityBridgeAttachment(once);

  assert.match(once, /import io\.agora\.cocos\.rtc\.AgoraRtcPlugin;/);
  assert.match(once, /SDKWrapper\.shared\(\)\.init\(this\);\n        AgoraRtcPlugin\.getInstance\(\)\.attachBridge\(\);/);
  assert.equal(
    [...once.matchAll(/AgoraRtcPlugin\.getInstance\(\)\.attachBridge\(\);/g)].length,
    1,
  );
  assert.doesNotMatch(once, /onRequestPermissionsResult/);
  assert.doesNotMatch(once, /AgoraRtcPlugin\.getInstance\(\)\.onRequestPermissionsResult\(requestCode, permissions, grantResults\)/);
  assert.equal(once, twice);
});

test('ensureAndroidAppActivityBridgeAttachment patches exported Android AppActivity.java', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-appactivity-'));
  const appActivityDir = path.join(root, 'app/src/com/cocos/game');
  const appActivityPath = path.join(appActivityDir, 'AppActivity.java');
  await mkdir(appActivityDir, { recursive: true });
  await writeFile(
    appActivityPath,
    `package com.cocos.game;

import android.os.Bundle;
import com.cocos.service.SDKWrapper;
import com.cocos.lib.CocosActivity;

public class AppActivity extends CocosActivity {
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SDKWrapper.shared().init(this);
    }
}
`,
    'utf8',
  );

  await ensureAndroidAppActivityBridgeAttachment(root);
  const content = await readFile(appActivityPath, 'utf8');

  assert.match(content, /import io\.agora\.cocos\.rtc\.AgoraRtcPlugin;/);
  assert.match(content, /AgoraRtcPlugin\.getInstance\(\)\.attachBridge\(\);/);
  assert.doesNotMatch(content, /AgoraRtcPlugin\.getInstance\(\)\.onRequestPermissionsResult\(requestCode, permissions, grantResults\)/);
});

test('ensureAndroidAppActivityBridgeAttachment skips exports without AppActivity.java', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-no-appactivity-'));

  const result = await ensureAndroidAppActivityBridgeAttachment(root);

  assert.equal(result, null);
});

test('ensureAndroidRtcPermissions patches exported release manifests with required rtc permissions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-manifest-'));
  const manifestPath = path.join(root, 'native/engine/android/app/AndroidManifest.xml');
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    android:installLocation="auto">

    <uses-permission android:name="android.permission.INTERNET"/>

    <application android:label="@string/app_name">
    </application>
</manifest>
`,
    'utf8',
  );

  const patchedPath = await ensureAndroidRtcPermissions(root);
  const content = await readFile(manifestPath, 'utf8');

  assert.equal(patchedPath, manifestPath);
  assert.match(content, /android\.permission\.CAMERA/);
  assert.match(content, /android\.permission\.RECORD_AUDIO/);
  assert.match(content, /android\.permission\.MODIFY_AUDIO_SETTINGS/);
  assert.equal([...content.matchAll(/android\.permission\.CAMERA/g)].length, 1);
  assert.ok(
    content.indexOf('android.permission.MODIFY_AUDIO_SETTINGS') < content.indexOf('<application'),
    'RTC permissions must be manifest-level entries before application',
  );
});

test('ensureIosRtcUsageDescriptions patches exported Info.plist with camera and microphone usage descriptions', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-plist-'));
  const infoPlistPath = path.join(root, 'native/engine/ios/Info.plist');
  await mkdir(path.dirname(infoPlistPath), { recursive: true });
  await writeFile(
    infoPlistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Agora Cocos RTC</string>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
</dict>
</plist>
`,
    'utf8',
  );

  const patchedPath = await ensureIosRtcUsageDescriptions(root);
  const once = await readFile(infoPlistPath, 'utf8');
  await ensureIosRtcUsageDescriptions(root);
  const twice = await readFile(infoPlistPath, 'utf8');

  assert.equal(patchedPath, infoPlistPath);
  assert.match(once, /NSCameraUsageDescription/);
  assert.match(once, /NSMicrophoneUsageDescription/);
  assert.ok(
    once.indexOf('</dict>') < once.indexOf('NSCameraUsageDescription'),
    'iOS usage descriptions must be inserted after nested dict entries, not inside them',
  );
  assert.ok(
    once.indexOf('NSCameraUsageDescription') < once.lastIndexOf('</dict>'),
    'iOS usage descriptions must be top-level Info.plist entries before </dict>',
  );
  assert.equal(once, twice);
});

test('ensureIosRtcUsageDescriptions patches generated CMakeFiles Info.plist when it exists', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-generated-plist-'));
  const infoPlistPath = path.join(
    root,
    'proj/CMakeFiles/agora-cocos-basic-call-mobile.dir/Info.plist',
  );
  await mkdir(path.dirname(infoPlistPath), { recursive: true });
  await writeFile(
    infoPlistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Agora Cocos RTC</string>
</dict>
</plist>
`,
    'utf8',
  );

  const patchedPath = await ensureIosRtcUsageDescriptions(root);
  const content = await readFile(infoPlistPath, 'utf8');

  assert.equal(patchedPath, infoPlistPath);
  assert.match(content, /NSCameraUsageDescription/);
  assert.match(content, /NSMicrophoneUsageDescription/);
});

test('cocos extension entrypoints are loadable from commonjs', () => {
  const main = require('../sdk/agora-rtc/dist/main.js');
  const builder = require('../sdk/agora-rtc/dist/builder.js');

  assert.equal(typeof main.load, 'function');
  assert.equal(typeof main.unload, 'function');
  assert.equal(typeof builder.configs.ios.hooks, 'string');
  assert.equal(typeof builder.configs['google-play'].hooks, 'string');
});

test('google-play is treated as an android-like platform for export integration', async () => {
  const {
    ANDROID_ENGINE_DIR_NAMES,
    androidEnginePathCandidates,
    isAndroidLikePlatform,
    onAfterBuild,
  } = require('../sdk/agora-rtc/dist/hooks.js');

  assert.deepEqual(ANDROID_ENGINE_DIR_NAMES, ['google-play', 'android']);
  assert.equal(isAndroidLikePlatform('google-play'), true);
  assert.equal(isAndroidLikePlatform('ANDROID'), true);
  assert.equal(isAndroidLikePlatform('ios'), false);
  assert.ok(
    androidEnginePathCandidates('app/build.gradle').some((candidate) =>
      candidate.includes('native/engine/google-play/app/build.gradle'),
    ),
  );

  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-google-play-export-'));
  const manifestPath = path.join(root, 'native/engine/google-play/app/AndroidManifest.xml');
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application />
</manifest>`,
    'utf8',
  );

  await onAfterBuild({ platform: 'google-play' }, { dest: root });
  const content = await readFile(manifestPath, 'utf8');
  assert.match(content, /android\.permission\.CAMERA/);
  assert.match(content, /android\.permission\.RECORD_AUDIO/);
});

test('android export integration only syncs app dependencies without rewriting project toolchain', async () => {
  const {
    onAfterBuild,
  } = require('../sdk/agora-rtc/dist/hooks.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-export-'));
  const gradlePath = path.join(root, 'native/engine/android/build.gradle');
  const appGradlePath = path.join(root, 'native/engine/android/app/build.gradle');
  const wrapperPath = path.join(root, 'proj/gradle/wrapper/gradle-wrapper.properties');
  await mkdir(path.dirname(gradlePath), { recursive: true });
  await mkdir(path.dirname(appGradlePath), { recursive: true });
  await mkdir(path.dirname(wrapperPath), { recursive: true });
  await writeFile(
    gradlePath,
    `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.10.1'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
`,
    'utf8',
  );
  await writeFile(
    appGradlePath,
    `plugins {
    id 'com.android.application'
}

dependencies {
    implementation "com.google.code.gson:gson:2.10.1"
}
`,
    'utf8',
  );
  await writeFile(
    wrapperPath,
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip\n',
    'utf8',
  );

  await onAfterBuild({ platform: 'android' }, { dest: root });
  const rootGradle = await readFile(gradlePath, 'utf8');
  const appGradle = await readFile(appGradlePath, 'utf8');
  const wrapper = await readFile(wrapperPath, 'utf8');

  assert.match(rootGradle, /com\.android\.tools\.build:gradle:8\.10\.1/);
  assert.doesNotMatch(rootGradle, /local-maven/);
  assert.doesNotMatch(rootGradle, /localAgoraRepo/);
  assert.equal(
    wrapper,
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip\n',
  );
  for (const dependency of sdkConfig.android.dependencies) {
    assert.match(appGradle, new RegExp(dependency.replaceAll('.', '\\.')));
  }
});

test('onAfterBuild resolves the exported Android project from Cocos result.dest', async () => {
  const {
    onAfterBuild,
  } = require('../sdk/agora-rtc/dist/hooks.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-result-dest-'));
  const appGradlePath = path.join(root, 'native/engine/android/app/build.gradle');
  await mkdir(path.dirname(appGradlePath), { recursive: true });
  await writeFile(
    appGradlePath,
    `plugins {
    id 'com.android.application'
}

dependencies {
    implementation "com.google.code.gson:gson:2.10.1"
}
`,
    'utf8',
  );

  await onAfterBuild({ platform: 'android' }, { dest: root });
  const appGradle = await readFile(appGradlePath, 'utf8');

  for (const dependency of sdkConfig.android.dependencies) {
    assert.match(appGradle, new RegExp(dependency.replaceAll('.', '\\.')));
  }
});

test('onBeforeMake syncs Android dependencies when Cocos passes the native project root', async () => {
  const {
    onBeforeMake,
  } = require('../sdk/agora-rtc/dist/hooks.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-make-'));
  const appGradlePath = path.join(root, 'app/build.gradle');
  await mkdir(path.dirname(appGradlePath), { recursive: true });
  await writeFile(
    appGradlePath,
    `plugins {
    id 'com.android.application'
}

dependencies {
    implementation "com.google.code.gson:gson:2.10.1"
}
`,
    'utf8',
  );

  await onBeforeMake(root, { platform: 'android' });
  const appGradle = await readFile(appGradlePath, 'utf8');

  for (const dependency of sdkConfig.android.dependencies) {
    assert.match(appGradle, new RegExp(dependency.replaceAll('.', '\\.')));
  }
});

test('onBeforeMake detects Android export roots from app Gradle even without platform options', async () => {
  const {
    onBeforeMake,
  } = require('../sdk/agora-rtc/dist/hooks.js');
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-android-path-only-'));
  const androidRoot = path.join(root, 'android', 'proj');
  const appGradlePath = path.join(androidRoot, 'app/build.gradle');
  await mkdir(path.dirname(appGradlePath), { recursive: true });
  await writeFile(
    appGradlePath,
    `plugins {
    id 'com.android.application'
}

dependencies {
    implementation "com.google.code.gson:gson:2.10.1"
}
`,
    'utf8',
  );

  await onBeforeMake(androidRoot);
  const appGradle = await readFile(appGradlePath, 'utf8');

  for (const dependency of sdkConfig.android.dependencies) {
    assert.match(appGradle, new RegExp(dependency.replaceAll('.', '\\.')));
  }
});
