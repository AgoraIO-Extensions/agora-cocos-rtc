# Flutter-Aligned Cocos RTC Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Flutter-style Cocos RTC example case list with six supported Flutter-aligned cases and add the minimum `AudioEffectMixing` SDK APIs required by that case.

**Architecture:** Keep `main.scene` and `AgoraRtcDemoRoot` as the entry point, but introduce a case-list/detail navigation state and a case registry. Reuse `RtcSessionService` for all Agora client lifecycle and bridge calls. Add the five missing `AudioEffectMixing` methods and `remoteAudioStateChanged` event through TypeScript, Android, and iOS bridges before wiring the user-facing case controls.

**Tech Stack:** TypeScript, Cocos Creator 3.8.x component scripts, Node.js `node:test`, Android Java bridge templates, iOS Swift bridge templates, Agora RTC native SDK 4.5.x.

---

## File Structure

Create:

- `example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`
  - Owns exact Flutter-aligned case names, sections, display modes, and action lists.
- `example/basic-call/assets/scripts/demo/cases/caseRegistry.ts.meta`
  - Stable Cocos script metadata for the new registry module.
- `example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts`
  - Encapsulates `AudioEffectMixing` local UI state and asset-path resolution helpers.
- `example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts.meta`
  - Stable Cocos metadata.
- `example/basic-call/assets/scripts/demo/cases.meta`
  - Cocos folder metadata.
- `example/basic-call/assets/resources/audio.meta`
  - Cocos folder metadata for audio resources.
- `example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3`
  - Bundled local audio-mixing asset equivalent to Flutter's asset.
- `example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3.meta`
  - Cocos asset metadata.

Modify:

- `sdk/agora-rtc/js/types.ts`
  - Add five `AgoraMethod` entries and `remoteAudioStateChanged`.
- `sdk/agora-rtc/js/agora.ts`
  - Add wrapper methods.
- `sdk/agora-rtc/README.md`
  - Document new methods and event.
- `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
  - Add Android switch cases, handlers, and remote audio event dispatch.
- `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
  - Add Swift request cases and remote audio delegate dispatch.
- `example/basic-call/assets/agora-rtc-sdk/types.ts`
  - Sync from SDK wrapper types.
- `example/basic-call/assets/agora-rtc-sdk/agora.ts`
  - Sync from SDK wrapper implementation.
- `example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
  - Sync from Android template.
- `example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift`
  - Sync from iOS template.
- `example/basic-call/assets/scripts/demo/types.ts`
  - Add case navigation/display/audio state types.
- `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
  - Add service methods for the new APIs, remote audio state tracking, case reset helpers, and audio mixing/effect state.
- `example/basic-call/assets/scripts/demo/actions.ts`
  - Keep legacy action constants for compatibility and append the new `AudioEffectMixing` action names.
- `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
  - Add case-list/detail navigation and route selected case actions to the session.
- `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`
  - Render list rows and case-specific controls.
- `example/basic-call/assets/scripts/demo/panels/VideoStagePanel.ts`
  - Keep video stage reusable for selected video cases.
- `example/basic-call/assets/scripts/demo/panels/LogPanel.ts`
  - No behavioral change expected; touch only if layout needs a Back/Log integration hook.
- `scripts/prepare-example.sh`
  - Include new case list/panel defaults and new Cocos metadata if the generated scene/template asserts file presence.
- `scripts/package-customer-delivery.sh`
  - Ensure generated package includes the new case files and audio asset.
- `tests/agora-client.test.ts`
  - Add client request/event tests.
- `tests/native-templates.test.ts`
  - Add Android/iOS bridge assertions and native stub methods.
- `tests/cocos-device-test-shard.test.ts`
  - Add method coverage expectations for the five new APIs.
- `tests/example-scene.test.ts`
  - Add case registry/navigation/control assertions.
- `tests/productization.test.ts`
  - Add new case files and audio asset to package expectations.
- `test_shard/integration_test_app/src/api_call_testcases.ts`
  - Add five new API cases.

Do not modify unrelated release, build, or native dependency versions in this plan.

## Verified Native Signatures

Android local SDK source:

```bash
tmpdir=$(mktemp -d /tmp/agora-aar.XXXXXX)
unzip -q example/basic-call/local-maven/io/agora/rtc/full-rtc-basic/4.5.3/full-rtc-basic-4.5.3.aar libs/agora-rtc-sdk.jar -d "$tmpdir"
javap -classpath "$tmpdir/libs/agora-rtc-sdk.jar" io.agora.rtc2.RtcEngine io.agora.rtc2.IAudioEffectManager io.agora.rtc2.IRtcEngineEventHandler | rg "adjustAudioMixing|pauseEffect|resumeEffect|setEffectsVolume|onRemoteAudioState"
```

Verified Android methods:

- `RtcEngine.adjustAudioMixingPlayoutVolume(int)`
- `RtcEngine.adjustAudioMixingPublishVolume(int)`
- `IAudioEffectManager.pauseEffect(int)`
- `IAudioEffectManager.resumeEffect(int)`
- `IAudioEffectManager.setEffectsVolume(double)`
- `IRtcEngineEventHandler.onRemoteAudioStateChanged(int, int, int, int)`

iOS local generated Pods are currently `AgoraRtcEngine_iOS 4.5.2`, while `sdk-config.json` targets `4.5.3`. The methods required by this plan exist in the local headers:

- `AgoraRtcEngineKit.setEffectsVolume(_:)`
- `AgoraRtcEngineKit.pauseEffect(_:)`
- `AgoraRtcEngineKit.resumeEffect(_:)`
- `AgoraRtcEngineKit.adjustAudioMixingPublishVolume(_:)`
- `AgoraRtcEngineKit.adjustAudioMixingPlayoutVolume(_:)`
- delegate `rtcEngine(_:remoteAudioStateChangedOfUid:state:reason:elapsed:)`

During implementation, do not change the configured SDK version just to refresh these generated Pods.

---

### Task 1: TypeScript SDK Contract Tests

**Files:**
- Modify: `tests/agora-client.test.ts`
- Modify: `test_shard/integration_test_app/src/api_call_testcases.ts`
- Modify: `tests/cocos-device-test-shard.test.ts`

- [x] **Step 1: Add failing client request tests**

Add one test near the existing audio mixing/effect wrapper tests in `tests/agora-client.test.ts`:

```ts
test('AudioEffectMixing extra APIs dispatch expected native requests', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });

  async function expectRequest(
    action: () => Promise<unknown>,
    method: string,
    expectedParams: Record<string, unknown>,
  ) {
    const pending = action();
    const request = JSON.parse(transport.sent.at(-1)!.payload);
    assert.equal(request.method, method);
    assert.deepEqual(request.params, expectedParams);

    transport.emit(
      'agora:response',
      JSON.stringify({
        requestId: request.requestId,
        ok: true,
      }),
    );

    await pending;
  }

  await expectRequest(() => client.pauseEffect(7), 'pauseEffect', { soundId: 7 });
  await expectRequest(() => client.resumeEffect(7), 'resumeEffect', { soundId: 7 });
  await expectRequest(() => client.setEffectsVolume(60), 'setEffectsVolume', { volume: 60 });
  await expectRequest(
    () => client.adjustAudioMixingPublishVolume(70),
    'adjustAudioMixingPublishVolume',
    { volume: 70 },
  );
  await expectRequest(
    () => client.adjustAudioMixingPlayoutVolume(80),
    'adjustAudioMixingPlayoutVolume',
    { volume: 80 },
  );
});
```

- [x] **Step 2: Add failing event forwarding test**

Add this test near the existing event forwarding tests:

```ts
test('client surfaces remote audio state change events', async () => {
  const transport = new MockTransport();
  const client = createAgoraRtcClient({
    transport,
    timeoutMs: 50,
  });
  const events: Array<string> = [];

  client.on('remoteAudioStateChanged', (payload) => {
    events.push(`${payload.uid}:${payload.state}:${payload.reason}:${payload.elapsed}`);
  });

  transport.emit(
    'agora:event',
    JSON.stringify({
      eventName: 'remoteAudioStateChanged',
      payload: {
        uid: 2002,
        state: 2,
        reason: 5,
        elapsed: 123,
      },
    }),
  );

  assert.deepEqual(events, ['2002:2:5:123']);
});
```

- [x] **Step 3: Add failing device API cases**

In `test_shard/integration_test_app/src/api_call_testcases.ts`, insert these cases after `effect.play` and before `effect.stop`:

```ts
  {
    id: 'effect.pause',
    method: 'pauseEffect',
    expectedParams: { soundId: 1 },
    requiredEvidence: ['response', 'error'],
    run: (client) => client.pauseEffect(1),
  },
  {
    id: 'effect.resume',
    method: 'resumeEffect',
    expectedParams: { soundId: 1 },
    requiredEvidence: ['response', 'error'],
    run: (client) => client.resumeEffect(1),
  },
  {
    id: 'effect.set-volume',
    method: 'setEffectsVolume',
    expectedParams: { volume: 65 },
    requiredEvidence: ['response'],
    run: (client) => client.setEffectsVolume(65),
  },
  {
    id: 'mixing.adjust-publish-volume',
    method: 'adjustAudioMixingPublishVolume',
    expectedParams: { volume: 70 },
    requiredEvidence: ['response', 'error'],
    run: (client) => client.adjustAudioMixingPublishVolume(70),
  },
  {
    id: 'mixing.adjust-playout-volume',
    method: 'adjustAudioMixingPlayoutVolume',
    expectedParams: { volume: 80 },
    requiredEvidence: ['response', 'error'],
    run: (client) => client.adjustAudioMixingPlayoutVolume(80),
  },
