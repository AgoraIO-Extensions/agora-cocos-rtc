# Agora API Boundary Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the readme-required Agora Cocos API contract so TypeScript owns media options, native bridges only map validated parameters, and unsupported or platform-specific behavior is explicit.

**Architecture:** Treat `sdk/agora-rtc/js/types.ts` and `sdk/agora-rtc/js/agora.ts` as the public Cocos API boundary. Android and iOS bridge templates map that boundary into local Agora RTC 4.5.3 SDK calls, and demo runtime files mirror the packaged SDK/template sources. The demo passes business defaults from `RtcSessionService`, including publish and subscribe options for video joins.

**Tech Stack:** TypeScript ESM, Node test runner, Cocos Creator 3.8.8 assets, Android Java bridge over `io.agora.rtc2`, iOS Swift bridge over `AgoraRtcEngineKit`.

---

## Current Dirty State

The worktree currently has a temporary Android native hardcode from the smoke test. Implementation must remove it instead of preserving it:

- `example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- `native/engine/android/app/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- `tests/native-templates.test.ts`

Do not revert unrelated user edits. These four dirty files are in scope because they contain the temporary native media-options behavior this plan replaces.

## File Structure

- `sdk/agora-rtc/js/types.ts`: public TypeScript request and option types.
- `sdk/agora-rtc/js/agora.ts`: public `AgoraRtcClient` methods and request payload construction.
- `example/basic-call/assets/agora-rtc-sdk/types.ts`: demo copy of SDK TypeScript types.
- `example/basic-call/assets/agora-rtc-sdk/agora.ts`: demo copy of SDK client.
- `example/basic-call/assets/scripts/demo/RtcSessionService.ts`: demo-owned RTC workflow and business defaults.
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`: Android bridge template.
- `native/engine/android/app/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`: local Android runtime bridge copy.
- `example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`: demo plugin Android bridge copy.
- `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`: iOS bridge template.
- `example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift`: demo plugin iOS bridge copy.
- `tests/agora-client.test.ts`: TypeScript bridge request tests.
- `tests/native-templates.test.ts`: static and compile tests for Android/iOS native templates.
- `tests/example-scene.test.ts`: static demo behavior tests.
- `docs/superpowers/plans/2026-06-08-agora-api-boundary-audit.md`: this plan and the phase API matrix.

## Phase API Matrix

| Readme API or event | Cocos API | Android 4.5.3 local SDK | iOS 4.5.3 expected SDK | Action |
| --- | --- | --- | --- | --- |
| `GetEngine` | `initialize(appId)` | `RtcEngine.create` | `AgoraRtcEngineKit.sharedEngine` | audit existing |
| `Destroy` / `UnloadEngine` | `destroy()` | `RtcEngine.destroy` | `AgoraRtcEngineKit.destroy` | audit existing |
| `GetSdkVersion` | `getSdkVersion()` | `RtcEngine.getSdkVersion` | `AgoraRtcEngineKit.getSdkVersion` | audit existing |
| `GetErrorDescription` | `getErrorDescription(code)` | `RtcEngine.getErrorDescription` | `AgoraRtcEngineKit.getErrorDescription` | audit existing |
| `SetLogFilter` | `setLogFilter(level)` | `setLogFilter` | `setLogFilter` | audit existing |
| `SetLogFile` | `setLogFile(path)` | `setLogFile` | `setLogFile` | audit existing |
| `SetChannelProfile` | `setChannelProfile(profile)` | `setChannelProfile` | `setChannelProfile` | audit existing |
| `SetClientRole` | `setClientRole(role)` | `setClientRole` | `setClientRole` | audit existing |
| `JoinChannelByKey` | `joinChannel(token, channelId, uid, options?)` | `joinChannel(String,String,int,ChannelMediaOptions)` | `joinChannel(byToken:channelId:uid:mediaOptions:joinSuccess:)` | add options |
| `LeaveChannel` | `leaveChannel()` | `leaveChannel` | `leaveChannel` | audit existing |
| `RenewToken` | `renewToken(token)` | `renewToken` | `renewToken` | audit existing |
| audio enable/mute | existing audio methods | matching `RtcEngine` methods | matching `AgoraRtcEngineKit` methods | audit existing |
| `SetDefaultAudioRouteToSpeakerphone` | `setDefaultAudioRouteToSpeakerphone(enabled)` | `setDefaultAudioRoutetoSpeakerphone` | `setDefaultAudioRouteToSpeakerphone` | fix Android bridge |
| `SetAudioSessionOperationRestriction` | `setAudioSessionOperationRestriction(restriction)` | no bridge support | `setAudioSessionOperationRestriction` | keep Android unsupported, audit iOS |
| video enable/mute/preview/camera | existing video methods | matching `RtcEngine` methods | matching `AgoraRtcEngineKit` methods | audit existing |
| `SetBeautyEffectOptions` | `setBeautyEffectOptions(enabled, options)` | `setBeautyEffectOptions` | `setBeautyEffectOptions` | audit existing |
| `EnableContentInspect` | `enableContentInspect(enabled, config)` | `enableContentInspect` | `enableContentInspect` | audit existing |
| `SetParameters` | `setParameters(parameters)` | `setParameters` | `setParameters` | audit existing |
| `StartAudioMixing` | `startAudioMixing(config)` | `startAudioMixing(String,boolean,int,int)` | `startAudioMixing(_:loopback:cycle:startPos:)` | reject/remove `replace` |
| audio effects | `preloadEffect`, `playEffect`, `stopEffect` | `IAudioEffectManager` | `AgoraRtcEngineKit` effect methods | audit existing |
| callbacks | `AgoraEventMap` | `IRtcEngineEventHandler` | `AgoraRtcEngineDelegate` | audit existing |

## Task 1: Verify Local SDK Signatures

**Files:**
- Read: `sdk/agora-rtc/sdk-config.json`
- Read: `example/basic-call/local-maven/io/agora/rtc/full-sdk/4.5.3/full-sdk-4.5.3.pom`
- Read: `example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar`
- Read after generation: `example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineKit.h`
- Read after generation: `example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraObjects.h`

- [ ] **Step 1: Verify Android `ChannelMediaOptions` and `RtcEngine` signatures**

Run:

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
jar xf /Users/admin/agora-cocos-rtc/.worktrees/cocos-prefab-demo-refactor/example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar libs/agora-rtc-sdk.jar
javap -classpath libs/agora-rtc-sdk.jar io.agora.rtc2.RtcEngine io.agora.rtc2.ChannelMediaOptions | rg 'joinChannel|setDefaultAudioRoutetoSpeakerphone|startAudioMixing|publishCameraTrack|publishMicrophoneTrack|autoSubscribeAudio|autoSubscribeVideo|clientRoleType|channelProfile|startPreview|parameters'
```

