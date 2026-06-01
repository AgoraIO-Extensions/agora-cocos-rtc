import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const runtimeConfig = JSON.parse(
  await readFile(
    path.join(repoRoot, 'example/basic-call/assets/resources/agora-config.json'),
    'utf8',
  ),
);
const runtimeAppId = JSON.stringify(runtimeConfig.appId ?? '');
const runtimeToken = JSON.stringify(runtimeConfig.token ?? '');
const runtimeChannelId = JSON.stringify(runtimeConfig.channelId ?? 'demo');
const runtimeUid = Number.isFinite(runtimeConfig.uid) ? Number(runtimeConfig.uid) : 1001;

const targets = [
  path.join(repoRoot, 'example/basic-call/build-android/android/data/assets/main/index.js'),
  path.join(repoRoot, 'example/basic-call/build/android/data/assets/main/index.js'),
];
const applicationTargets = [
  path.join(repoRoot, 'example/basic-call/build-android/android/data/application.js'),
  path.join(repoRoot, 'example/basic-call/build/android/data/application.js'),
];

const controllerModule = `System.register("chunks:///_virtual/AgoraRtcExampleController.ts", ['cc', './agora.ts'], function (exports) {
  var cclegacy, _decorator, Component, native, sys, director, Director, Node, UITransform, Label, Color, createAgoraRtcClient;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Component = module.Component;
      native = module.native;
      sys = module.sys;
      director = module.director;
      Director = module.Director;
      Node = module.Node;
      UITransform = module.UITransform;
      Label = module.Label;
      Color = module.Color;
    }, function (module) {
      createAgoraRtcClient = module.createAgoraRtcClient;
    }],
    execute: function () {
      cclegacy._RF.push({}, "6f0fc5VEABCuIt7Gq+AAAAB", "AgoraRtcExampleController", undefined);
      const { ccclass } = _decorator;
      const DEFAULT_BUTTON_LAYOUT = [{
        name: 'Initialize',
        y: 100,
        handler: 'initializeRtc'
      }, {
        name: 'Join',
        y: 0,
        handler: 'joinRtcChannel'
      }, {
        name: 'Leave',
        y: -100,
        handler: 'leaveRtcChannel'
      }];
      let AgoraRtcExampleController = exports('AgoraRtcExampleController', ccclass('AgoraRtcExampleController')(class AgoraRtcExampleController extends Component {
        constructor() {
          super();
          this.appId = '';
          this.token = '';
          this.channelId = 'demo';
          this.uid = 1001;
          this.client = null;
          this.listenersBound = false;
        }
        getClient() {
          if (!this.client) {
            this.client = createAgoraRtcClient({
              bridgeRuntime: {
                native,
                sys
              }
            });
          }
          if (!this.listenersBound) {
            this.client.on('joinChannelSuccess', ({
              channelId,
              uid
            }) => {
              console.log('[agora-rtc] joined channel', channelId, uid);
            });
            this.client.on('userJoined', ({
              uid
            }) => {
              console.log('[agora-rtc] remote user joined', uid);
            });
            this.client.on('userOffline', ({
              uid,
              reason
            }) => {
              console.log('[agora-rtc] remote user offline', uid, reason);
            });
            this.client.on('error', ({
              message
            }) => {
              console.error('[agora-rtc] native error', message);
            });
            this.listenersBound = true;
          }
          return this.client;
        }
        async initializeRtc() {
          await this.getClient().initialize(this.appId);
        }
        async joinRtcChannel() {
          await this.getClient().joinChannel(this.token, this.channelId, this.uid);
        }
        async leaveRtcChannel() {
          await this.getClient().leaveChannel();
        }
        async setLocalAudioEnabled(enabled) {
          await this.getClient().enableLocalAudio(enabled);
        }
        async setLocalVideoEnabled(enabled) {
          await this.getClient().enableLocalVideo(enabled);
        }
        async onDestroy() {
          if (this.client) {
            await this.client.destroy();
            this.client = null;
          }
        }
      }));
      function ensureExampleControllerUi() {
        const scene = director.getScene();
        const canvas = scene && scene.getChildByName('Canvas');
        if (!canvas) {
          return;
        }
        const controller = canvas.getComponent(AgoraRtcExampleController) || canvas.addComponent(AgoraRtcExampleController);
        for (const buttonSpec of DEFAULT_BUTTON_LAYOUT) {
          if (canvas.getChildByName(buttonSpec.name)) {
            continue;
          }
          const buttonNode = new Node(buttonSpec.name);
          buttonNode.layer = canvas.layer;
          buttonNode.setParent(canvas);
          buttonNode.setPosition(0, buttonSpec.y, 0);
          const transform = buttonNode.addComponent(UITransform);
          transform.setContentSize(220, 60);
          const label = buttonNode.addComponent(Label);
          label.string = buttonSpec.name;
          label.fontSize = 28;
          label.lineHeight = 32;
          label.color = new Color(255, 255, 255, 255);
          buttonNode.on(Node.EventType.TOUCH_END, () => {
            const handler = controller[buttonSpec.handler];
            if (typeof handler === 'function') {
              Promise.resolve(handler.call(controller)).catch((error) => {
                console.error('[agora-rtc] action failed', error);
              });
            }
          });
        }
      }
      director.on(Director.EVENT_AFTER_SCENE_LAUNCH, ensureExampleControllerUi);
      ensureExampleControllerUi();
      cclegacy._RF.pop();
    }
  };
});`;

