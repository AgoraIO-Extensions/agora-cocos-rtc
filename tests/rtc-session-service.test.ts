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

type PermissionRequest = {
  requestId: string;
  permission: 'camera' | 'microphone';
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
    this.children = [];
  }

  getComponent(component) {
    if (component === UITransform) {
      return this._transform;
    }
    if (component === Sprite) {
      return this._sprite ?? null;
    }
    return null;
  }

  getChildByName(_name) {
    return null;
  }

  getScale() {
    return this._scale;
  }

  setScale(x, y, z) {
    this._scale = { x, y, z };
  }
}

export class Sprite {
  constructor() {
    this.spriteFrame = new SpriteFrame();
    this.node = null;
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
    this._texture = null;
  }

  get texture() {
    return this._texture;
  }

  set texture(value) {
    if (value === null) {
      globalThis.__ccSpriteFrameNullAssignments = (globalThis.__ccSpriteFrameNullAssignments ?? 0) + 1;
      throw new Error('SpriteFrame.texture cannot be null');
    }
    this._texture = value;
  }
}

export class AudioClip {
  constructor() {
    this.nativeUrl = '/tmp/Agora.io-Interactions.mp3';
  }
}

export const resources = {
  load(_path, _type, callback) {
    callback(null, new AudioClip());
  },
};
`;

const TRANSPILE_TARGETS = [
  {
    sourcePath: 'example/basic-call/assets/scripts/demo/RtcSessionService.ts',
    outputPath: 'example/basic-call/assets/scripts/demo/RtcSessionService.ts',
  },
  {
    sourcePath: 'example/basic-call/assets/scripts/demo/DemoPermissions.ts',
    outputPath: 'example/basic-call/assets/scripts/demo/DemoPermissions.ts',
  },
  {
    sourcePath: 'example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts',
    outputPath: 'example/basic-call/assets/scripts/demo/cases/AudioEffectMixingCase.ts',
  },
  {
    sourcePath: 'example/basic-call/assets/scripts/demo/types.ts',
    outputPath: 'example/basic-call/assets/scripts/demo/types.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/agora.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/agora.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/types.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/types.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/source_types.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/source_types.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/internal/bridge.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/internal/bridge.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/internal/engine_texture_mirror.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_mirror.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/internal/engine_texture_encoder_mirror.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_encoder_mirror.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/internal/engine_texture_view.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_view.ts',
  },
  {
    sourcePath: 'sdk/agora-rtc/js/internal/engine_texture_view_manager.ts',
    outputPath: 'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_view_manager.ts',
  },
] as const;

class AutoResponseTransport {
  sent: SentRequest[] = [];
  permissionRequests: PermissionRequest[] = [];
  dispatches: Array<{ eventName: string; payload: Record<string, unknown> }> = [];
  listeners = new Map<string, Array<(payload: string) => void>>();

  dispatchEventToNative(eventName: string, payload: string) {
    const request = JSON.parse(payload) as Record<string, unknown>;
    this.dispatches.push({ eventName, payload: request });

    if (eventName === 'agora:request') {
      const agoraRequest = request as SentRequest;
      this.sent.push(agoraRequest);
      queueMicrotask(() => {
        this.emit('agora:response', JSON.stringify({
          requestId: agoraRequest.requestId,
          ok: true,
          result: null,
        }));
      });
      return;
    }

    if (eventName === 'demo:permissions:request') {
      const permissionRequest = request as PermissionRequest;
      this.permissionRequests.push(permissionRequest);
      queueMicrotask(() => {
        this.emit('demo:permissions:response', JSON.stringify({
          requestId: permissionRequest.requestId,
          ok: true,
        }));
      });
    }
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

  for (const { sourcePath, outputPath } of TRANSPILE_TARGETS) {
    const source = await readFile(path.join(repoRoot, sourcePath), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        rewriteRelativeImportExtensions: true,
        verbatimModuleSyntax: true,
      },
      fileName: outputPath,
    });
    const fixtureOutputPath = path.join(fixtureRoot, outputPath.replace(/\.ts$/, '.js'));
    await mkdir(path.dirname(fixtureOutputPath), { recursive: true });
    await writeFile(fixtureOutputPath, output.outputText, 'utf8');
  }

  const ccModule = await import(pathToFileURL(path.join(fixtureRoot, 'node_modules/cc/index.js')).href);
  const rtcModule = await import(
    pathToFileURL(path.join(fixtureRoot, 'example/basic-call/assets/scripts/demo/RtcSessionService.js')).href
  );
  const engineTextureViewManagerModule = await import(
    pathToFileURL(path.join(fixtureRoot, 'example/basic-call/extensions/agora-rtc/js/internal/engine_texture_view_manager.js')).href
  );

  return {
    Node: ccModule.Node as new () => {
      getComponent(component: unknown): { contentSize: { width: number; height: number } } | null;
      getScale(): { x: number; y: number; z: number };
      setScale(x: number, y: number, z: number): void;
    },
    Sprite: ccModule.Sprite as new () => {
      spriteFrame: { texture: unknown } | null;
      node: object | null;
    },
    SpriteFrame: ccModule.SpriteFrame as new () => {
      texture: unknown;
    },
    Texture2D: ccModule.Texture2D as new () => object,
    native: ccModule.native as {
      jsbBridgeWrapper: AutoResponseTransport | null;
    },
    AgoraEngineTextureViewManager: engineTextureViewManagerModule.AgoraEngineTextureViewManager as new (
      client: {
        on(eventName: string, listener: (payload: Record<string, unknown>) => void): void;
        takeCachedLocalTextureSlot(): null;
        takeCachedRemoteTextureSlot(uid: number): null;
      },
    ) => {
      registerLocalDisplay(options: {
        displayNode: object;
        mirrorMode?: number;
        sourceType?: number;
      }): void;
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

test('joinRtcChannel skips encoder config when deferVideoEncoderConfiguration is set', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig({ deferVideoEncoderConfiguration: true })),
  );

  await service.joinRtcChannel();

  const encoderRequests = pickRequests(transport, 'setVideoEncoderConfiguration');
  assert.equal(encoderRequests.length, 0);
  const joinRequests = pickRequests(transport, 'joinChannel');
  assert.equal(joinRequests.length, 1);
});

test('joinRtcChannel requests demo-owned camera and microphone permissions before publisher join', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig({
      publishCameraTrack: true,
      publishMicrophoneTrack: true,
    })),
  );

  await service.joinRtcChannel();

  assert.deepEqual(
    transport.permissionRequests.map((request) => request.permission),
    ['camera', 'microphone'],
  );
  assert.equal(pickRequests(transport, 'joinChannel').length, 1);
  assert.ok(
    transport.dispatches.findIndex((dispatch) => dispatch.eventName === 'demo:permissions:request')
      < transport.dispatches.findIndex((dispatch) => dispatch.eventName === 'agora:request' && dispatch.payload.method === 'joinChannel'),
  );
});

test('joinRtcChannel skips demo-owned permission requests for subscriber-only join', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig({
      clientRole: 'audience',
      publishCameraTrack: false,
      publishMicrophoneTrack: false,
    })),
  );

  await service.applyClientRole('audience');
  await service.joinRtcChannel();

  assert.equal(transport.permissionRequests.length, 0);
  assert.equal(pickRequests(transport, 'joinChannel').length, 1);
});

test('startLocalPreview skips encoder config when deferVideoEncoderConfiguration is set', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig({ deferVideoEncoderConfiguration: true })),
  );

  await service.startLocalPreview();

  const encoderRequests = pickRequests(transport, 'setVideoEncoderConfiguration');
  assert.equal(encoderRequests.length, 0);
});

test('startLocalPreview requests demo-owned camera permission before preview', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig()),
  );

  await service.startLocalPreview();

  assert.deepEqual(
    transport.permissionRequests.map((request) => request.permission),
    ['camera'],
  );
  assert.equal(pickRequests(transport, 'startPreview').length, 1);
  assert.ok(
    transport.dispatches.findIndex((dispatch) => dispatch.eventName === 'demo:permissions:request')
      < transport.dispatches.findIndex((dispatch) => dispatch.eventName === 'agora:request' && dispatch.payload.method === 'startPreview'),
  );
});

test('applyVideoEncoderConfiguration forwards width height frameRate and bitrate', async () => {
  const { RtcSessionService, Node, native } = await prepareRtcSessionFixture();
  const transport = new AutoResponseTransport();
  native.jsbBridgeWrapper = transport;

  const service = new RtcSessionService(
    createServiceOptions(Node, () => createConfig()),
  );

  await service.applyVideoEncoderConfiguration({
    width: 960,
    height: 540,
    frameRate: 15,
    bitrate: 1000,
  });

  const encoderRequests = pickRequests(transport, 'setVideoEncoderConfiguration');
  assert.equal(encoderRequests.length, 1);
  assert.equal(encoderRequests[0].params.width, 960);
  assert.equal(encoderRequests[0].params.height, 540);
  assert.equal(encoderRequests[0].params.frameRate, 15);
  assert.equal(encoderRequests[0].params.bitrate, 1000);
});

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

test('engine texture view manager detaches sprite frames instead of assigning null textures on release', async () => {
  const {
    AgoraEngineTextureViewManager,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
  } = await prepareRtcSessionFixture();
  const listeners = new Map<string, (payload: Record<string, unknown>) => void>();
  const client = {
    on(eventName: string, listener: (payload: Record<string, unknown>) => void) {
      listeners.set(eventName, listener);
    },
    takeCachedLocalTextureSlot() {
      return null;
    },
    takeCachedRemoteTextureSlot(_uid: number) {
      return null;
    },
  };
  const manager = new AgoraEngineTextureViewManager(client);
  const displayNode = new Node() as Node & { _sprite?: InstanceType<typeof Sprite> };
  const sprite = new Sprite();
  sprite.node = displayNode;
  sprite.spriteFrame = new SpriteFrame();
  sprite.spriteFrame.texture = new Texture2D();
  displayNode._sprite = sprite;
  globalThis.__ccSpriteFrameNullAssignments = 0;

  manager.registerLocalDisplay({
    displayNode,
    mirrorMode: 0,
  });

  const releaseListener = listeners.get('localVideoTextureReleased');
  assert.ok(releaseListener);
  assert.doesNotThrow(() => releaseListener({}));
  assert.equal(globalThis.__ccSpriteFrameNullAssignments, 0);
  assert.equal(sprite.spriteFrame, null);
});