```

- [x] **Step 4: Add platform-sensitive evidence expectations**

In `tests/cocos-device-test-shard.test.ts`, extend `platformSensitiveCaseIds`:

```ts
    'effect.pause',
    'effect.resume',
    'mixing.adjust-publish-volume',
    'mixing.adjust-playout-volume',
```

Keep `effect.set-volume` as response-only because it can execute without active playback on Android/iOS when the effect manager accepts it.

- [x] **Step 5: Run failing SDK tests**

Run:

```bash
npm test -- tests/agora-client.test.ts tests/cocos-device-test-shard.test.ts
```

Expected: fail with TypeScript/runtime errors such as `client.pauseEffect is not a function` or missing `AgoraMethod` cases.

- [x] **Step 6: Commit failing tests**

```bash
git add tests/agora-client.test.ts test_shard/integration_test_app/src/api_call_testcases.ts tests/cocos-device-test-shard.test.ts
git commit -m "test: cover audio effect mixing api additions"
```

### Task 2: TypeScript SDK API Additions

**Files:**
- Modify: `sdk/agora-rtc/js/types.ts`
- Modify: `sdk/agora-rtc/js/agora.ts`
- Modify: `sdk/agora-rtc/README.md`
- Modify: `example/basic-call/assets/agora-rtc-sdk/types.ts`
- Modify: `example/basic-call/assets/agora-rtc-sdk/agora.ts`

- [x] **Step 1: Add methods and event to SDK types**

In `sdk/agora-rtc/js/types.ts`, add these entries to `AgoraMethod` after `playEffect`:

```ts
  | 'pauseEffect'
  | 'resumeEffect'
  | 'setEffectsVolume'
  | 'adjustAudioMixingPublishVolume'
  | 'adjustAudioMixingPlayoutVolume'
```

Add this event in `AgoraEventMap` near the existing audio events:

```ts
  remoteAudioStateChanged: {
    uid: number;
    state: number;
    reason: number;
    elapsed: number;
  };
```

- [x] **Step 2: Add wrapper methods**

In `sdk/agora-rtc/js/agora.ts`, add these methods after `playEffect` and before `stopEffect`:

```ts
  pauseEffect(soundId: number): Promise<void> {
    return this.#invoke('pauseEffect', { soundId }) as Promise<void>;
  }

  resumeEffect(soundId: number): Promise<void> {
    return this.#invoke('resumeEffect', { soundId }) as Promise<void>;
  }

  setEffectsVolume(volume: number): Promise<void> {
    return this.#invoke('setEffectsVolume', { volume }) as Promise<void>;
  }

  adjustAudioMixingPublishVolume(volume: number): Promise<void> {
    return this.#invoke('adjustAudioMixingPublishVolume', { volume }) as Promise<void>;
  }

  adjustAudioMixingPlayoutVolume(volume: number): Promise<void> {
    return this.#invoke('adjustAudioMixingPlayoutVolume', { volume }) as Promise<void>;
  }
```

- [x] **Step 3: Sync example SDK copies**

Copy the changed SDK wrapper files into the example project:

```bash
cp sdk/agora-rtc/js/types.ts example/basic-call/assets/agora-rtc-sdk/types.ts
cp sdk/agora-rtc/js/agora.ts example/basic-call/assets/agora-rtc-sdk/agora.ts
```

- [x] **Step 4: Update README API surface**

In `sdk/agora-rtc/README.md`, add the new methods under API Surface after `playEffect`:

```md
- `pauseEffect`
- `resumeEffect`
- `setEffectsVolume`
- `adjustAudioMixingPublishVolume`
- `adjustAudioMixingPlayoutVolume`
```

Add one platform note:

```md
- `AudioEffectMixing` effect pause/resume and effect volume map to native audio effect APIs; audio mixing publish/playout volume map to native audio mixing APIs.
```

- [x] **Step 5: Run focused client tests**

Run:

```bash
npm test -- tests/agora-client.test.ts
```

Expected: client wrapper tests pass; native template tests still fail until bridge tasks are complete.

- [x] **Step 6: Commit SDK TypeScript changes**

```bash
git add sdk/agora-rtc/js/types.ts sdk/agora-rtc/js/agora.ts sdk/agora-rtc/README.md example/basic-call/assets/agora-rtc-sdk/types.ts example/basic-call/assets/agora-rtc-sdk/agora.ts
git commit -m "feat: expose audio effect mixing bridge methods"
```

### Task 3: Android Bridge Additions

**Files:**
- Modify: `tests/native-templates.test.ts`
- Modify: `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`
- Modify: `example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`

- [x] **Step 1: Add failing Android bridge assertions**

In `tests/native-templates.test.ts`, extend `android bridge template dispatches expanded sdk methods`:

```ts
  assert.match(bridgeContent, /case "pauseEffect":/);
  assert.match(bridgeContent, /case "resumeEffect":/);
  assert.match(bridgeContent, /case "setEffectsVolume":/);
  assert.match(bridgeContent, /case "adjustAudioMixingPublishVolume":/);
  assert.match(bridgeContent, /case "adjustAudioMixingPlayoutVolume":/);
