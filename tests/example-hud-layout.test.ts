import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultAgoraHudLayout,
  worldRectToNativeOverlayRect,
} from '../example/basic-call/assets/scripts/agoraRtcHudLayout.ts';

test('createDefaultAgoraHudLayout builds a 1v1 rtc hud with a dominant remote stage', () => {
  const layout = createDefaultAgoraHudLayout(1280, 720);

  assert.equal(layout.actions.length, 6);
  assert.deepEqual(
    layout.actions.map((action) => action.id),
    ['initialize', 'join', 'leave', 'toggleAudio', 'toggleVideo', 'switchCamera'],
  );

  assert.ok(layout.remoteViewport.width > 700);
  assert.ok(layout.remoteViewport.height > 380);
  assert.ok(layout.remoteViewport.x > layout.controlsPanel.x + layout.controlsPanel.width);
  assert.ok(layout.localPreview.width < layout.remoteViewport.width / 2);
  assert.ok(layout.localPreview.height < layout.remoteViewport.height / 2);
  assert.ok(
    layout.localPreview.x + layout.localPreview.width <=
      layout.remoteViewport.x + layout.remoteViewport.width,
  );
  assert.ok(
    layout.localPreview.y + layout.localPreview.height <=
      layout.remoteViewport.y + layout.remoteViewport.height,
  );
  assert.ok(layout.statusPanel.width > 1000);
});

test('worldRectToNativeOverlayRect converts cocos world coordinates into native overlay pixels', () => {
  const rect = worldRectToNativeOverlayRect(
    {
      x: 920,
      y: 430,
      width: 260,
      height: 146,
    },
    {
      viewportX: 10,
      viewportY: 20,
      scaleX: 1.5,
      scaleY: 2,
      visibleHeight: 720,
    },
  );

  assert.deepEqual(rect, {
    x: 1390,
    y: 308,
    width: 390,
    height: 292,
    renderMode: 'hidden',
  });
});
