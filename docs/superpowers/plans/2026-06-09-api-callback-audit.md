# API Callback Audit Implementation Plan

> Status: This was the original docs-only audit plan. The PR was later expanded into implementation fixes for the reported API and callback gaps; use `docs/superpowers/reports/2026-06-09-api-callback-audit.md` and the PR diff as the current delivery record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a Chinese evidence-backed audit report for the current Agora Cocos RTC wrapper API and callback surface.

**Architecture:** Treat the TypeScript wrapper as the public contract and the Android/iOS templates as platform implementations. Generate static inventories from source, compare the inventories, verify suspected dropped native callback parameters against local Agora 4.5.3 artifacts, and write a report without changing SDK code.

**Tech Stack:** TypeScript source files, Node.js one-off extraction scripts, Android `javap`, iOS Objective-C/Swift headers, Markdown.

---

## File Structure

Create:

- `docs/superpowers/reports/2026-06-09-api-callback-audit.md`
  - Chinese audit report with inventory evidence, callback payload findings, documentation gaps, type-only event findings, and optional enhancement candidates.

Read:

- `docs/superpowers/specs/2026-06-09-api-callback-audit-design.md`
  - Approved scope and acceptance criteria.
- `sdk/agora-rtc/js/types.ts`
  - `AgoraMethod`, request option types, and `AgoraEventMap`.
- `sdk/agora-rtc/js/agora.ts`
  - `AgoraRtcClient` public methods and request payload construction.
- `sdk/agora-rtc/README.md`
  - Published README API Surface list.
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
  - Android request handlers and core native callback dispatch.
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/render/RawFrameTextureRenderBackend.java`
  - Android engine-texture event dispatch.
- `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
  - iOS request handlers, texture events, and native callback dispatch.
- `test_shard/integration_test_app/src/api_call_testcases.ts`
  - Integration API call coverage.
- `example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar`
  - Android Agora RTC 4.5.3 Java API signatures.
- `example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineDelegate.h`
  - iOS Agora RTC callback signatures.

Do not modify SDK, demo, native template, test, or packaging files.

## Task 1: Generate Static Inventories

**Files:**
- Read: `sdk/agora-rtc/js/types.ts`
- Read: `sdk/agora-rtc/js/agora.ts`
- Read: `sdk/agora-rtc/README.md`
- Read: `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- Read: `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
- Read: `test_shard/integration_test_app/src/api_call_testcases.ts`
- Temporary output: `/tmp/agora-cocos-api-callback-audit-inventory.json`

- [ ] **Step 1: Generate inventory JSON**

Run:

```bash
node --input-type=module <<'NODE' > /tmp/agora-cocos-api-callback-audit-inventory.json
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const sorted = (values) => [...new Set(values)].sort();
const diff = (left, right) => {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
};
const files = (dir) => {
  let output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output = output.concat(files(file));
    } else {
      output.push(file);
    }
  }
  return output;
};

const types = read('sdk/agora-rtc/js/types.ts');
const client = read('sdk/agora-rtc/js/agora.ts');
const readme = read('sdk/agora-rtc/README.md');
const android = read('sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java');
const ios = read('sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift');
const apiCases = read('test_shard/integration_test_app/src/api_call_testcases.ts');

const methodBlock = types.match(/export type AgoraMethod =([\s\S]*?);\n\nexport interface AgoraVideoViewRect/)?.[1] ?? '';
const methodUnion = sorted([...methodBlock.matchAll(/\| '([^']+)'/g)].map((match) => match[1]));
const clientMethods = sorted(
  [...client.matchAll(/^  (?:async\s+)?([a-zA-Z][\w]*)\s*\(/gm)]
    .map((match) => match[1])
    .filter((name) => !['constructor', 'on', 'off', 'getEngineTexture', 'isEngineTextureReady'].includes(name)),
);
const apiSurfaceBlock = readme.match(/## API Surface([\s\S]*?)\n## /)?.[1] ?? '';
const readmeApi = sorted([...apiSurfaceBlock.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]));
const androidCases = sorted([...android.matchAll(/case "([^"]+)":/g)].map((match) => match[1]));
const iosCases = sorted([...ios.matchAll(/case "([^"]+)":/g)].map((match) => match[1]));
const testMethods = sorted([...apiCases.matchAll(/method: '([^']+)'/g)].map((match) => match[1]));
const eventMapBlock = types.match(/export interface AgoraEventMap \{([\s\S]*?)\n\}/)?.[1] ?? '';
const eventMap = sorted([...eventMapBlock.matchAll(/^  ([a-zA-Z][\w]*):/gm)].map((match) => match[1]));
const nativeTemplateFiles = files('sdk/agora-rtc/templates').filter((file) => /\.(java|swift|mm|cpp|h)$/.test(file));
const nativeEvents = sorted(
  eventMap.filter((eventName) => nativeTemplateFiles.some((file) => read(file).includes(eventName))),
);

console.log(JSON.stringify({
  counts: {
    methodUnion: methodUnion.length,
    clientMethods: clientMethods.length,
    readmeApi: readmeApi.length,
    androidCases: androidCases.length,
    iosCases: iosCases.length,
    integrationMethods: testMethods.length,
    eventMap: eventMap.length,
    nativeEvents: nativeEvents.length,
  },
  methodUnion,
  clientMethods,
  readmeApi,
  androidCases,
  iosCases,
  integrationMethods: testMethods,
  eventMap,
  nativeEvents,
  deltas: {
    missingFromReadme: diff(methodUnion, readmeApi),
    readmeNotInMethodUnion: diff(readmeApi, methodUnion),
    methodUnionMissingClientMethod: diff(methodUnion, clientMethods),
    methodUnionMissingAndroidCase: diff(methodUnion, androidCases),
    methodUnionMissingIosCase: diff(methodUnion, iosCases),
    methodUnionMissingIntegrationCase: diff(methodUnion, testMethods),
    eventMapNotNativeTemplates: diff(eventMap, nativeEvents),
    nativeTemplatesNotEventMap: diff(nativeEvents, eventMap),
  },
}, null, 2));
NODE
```