```

Extend `android bridge template wires supported advanced sdk methods to real Agora APIs`:

```ts
  assert.match(bridgeContent, /pauseEffect/);
  assert.match(bridgeContent, /resumeEffect/);
  assert.match(bridgeContent, /setEffectsVolume/);
  assert.match(bridgeContent, /rtcEngine\.adjustAudioMixingPublishVolume/);
  assert.match(bridgeContent, /rtcEngine\.adjustAudioMixingPlayoutVolume/);
  assert.match(bridgeContent, /onRemoteAudioStateChanged/);
  assert.match(bridgeContent, /dispatchEvent\("remoteAudioStateChanged"/);
```

Update the Java stub `IAudioEffectManager` interface in the same test file:

```java
    int pauseEffect(int soundId);
    int resumeEffect(int soundId);
    int setEffectsVolume(double volume);
```

Update the Java stub `RtcEngine` class:

```java
    public int adjustAudioMixingPublishVolume(int volume) { return 0; }
    public int adjustAudioMixingPlayoutVolume(int volume) { return 0; }
```

Update the Java stub `IRtcEngineEventHandler` class:

```java
    public void onRemoteAudioStateChanged(int uid, int state, int reason, int elapsed) {}
```

- [x] **Step 2: Run failing native template tests**

Run:

```bash
npm test -- tests/native-templates.test.ts
```

Expected: fail on missing Android bridge cases and handlers.

- [x] **Step 3: Add Android switch cases**

In `sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java`, add cases after `playEffect`:

```java
            case "pauseEffect":
                handlePauseEffect(requestId, params);
                break;
            case "resumeEffect":
                handleResumeEffect(requestId, params);
                break;
            case "setEffectsVolume":
                handleSetEffectsVolume(requestId, params);
                break;
            case "adjustAudioMixingPublishVolume":
                handleAdjustAudioMixingPublishVolume(requestId, params);
                break;
            case "adjustAudioMixingPlayoutVolume":
                handleAdjustAudioMixingPlayoutVolume(requestId, params);
                break;
```

- [x] **Step 4: Add Android event dispatch**

Inside the existing `IRtcEngineEventHandler`, add:

```java
                @Override
                public void onRemoteAudioStateChanged(int uid, int state, int reason, int elapsed) {
                    dispatchEvent("remoteAudioStateChanged", jsonObject(
                            "uid", uid,
                            "state", state,
                            "reason", reason,
                            "elapsed", elapsed
                    ));
                }
```

- [x] **Step 5: Add Android handlers**

Add handlers near the existing effect/mixing handlers:

```java
    private void handlePauseEffect(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        int soundId = params != null ? params.optInt("soundId", 0) : 0;
        int result = effectManager.pauseEffect(soundId);
        if (result != 0) {
            dispatchAgoraError(requestId, "pauseEffect", result);
            return;
        }
        dispatchSuccess(requestId, JSONObject.NULL);
    }

    private void handleResumeEffect(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        int soundId = params != null ? params.optInt("soundId", 0) : 0;
        int result = effectManager.resumeEffect(soundId);
        if (result != 0) {
            dispatchAgoraError(requestId, "resumeEffect", result);
            return;
        }
        dispatchSuccess(requestId, JSONObject.NULL);
    }

    private void handleSetEffectsVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        double volume = params != null ? params.optDouble("volume", 100.0) : 100.0;
        int result = effectManager.setEffectsVolume(volume);
        if (result != 0) {
            dispatchAgoraError(requestId, "setEffectsVolume", result);
            return;
        }
        dispatchSuccess(requestId, JSONObject.NULL);
    }

    private void handleAdjustAudioMixingPublishVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.adjustAudioMixingPublishVolume(params != null ? params.optInt("volume", 100) : 100);
        if (result != 0) {
            dispatchAgoraError(requestId, "adjustAudioMixingPublishVolume", result);
            return;
        }
        dispatchSuccess(requestId, JSONObject.NULL);
    }

    private void handleAdjustAudioMixingPlayoutVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.adjustAudioMixingPlayoutVolume(params != null ? params.optInt("volume", 100) : 100);
        if (result != 0) {
            dispatchAgoraError(requestId, "adjustAudioMixingPlayoutVolume", result);
            return;
        }
        dispatchSuccess(requestId, JSONObject.NULL);
    }
```

- [x] **Step 6: Sync Android example native copy**

```bash
cp sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java
```

- [x] **Step 7: Run Android bridge tests**

Run:

```bash
npm test -- tests/native-templates.test.ts
```

Expected: Android assertions pass. iOS assertions fail only if Task 4's failing assertions were already added.

- [x] **Step 8: Commit Android bridge**

```bash
git add tests/native-templates.test.ts sdk/agora-rtc/templates/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java example/basic-call/native/agora-rtc/android/src/main/java/io/agora/cocos/rtc/AgoraRtcPlugin.java
git commit -m "feat: bridge audio effect mixing APIs on android"
```

### Task 4: iOS Bridge Additions

**Files:**
- Modify: `tests/native-templates.test.ts`
- Modify: `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`
- Modify: `example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift`

- [x] **Step 1: Add failing iOS bridge assertions**

In `tests/native-templates.test.ts`, extend the iOS bridge tests near existing audio mixing assertions:

```ts
  assert.match(bridgeContent, /case "pauseEffect"/);
  assert.match(bridgeContent, /case "resumeEffect"/);
  assert.match(bridgeContent, /case "setEffectsVolume"/);
  assert.match(bridgeContent, /case "adjustAudioMixingPublishVolume"/);
  assert.match(bridgeContent, /case "adjustAudioMixingPlayoutVolume"/);
  assert.match(bridgeContent, /engine\.pauseEffect/);
  assert.match(bridgeContent, /engine\.resumeEffect/);
  assert.match(bridgeContent, /engine\.setEffectsVolume/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingPublishVolume/);
  assert.match(bridgeContent, /engine\.adjustAudioMixingPlayoutVolume/);
  assert.match(bridgeContent, /remoteAudioStateChangedOfUid/);
  assert.match(bridgeContent, /dispatchEvent\(name: "remoteAudioStateChanged"/);
```

- [x] **Step 2: Run failing iOS template tests**

Run:

```bash
npm test -- tests/native-templates.test.ts
```

Expected: fail on missing iOS cases and delegate dispatch.

- [x] **Step 3: Add Swift request cases**

In `sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift`, add cases after `playEffect` and before `stopEffect`, using the existing `requireEngine` and `dispatchResult` helpers:

```swift
        case "pauseEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let result = engine.pauseEffect(soundId)
                dispatchResult(requestId: requestId, method: method, result: result)
            }

        case "resumeEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let result = engine.resumeEffect(soundId)
                dispatchResult(requestId: requestId, method: method, result: result)
            }

        case "setEffectsVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.setEffectsVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }

        case "adjustAudioMixingPublishVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustAudioMixingPublishVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }

        case "adjustAudioMixingPlayoutVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustAudioMixingPlayoutVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