Expected output contains:

```text
public abstract int joinChannel(java.lang.String, java.lang.String, int, io.agora.rtc2.ChannelMediaOptions);
public abstract int setDefaultAudioRoutetoSpeakerphone(boolean);
public abstract int startAudioMixing(java.lang.String, boolean, int, int);
public java.lang.Boolean publishCameraTrack;
public java.lang.Boolean publishMicrophoneTrack;
public java.lang.Boolean autoSubscribeAudio;
public java.lang.Boolean autoSubscribeVideo;
public java.lang.Integer clientRoleType;
public java.lang.Integer channelProfile;
public java.lang.Boolean startPreview;
public java.lang.String parameters;
```

- [ ] **Step 2: Generate or refresh iOS 4.5.3 Pods before final iOS bridge implementation**

Run with the user's proxy when network is needed:

```bash
export http_proxy=http://127.0.0.1:7892
export https_proxy=http://127.0.0.1:7892
export all_proxy=http://127.0.0.1:7892
./scripts/dev-ios.sh
```

Expected: the script reaches `pod install` and the generated `Podfile.lock` uses `AgoraRtcEngine_iOS (4.5.3)`. If the full Cocos or simulator build fails after Pods are generated, keep the generated headers and continue only if the headers are present.

- [ ] **Step 3: Verify iOS media-options signatures**

Run:

```bash
rg -n "joinChannelByToken|AgoraRtcChannelMediaOptions|publishCameraTrack|publishMicrophoneTrack|autoSubscribeAudio|autoSubscribeVideo|clientRoleType|channelProfile|startPreview|parameters" \
  example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraRtcEngineKit.h \
  example/basic-call/build-ios/ios/proj/Pods/AgoraRtcEngine_iOS/AgoraRtcKit.xcframework/ios-arm64_x86_64-simulator/AgoraRtcKit.framework/Headers/AgoraObjects.h
```

Expected output contains this Swift-name signature and option properties:

```text
NS_SWIFT_NAME(joinChannel(byToken:channelId:uid:mediaOptions:joinSuccess:))
@interface AgoraRtcChannelMediaOptions : NSObject
@property(assign, nonatomic) BOOL publishCameraTrack;
@property(assign, nonatomic) BOOL publishMicrophoneTrack;
@property(assign, nonatomic) BOOL autoSubscribeAudio;
@property(assign, nonatomic) BOOL autoSubscribeVideo;
@property(assign, nonatomic) AgoraClientRole clientRoleType;
@property(assign, nonatomic) AgoraChannelProfile channelProfile;
```