Expected file exists:

```bash
test -s /tmp/agora-cocos-api-callback-audit-inventory.json && echo inventory-ready
```

Expected output:

```text
inventory-ready
```

- [ ] **Step 2: Validate inventory counts and deltas**

Run:

```bash
node --input-type=module <<'NODE'
import fs from 'node:fs';
const inventory = JSON.parse(fs.readFileSync('/tmp/agora-cocos-api-callback-audit-inventory.json', 'utf8'));
console.log(JSON.stringify({
  counts: inventory.counts,
  deltas: inventory.deltas,
}, null, 2));
NODE
```

Expected output:

```json
{
  "counts": {
    "methodUnion": 54,
    "clientMethods": 54,
    "readmeApi": 53,
    "androidCases": 54,
    "iosCases": 54,
    "integrationMethods": 54,
    "eventMap": 24,
    "nativeEvents": 21
  },
  "deltas": {
    "missingFromReadme": [
      "setNativeVideoOverlaySuspended"
    ],
    "readmeNotInMethodUnion": [],
    "methodUnionMissingClientMethod": [],
    "methodUnionMissingAndroidCase": [],
    "methodUnionMissingIosCase": [],
    "methodUnionMissingIntegrationCase": [],
    "eventMapNotNativeTemplates": [
      "localVideoFrame",
      "remoteVideoFrame",
      "warning"
    ],
    "nativeTemplatesNotEventMap": []
  }
}
```

## Task 2: Verify Confirmed Callback Parameter Findings

**Files:**
- Read: `sdk/agora-rtc/js/types.ts`
- Read: `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- Read: `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
- Read: `example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar`
- Read: `example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineDelegate.h`

- [ ] **Step 1: Verify TypeScript event payload declarations omit `elapsed`**

Run:

```bash
nl -ba sdk/agora-rtc/js/types.ts | sed -n '167,225p'
```

Expected evidence:

```text
168	  joinChannelSuccess: {
169	    channelId: string;
170	    uid: number;
171	  };
223	  userJoined: {
224	    uid: number;
225	  };
```

- [ ] **Step 2: Verify Android native dispatch receives but omits `elapsed`**

Run:

```bash
nl -ba sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java | sed -n '435,447p'
```

Expected evidence:

```text
437	                public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
438	                    dispatchEvent("joinChannelSuccess", jsonObject(
439	                            "channelId", channel,
440	                            "uid", uid
441	                    ));
445	                public void onUserJoined(int uid, int elapsed) {
446	                    dispatchEvent("userJoined", jsonObject("uid", uid));
```

- [ ] **Step 3: Verify iOS native dispatch receives but omits `elapsed`**

Run:

```bash
nl -ba sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift | sed -n '1231,1272p'
```

