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
  ensureAgoraLocalMavenRepository,
  ensureAndroidRtcPermissions,
  ensureIosCMakeRtcBridgeSources,
  ensureIosRtcUsageDescriptions,
  ensureIosXcodeProjectSwiftPackage,
  ensureIosAppDelegateBridgeAttachment,
  ensureIosSetupGuide,
  ensureNativeEngineTextureBridge,
  findFirstExistingPath,
  onBeforeMake,
  patchAndroidAppActivityBridgeAttachment,
  patchIosAppDelegateBridgeAttachment,
  patchIosCMakeRtcBridgeSources,
  patchIosXcodeProjectSwiftPackage,
  patchNativeCommonCMakeTextureBridge,
  patchNativeGameTextureBridgeRegistration,
  rewriteAndroidGradlePluginVersion,
  rewriteGradleDistributionUrl,
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

test('rewriteAndroidGradlePluginVersion upgrades AGP to the pinned cached version', () => {
  const original = "classpath 'com.android.tools.build:gradle:8.10.1'";
  const rewritten = rewriteAndroidGradlePluginVersion(original);

  assert.match(
    rewritten,
    new RegExp(sdkConfig.android.gradlePluginVersion.replaceAll('.', '\\.')),
  );
  assert.doesNotMatch(rewritten, /8\.10\.1/);
});

test('ensureAgoraLocalMavenRepository injects project-local Maven mirror once', () => {
  const original = `allprojects {
    repositories {
        google()
        mavenCentral()
    }
  }`;

  const once = ensureAgoraLocalMavenRepository(original);
  const twice = ensureAgoraLocalMavenRepository(once);

  assert.match(once, /local-maven/);
  assert.equal(once, twice);
});

test('rewriteGradleDistributionUrl pins the wrapper to Gradle 8.13', () => {
  const original = 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip';
  const rewritten = rewriteGradleDistributionUrl(original);

  assert.equal(rewritten, `distributionUrl=${sdkConfig.android.gradleDistributionUrl}`);
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

  assert.match(content, new RegExp(sdkConfig.ios.packageProduct));
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
/* End XCBuildConfiguration section */
  };
  rootObject = F133864AD5934D1C837F0D69 /* Project object */;
}
`;
}

test('patchIosXcodeProjectSwiftPackage adds Agora iOS SPM product to the app target once', () => {
  const original = createIosPbxprojFixture();
  const once = patchIosXcodeProjectSwiftPackage(original);
  const twice = patchIosXcodeProjectSwiftPackage(once);

  assert.match(once, /XCRemoteSwiftPackageReference/);
  assert.match(once, new RegExp(sdkConfig.ios.packageUrl.replaceAll('.', '\\.')));
  assert.match(once, /kind = exactVersion;/);
  assert.match(once, new RegExp(`version = ${sdkConfig.ios.packageVersion.replaceAll('.', '\\.')};`));
  assert.match(once, /XCSwiftPackageProductDependency/);
  assert.match(once, new RegExp(`productName = ${sdkConfig.ios.packageProduct};`));
  assert.match(once, /packageReferences = \(\s*A90A00000000000000000101 \/\* XCRemoteSwiftPackageReference "AgoraRtcEngine_iOS" \*\/,\s*\);/);
  assert.match(once, /packageProductDependencies = \(\s*A90A00000000000000000102 \/\* RtcBasic \*\/,\s*\);/);
  assert.match(once, /files = \(\s*A90A00000000000000000103 \/\* RtcBasic in Frameworks \*\/,\s*\);/);
  assert.equal(
    [...once.matchAll(/repositoryURL = "https:\/\/github\.com\/AgoraIO\/AgoraRtcEngine_iOS\.git";/g)].length,
    1,
  );
  assert.equal(once, twice);
});

test('ensureIosXcodeProjectSwiftPackage patches generated Xcode project files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-pbxproj-'));
  const pbxprojPath = path.join(
    root,
    'proj/agora-cocos-basic-call.xcodeproj/project.pbxproj',
  );
  await mkdir(path.dirname(pbxprojPath), { recursive: true });
  await writeFile(pbxprojPath, createIosPbxprojFixture(), 'utf8');

  const patchedPaths = await ensureIosXcodeProjectSwiftPackage(root);
  const content = await readFile(pbxprojPath, 'utf8');

  assert.deepEqual(patchedPaths, [pbxprojPath]);
  assert.match(content, /XCRemoteSwiftPackageReference/);
  assert.match(content, /productName = RtcBasic;/);
});

test('onBeforeMake patches generated iOS Xcode project before native compilation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agora-cocos-ios-before-make-'));
  const pbxprojPath = path.join(root, 'agora-cocos-basic-call.xcodeproj/project.pbxproj');
  await mkdir(path.dirname(pbxprojPath), { recursive: true });
  await writeFile(pbxprojPath, createIosPbxprojFixture(), 'utf8');

  await onBeforeMake(root, { platform: 'ios' });
  const content = await readFile(pbxprojPath, 'utf8');

  assert.match(content, /XCRemoteSwiftPackageReference/);
  assert.match(content, /RtcBasic in Frameworks/);
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
  assert.match(once, /onRequestPermissionsResult/);
  assert.match(once, /AgoraRtcPlugin\.getInstance\(\)\.onRequestPermissionsResult\(requestCode, permissions, grantResults\)/);
  assert.equal(
    [...once.matchAll(/AgoraRtcPlugin\.getInstance\(\)\.attachBridge\(\);/g)].length,
    1,
  );
  assert.equal(
    [...once.matchAll(/AgoraRtcPlugin\.getInstance\(\)\.onRequestPermissionsResult/g)].length,
    1,
  );
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
  assert.match(content, /AgoraRtcPlugin\.getInstance\(\)\.onRequestPermissionsResult\(requestCode, permissions, grantResults\)/);
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

test('cocos extension entrypoints are loadable from commonjs', () => {
  const main = require('../sdk/agora-rtc/dist/main.js');
  const builder = require('../sdk/agora-rtc/dist/builder.js');

  assert.equal(typeof main.load, 'function');
  assert.equal(typeof main.unload, 'function');
  assert.equal(typeof builder.configs.ios.hooks, 'string');
});