- [ ] **Step 4: Commit nothing**

This task captures evidence only. Do not commit generated `build-ios`, `build-android`, `local`, screenshots, or credentials.

## Task 2: Add TypeScript Join Options Contract

**Files:**
- Modify: `sdk/agora-rtc/js/types.ts`
- Modify: `sdk/agora-rtc/js/agora.ts`
- Modify: `example/basic-call/assets/agora-rtc-sdk/types.ts`
- Modify: `example/basic-call/assets/agora-rtc-sdk/agora.ts`
- Test: `tests/agora-client.test.ts`

- [ ] **Step 1: Write failing TypeScript client tests**

Add this test after the existing native failure tests in `tests/agora-client.test.ts`:

```ts
test('joinChannel dispatches optional channel media options from TypeScript', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.joinChannel('demo-token', 'demo-channel', 1001, {
    clientRoleType: 'broadcaster',
    channelProfile: 'liveBroadcasting',
    publishCameraTrack: true,
    publishMicrophoneTrack: true,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
    enableAudioRecordingOrPlayout: true,
    startPreview: true,
    token: 'override-token',
    parameters: '{"rtc.video.enabled":true}',
  });
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'joinChannel');
  assert.deepEqual(request.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    uid: 1001,
    options: {
      clientRoleType: 'broadcaster',
      channelProfile: 'liveBroadcasting',
      publishCameraTrack: true,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
      enableAudioRecordingOrPlayout: true,
      startPreview: true,
      token: 'override-token',
      parameters: '{"rtc.video.enabled":true}',
    },
  });

  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
});

test('joinChannel keeps the existing payload when options are omitted', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  const pending = client.joinChannel('demo-token', 'demo-channel', 7);
  const request = JSON.parse(transport.sent[0].payload);

  assert.equal(request.method, 'joinChannel');
  assert.deepEqual(request.params, {
    token: 'demo-token',
    channelId: 'demo-channel',
    uid: 7,
  });

  transport.emit('agora:response', JSON.stringify({ requestId: request.requestId, ok: true }));
  await pending;
});
```

- [ ] **Step 2: Add a failing unsupported `replace` test**

Add this test near the existing audio mixing API assertions in `tests/agora-client.test.ts`:

```ts
test('startAudioMixing rejects replace because RTC 4.5.3 bridge signatures do not support it', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  await assert.rejects(
    client.startAudioMixing({
      path: 'audio/demo.mp3',
      loopback: false,
      cycle: 1,
      replace: false,
    } as any),
    (error: { code: string; message: string; details: Record<string, unknown> }) =>
      error.code === AgoraErrorCode.ProtocolError &&
      error.message === 'startAudioMixing.replace is not supported by the Agora RTC 4.5.3 native bridge.' &&
      error.details.method === 'startAudioMixing' &&
      error.details.parameter === 'replace',
  );
  assert.equal(transport.sent.length, 0);
});
```

- [ ] **Step 3: Run the failing client tests**

Run:

```bash
node --test tests/agora-client.test.ts
```

Expected: FAIL because `joinChannel` accepts only three arguments and `startAudioMixing` does not reject `replace`.

- [ ] **Step 4: Add TypeScript option types**

In `sdk/agora-rtc/js/types.ts`, insert these types after `AgoraContentInspectConfig`:

```ts
export type AgoraClientRole = 'broadcaster' | 'audience';

export type AgoraChannelProfile =
  | 'communication'
  | 'liveBroadcasting';

export interface AgoraChannelMediaOptions {
  clientRoleType?: AgoraClientRole | number;
  channelProfile?: AgoraChannelProfile | number;
  publishCameraTrack?: boolean;
  publishMicrophoneTrack?: boolean;
  autoSubscribeAudio?: boolean;
  autoSubscribeVideo?: boolean;
  enableAudioRecordingOrPlayout?: boolean;
  startPreview?: boolean;
  token?: string;
  parameters?: string;
}
```

In `sdk/agora-rtc/js/types.ts`, remove `replace?: boolean;` from `AgoraAudioMixingConfig` so the interface becomes:

```ts
export interface AgoraAudioMixingConfig {
  path: string;
  loopback?: boolean;
  cycle?: number;
  startPos?: number;
}
```

- [ ] **Step 5: Update the TypeScript client**

In `sdk/agora-rtc/js/agora.ts`, add `type AgoraChannelMediaOptions` to the existing type imports from `./types.ts`.