```

- [x] **Step 4: Add Swift remote audio event dispatch**

Add this delegate method near the existing video/audio event delegates:

```swift
    func rtcEngine(_ engine: AgoraRtcEngineKit, remoteAudioStateChangedOfUid uid: UInt, state: AgoraAudioRemoteState, reason: AgoraAudioRemoteReason, elapsed: Int) {
        dispatchEvent(name: "remoteAudioStateChanged", payload: [
            "uid": uid,
            "state": state.rawValue,
            "reason": reason.rawValue,
            "elapsed": elapsed,
        ])
    }
```

- [x] **Step 5: Sync iOS example native copy**

```bash
cp sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift
```

- [x] **Step 6: Run Swift parse and native template tests**

Run:

```bash
/usr/bin/swiftc -parse sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift
npm test -- tests/native-templates.test.ts
```

Expected: Swift parse passes; native template tests pass.

- [x] **Step 7: Commit iOS bridge**

```bash
git add tests/native-templates.test.ts sdk/agora-rtc/templates/ios/AgoraRtcBridge.swift example/basic-call/native/agora-rtc/ios/AgoraRtcBridge.swift
git commit -m "feat: bridge audio effect mixing APIs on ios"
```

### Task 5: Case Registry Tests And Types

**Files:**
- Modify: `tests/example-scene.test.ts`
- Modify: `tests/productization.test.ts`
- Create: `example/basic-call/assets/scripts/demo/cases.meta`
- Create: `example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`
- Create: `example/basic-call/assets/scripts/demo/cases/caseRegistry.ts.meta`
- Modify: `example/basic-call/assets/scripts/demo/types.ts`

- [x] **Step 1: Add failing exact case registry test**

In `tests/example-scene.test.ts`, add:

```ts
test('demo case registry exposes the approved flutter-aligned case list', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`,
    'utf8',
  );

  for (const name of [
    'Basic',
    'JoinChannelAudio',
    'JoinChannelVideo',
    'Advanced',
    'AudioEffectMixing',
    'SetVideoEncoderConfiguration',
    'SetBeautyEffect',
    'SetContentInspect',
  ]) {
    assert.match(content, new RegExp(`name:\\s*'${name}'`));
  }

  for (const unsupported of [
    'StringUid',
    'ChannelMediaRelay',
    'ScreenSharing',
    'MediaPlayer',
    'PictureInPicture',
  ]) {
    assert.doesNotMatch(content, new RegExp(`name:\\s*'${unsupported}'`));
  }

  assert.match(content, /displayMode:\s*'audio'/);
  assert.match(content, /displayMode:\s*'video'/);
});
```

- [x] **Step 2: Add failing productization file expectations**

In `tests/productization.test.ts`, add these paths to the existing example source package/file list assertion:

```ts
    'example/basic-call/assets/scripts/demo/cases/caseRegistry.ts',
    'example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts',
    'example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3',
```

When the existing assertion uses a tar listing, add exact path matches with the same `example-basic-call/...` prefix used for current demo files.

- [x] **Step 3: Run failing tests**

Run:

```bash
npm test -- tests/example-scene.test.ts tests/productization.test.ts
```

Expected: fail because the case registry and audio asset do not exist yet.

- [x] **Step 4: Create case registry**

Create `example/basic-call/assets/scripts/demo/cases/caseRegistry.ts`:

```ts
export type DemoCaseSection = 'Basic' | 'Advanced';
export type DemoCaseDisplayMode = 'audio' | 'video';

export type DemoCaseDefinition = {
  name: string;
  section: DemoCaseSection;
  displayMode: DemoCaseDisplayMode;
  actions: readonly string[];
};

export const DEMO_CASE_SECTIONS = [
  { name: 'Basic' },
  { name: 'Advanced' },
] as const;

export const DEMO_CASES = [
  {
    name: 'JoinChannelAudio',
    section: 'Basic',
    displayMode: 'audio',
    actions: [
      'Initialize',
      'JoinChannel',
      'EnableAudio',
      'EnableLocalAudio',
      'MuteLocalAudio',
      'MuteRemoteAudio',
      'MuteAllRemoteAudio',
      'AudioVolumeIndication',
      'Speaker',
      'Leave',
    ],
  },
  {
    name: 'JoinChannelVideo',
    section: 'Basic',
    displayMode: 'video',
    actions: [
      'StartPreview',
      'JoinChannel',
      'SwitchCamera',
      'Cam',
      'MuteLocalVideo',
      'MuteAllRemoteVideo',
      'RefreshViews',
      'Leave',
    ],
  },
  {
    name: 'AudioEffectMixing',
    section: 'Advanced',
    displayMode: 'audio',
    actions: [
      'JoinChannel',
      'PreloadEffect',
      'PlayEffect',
      'PauseEffect',
      'ResumeEffect',
      'SetEffectsVolume',
      'StartAudioMixing',
      'SetAudioMixingPosition',
      'AudioMixingPublishVolume',
      'AudioMixingPlayoutVolume',
      'AudioMixingVolume',
      'Leave',
    ],
  },
  {
    name: 'SetVideoEncoderConfiguration',
    section: 'Advanced',
    displayMode: 'video',
    actions: ['StartPreview', 'JoinChannel', 'ApplyEncoder', 'Leave'],
  },
  {
    name: 'SetBeautyEffect',
    section: 'Advanced',
    displayMode: 'video',
    actions: ['StartPreview', 'JoinChannel', 'BeautyEffect', 'Leave'],
  },
  {
    name: 'SetContentInspect',
    section: 'Advanced',
    displayMode: 'video',
    actions: ['StartPreview', 'JoinChannel', 'ContentInspect', 'Leave'],
  },
] as const satisfies readonly DemoCaseDefinition[];

export type DemoCaseName = typeof DEMO_CASES[number]['name'];

export function findDemoCase(name: string): DemoCaseDefinition | null {
  return DEMO_CASES.find((item) => item.name === name) ?? null;
}
```

- [x] **Step 5: Add Cocos metadata**

Create `example/basic-call/assets/scripts/demo/cases.meta` with a new stable UUID:

```json
{
  "ver": "1.1.3",
  "importer": "directory",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000108",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

Create `example/basic-call/assets/scripts/demo/cases/caseRegistry.ts.meta`:

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000109",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

- [x] **Step 6: Add case state types**

In `example/basic-call/assets/scripts/demo/types.ts`, add:

```ts
export type DemoCaseDisplayMode = 'audio' | 'video';
export type DemoNavigationMode = 'caseList' | 'caseDetail';

export interface DemoCaseSelectionState {
  mode: DemoNavigationMode;
  selectedCaseName: string | null;
  displayMode: DemoCaseDisplayMode | null;
}

export interface AudioEffectMixingState {
  effectPreloaded: boolean;
  effectPlaying: boolean;
  audioMixingStarted: boolean;
  effectsVolume: number;
  audioMixingPublishVolume: number;
  audioMixingPlayoutVolume: number;
  audioMixingVolume: number;
  audioMixingPositionMs: number;
  remoteAudioStateSummary: string;
}
```

- [x] **Step 7: Run focused tests**

Run:

```bash
npm test -- tests/example-scene.test.ts tests/productization.test.ts
```

Expected: registry test passes. Productization fails on the missing `AudioEffectMixingCase.ts` and audio asset until Task 8 creates them.

- [x] **Step 8: Commit registry and types**

```bash
git add tests/example-scene.test.ts tests/productization.test.ts example/basic-call/assets/scripts/demo/types.ts example/basic-call/assets/scripts/demo/cases.meta example/basic-call/assets/scripts/demo/cases/caseRegistry.ts example/basic-call/assets/scripts/demo/cases/caseRegistry.ts.meta
git commit -m "feat: add flutter-aligned case registry"
```

### Task 6: Case List Navigation UI

**Files:**
- Modify: `tests/example-scene.test.ts`
- Modify: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
- Modify: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`

- [x] **Step 1: Add failing root and panel tests**

In `tests/example-scene.test.ts`, add:

```ts
test('demo root supports case list navigation before case detail actions', async () => {
  const rootContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );
  const panelContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(rootContent, /selectedCaseName/);
  assert.match(rootContent, /showCaseList/);
  assert.match(rootContent, /selectDemoCase/);
  assert.match(rootContent, /DEMO_CASES/);
  assert.match(panelContent, /renderCaseList/);
  assert.match(panelContent, /renderCaseControls/);
  assert.match(panelContent, /Back/);
  assert.match(panelContent, /AudioEffectMixing/);
});
```

- [x] **Step 2: Run failing test**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: fail on missing navigation and render methods.

- [x] **Step 3: Add root navigation fields and callbacks**

In `AgoraRtcDemoRoot.ts`, import registry helpers:

```ts
import { DEMO_CASES, findDemoCase, type DemoCaseDefinition } from './cases/caseRegistry.ts';
```

Add fields:

```ts
  private selectedCase: DemoCaseDefinition | null = null;
```

Update `actionPanel.initialize` callbacks to include case selection:

```ts
    this.actionPanel?.initialize({
      onAction: (actionName) => { void this.invokeAction(actionName); },
      onApplyConfig: (config) => this.applyBasicVideoConfig(config),
      onSelectCase: (caseName) => this.selectDemoCase(caseName),
      onBackToCases: () => this.showCaseList(),
    });
```

Add methods:

```ts
  showCaseList(): void {
    this.selectedCase = null;
    this.videoStagePanel?.node.active = false;
    this.refreshPanels();
  }

  selectDemoCase(caseName: string): void {
    const definition = findDemoCase(caseName);
    if (!definition) {
      this.pushStatus(`Unknown case: ${caseName}`);
      return;
    }
    this.selectedCase = definition;
    this.videoStagePanel?.node.active = definition.displayMode === 'video';
    this.pushStatus(`Case selected: ${caseName}`);
    this.refreshPanels();
  }
```

In `refreshPanels`, pass the case list and selected case:

```ts
    this.actionPanel?.setCaseState(DEMO_CASES, this.selectedCase);
```

- [x] **Step 4: Extend panel callback types**

In `DemoActionPanel.ts`, import case type:

```ts
import type { DemoCaseDefinition } from '../cases/caseRegistry.ts';
```

Extend `ActionCallbacks`:

```ts
  onSelectCase?: (caseName: string) => void;
  onBackToCases?: () => void;
```

Add fields:

```ts
  private cases: readonly DemoCaseDefinition[] = [];
  private selectedCase: DemoCaseDefinition | null = null;
  private onSelectCase: ((caseName: string) => void) | null = null;
  private onBackToCases: (() => void) | null = null;
```

In `initialize`, set optional callbacks.

Add:

```ts
  setCaseState(cases: readonly DemoCaseDefinition[], selectedCase: DemoCaseDefinition | null): void {
    this.cases = cases;
    this.selectedCase = selectedCase;
    this.ensureControls();
    this.refresh();
  }
```

- [x] **Step 5: Render case list and detail controls**

At the start of `ensureControls`, branch:

```ts
    if (!this.selectedCase) {
      this.renderCaseList();
      return;
    }
    this.renderCaseControls();
```

Add `renderCaseList()` using existing `ensureContainer`, `ensureLabelNode`, and `ensureButtonNode` helpers:

```ts
  private renderCaseList(): void {
    this.clearDynamicChildren();
    ensureTransform(this.node, 420, 620);
    ensureLabelNode(this.node, 'CaseListTitle', 360, 28, 'APIExample', 18, COLORS.textPrimary)
      .node.setPosition(0, 270, 0);

    let y = 220;
    let currentSection = '';
    for (const item of this.cases) {
      if (item.section !== currentSection) {
        currentSection = item.section;
        ensureLabelNode(this.node, `CaseSection_${currentSection}`, 360, 24, currentSection, 15, COLORS.textMuted)
          .node.setPosition(0, y, 0);
        y -= 42;
      }
      const button = ensureButtonNode(this.node, `Case_${item.name}`, 330, 36, item.name, 'secondary');
      button.node.setPosition(0, y, 0);
      button.node.off(Node.EventType.TOUCH_END);
      button.node.on(Node.EventType.TOUCH_END, () => this.onSelectCase?.(item.name), this);
      y -= 44;
    }
  }
```

Add `renderCaseControls()` by moving the current section-building logic into it and prepending Back/title:

```ts
  private renderCaseControls(): void {
    this.clearDynamicChildren();
    ensureLabelNode(this.node, 'CaseTitle', 260, 28, this.selectedCase?.name ?? '', 16, COLORS.textPrimary)
      .node.setPosition(40, 280, 0);
    const back = ensureButtonNode(this.node, 'BackButton', 92, 32, 'Back', 'ghost');
    back.node.setPosition(-140, 280, 0);
    back.node.off(Node.EventType.TOUCH_END);
    back.node.on(Node.EventType.TOUCH_END, () => this.onBackToCases?.(), this);

    this.buildConnectionSection(this.ensureContainer('ConnectionSection', 0, 180, 390, 150));
    this.buildPreviewSection(this.ensureContainer('PreviewCameraSection', 0, 30, 390, 150));
    this.buildRenderSection(this.ensureContainer('RenderEncoderSection', 0, -80, 390, 130));
    this.buildDiagnosticsSection(this.ensureContainer('DiagnosticsSection', 0, -185, 390, 92));
  }
```

Add `clearDynamicChildren()`:

```ts
  private clearDynamicChildren(): void {
    for (const child of [...this.node.children]) {
      child.destroy();
    }
    this.labels.clear();
    this.buttonNodes.clear();
    this.buttonSizes.clear();
    this.channelInput = null;
    this.uidInput = null;
    this.profileLabel = null;
    this.renderLabel = null;
    this.encoderLabel = null;
    this.statusLabel = null;
    this.advancedToggleLabel = null;
    this.advancedSection = null;
  }
```

Before using `clearDynamicChildren`, guard `ensureControls()` with a `lastRenderedCaseName` field so the panel rebuilds children only when switching between the list and a different case. `refresh()` should only update labels/buttons for the active tree.

- [x] **Step 6: Run focused navigation test**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: case navigation test passes.

- [x] **Step 7: Commit navigation UI**

```bash
git add tests/example-scene.test.ts example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts
git commit -m "feat: add flutter-style case navigation"
```

### Task 7: Case-Specific Service Actions

**Files:**
- Modify: `tests/example-scene.test.ts`
- Modify: `example/basic-call/assets/scripts/demo/actions.ts`
- Modify: `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
- Modify: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
- Modify: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`

- [x] **Step 1: Add failing AudioEffectMixing control assertions**

In `tests/example-scene.test.ts`, add:

```ts
test('audio effect mixing case wires flutter-required controls', async () => {
  const actionsContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/actions.ts`,
    'utf8',
  );
  const serviceContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/RtcSessionService.ts`,
    'utf8',
  );
  const rootContent = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`,
    'utf8',
  );

  for (const name of [
    'PreloadEffect',
    'PlayEffect',
    'PauseEffect',
    'ResumeEffect',
    'SetEffectsVolume',
    'StartAudioMixing',
    'SetAudioMixingPosition',
    'AudioMixingPublishVolume',
    'AudioMixingPlayoutVolume',
    'AudioMixingVolume',
  ]) {
    assert.match(actionsContent, new RegExp(name));
  }

  assert.match(serviceContent, /pauseEffect/);
  assert.match(serviceContent, /resumeEffect/);
  assert.match(serviceContent, /setEffectsVolume/);
  assert.match(serviceContent, /adjustAudioMixingPublishVolume/);
  assert.match(serviceContent, /adjustAudioMixingPlayoutVolume/);
  assert.match(serviceContent, /remoteAudioStateChanged/);
  assert.match(rootContent, /runAudioEffectMixingAction/);
});
```

- [x] **Step 2: Run failing case action test**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: fail on missing actions/service methods.

- [x] **Step 3: Add action names and labels**

In `example/basic-call/assets/scripts/demo/actions.ts`, add advanced action entries:

```ts
  { name: 'PreloadEffect', handler: 'preloadAudioEffect' },
  { name: 'PlayEffect', handler: 'togglePlayAudioEffect' },
  { name: 'PauseEffect', handler: 'pauseAudioEffect' },
  { name: 'ResumeEffect', handler: 'resumeAudioEffect' },
  { name: 'SetEffectsVolume', handler: 'applyEffectsVolume' },
  { name: 'StartAudioMixing', handler: 'toggleAudioMixing' },
  { name: 'SetAudioMixingPosition', handler: 'applyAudioMixingPosition' },
  { name: 'AudioMixingPublishVolume', handler: 'applyAudioMixingPublishVolume' },
  { name: 'AudioMixingPlayoutVolume', handler: 'applyAudioMixingPlayoutVolume' },
  { name: 'AudioMixingVolume', handler: 'applyAudioMixingVolume' },
