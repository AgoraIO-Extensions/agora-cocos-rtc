import { director, Director, game, native, Node, sys, UITransform, view } from 'cc';

import { AgoraRtcDemoRoot } from './demo/AgoraRtcDemoRoot.ts';

const MAX_ROOT_ATTEMPTS = 120;
let rootAttempts = 0;
let rootLoopScheduled = false;

function ensureDemoRootMounted(): boolean {
  const scene = director.getScene();
  const canvas = scene?.getChildByName('Canvas');
  if (!canvas) {
    console.log('[agora-rtc] bootstrap canvas not ready', scene?.name ?? 'no-scene');
    return false;
  }

  let demoRoot = canvas.getChildByName('DemoRoot');
  if (!demoRoot) {
    demoRoot = new Node('DemoRoot');
    demoRoot.layer = canvas.layer;
    demoRoot.setParent(canvas);
    demoRoot.setPosition(0, 0, 0);
  }

  const transform = demoRoot.getComponent(UITransform) ?? demoRoot.addComponent(UITransform);
  const visibleSize = view.getVisibleSize();
  transform.setContentSize(visibleSize.width, visibleSize.height);

  if (!demoRoot.getComponent(AgoraRtcDemoRoot)) {
    demoRoot.addComponent(AgoraRtcDemoRoot);
    console.log('[agora-rtc] bootstrap demo root component added');
  }

  return true;
}

function scheduleDemoRootCheck(): void {
  if (rootLoopScheduled) {
    return;
  }
  rootLoopScheduled = true;
  rootAttempts = 0;

  const tick = () => {
    rootAttempts += 1;
    if (ensureDemoRootMounted()) {
      rootLoopScheduled = false;
      return;
    }
    if (rootAttempts >= MAX_ROOT_ATTEMPTS) {
      console.error('[agora-rtc] bootstrap demo root check failed after retries');
      rootLoopScheduled = false;
      return;
    }
    setTimeout(tick, 50);
  };

  tick();
}

console.log('[agora-rtc] bootstrap module loaded v20260608-prefab-root');
if (sys.isNative) {
  try {
    (globalThis as any).cc?.assetManager?.cacheManager?.clearCache?.();
    const pipeline = director.root?.pipeline;
    if (pipeline) {
      pipeline.profiler = null;
      (globalThis as any).cc?.profiler?.hideStats?.();
    }
    const writablePath = (globalThis as any).jsb?.fileUtils?.getWritablePath?.() ?? 'unknown';
    const cacheDir = (globalThis as any).cc?.assetManager?.cacheManager?.cacheDir ?? 'unknown';
    console.log('[agora-rtc] bootstrap runtime paths', writablePath, cacheDir, Boolean(native));
  } catch (error) {
    console.log('[agora-rtc] bootstrap runtime paths failed', String(error));
  }
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, scheduleDemoRootCheck);
game.onPostProjectInitDelegate?.add?.(scheduleDemoRootCheck);
scheduleDemoRootCheck();

export {};