Replace the existing `joinChannel` method with:

```ts
  joinChannel(
    token: string,
    channelId: string,
    uid: number,
    options?: AgoraChannelMediaOptions,
  ): Promise<void> {
    const params: Record<string, unknown> = { token, channelId, uid };
    if (options !== undefined) {
      params.options = options;
    }
    return this.#invoke('joinChannel', params) as Promise<void>;
  }
```

Replace the existing `startAudioMixing` method with:

```ts
  startAudioMixing(config: AgoraAudioMixingConfig): Promise<void> {
    if (Object.prototype.hasOwnProperty.call(config as Record<string, unknown>, 'replace')) {
      return Promise.reject(
        new AgoraSdkError(
          AgoraErrorCode.ProtocolError,
          'startAudioMixing.replace is not supported by the Agora RTC 4.5.3 native bridge.',
          {
            method: 'startAudioMixing',
            parameter: 'replace',
          },
        ),
      );
    }
    return this.#invoke('startAudioMixing', { ...config }) as Promise<void>;
  }
```

- [ ] **Step 6: Mirror SDK TypeScript files into the demo asset copy**

Run:

```bash
cp sdk/agora-rtc/js/types.ts example/basic-call/assets/agora-rtc-sdk/types.ts
cp sdk/agora-rtc/js/agora.ts example/basic-call/assets/agora-rtc-sdk/agora.ts
```

- [ ] **Step 7: Run client tests and typecheck**

Run:

```bash
node --test tests/agora-client.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add sdk/agora-rtc/js/types.ts sdk/agora-rtc/js/agora.ts example/basic-call/assets/agora-rtc-sdk/types.ts example/basic-call/assets/agora-rtc-sdk/agora.ts tests/agora-client.test.ts
git commit -m "feat: add channel media options to cocos rtc client"
```

## Task 3: Move Demo Join Defaults To TypeScript

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
- Test: `tests/example-scene.test.ts`

- [ ] **Step 1: Write failing demo source test**

Add this test to `tests/example-scene.test.ts`:

```ts
test('rtc session service passes video join media options from TypeScript', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );

  const joinMethodMatch = content.match(/async joinRtcChannel\(\): Promise<void>[\s\S]*?async leaveRtcChannel/);
  assert.ok(joinMethodMatch);
  const joinMethod = joinMethodMatch[0];

  assert.match(joinMethod, /client\.joinChannel\(\s*config\.token,\s*config\.channelId\.trim\(\),\s*config\.uid,\s*\{/);
  assert.match(joinMethod, /clientRoleType:\s*this\.selectedClientRole/);
  assert.match(joinMethod, /channelProfile:\s*this\.selectedChannelProfile/);
  assert.match(joinMethod, /publishCameraTrack:\s*true/);
  assert.match(joinMethod, /publishMicrophoneTrack:\s*true/);
  assert.match(joinMethod, /autoSubscribeAudio:\s*true/);
  assert.match(joinMethod, /autoSubscribeVideo:\s*true/);
});
```

- [ ] **Step 2: Run the failing demo source test**

Run:

```bash
node --test tests/example-scene.test.ts
```

Expected: FAIL because `RtcSessionService` still calls `client.joinChannel(config.token, config.channelId.trim(), config.uid)`.

- [ ] **Step 3: Pass join options from `RtcSessionService`**

In `example/basic-call/assets/scripts/demo/RtcSessionService.ts`, replace:

```ts
    await client.joinChannel(config.token, config.channelId.trim(), config.uid);
```

with:

```ts
    await client.joinChannel(config.token, config.channelId.trim(), config.uid, {
      clientRoleType: this.selectedClientRole,
      channelProfile: this.selectedChannelProfile,
      publishCameraTrack: true,
      publishMicrophoneTrack: true,
      autoSubscribeAudio: true,
      autoSubscribeVideo: true,
    });
```

In `runMixingDemo`, remove the unsupported `replace: false` property so the call is:

```ts
    await this.callAndLogFailure('startAudioMixing', () => client.startAudioMixing({
      path: 'audio/demo-mix.mp3',
      loopback: false,
      cycle: 1,
    }));
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test tests/example-scene.test.ts tests/agora-client.test.ts
npm run typecheck
```

Expected: all pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add example/basic-call/assets/scripts/demo/RtcSessionService.ts tests/example-scene.test.ts
git commit -m "feat: pass demo media options from typescript"
```

## Task 4: Map Android Channel Media Options And Speaker Route

**Files:**
- Modify: `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- Modify: `native/engine/android/app/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- Modify: `example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- Test: `tests/native-templates.test.ts`