```

Add labels:

```ts
  PreloadEffect: 'Preload Effect',
  PlayEffect: 'Play Effect',
  PauseEffect: 'Pause Effect',
  ResumeEffect: 'Resume Effect',
  SetEffectsVolume: 'Effect Volume',
  StartAudioMixing: 'Start Mixing',
  SetAudioMixingPosition: 'Mix Position',
  AudioMixingPublishVolume: 'Publish Vol',
  AudioMixingPlayoutVolume: 'Playout Vol',
  AudioMixingVolume: 'Mix Volume',
```

- [x] **Step 4: Add service state fields**

In `RtcSessionService.ts`, add fields:

```ts
  private audioEffectPreloaded = false;
  private audioEffectPlaying = false;
  private audioMixingStarted = false;
  private effectsVolume = 100;
  private audioMixingPublishVolume = 100;
  private audioMixingPlayoutVolume = 100;
  private audioMixingVolume = 100;
  private audioMixingPositionMs = 1000;
  private remoteAudioStateSummary = '-';
  private readonly audioEffectSoundId = 0;
  private readonly audioEffectUrl = 'https://webdemo.agora.io/ding.mp3';
```

Extend `DemoSessionState` in `types.ts` with the matching summary fields or add a nested `audioEffectMixing` object if keeping state compact.

- [x] **Step 5: Add service methods**

Add methods to `RtcSessionService`:

```ts
  async preloadAudioEffect(): Promise<void> {
    await this.getClient().preloadEffect(this.audioEffectSoundId, this.audioEffectUrl);
    this.audioEffectPreloaded = true;
    this.log(`Audio effect preloaded: ${this.audioEffectUrl}`);
    this.emitState();
  }

  async togglePlayAudioEffect(): Promise<void> {
    if (this.audioEffectPlaying) {
      await this.getClient().stopEffect(this.audioEffectSoundId);
      this.audioEffectPlaying = false;
      this.log('Audio effect stopped');
      this.emitState();
      return;
    }
    await this.getClient().playEffect({
      soundId: this.audioEffectSoundId,
      path: this.audioEffectUrl,
      loopCount: -1,
      pitch: 1,
      pan: 1,
      gain: 100,
      publish: true,
      startPos: 0,
    });
    this.audioEffectPlaying = true;
    this.log('Audio effect playing');
    this.emitState();
  }

  async pauseAudioEffect(): Promise<void> {
    await this.getClient().pauseEffect(this.audioEffectSoundId);
    this.log('Audio effect paused');
  }

  async resumeAudioEffect(): Promise<void> {
    await this.getClient().resumeEffect(this.audioEffectSoundId);
    this.log('Audio effect resumed');
  }

  async applyEffectsVolume(volume = this.effectsVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().setEffectsVolume(next);
    this.effectsVolume = next;
    this.log(`Effects volume: ${next}`);
    this.emitState();
  }

  async toggleAudioMixing(path: string): Promise<void> {
    if (this.audioMixingStarted) {
      await this.getClient().stopAudioMixing();
      this.audioMixingStarted = false;
      this.log('Audio mixing stopped');
      this.emitState();
      return;
    }
    await this.getClient().startAudioMixing({
      path,
      loopback: false,
      cycle: 1,
      startPos: 1000,
    });
    this.audioMixingStarted = true;
    this.log(`Audio mixing started: ${path}`);
    this.emitState();
  }

  async applyAudioMixingPosition(positionMs = this.audioMixingPositionMs): Promise<void> {
    this.audioMixingPositionMs = Math.max(0, Math.floor(positionMs));
    await this.getClient().setAudioMixingPosition(this.audioMixingPositionMs);
    this.log(`Audio mixing position: ${this.audioMixingPositionMs}`);
    this.emitState();
  }

  async applyAudioMixingPublishVolume(volume = this.audioMixingPublishVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().adjustAudioMixingPublishVolume(next);
    this.audioMixingPublishVolume = next;
    this.log(`Audio mixing publish volume: ${next}`);
    this.emitState();
  }

  async applyAudioMixingPlayoutVolume(volume = this.audioMixingPlayoutVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().adjustAudioMixingPlayoutVolume(next);
    this.audioMixingPlayoutVolume = next;
    this.log(`Audio mixing playout volume: ${next}`);
    this.emitState();
  }

  async applyAudioMixingVolume(volume = this.audioMixingVolume): Promise<void> {
    const next = this.clampVolume(volume);
    await this.getClient().adjustAudioMixingVolume(next);
    this.audioMixingVolume = next;
    this.log(`Audio mixing volume: ${next}`);
    this.emitState();
  }

  private clampVolume(volume: number): number {
    return Math.max(0, Math.min(100, Math.floor(volume)));
  }
