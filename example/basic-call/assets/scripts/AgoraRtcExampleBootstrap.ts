import { director, Director, game, native, sys } from 'cc';

import { AgoraRtcExampleController } from './AgoraRtcExampleController.ts';

const MAX_MOUNT_ATTEMPTS = 200;
let mountAttempts = 0;
let mountLoopScheduled = false;

function isControllerMounted(): boolean {
  const canvas = director.getScene()?.getChildByName('Canvas');
  return Boolean(canvas?.getComponent(AgoraRtcExampleController));
}

function ensureExampleControllerMounted(): boolean {
  const scene = director.getScene();
  const canvas = scene?.getChildByName('Canvas');
  if (!canvas) {
    console.log('[agora-rtc] bootstrap canvas not ready', scene?.name ?? 'no-scene');
    return false;
  }

  let component = canvas.getComponent(AgoraRtcExampleController);
  if (!component) {
    try {
      component = canvas.addComponent(AgoraRtcExampleController);
      console.log('[agora-rtc] bootstrap controller added', Boolean(component));
    } catch (error) {
      console.error('[agora-rtc] bootstrap add component failed', error);
      return false;
    }
  } else {
    console.log('[agora-rtc] bootstrap controller already present');
  }

  component?.initializeUi();
  console.log('[agora-rtc] bootstrap canvas child count', canvas.children.length);
  return true;
}

function scheduleMountLoop() {
  if (mountLoopScheduled) {
    return;
  }
  mountLoopScheduled = true;
  mountAttempts = 0;

  const tick = () => {
    mountAttempts += 1;
    if (ensureExampleControllerMounted() || isControllerMounted()) {
      mountLoopScheduled = false;
      return;
    }
    if (mountAttempts >= MAX_MOUNT_ATTEMPTS) {
      console.error('[agora-rtc] bootstrap mount failed after retries');
      mountLoopScheduled = false;
      return;
    }
    setTimeout(tick, 50);
  };

  tick();
}

console.log('[agora-rtc] bootstrap module loaded v20260521-1');
if (sys.isNative) {
  try {
    (globalThis as any).cc?.assetManager?.cacheManager?.clearCache?.();
    game.config.showFPS = false;
    if (director.root?.pipeline) {
      director.root.pipeline.profiler = null;
    }
    (globalThis as any).cc?.profiler?.hideStats?.();
    const writablePath = (globalThis as any).jsb?.fileUtils?.getWritablePath?.() ?? 'unknown';
    const cacheDir = (globalThis as any).cc?.assetManager?.cacheManager?.cacheDir ?? 'unknown';
    console.log('[agora-rtc] bootstrap runtime paths', writablePath, cacheDir, Boolean(native));
  } catch (error) {
    console.log('[agora-rtc] bootstrap runtime paths failed', String(error));
  }
}

director.on(Director.EVENT_AFTER_SCENE_LAUNCH, scheduleMountLoop);
game.onPostProjectInitDelegate?.add?.(scheduleMountLoop);
scheduleMountLoop();

export {};