- [ ] **Step 1: Replace the temporary hardcode test with a payload mapping test**

In `tests/native-templates.test.ts`, replace `android bridge template publishes and subscribes media when joining a channel` with:

```ts
test('android bridge template maps joinChannel media options from request payload', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private void handleJoinChannel[\s\S]*?private void handleGetErrorDescription/,
  );
  assert.ok(handleJoinChannelMatch);
  const handleJoinChannel = handleJoinChannelMatch[0];

  assert.match(handleJoinChannel, /JSONObject mediaOptions = params != null \? params\.optJSONObject\("options"\) : null/);
  assert.match(handleJoinChannel, /applyChannelMediaOptions\(options, mediaOptions\)/);
  assert.doesNotMatch(handleJoinChannel, /options\.clientRoleType\s*=\s*Constants\.CLIENT_ROLE_BROADCASTER/);
  assert.doesNotMatch(handleJoinChannel, /options\.publishCameraTrack\s*=\s*true/);
  assert.doesNotMatch(handleJoinChannel, /options\.publishMicrophoneTrack\s*=\s*true/);
  assert.doesNotMatch(handleJoinChannel, /options\.autoSubscribeAudio\s*=\s*true/);
  assert.doesNotMatch(handleJoinChannel, /options\.autoSubscribeVideo\s*=\s*true/);

  assert.match(bridgeContent, /private void applyChannelMediaOptions\(ChannelMediaOptions options, JSONObject mediaOptions\)/);
  assert.match(bridgeContent, /options\.clientRoleType = parseClientRoleType\(mediaOptions\.opt\("clientRoleType"\)\)/);
  assert.match(bridgeContent, /options\.channelProfile = parseChannelProfile\(mediaOptions\.opt\("channelProfile"\)\)/);
  assert.match(bridgeContent, /options\.publishCameraTrack = optNullableBoolean\(mediaOptions, "publishCameraTrack"\)/);
  assert.match(bridgeContent, /options\.publishMicrophoneTrack = optNullableBoolean\(mediaOptions, "publishMicrophoneTrack"\)/);
  assert.match(bridgeContent, /options\.autoSubscribeAudio = optNullableBoolean\(mediaOptions, "autoSubscribeAudio"\)/);
  assert.match(bridgeContent, /options\.autoSubscribeVideo = optNullableBoolean\(mediaOptions, "autoSubscribeVideo"\)/);
});
```

- [ ] **Step 2: Add a speaker route mapping test**

Add this test after the audio volume indication or API coverage tests in `tests/native-templates.test.ts`:

```ts
test('android bridge template supports default audio route to speakerphone', async () => {
  const bridgeContent = await readFile(
    path.join(
      repoRoot,
      'sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java',
    ),
    'utf8',
  );

  const routeMatch = bridgeContent.match(
    /private void handleSetDefaultAudioRouteToSpeakerphone[\s\S]*?private void handleSetEnableSpeakerphone/,
  );
  assert.ok(routeMatch);
  assert.match(routeMatch[0], /rtcEngine\.setDefaultAudioRoutetoSpeakerphone\(params == null \|\| params\.optBoolean\("enabled", true\)\)/);
  assert.doesNotMatch(routeMatch[0], /dispatchUnsupported/);
});
```

- [ ] **Step 3: Update the Android compile fixture**

In `tests/native-templates.test.ts`, change the generated `ChannelMediaOptions.java` fixture to:

```java
package io.agora.rtc2;

public class ChannelMediaOptions {
    public Integer clientRoleType;
    public Integer channelProfile;
    public Boolean publishCameraTrack;
    public Boolean publishMicrophoneTrack;
    public Boolean autoSubscribeAudio;
    public Boolean autoSubscribeVideo;
    public Boolean enableAudioRecordingOrPlayout;
    public Boolean startPreview;
    public String token;
    public String parameters;
}
```

In the generated `RtcEngine.java` fixture, rename:

```java
public int setDefaultAudioRouteToSpeakerphone(boolean enabled) { return 0; }
```

to:

```java
public int setDefaultAudioRoutetoSpeakerphone(boolean enabled) { return 0; }
```

- [ ] **Step 4: Run the failing Android template tests**

Run:

```bash
node --test tests/native-templates.test.ts
```

Expected: FAIL because the bridge still hardcodes join options and reports speaker route unsupported.

- [ ] **Step 5: Implement Android option mapping in the template**

In `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`, replace the hardcoded part of `handleJoinChannel` with:

```java
        ChannelMediaOptions options = new ChannelMediaOptions();
        JSONObject mediaOptions = params != null ? params.optJSONObject("options") : null;
        applyChannelMediaOptions(options, mediaOptions);
        int result = rtcEngine.joinChannel(token, channelId, uid, options);
```

Add these helper methods before `handleGetErrorDescription`:

```java
    private void applyChannelMediaOptions(ChannelMediaOptions options, JSONObject mediaOptions) {
        if (mediaOptions == null) {
            return;
        }
        if (mediaOptions.has("clientRoleType") && !mediaOptions.isNull("clientRoleType")) {
            options.clientRoleType = parseClientRoleType(mediaOptions.opt("clientRoleType"));
        }
        if (mediaOptions.has("channelProfile") && !mediaOptions.isNull("channelProfile")) {
            options.channelProfile = parseChannelProfile(mediaOptions.opt("channelProfile"));
        }
        if (mediaOptions.has("publishCameraTrack")) {
            options.publishCameraTrack = optNullableBoolean(mediaOptions, "publishCameraTrack");
        }
        if (mediaOptions.has("publishMicrophoneTrack")) {
            options.publishMicrophoneTrack = optNullableBoolean(mediaOptions, "publishMicrophoneTrack");
        }
        if (mediaOptions.has("autoSubscribeAudio")) {
            options.autoSubscribeAudio = optNullableBoolean(mediaOptions, "autoSubscribeAudio");
        }
        if (mediaOptions.has("autoSubscribeVideo")) {
            options.autoSubscribeVideo = optNullableBoolean(mediaOptions, "autoSubscribeVideo");
        }
        if (mediaOptions.has("enableAudioRecordingOrPlayout")) {
            options.enableAudioRecordingOrPlayout = optNullableBoolean(mediaOptions, "enableAudioRecordingOrPlayout");
        }
        if (mediaOptions.has("startPreview")) {
            options.startPreview = optNullableBoolean(mediaOptions, "startPreview");
        }
        if (mediaOptions.has("token") && !mediaOptions.isNull("token")) {
            options.token = mediaOptions.optString("token");
        }
        if (mediaOptions.has("parameters") && !mediaOptions.isNull("parameters")) {
            options.parameters = mediaOptions.optString("parameters");
        }
    }

    private Boolean optNullableBoolean(JSONObject object, String key) {
        if (object == null || !object.has(key) || object.isNull(key)) {
            return null;
        }
        return object.optBoolean(key);
    }

    private int parseClientRoleType(Object rawValue) {
        if (rawValue instanceof Number) {
            return ((Number) rawValue).intValue();
        }
        String value = String.valueOf(rawValue);
        if ("audience".equals(value)) {
            return Constants.CLIENT_ROLE_AUDIENCE;
        }
        return Constants.CLIENT_ROLE_BROADCASTER;
    }

    private int parseChannelProfile(Object rawValue) {
        if (rawValue instanceof Number) {
            return ((Number) rawValue).intValue();
        }
        String value = String.valueOf(rawValue);
        if ("communication".equals(value)) {
            return Constants.CHANNEL_PROFILE_COMMUNICATION;
        }
        return Constants.CHANNEL_PROFILE_LIVE_BROADCASTING;
    }
```

Replace `handleSetDefaultAudioRouteToSpeakerphone` with:

```java
    private void handleSetDefaultAudioRouteToSpeakerphone(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.setDefaultAudioRoutetoSpeakerphone(params == null || params.optBoolean("enabled", true));
        if (result < 0) {
            dispatchAgoraError(requestId, "setDefaultAudioRouteToSpeakerphone", result);
            return;
        }
        dispatchOk(requestId);
    }
```

- [ ] **Step 6: Mirror Android bridge template into runtime copies**

Run:

```bash
cp sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java native/engine/android/app/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java
cp sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java
```

- [ ] **Step 7: Run Android template tests**

Run:

```bash
node --test tests/native-templates.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java native/engine/android/app/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java tests/native-templates.test.ts
git commit -m "feat: map android channel media options"
```

## Task 5: Map iOS Channel Media Options