Expected evidence:

```text
1231	    func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinChannel channel: String, withUid uid: UInt, elapsed: Int) {
1232	        dispatchEvent(name: "joinChannelSuccess", payload: [
1233	            "channelId": channel,
1234	            "uid": uid,
1235	        ])
1269	    func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinedOfUid uid: UInt, elapsed: Int) {
1270	        dispatchEvent(name: "userJoined", payload: [
1271	            "uid": uid,
1272	        ])
```

- [ ] **Step 4: Verify Android 4.5.3 callback signatures**

Run:

```bash
tmpdir=$(mktemp -d)
unzip -p example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar libs/agora-rtc-sdk.jar > "$tmpdir/agora-rtc-sdk.jar"
javap -classpath "$tmpdir/agora-rtc-sdk.jar" -public io.agora.rtc2.IRtcEngineEventHandler | rg 'onJoinChannelSuccess|onUserJoined'
rm -rf "$tmpdir"
```

Expected evidence:

```text
public void onJoinChannelSuccess(java.lang.String, int, int);
public void onUserJoined(int, int);
```

- [ ] **Step 5: Verify iOS 4.5.3 callback signatures**

Run:

```bash
rg -n "didJoinChannel|didJoinedOfUid" \
  example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineDelegate.h
```

Expected evidence contains:

```text
didJoinChannel:(NSString * _Nonnull)channel withUid:(NSUInteger)uid elapsed:(NSInteger)elapsed
didJoinedOfUid:(NSUInteger)uid elapsed:(NSInteger)elapsed
```

## Task 3: Verify Documentation Gap and Type-Only Events

**Files:**
- Read: `sdk/agora-rtc/README.md`
- Read: `sdk/agora-rtc/js/types.ts`
- Read: `sdk/agora-rtc/templates/android`
- Read: `sdk/agora-rtc/templates/ios`

- [ ] **Step 1: Verify README omits `setNativeVideoOverlaySuspended`**

Run:

```bash
nl -ba sdk/agora-rtc/README.md | sed -n '29,84p'
rg -n --fixed-strings 'setNativeVideoOverlaySuspended' sdk/agora-rtc/README.md || echo 'README missing setNativeVideoOverlaySuspended'
```

Expected evidence:

```text
README missing setNativeVideoOverlaySuspended
```

- [ ] **Step 2: Verify TypeScript declares the three type-only events**

Run:

```bash
nl -ba sdk/agora-rtc/js/types.ts | sed -n '203,216p;271,274p'
```

Expected evidence:

```text
203	  localVideoFrame: {
210	  remoteVideoFrame: {
271	  warning: {
```

- [ ] **Step 3: Verify native templates do not emit the three type-only events**

Run:

```bash
if rg -n --fixed-strings 'localVideoFrame' sdk/agora-rtc/templates; then exit 1; else echo 'localVideoFrame not emitted'; fi
if rg -n --fixed-strings 'remoteVideoFrame' sdk/agora-rtc/templates; then exit 1; else echo 'remoteVideoFrame not emitted'; fi
if rg -n --fixed-strings 'warning' sdk/agora-rtc/templates; then exit 1; else echo 'warning not emitted'; fi
```

Expected evidence:

```text
localVideoFrame not emitted
remoteVideoFrame not emitted
warning not emitted
```

- [ ] **Step 4: Verify texture-ready events are emitted and should not be reported as type-only**

Run:

```bash
rg -n --fixed-strings 'localVideoTextureReady' sdk/agora-rtc/templates
rg -n --fixed-strings 'remoteVideoTextureReady' sdk/agora-rtc/templates
rg -n --fixed-strings 'renderBackendState' sdk/agora-rtc/templates
```

Expected evidence includes Android `RawFrameTextureRenderBackend.java` and iOS `AgoraRtcBridge.swift` locations. These events are not audit findings.

## Task 4: Write the Chinese Audit Report

**Files:**
- Create: `docs/superpowers/reports/2026-06-09-api-callback-audit.md`
- Read: `/tmp/agora-cocos-api-callback-audit-inventory.json`
- Read: command outputs from Tasks 1-3

- [ ] **Step 1: Create the report directory**

Run:

```bash
mkdir -p docs/superpowers/reports
```

Expected output: none.

- [ ] **Step 2: Write the report**

Create `docs/superpowers/reports/2026-06-09-api-callback-audit.md` with this structure and evidence:

```markdown
# Agora Cocos RTC API 和回调审计报告

日期：2026-06-09

## 口径

本报告只审计当前 wrapper 已暴露或已声明的 API 与回调：`AgoraMethod`、`AgoraRtcClient`、`AgoraEventMap`、Android/iOS native templates、README API Surface、integration API call cases。Agora Native SDK 4.5.3 存在但 wrapper 没声明的字段不算当前缺陷，只列为候选增强。

## API 对齐矩阵

静态 inventory 结果：

| 项目 | 数量 | 结论 |
| --- | ---: | --- |
| `AgoraMethod` | 54 | 当前 TS bridge method union |
| `AgoraRtcClient` bridge 方法 | 54 | 与 `AgoraMethod` 对齐 |
| Android native handlers | 54 | 与 `AgoraMethod` 对齐 |
| iOS native handlers | 54 | 与 `AgoraMethod` 对齐 |
| integration API cases | 54 | 与 `AgoraMethod` 对齐 |
| README API Surface | 53 | 少列 1 个方法 |

差异：

- README 少列：`setNativeVideoOverlaySuspended`。
- `AgoraMethod` 没有缺失 client method、Android handler、iOS handler 或 integration case。

证据：

- `sdk/agora-rtc/js/types.ts:17` 定义 `AgoraMethod`，其中 `setNativeVideoOverlaySuspended` 在 `sdk/agora-rtc/js/types.ts:55`。
- `sdk/agora-rtc/js/agora.ts:239` 暴露 `setNativeVideoOverlaySuspended(suspended: boolean)`。
- `sdk/agora-rtc/README.md:29` 到 `sdk/agora-rtc/README.md:83` 是 README API Surface，未列 `setNativeVideoOverlaySuspended`。
- `/tmp/agora-cocos-api-callback-audit-inventory.json` 的 `missingFromReadme` 只有 `setNativeVideoOverlaySuspended`。

## 回调对齐矩阵

静态 inventory 结果：

| 项目 | 数量 | 结论 |
| --- | ---: | --- |
| `AgoraEventMap` | 24 | 当前 TS 声明事件 |
| native templates emitted events | 21 | 少 3 个 TS-only 事件 |

native templates 未发出的 TS 声明事件：

- `localVideoFrame`
- `remoteVideoFrame`
- `warning`

证据：

- `localVideoFrame` 和 `remoteVideoFrame` 声明在 `sdk/agora-rtc/js/types.ts:203` 到 `sdk/agora-rtc/js/types.ts:216`。
- `warning` 声明在 `sdk/agora-rtc/js/types.ts:271` 到 `sdk/agora-rtc/js/types.ts:274`。
- `rg` 检查 `sdk/agora-rtc/templates` 未找到这三个事件的 native emit。
- `localVideoTextureReady`、`remoteVideoTextureReady`、`renderBackendState` 已在 native templates 发出，不属于 TS-only 问题。

## 确认漏掉的回调参数

### `joinChannelSuccess.elapsed`

当前 TS payload 没有 `elapsed`：

- `sdk/agora-rtc/js/types.ts:168` 到 `sdk/agora-rtc/js/types.ts:171` 只声明 `channelId` 和 `uid`。

Android/iOS native callback 收到了 `elapsed` 但 dispatch payload 没发：

- Android：`sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:437` 的 `onJoinChannelSuccess(String channel, int uid, int elapsed)` 收到 `elapsed`，但 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:438` 到 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:441` 只发 `channelId` 和 `uid`。
- iOS：`sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1231` 的 `didJoinChannel ... elapsed: Int` 收到 `elapsed`，但 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1232` 到 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1235` 只发 `channelId` 和 `uid`。

Native 4.5.3 签名证据：

- Android `javap` 输出包含 `public void onJoinChannelSuccess(java.lang.String, int, int);`。
- iOS header 输出包含 `didJoinChannel:(NSString * _Nonnull)channel withUid:(NSUInteger)uid elapsed:(NSInteger)elapsed`。

结论：这是当前已暴露回调的确认漏参。

### `userJoined.elapsed`

当前 TS payload 没有 `elapsed`：

- `sdk/agora-rtc/js/types.ts:223` 到 `sdk/agora-rtc/js/types.ts:225` 只声明 `uid`。

Android/iOS native callback 收到了 `elapsed` 但 dispatch payload 没发：

- Android：`sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:445` 的 `onUserJoined(int uid, int elapsed)` 收到 `elapsed`，但 `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java:446` 只发 `uid`。
- iOS：`sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1269` 的 `didJoinedOfUid uid: UInt, elapsed: Int` 收到 `elapsed`，但 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1270` 到 `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift:1272` 只发 `uid`。