async function patchBundle(filePath) {
  let content;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return false;
  }

  const marker = 'System.register("chunks:///_virtual/bridge.ts"';
  const start = content.indexOf('System.register("chunks:///_virtual/AgoraRtcExampleController.ts"');
  const end = content.indexOf(marker, start);
  if (start === -1 || end === -1) {
    return false;
  }

  const next = `${content.slice(0, start)}${controllerModule}\n\n${content.slice(end)}`;
  if (next === content) {
    return false;
  }

  await writeFile(filePath, next, 'utf8');
  return true;
}

const applicationBootstrap = `System.register([], function (_export, _context) {
  "use strict";

  var Application, cc;
  _export("Application", void 0);
  return {
    setters: [],
    execute: function () {
      let requestCounter = 0;
      function createRequestId() {
        requestCounter += 1;
        return "manual-request-" + Date.now() + "-" + requestCounter;
      }
      _export("Application", Application = class Application {
        constructor() {
          this.settingsPath = 'src/settings.json';
          this.showFPS = true;
          this.transport = null;
          this.pending = new Map();
          this.bridgeListenersAttached = false;
          this.uiRetryTimer = null;
          this.bridgeProbeStarted = false;
          this.apiProbeStarted = false;
          this.runtimeConfig = {
            appId: ${runtimeAppId},
            token: ${runtimeToken},
            channelId: ${runtimeChannelId},
            uid: ${runtimeUid}
          };
          this.ensureUi = this.ensureUi.bind(this);
        }
        init(engine) {
          cc = engine;
          cc.game.onPostBaseInitDelegate.add(this.onPostInitBase.bind(this));
          cc.game.onPostSubsystemInitDelegate.add(this.onPostSystemInit.bind(this));
        }
        onPostInitBase() {}
        onPostSystemInit() {
          cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, this.ensureUi);
          this.scheduleUiRetry();
        }
        getTransport() {
          if (!this.transport) {
            this.transport = cc.native && cc.native.jsbBridgeWrapper || globalThis.jsb && globalThis.jsb.jsbBridgeWrapper || null;
            if (this.transport && !this.bridgeListenersAttached) {
              this.transport.addNativeEventListener('agora:response', this.handleResponse.bind(this));
              this.transport.addNativeEventListener('agora:event', this.handleEvent.bind(this));
              this.bridgeListenersAttached = true;
            }
          }
          return this.transport;
        }
        invoke(method, params) {
          const transport = this.getTransport();
          if (!transport) {
            console.error('[agora-rtc] bridge unavailable in application bootstrap');
            return Promise.reject(new Error('bridge unavailable'));
          }
          const requestId = createRequestId();
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              this.pending.delete(requestId);
              reject(new Error('Native request timed out: ' + method));
            }, 5000);
            this.pending.set(requestId, {
              resolve,
              reject,
              timer
            });
            transport.dispatchEventToNative('agora:request', JSON.stringify({
              requestId,
              method,
              params
            }));
          });
        }
        handleResponse(payload) {
          try {
            const response = JSON.parse(payload);
            const pending = this.pending.get(response.requestId);
            if (!pending) {
              return;
            }
            clearTimeout(pending.timer);
            this.pending.delete(response.requestId);
            if (response.ok) {
              pending.resolve(response.result ?? null);
            } else {
              pending.reject(new Error(response.error && response.error.message || 'Native Agora request failed.'));
            }
          } catch (error) {
            console.error('[agora-rtc] invalid response payload', error);
          }
        }
        handleEvent(payload) {
          try {
            const event = JSON.parse(payload);
            console.log('[agora-rtc] native event', event.eventName, event.payload ?? {});
          } catch (error) {
            console.error('[agora-rtc] invalid event payload', error);
          }
        }
        probeBridgeOnce() {
          if (this.bridgeProbeStarted) {
            return;
          }
          this.bridgeProbeStarted = true;
          console.log('[agora-rtc] probing native bridge with leaveChannel');
          this.invoke('leaveChannel', {}).then(() => {
            console.log('[agora-rtc] bridge probe leaveChannel ok');
          }).catch((error) => {
            console.error('[agora-rtc] bridge probe leaveChannel failed', error);
          });
        }
        async probeApisOnce() {
          if (this.apiProbeStarted) {
            return;
          }
          this.apiProbeStarted = true;
          const probes = [{
            name: 'leaveChannel',
            run: () => this.invoke('leaveChannel', {})
          }, {
            name: 'enableLocalAudio(false)',
            run: () => this.invoke('enableLocalAudio', {
              enabled: false
            })
          }, {
            name: 'enableLocalVideo(false)',
            run: () => this.invoke('enableLocalVideo', {
              enabled: false
            })
          }, {
            name: 'initialize(dummyAppId)',
            run: () => this.invoke('initialize', {
              appId: this.runtimeConfig.appId
            })
          }, {
            name: 'joinChannel(afterInitialize)',
            run: () => this.invoke('joinChannel', {
              token: this.runtimeConfig.token,
              channelId: this.runtimeConfig.channelId,
              uid: this.runtimeConfig.uid
            })
          }, {
            name: 'destroy',
            run: () => this.invoke('destroy', {})
          }];
          for (const probe of probes) {
            try {
              await probe.run();
              console.log('[agora-rtc] api probe ok', probe.name);
            } catch (error) {
              const message = error && error.message ? error.message : String(error);
              console.error('[agora-rtc] api probe failed', probe.name, message);
            }
          }
        }
        createButton(canvas, name, y, handler) {
          const nodeName = '__fallback_' + name;
          let node = canvas.getChildByName(nodeName);
          if (!node) {
            node = new cc.Node(nodeName);
            node.setParent(canvas);
          }
          node.layer = canvas.layer;
          node.active = true;
          node.setPosition(0, y, 0);
          const transform = node.getComponent(cc.UITransform) || node.addComponent(cc.UITransform);
          transform.setContentSize(320, 72);
          let backgroundNode = node.getChildByName('__fallback_bg');
          if (!backgroundNode) {
            backgroundNode = new cc.Node('__fallback_bg');
            backgroundNode.setParent(node);
          }
          backgroundNode.layer = node.layer;
          backgroundNode.active = true;
          backgroundNode.setPosition(0, 0, 0);
          const backgroundTransform = backgroundNode.getComponent(cc.UITransform) || backgroundNode.addComponent(cc.UITransform);
          backgroundTransform.setContentSize(320, 72);
          const graphics = backgroundNode.getComponent(cc.Graphics) || backgroundNode.addComponent(cc.Graphics);
          graphics.clear();
          graphics.fillColor = new cc.Color(40, 40, 40, 220);
          graphics.strokeColor = new cc.Color(255, 255, 255, 255);
          graphics.lineWidth = 2;
          graphics.roundRect(-160, -36, 320, 72, 12);
          graphics.fill();
          graphics.stroke();
          let labelNode = node.getChildByName('__fallback_label');
          if (!labelNode) {
            labelNode = new cc.Node('__fallback_label');
            labelNode.setParent(node);
          }
          labelNode.layer = node.layer;
          labelNode.active = true;
          labelNode.setPosition(0, 0, 0);
          const labelTransform = labelNode.getComponent(cc.UITransform) || labelNode.addComponent(cc.UITransform);
          labelTransform.setContentSize(320, 72);
          const label = labelNode.getComponent(cc.Label) || labelNode.addComponent(cc.Label);
          label.string = '[ ' + name + ' ]';
          label.fontSize = 32;
          label.lineHeight = 36;
          label.useSystemFont = true;
          label.fontFamily = 'Arial';
          label.color = new cc.Color(255, 255, 255, 255);
          node.on(cc.Node.EventType.TOUCH_END, () => {
            Promise.resolve(handler()).catch((error) => {
              console.error('[agora-rtc] action failed', error);
            });
          });
        }
        scheduleUiRetry() {
          if (this.uiRetryTimer !== null) {
            return;
          }
          this.uiRetryTimer = setInterval(() => {
            if (this.ensureUi()) {
              clearInterval(this.uiRetryTimer);
              this.uiRetryTimer = null;
            }
          }, 500);
        }
        ensureUi() {
          const scene = cc.director.getScene();
          const canvas = scene && scene.getChildByName('Canvas');
          if (!canvas) {
            console.log('[agora-rtc] waiting for Canvas before creating fallback UI');
            return false;
          }
          this.createButton(canvas, 'Initialize', 100, () => this.invoke('initialize', {
            appId: this.runtimeConfig.appId
          }));
          this.createButton(canvas, 'Join', 0, () => this.invoke('joinChannel', {
            token: this.runtimeConfig.token,
            channelId: this.runtimeConfig.channelId,
            uid: this.runtimeConfig.uid
          }));
          this.createButton(canvas, 'Leave', -100, () => this.invoke('leaveChannel', {}));
          console.log('[agora-rtc] fallback UI is ready');
          this.probeBridgeOnce();
          this.probeApisOnce();
          return true;
        }
        start() {
          return cc.game.init({
            debugMode: true ? cc.DebugMode.INFO : cc.DebugMode.ERROR,
            settingsPath: this.settingsPath,
            overrideSettings: {
              profiling: {
                showFPS: this.showFPS
              }
            }
          }).then(() => cc.game.run()).then(() => {
            this.scheduleUiRetry();
          });
        }
      });
    }
  };
});`;

async function patchApplication(filePath) {
  try {
    await writeFile(filePath, applicationBootstrap, 'utf8');
    return true;
  } catch {
    return false;
  }
}

for (const target of targets) {
  const patched = await patchBundle(target);
  if (patched) {
    console.log(`Patched exported main bundle: ${target}`);
  }
}

for (const target of applicationTargets) {
  const patched = await patchApplication(target);
  if (patched) {
    console.log(`Patched application bootstrap: ${target}`);
  }
}