**Files:**
- Modify: `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
- Modify: `example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift`
- Test: `tests/native-templates.test.ts`

- [ ] **Step 1: Add failing iOS media-options template test**

Add this test near the existing iOS joinChannel template tests in `tests/native-templates.test.ts`:

```ts
test('ios bridge template maps joinChannel media options from request payload', async () => {
  const bridgeContent = await readFile(
    path.join(repoRoot, 'sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift'),
    'utf8',
  );

  const handleJoinChannelMatch = bridgeContent.match(
    /private func handleJoinChannel\(requestId: String, params: \[String: Any\]\)[\s\S]*?private func requireEngine/,
  );
  assert.ok(handleJoinChannelMatch);
  const handleJoinChannel = handleJoinChannelMatch[0];

  assert.match(handleJoinChannel, /let mediaOptions = buildChannelMediaOptions\(params\["options"\] as\? \[String: Any\]\)/);
  assert.match(handleJoinChannel, /uid: uid,\s*mediaOptions: mediaOptions,\s*joinSuccess: nil/);
  assert.doesNotMatch(handleJoinChannel, /info: nil/);

  assert.match(bridgeContent, /private func buildChannelMediaOptions\(_ params: \[String: Any\]\?\) -> AgoraRtcChannelMediaOptions/);
  assert.match(bridgeContent, /options\.clientRoleType = parseClientRoleType\(rawValue\)/);
  assert.match(bridgeContent, /options\.channelProfile = parseChannelProfile\(rawValue\)/);
  assert.match(bridgeContent, /options\.publishCameraTrack = value/);
  assert.match(bridgeContent, /options\.publishMicrophoneTrack = value/);
  assert.match(bridgeContent, /options\.autoSubscribeAudio = value/);
  assert.match(bridgeContent, /options\.autoSubscribeVideo = value/);
});
```

- [ ] **Step 2: Run the failing iOS template test**

Run:

```bash
node --test tests/native-templates.test.ts
```

Expected: FAIL because iOS still calls `joinChannel(byToken:channelId:info:uid:joinSuccess:)`.

- [ ] **Step 3: Implement iOS media option mapping in the template**

In `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`, replace the result call in `handleJoinChannel` with:

```swift
        let mediaOptions = buildChannelMediaOptions(params["options"] as? [String: Any])
        let result = engine.joinChannel(
            byToken: token,
            channelId: channelId,
            uid: uid,
            mediaOptions: mediaOptions,
            joinSuccess: nil
        )
```

Add these helper methods before `requireEngine`:

```swift
    private func buildChannelMediaOptions(_ params: [String: Any]?) -> AgoraRtcChannelMediaOptions {
        let options = AgoraRtcChannelMediaOptions()
        guard let params else {
            return options
        }
        if let rawValue = params["clientRoleType"] {
            options.clientRoleType = parseClientRoleType(rawValue)
        }
        if let rawValue = params["channelProfile"] {
            options.channelProfile = parseChannelProfile(rawValue)
        }
        if let value = params["publishCameraTrack"] as? Bool {
            options.publishCameraTrack = value
        }
        if let value = params["publishMicrophoneTrack"] as? Bool {
            options.publishMicrophoneTrack = value
        }
        if let value = params["autoSubscribeAudio"] as? Bool {
            options.autoSubscribeAudio = value
        }
        if let value = params["autoSubscribeVideo"] as? Bool {
            options.autoSubscribeVideo = value
        }
        if let value = params["enableAudioRecordingOrPlayout"] as? Bool {
            options.enableAudioRecordingOrPlayout = value
        }
        if let value = params["startPreview"] as? Bool {
            options.startPreview = value
        }
        if let value = params["token"] as? String {
            options.token = value
        }
        if let value = params["parameters"] as? String {
            options.parameters = value
        }
        return options
    }

    private func parseClientRoleType(_ rawValue: Any) -> AgoraClientRole {
        if let value = rawValue as? UInt {
            return AgoraClientRole(rawValue: value) ?? .broadcaster
        }
        if let value = rawValue as? Int {
            return AgoraClientRole(rawValue: UInt(value)) ?? .broadcaster
        }
        if let value = rawValue as? String, value == "audience" {
            return .audience
        }
        return .broadcaster
    }

    private func parseChannelProfile(_ rawValue: Any) -> AgoraChannelProfile {
        if let value = rawValue as? UInt {
            return AgoraChannelProfile(rawValue: value) ?? .liveBroadcasting
        }
        if let value = rawValue as? Int {
            return AgoraChannelProfile(rawValue: UInt(value)) ?? .liveBroadcasting
        }
        if let value = rawValue as? String, value == "communication" {
            return .communication
        }
        return .liveBroadcasting
    }
