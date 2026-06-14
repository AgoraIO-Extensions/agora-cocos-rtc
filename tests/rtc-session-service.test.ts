import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

type SentRequest = {
  requestId: string;
  method: string;
  params: Record<string, unknown>;
};

const repoRoot = process.cwd();

const CC_STUB_SOURCE = `
export const native = {
  jsbBridgeWrapper: null,
  agoraEngineTexture: {
    getTexture() { return null; },
    isSlotReady() { return false; },
  },
  fileUtils: {
    fullPathForFilename(path) { return path; },
    getWritablePath() { return ''; },
    isFileExist() { return false; },
    copyFile() { return false; },
  },
};

export const sys = { isNative: true };

export class UITransform {
  constructor() {
    this.contentSize = { width: 320, height: 180 };
    this.width = 320;
    this.height = 180;
  }
}

export class Node {
  constructor() {
    this._scale = { x: 1, y: 1, z: 1 };
    this._transform = new UITransform();
  }

  getComponent(component) {
    return component === UITransform ? this._transform : null;
  }

  getScale() {
    return this._scale;
  }

  setScale(x, y, z) {
    this._scale = { x, y, z };
  }
}

export class Texture2D {
  static Filter = { LINEAR: 'LINEAR', NONE: 'NONE' };
  static WrapMode = { CLAMP_TO_EDGE: 'CLAMP_TO_EDGE' };

  setFilters() {}
  setMipFilter() {}
  setWrapMode() {}
}

export class SpriteFrame {
  constructor() {
    this.texture = null;
  }
}
`;

const TRANSPILE_TARGETS = [
  'example/basic-call/assets/scripts/demo/RtcSessionService.ts',
  'example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts',
  'example/basic-call/assets/scripts/demo/types.ts',
  'example/basic-call/extensions/agora-rtc/js/agora.ts',
  'example/basic-call/extensions/agora-rtc/js/types.ts',
  'example/basic-call/extensions/agora-rtc/js/internal/bridge.ts',
  'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_mirror.ts',
  'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_view.ts',
] as const;

class AutoResponseTransport {
  sent: SentRequest[] = [];
  listeners = new Map<string, Array<(payload: string) => void>>();

  dispatchEventToNative(_eventName: string, payload: string) {
    const request = JSON.parse(payload) as SentRequest;
    this.sent.push(request);
    queueMicrotask(() => {
      this.emit('agora:response', JSON.stringify({
        requestId: request.requestId,
        ok: true,
        result: null,
      }));
    });
  }

  addNativeEventListener(eventName: string, listener: (payload: string) => void) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }

  removeNativeEventListener(eventName: string, listener: (payload: string) => void) {
    const listeners = this.listeners.get(eventName) ?? [];
    this.listeners.set(
      eventName,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  emit(eventName: string, payload: string) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(payload);
    }
  }
}

async function prepareRtcSessionFixture() {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'rtc-session-service-'));
  await writeFile(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2),
    'utf8',
  );
  await mkdir(path.join(fixtureRoot, 'node_modules/cc'), { recursive: true });
  await writeFile(
    path.join(fixtureRoot, 'node_modules/cc/package.json'),
    JSON.stringify({ name: 'cc', type: 'module', exports: './index.js' }, null, 2),
    'utf8',
  );
  await writeFile(
    path.join(fixtureRoot, 'node_modules/cc/index.js'),
    CC_STUB_SOURCE,
    'utf8',
  );

  for (const relativePath of TRANSPILE_TARGETS) {
    const source = await readFile(path.join(repoRoot, relativePath), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        rewriteRelativeImportExtensions: true,
        verbatimModuleSyntax: true,
      },
      fileName: relativePath,
    });
    const outputPath = path.join(fixtureRoot, relativePath.replace(/\.ts$/, '.js'));
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output.outputText, 'utf8');
  }

  const ccModule = await import(pathToFileURL(path.join(fixtureRoot, 'node_modules/cc/index.js')).href);
  const rtcModule = await import(
    pathToFileURL(path.join(fixtureRoot, 'example/basic-call/assets/scripts/demo/RtcSessionService.js')).href
  );

  return {
    Node: ccModule.Node as new () => {
      getComponent(component: unknown): { contentSize: { width: number; height: number } } | null;
      getScale(): { x: number; y: number; z: number };
      setScale(x: number, y: number, z: number): void;
    },
    native: ccModule.native as {
      jsbBridgeWrapper: AutoResponseTransport | null;
    },
    RtcSessionService: rtcModule.RtcSessionService as new (
      options: ConstructorParameters<typeof rtcModule.RtcSessionService>[0]
    ) => InstanceType<typeof rtcModule.RtcSessionService>,
  };
}