Native 4.5.3 签名证据：

- Android `javap` 输出包含 `public void onUserJoined(int, int);`。
- iOS header 输出包含 `didJoinedOfUid:(NSUInteger)uid elapsed:(NSInteger)elapsed`。

结论：这是当前已暴露回调的确认漏参。

## 文档漏项

- `setNativeVideoOverlaySuspended` 已在 TS method union 和 client wrapper 中暴露，但 README API Surface 没列。
- 证据：`sdk/agora-rtc/js/types.ts:55`、`sdk/agora-rtc/js/agora.ts:239`、`sdk/agora-rtc/README.md:29` 到 `sdk/agora-rtc/README.md:83`。

## 类型声明但 native 当前不发出的事件

- `localVideoFrame`
- `remoteVideoFrame`
- `warning`

证据：`sdk/agora-rtc/js/types.ts:203` 到 `sdk/agora-rtc/js/types.ts:216`、`sdk/agora-rtc/js/types.ts:271` 到 `sdk/agora-rtc/js/types.ts:274`，以及 `rg` 对 `sdk/agora-rtc/templates` 的未命中结果。

影响：这三个事件对 TS 消费者表现为可订阅，但当前 native templates 不会产生对应事件。后续可以选择删除类型、标注保留、或实现 native emit。

## 候选增强，不按 bug 处理

当前审计没有把未暴露的 Agora Native 4.5.3 全量字段列为 bug。若后续要扩大 wrapper 能力，可以另开范围评估：

- `ChannelMediaOptions` 中更多 publish/custom/multipath 字段。
- `VideoEncoderConfiguration` 中 `minBitrate`、`mirrorMode`、`degradationPreference`、`advancedVideoOptions` 等字段。
- `setClientRole` 带 options 的重载。
- `preloadEffect` 带 `startPos` 的重载。

这些候选增强来自本地 4.5.3 AAR/header 签名，但不属于本次“当前 wrapper 已暴露 API/回调”的漏参结论。

## 总结

当前 54 个已暴露 bridge API 在 TypeScript、Android、iOS 和 integration test 之间是对齐的。确认问题集中在 2 个回调漏参、1 个 README API 漏项、3 个 TS-only 事件声明。
```

Expected result: the report is written in Chinese and contains all sections above.

## Task 5: Verify Report and Commit

**Files:**
- Read: `docs/superpowers/reports/2026-06-09-api-callback-audit.md`
- Modify: git index only

- [ ] **Step 1: Run report self-review checks**

Run:

```bash
node --input-type=module <<'NODE'
import fs from 'node:fs';
const report = fs.readFileSync('docs/superpowers/reports/2026-06-09-api-callback-audit.md', 'utf8');
const markers = ['TB' + 'D', 'TO' + 'DO', 'FIX' + 'ME', '\u5f85' + '\u8865', '\u5360' + '\u4f4d'];
let matched = false;
for (const [index, line] of report.split('\n').entries()) {
  if (markers.some((marker) => line.includes(marker))) {
    console.log(`${index + 1}:${line}`);
    matched = true;
  }
}
if (matched) {
  process.exit(1);
}
NODE
```

Expected: no output and exit code 0.

- [ ] **Step 2: Verify report contains required categories**

Run:

```bash
rg -n "API 对齐矩阵|回调对齐矩阵|确认漏掉的回调参数|文档漏项|类型声明但 native 当前不发出的事件|候选增强，不按 bug 处理" docs/superpowers/reports/2026-06-09-api-callback-audit.md
```

Expected output contains all six section headings.

- [ ] **Step 3: Verify no SDK files changed**

Run:

```bash
git diff --name-only | rg -v '^docs/superpowers/reports/2026-06-09-api-callback-audit.md$|^docs/superpowers/plans/2026-06-09-api-callback-audit.md$' || true
```

Expected: no output.

- [ ] **Step 4: Commit the audit report**

Run:

```bash
git add -f docs/superpowers/reports/2026-06-09-api-callback-audit.md
git commit -m "docs: add api callback audit report"
```

Expected commit message:

```text
docs: add api callback audit report
```

Do not include `/tmp/agora-cocos-api-callback-audit-inventory.json` in the commit.