```

- [x] **Step 6: Add remote audio event listener**

In `bindRtcEventListeners`, add:

```ts
    this.client.on('remoteAudioStateChanged', ({ uid, state, reason, elapsed }) => {
      this.remoteAudioStateSummary = `${uid}: state ${state}/reason ${reason}/${elapsed}ms`;
      this.log(`Remote audio state: ${this.remoteAudioStateSummary}`);
      this.emitState();
    });
```

- [x] **Step 7: Wire root action handlers**

In `AgoraRtcDemoRoot.ts`, add methods:

```ts
  async preloadAudioEffect(): Promise<void> {
    await this.runSessionAction('PreloadEffect', (session) => session.preloadAudioEffect());
  }

  async togglePlayAudioEffect(): Promise<void> {
    await this.runSessionAction('PlayEffect', (session) => session.togglePlayAudioEffect());
  }

  async pauseAudioEffect(): Promise<void> {
    await this.runSessionAction('PauseEffect', (session) => session.pauseAudioEffect());
  }

  async resumeAudioEffect(): Promise<void> {
    await this.runSessionAction('ResumeEffect', (session) => session.resumeAudioEffect());
  }

  async applyEffectsVolume(): Promise<void> {
    await this.runSessionAction('SetEffectsVolume', (session) => session.applyEffectsVolume());
  }

  async toggleAudioMixing(): Promise<void> {
    await this.runAudioEffectMixingAction('StartAudioMixing', (session, assetPath) => session.toggleAudioMixing(assetPath));
  }

  async applyAudioMixingPosition(): Promise<void> {
    await this.runSessionAction('SetAudioMixingPosition', (session) => session.applyAudioMixingPosition());
  }

  async applyAudioMixingPublishVolume(): Promise<void> {
    await this.runSessionAction('AudioMixingPublishVolume', (session) => session.applyAudioMixingPublishVolume());
  }

  async applyAudioMixingPlayoutVolume(): Promise<void> {
    await this.runSessionAction('AudioMixingPlayoutVolume', (session) => session.applyAudioMixingPlayoutVolume());
  }

  async applyAudioMixingVolume(): Promise<void> {
    await this.runSessionAction('AudioMixingVolume', (session) => session.applyAudioMixingVolume());
  }