function createConfig(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    appId: 'test-app-id',
    token: '',
    channelId: 'demo-channel',
    uid: 0,
    renderBackend: 'engine-texture',
    autoPreview: true,
    autoJoin: false,
    publishCameraTrack: true,
    publishMicrophoneTrack: true,
    autoSubscribeAudio: true,
    autoSubscribeVideo: true,
    ...overrides,
  };
}

function createServiceOptions(NodeCtor: new () => object, getConfig: () => ReturnType<typeof createConfig>) {
  const localNode = new NodeCtor();
  const remoteNode = new NodeCtor();
  return {
    getConfig,
    getLocalVideoNode: () => localNode,
    getRemoteVideoNode: (_uid: number) => remoteNode,
    onLog: (_line: string) => {},
    onStateChanged: () => {},
    onRemoteUsersChanged: (_uids: number[], _activeUid: number | null) => {},
    onLocalTextureReady: () => {},
    onRemoteTextureReady: () => {},
    onLocalVideoCleared: () => {},
    onRemoteVideoCleared: () => {},
  };
}

function pickRequests(transport: AutoResponseTransport, method: string): SentRequest[] {
  return transport.sent.filter((request) => request.method === method);
}

test('joinRtcChannel publishes derived encoder mirror config before join', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig()),
  );

  await service.joinRtcChannel();

  const encoderRequests = pickRequests(transport, 'setVideoEncoderConfiguration');
  assert.equal(encoderRequests.length, 1);
  assert.equal(encoderRequests[0].params.width, 640);
  assert.equal(encoderRequests[0].params.height, 360);
  assert.equal(encoderRequests[0].params.frameRate, 15);
  assert.equal(encoderRequests[0].params.bitrate, 0);
  assert.equal(encoderRequests[0].params.mirrorMode, 2);

  const joinRequests = pickRequests(transport, 'joinChannel');
  assert.equal(joinRequests.length, 1);
  assert.ok(
    transport.sent.findIndex((request) => request.method === 'setVideoEncoderConfiguration')
      < transport.sent.findIndex((request) => request.method === 'joinChannel'),
  );
});

test('startLocalPreview preserves explicit encoder mirror config', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(
      Node,
      () => createConfig({
        videoEncoderConfiguration: {
          width: 1280,
          height: 720,
          frameRate: 24,
          bitrate: 900,
          mirrorMode: 1,
        },
      }),
    ),
  );

  await service.startLocalPreview();

  const encoderRequests = pickRequests(transport, 'setVideoEncoderConfiguration');
  assert.equal(encoderRequests.length, 1);
  assert.equal(encoderRequests[0].params.width, 1280);
  assert.equal(encoderRequests[0].params.height, 720);
  assert.equal(encoderRequests[0].params.frameRate, 24);
  assert.equal(encoderRequests[0].params.bitrate, 900);
  assert.equal(encoderRequests[0].params.mirrorMode, 1);
});

test('triggerSwitchCamera reapplies encoder mirror config after facing flips', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig()),
  );

  await service.startLocalPreview();
  transport.sent = [];

  await service.triggerSwitchCamera();

  assert.deepEqual(
    transport.sent.map((request) => request.method),
    ['switchCamera', 'setVideoEncoderConfiguration'],
  );

  const encoderRequests = pickRequests(transport, 'setVideoEncoderConfiguration');
  assert.equal(encoderRequests.length, 1);
  assert.equal(encoderRequests[0].params.width, 640);
  assert.equal(encoderRequests[0].params.height, 360);
  assert.equal(encoderRequests[0].params.frameRate, 15);
  assert.equal(encoderRequests[0].params.bitrate, 0);
  assert.equal(encoderRequests[0].params.mirrorMode, 1);
});
