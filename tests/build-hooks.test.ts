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
  ensureIosAppDelegateBridgeAttachment,
  ensureIosSetupGuide,
  ensureNativeEngineTextureBridge,
  findFirstExistingPath,
  patchAndroidAppActivityBridgeAttachment,
  patchIosAppDelegateBridgeAttachment,
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

  assert.match(
    once,
    /if\(NOT APPLE\)[\s\S]*Classes\/agora\/AgoraEngineTextureBridge\.h[\s\S]*Classes\/agora\/AgoraEngineTextureBridge\.cpp[\s\S]*endif\(\)/,
  );
  assert.equal(once, twice);
});

test('patchNativeCommonCMakeTextureBridge upgrades unguarded texture bridge sources', () => {
  const original = `list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/Game.cpp
)

list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.cpp
)
`;

  const patched = patchNativeCommonCMakeTextureBridge(original);

  assert.match(patched, /if\(NOT APPLE\)/);
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

test('cocos extension entrypoints are loadable from commonjs', () => {
  const main = require('../sdk/agora-rtc/dist/main.js');
  const builder = require('../sdk/agora-rtc/dist/builder.js');

  assert.equal(typeof main.load, 'function');
  assert.equal(typeof main.unload, 'function');
  assert.equal(typeof builder.configs.ios.hooks, 'string');
});