```

- [ ] **Step 4: Mirror iOS bridge template into demo plugin copy**

Run:

```bash
cp sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift
```

- [ ] **Step 5: Run iOS template tests**

Run:

```bash
node --test tests/native-templates.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift tests/native-templates.test.ts
git commit -m "feat: map ios channel media options"
```

## Task 6: Verify API Boundary And Packaging

**Files:**
- Modify if needed: `sdk/agora-rtc/README.md`
- Test: `tests/package-sdk.test.ts`
- Test: `tests/package-customer-delivery.test.ts`
- Test: `tests/productization.test.ts`

- [ ] **Step 1: Update README API example if package tests require it**

If `tests/package-sdk.test.ts` still asserts `client.joinChannel(token, channelId, uid)`, preserve that simple example and add a second options example in `sdk/agora-rtc/README.md`:

```ts
await client.joinChannel(token, channelId, uid, {
  clientRoleType: 'broadcaster',
  channelProfile: 'liveBroadcasting',
  publishCameraTrack: true,
  publishMicrophoneTrack: true,
  autoSubscribeAudio: true,
  autoSubscribeVideo: true,
});
```

- [ ] **Step 2: Run full test suite and typecheck**

Run:

```bash
npm run typecheck
npm test
```

Expected: both commands pass.

- [ ] **Step 3: Run packaging verification**

Run:

```bash
./scripts/prepare-example.sh >/dev/null
./scripts/package-sdk.sh ./dist >/dev/null
```

Expected: both commands exit 0 and no real Agora credentials are added to git.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
git diff -- example/basic-call/assets/resources/agora-config.json example/basic-call/assets/resources/agora-config.build.json
```

Expected: no `agora-config.build.json` is tracked, no real app id or token diff is present, and only scoped source/test/docs files remain changed.

- [ ] **Step 5: Commit README or packaging changes if any**

Run only if README or packaging tests changed:

```bash
git add sdk/agora-rtc/README.md tests/package-sdk.test.ts tests/package-customer-delivery.test.ts tests/productization.test.ts
git commit -m "docs: document channel media options"
```

## Task 7: Android Smoke Verification

**Files:**
- Read: `scripts/dev-android.sh`
- Read: `example/basic-call/local/android-debug.env` or generated local build config if present
- Do not commit: `example/basic-call/assets/resources/agora-config.build.json`
- Do not commit: screenshots under `/tmp`

- [ ] **Step 1: Prepare proxy and app id**

Run:

```bash
export http_proxy=http://127.0.0.1:7892
export https_proxy=http://127.0.0.1:7892
export all_proxy=http://127.0.0.1:7892
export AGORA_APP_ID=dd8dfbf0f9484a8c960546ffe4ba4dce
```

- [ ] **Step 2: Build and install Android demo**

Run the repo's Android dev script or the already validated Android build command for this branch:

```bash
./scripts/dev-android.sh
```

Expected: debug APK builds, installs, and launches on the emulator. If the script needs local env values, use the existing local env file pattern and keep generated local files untracked.

- [ ] **Step 3: Two-emulator join smoke**

Run the existing emulator flow used for the previous smoke:

```bash
adb -s emulator-5554 shell am start -n io.agora.cocos.example/org.cocos2dx.javascript.AppActivity
adb -s emulator-5556 shell am start -n io.agora.cocos.example/org.cocos2dx.javascript.AppActivity
```

Expected: both clients join the same configured channel, local preview renders, each side observes one remote user, and the UI no longer depends on Android native hardcoded media options.

- [ ] **Step 4: Capture evidence without committing screenshots**

Run:

```bash
adb -s emulator-5554 exec-out screencap -p > /tmp/agora-emu5554-api-boundary.png
adb -s emulator-5556 exec-out screencap -p > /tmp/agora-emu5556-api-boundary.png
```

Expected: screenshots show joined state and remote video/card presence. Do not add `/tmp` files or screenshots to git.

## Task 8: Final Review And Handoff

**Files:**
- Review all changed source, tests, and docs.

- [ ] **Step 1: Run final verification**

Run:

```bash
npm run typecheck
npm test
```

Expected: both pass.

- [ ] **Step 2: Confirm no credentials or generated artifacts are staged**

Run:

```bash
git status --short
git diff --cached --name-only
git diff --name-only | rg 'agora-config.build.json|screenshot|\\.png$|build-android|build-ios' || true
```

Expected: no credentials, screenshots, or generated build directories are staged.

- [ ] **Step 3: Summarize implementation commits**

Run:

```bash
git log --oneline --max-count=8
```

Expected: the top commits include the implementation commits from Tasks 2 through 6 and no accidental generated artifact commit.

- [ ] **Step 4: Prepare final response**

Report:

```text
Implemented API boundary audit changes:
- joinChannel media options now originate from TS/demo.
- Android and iOS map media options into native SDK option objects.
- Android speaker route mapping uses the local SDK method.
- startAudioMixing.replace is no longer silently ignored.
- Tests: npm run typecheck, npm test, and Android smoke result.
```