```

Implement `runAudioEffectMixingAction` in Task 8 after asset resolution exists. For this task, make it call `runSessionAction` with a temporary string path `audio/Agora.io-Interactions.mp3`; Task 8 replaces it.

- [x] **Step 8: Run action tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: tests pass for action registry and service method presence.

- [x] **Step 9: Commit service actions**

```bash
git add tests/example-scene.test.ts example/basic-call/assets/scripts/demo/actions.ts example/basic-call/assets/scripts/demo/RtcSessionService.ts example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts example/basic-call/assets/scripts/demo/types.ts
git commit -m "feat: wire audio effect mixing case actions"
```

### Task 8: Audio Asset Handling

**Files:**
- Create: `example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts`
- Create: `example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts.meta`
- Create: `example/basic-call/assets/resources/audio.meta`
- Create: `example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3`
- Create: `example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3.meta`
- Modify: `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
- Modify: `tests/example-scene.test.ts`
- Modify: `tests/productization.test.ts`

- [x] **Step 1: Add failing asset helper tests**

In `tests/example-scene.test.ts`, add:

```ts
test('audio effect mixing case resolves a bundled local mixing asset', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts`,
    'utf8',
  );

  assert.match(content, /Agora\.io-Interactions\.mp3/);
  assert.match(content, /resolveAudioMixingAssetPath/);
  assert.match(content, /native\.fileUtils/);
  assert.match(content, /getWritablePath/);
  assert.match(content, /copyFile/);
  assert.match(content, /https:\/\/webdemo\.agora\.io\/ding\.mp3/);
});
```

- [x] **Step 2: Add local audio resource**

Add `example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3` by copying the exact Flutter example asset:

```bash
git -C /tmp/agora-flutter-sdk-ref.40b8gD sparse-checkout add example/assets/audio_mixing/Agora.io-Interactions.mp3
mkdir -p example/basic-call/assets/resources/audio
cp /tmp/agora-flutter-sdk-ref.40b8gD/example/assets/audio_mixing/Agora.io-Interactions.mp3 example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3
```

Create `example/basic-call/assets/resources/audio.meta`:

```json
{
  "ver": "1.1.3",
  "importer": "directory",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000110",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

Create `example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3.meta`:

```json
{
  "ver": "1.0.0",
  "importer": "audio-clip",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000111",
  "files": [".json"],
  "subMetas": {},
  "userData": {}
}
```

- [x] **Step 3: Add asset resolver helper**

Create `example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts`:

```ts
import { native, sys } from 'cc';

export const AUDIO_EFFECT_URL = 'https://webdemo.agora.io/ding.mp3';
export const AUDIO_MIXING_RESOURCE = 'audio/Agora.io-Interactions.mp3';
export const AUDIO_MIXING_FILE_NAME = 'Agora.io-Interactions.mp3';

type FileUtilsLike = {
  fullPathForFilename?(path: string): string;
  getWritablePath?(): string;
  isFileExist?(path: string): boolean;
  copyFile?(source: string, destination: string): boolean;
};

export function resolveAudioMixingAssetPath(): string {
  if (!sys.isNative) {
    return AUDIO_MIXING_RESOURCE;
  }

  const fileUtils = native.fileUtils as FileUtilsLike | undefined;
  if (!fileUtils) {
    throw new Error('Cocos native fileUtils is unavailable.');
  }

  const source =
    fileUtils.fullPathForFilename?.(`assets/resources/${AUDIO_MIXING_RESOURCE}`) ||
    fileUtils.fullPathForFilename?.(AUDIO_MIXING_RESOURCE) ||
    '';

  if (!source) {
    throw new Error(`Audio mixing asset not found: ${AUDIO_MIXING_RESOURCE}`);
  }

  const writablePath = fileUtils.getWritablePath?.() ?? '';
  if (!writablePath) {
    return source;
  }

  const destination = `${writablePath}${AUDIO_MIXING_FILE_NAME}`;
  if (fileUtils.isFileExist?.(destination)) {
    return destination;
  }

  const copied = fileUtils.copyFile?.(source, destination) ?? false;
  if (!copied) {
    return source;
  }

  return destination;
}
```

Create `AudioEffectMixingCase.ts.meta`:

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "6f0fce55-1000-42b8-8b7b-1aaf80000112",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

- [x] **Step 4: Use resolver in root**

In `AgoraRtcDemoRoot.ts`, import:

```ts
import { resolveAudioMixingAssetPath } from './cases/AudioEffectMixingCase.ts';
```

Replace `runAudioEffectMixingAction` with:

```ts
  private async runAudioEffectMixingAction(
    actionName: string,
    action: (session: RtcSessionService, assetPath: string) => Promise<void>,
  ): Promise<void> {
    this.createSession();
    this.setActionResult(actionName, 'idle');
    try {
      const assetPath = resolveAudioMixingAssetPath();
      await action(this.session!, assetPath);
      this.setActionResult(actionName, 'ok');
    } catch (error) {
      this.setActionResult(actionName, 'fail');
      this.pushStatus(`${actionName} failed: ${String(error)}`);
      throw error;
    }
  }
```

- [x] **Step 5: Run asset tests**

Run:

```bash
npm test -- tests/example-scene.test.ts tests/productization.test.ts
```

Expected: tests pass for helper presence and package file expectations.

- [x] **Step 6: Commit asset handling**

```bash
git add tests/example-scene.test.ts tests/productization.test.ts example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts.meta example/basic-call/assets/resources/audio.meta example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3 example/basic-call/assets/resources/audio/Agora.io-Interactions.mp3.meta example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts
git commit -m "feat: add local audio mixing asset handling"
```

### Task 9: Case-Specific Control Rendering

**Files:**
- Modify: `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`
- Modify: `tests/example-scene.test.ts`

- [x] **Step 1: Add failing per-case control tests**

In `tests/example-scene.test.ts`, add:

```ts
test('demo action panel renders case-specific controls instead of the full qa matrix', async () => {
  const content = await readFile(
    `${repoRoot}/example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`,
    'utf8',
  );

  assert.match(content, /buildCaseActionButtons/);
  assert.match(content, /selectedCase\.actions/);
  assert.match(content, /buildAudioEffectMixingControls/);
  assert.match(content, /buildBeautyControls/);
  assert.match(content, /buildEncoderControls/);
  assert.match(content, /buildContentInspectControls/);
});
```

- [x] **Step 2: Run failing panel test**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: fail on missing case-specific control helpers.

- [x] **Step 3: Restrict action buttons to selected case**

In `DemoActionPanel.ts`, replace `buildAdvancedSection`'s default use of all advanced actions in case detail mode with:

```ts
  private buildCaseActionButtons(parent: Node): void {
    const names = this.selectedCase?.actions ?? [];
    this.buildButtonList(parent, [...names], 2, 48, 176, 32, 184, 40);
  }
```

Call `buildCaseActionButtons` from `renderCaseControls()` after the common connection controls.

- [x] **Step 4: Add case-specific option sections**

Add dispatch:

```ts
  private buildSelectedCaseOptions(parent: Node): void {
    switch (this.selectedCase?.name) {
      case 'AudioEffectMixing':
        this.buildAudioEffectMixingControls(parent);
        return;
      case 'SetBeautyEffect':
        this.buildBeautyControls(parent);
        return;
      case 'SetVideoEncoderConfiguration':
        this.buildEncoderControls(parent);
        return;
      case 'SetContentInspect':
        this.buildContentInspectControls(parent);
        return;
      default:
        return;
    }
  }
```

Add minimal helper methods that render stable labels and buttons using existing style helpers:

```ts
  private buildAudioEffectMixingControls(parent: Node): void {
    ensureLabelNode(parent, 'AudioEffectUrlLabel', 340, 20, 'Effect: webdemo.agora.io/ding.mp3', 11, COLORS.textMuted)
      .node.setPosition(0, -130, 0);
    ensureLabelNode(parent, 'AudioMixingAssetLabel', 340, 20, 'Mixing: Agora.io-Interactions.mp3', 11, COLORS.textMuted)
      .node.setPosition(0, -154, 0);
  }

  private buildBeautyControls(parent: Node): void {
    ensureLabelNode(parent, 'BeautyOptionsLabel', 340, 20, 'Beauty: contrast / lightening / smooth / red / sharp', 11, COLORS.textMuted)
      .node.setPosition(0, -130, 0);
  }

  private buildEncoderControls(parent: Node): void {
    ensureLabelNode(parent, 'EncoderOptionsLabel', 340, 20, 'Encoder: 640x480 / 480x480 / 480x240', 11, COLORS.textMuted)
      .node.setPosition(0, -130, 0);
  }

  private buildContentInspectControls(parent: Node): void {
    ensureLabelNode(parent, 'ContentInspectOptionsLabel', 340, 20, 'ContentInspect: module 0 interval 2s', 11, COLORS.textMuted)
      .node.setPosition(0, -130, 0);
  }
```

The first implementation uses case action buttons and text labels for state changes. Do not add custom slider infrastructure in this task.

- [x] **Step 5: Run panel tests**

Run:

```bash
npm test -- tests/example-scene.test.ts
```

Expected: pass.

- [x] **Step 6: Commit case controls**

```bash
git add tests/example-scene.test.ts example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts
git commit -m "feat: render case-specific rtc controls"
```

### Task 10: Packaging, Build Scripts, And Full Verification

**Files:**
- Modify only if tests reveal missing packaging: `scripts/package-customer-delivery.sh`, `scripts/prepare-example.sh`, `tests/package-customer-delivery.test.ts`, `tests/productization.test.ts`

- [x] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass. If it fails on Cocos types for `native.fileUtils.copyFile`, adjust `AudioEffectMixingCase.ts` `FileUtilsLike` typing only; do not loosen global type checking.

- [x] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: pass. If productization/package tests fail because the new files are ignored by an allowlist, update only the allowlist entries for the new case files and audio asset.

- [x] **Step 3: Run package smoke**

Run:

```bash
./scripts/package-sdk.sh ./dist >/dev/null
```

Expected: exits 0 and produces package output under `dist`.

- [x] **Step 4: Run prepare-example smoke**

Run:

```bash
./scripts/prepare-example.sh >/dev/null
```

Expected: exits 0. Then run:

```bash
git status --short
```

Expected: only intended source/test/doc changes are present. If generated files changed unexpectedly, inspect before committing; do not revert user changes.

- [x] **Step 5: Update plan checklist if executing inline**

Mark completed checkboxes in this plan for tasks that were actually executed. Leave unexecuted optional device verification unchecked.

- [x] **Step 6: Commit final verification fixes**

If Task 10 changed files:

```bash
git add scripts/package-customer-delivery.sh scripts/prepare-example.sh tests/package-customer-delivery.test.ts tests/productization.test.ts docs/superpowers/plans/2026-06-09-flutter-aligned-cases.md
git commit -m "test: verify flutter-aligned cocos rtc cases"
```

If Task 10 did not change files, do not create an empty commit.

## Final Verification Before Completion

Run:

```bash
npm run typecheck
npm test
./scripts/prepare-example.sh >/dev/null
./scripts/package-sdk.sh ./dist >/dev/null
git status --short --branch
```

Expected:

- typecheck passes;
- all node tests pass;
- prepare-example exits 0;
- package-sdk exits 0;
- git status shows only intentional commits or a clean worktree after committing.

Device integration scripts are optional and require a configured Android/iOS environment plus test credentials:

```bash
TEST_APP_ID=... TEST_CHANNEL_ID=... ./scripts/run_cocos_integration_test_android.sh
TEST_APP_ID=... TEST_CHANNEL_ID=... ./scripts/run_cocos_integration_test_ios.sh
```

Do not claim device validation unless these scripts were actually run and passed.
