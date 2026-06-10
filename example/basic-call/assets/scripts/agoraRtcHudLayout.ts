import type { AgoraRtcVideoCanvas } from '../../extensions/agora-rtc/js/types.ts';

export type AgoraHudActionId =
  | 'initialize'
  | 'join'
  | 'leave'
  | 'toggleAudio'
  | 'toggleVideo'
  | 'switchCamera';

export type AgoraHudRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AgoraHudActionLayout = {
  id: AgoraHudActionId;
  label: string;
  rect: AgoraHudRect;
};

export type AgoraHudLayout = {
  headerPanel: AgoraHudRect;
  configPanel: AgoraHudRect;
  controlsPanel: AgoraHudRect;
  remoteViewport: AgoraHudRect;
  localPreview: AgoraHudRect;
  statusPanel: AgoraHudRect;
  actions: AgoraHudActionLayout[];
};

export type AgoraNativeViewMetrics = {
  viewportX: number;
  viewportY: number;
  scaleX: number;
  scaleY: number;
  visibleHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createDefaultAgoraHudLayout(
  stageWidth: number,
  stageHeight: number,
): AgoraHudLayout {
  const gutter = Math.round(Math.min(stageWidth, stageHeight) * 0.028);
  const leftRailWidth = clamp(Math.round(stageWidth * 0.24), 296, 360);
  const headerHeight = clamp(Math.round(stageHeight * 0.1), 68, 82);
  const configHeight = clamp(Math.round(stageHeight * 0.16), 112, 132);
  const statusHeight = clamp(Math.round(stageHeight * 0.19), 128, 156);

  const headerPanel = {
    x: gutter,
    y: stageHeight - gutter - headerHeight,
    width: leftRailWidth,
    height: headerHeight,
  };
  const configPanel = {
    x: gutter,
    y: headerPanel.y - gutter - configHeight,
    width: leftRailWidth,
    height: configHeight,
  };
  const statusPanel = {
    x: gutter,
    y: gutter,
    width: stageWidth - gutter * 2,
    height: statusHeight,
  };
  const controlsPanel = {
    x: gutter,
    y: statusPanel.y + statusPanel.height + gutter,
    width: leftRailWidth,
    height: configPanel.y - gutter - (statusPanel.y + statusPanel.height + gutter),
  };
  const remoteViewport = {
    x: controlsPanel.x + controlsPanel.width + gutter,
    y: statusPanel.y + statusPanel.height + gutter,
    width: stageWidth - (controlsPanel.x + controlsPanel.width + gutter) - gutter,
    height: stageHeight - (statusPanel.y + statusPanel.height + gutter) - gutter,
  };

  const localWidth = clamp(Math.round(remoteViewport.width * 0.28), 208, 280);
  const localHeight = Math.round(localWidth * 9 / 16);
  const localPreview = {
    x: remoteViewport.x + remoteViewport.width - localWidth - gutter,
    y: remoteViewport.y + remoteViewport.height - localHeight - gutter,
    width: localWidth,
    height: localHeight,
  };

  const buttonGap = 14;
  const buttonWidth = Math.floor((controlsPanel.width - buttonGap * 3) / 2);
  const buttonHeight = clamp(
    Math.floor((controlsPanel.height - buttonGap * 4) / 3),
    58,
    84,
  );
  const actions: AgoraHudActionLayout[] = [
    ['initialize', 'INITIALIZE'],
    ['join', 'JOIN'],
    ['leave', 'LEAVE'],
    ['toggleAudio', 'MUTE MIC'],
    ['toggleVideo', 'DISABLE CAM'],
    ['switchCamera', 'SWITCH CAM'],
  ].map(([id, label], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    return {
      id: id as AgoraHudActionId,
      label,
      rect: {
        x: controlsPanel.x + buttonGap + column * (buttonWidth + buttonGap),
        y:
          controlsPanel.y +
          controlsPanel.height -
          buttonGap -
          (row + 1) * buttonHeight -
          row * buttonGap,
        width: buttonWidth,
        height: buttonHeight,
      },
    };
  });

  return {
    headerPanel,
    configPanel,
    controlsPanel,
    remoteViewport,
    localPreview,
    statusPanel,
    actions,
  };
}

export function worldRectToNativeOverlayRect(
  rect: AgoraHudRect,
  metrics: AgoraNativeViewMetrics,
  renderMode: 'hidden' | 'fit' | 'adaptive' = 'hidden',
): AgoraRtcVideoCanvas {
  return {
    x: Math.round(metrics.viewportX + rect.x * metrics.scaleX),
    y: Math.round(
      metrics.viewportY +
        (metrics.visibleHeight - rect.y - rect.height) * metrics.scaleY,
    ),
    width: Math.round(rect.width * metrics.scaleX),
    height: Math.round(rect.height * metrics.scaleY),
    renderMode,
  };
}
