import {
  _decorator,
  Component,
  Graphics,
  Label,
  Mask,
  Node,
  ScrollView,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
} from 'cc';
import type { DemoSessionState } from '../types.ts';
import { COLORS, configureLabel, drawPanel, ensureTransform } from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;
const DEFAULT_STAGE_WIDTH = 820;
const DEFAULT_STAGE_HEIGHT = 620;
const MIN_STAGE_WIDTH = 360;
const MIN_STAGE_HEIGHT = 320;
const STAGE_PADDING = 10;
const VIDEO_INSET = 8;
const REMOTE_ROW_HEIGHT = 176;
const REMOTE_THUMB_WIDTH = 240;
const REMOTE_THUMB_HEIGHT = 148;
const REMOTE_THUMB_GAP = 12;
const REMOTE_ROW_INSET = 12;
const VERTICAL_SCROLL_WIDTH = 14;
const STAGE_CONTENT_GAP = 14;

@ccclass('VideoStagePanel')
export class VideoStagePanel extends Component {
  @property(Node)
  localCard: Node | null = null;

  @property(Node)
  remoteCard: Node | null = null;

  @property(Label)
  localHintLabel: Label | null = null;

  @property(Sprite)
  localVideoSprite: Sprite | null = null;

  @property(Label)
  localStatsLabel: Label | null = null;

  @property(Node)
  remoteThumbnailRow: Node | null = null;

  private stageScrollView: ScrollView | null = null;
  private stageScrollContent: Node | null = null;
  private remoteRowScrollView: ScrollView | null = null;
  private remoteRowContent: Node | null = null;
  private remoteHintLabels = new Map<number, Label>();
  private remoteVideoSprites = new Map<number, Sprite>();
  private remoteVideoNodes = new Map<number, Node>();
  private remoteStatsLabels = new Map<number, Label>();
  private stageWidth = DEFAULT_STAGE_WIDTH;
  private stageHeight = DEFAULT_STAGE_HEIGHT;

  initialize(): void {
    this.ensureBaseNodes();
  }

  applyLayout(width: number, height: number): void {
    this.stageWidth = Math.max(MIN_STAGE_WIDTH, Math.round(width));
    this.stageHeight = Math.max(MIN_STAGE_HEIGHT, Math.round(height));
    this.ensureBaseNodes();
    this.layoutRemoteThumbnails();
  }

  setLocalHint(text: string): void {
    this.ensureBaseNodes();
    if (this.localHintLabel) {
      this.localHintLabel.string = text;
    }
  }

  setRemoteUsers(uids: number[], activeUid: number | null): void {
    this.ensureBaseNodes();
    for (const uid of uids) {
      this.ensureRemoteUserPage(uid);
    }
    for (const uid of [...this.remoteVideoNodes.keys()]) {
      if (!uids.includes(uid)) {
        this.removeRemoteUserPage(uid);
      }
    }
    if (activeUid !== null) {
      this.focusRemoteUser(activeUid);
    }
    this.layoutRemoteThumbnails();
  }

  setLocalStageState(state: DemoSessionState): void {
    this.ensureBaseNodes();
    this.setLocalHint(state.previewStarted ? 'Local preview' : 'Preview stopped');
  }

  setStats(state: DemoSessionState): void {
    this.ensureBaseNodes();
    if (this.localStatsLabel) {
      this.localStatsLabel.string = `Local ${state.lastLocalVideoStatsSummary} | RTC ${state.lastRtcStatsSummary}`;
    }
    for (const uid of state.remoteUserUids) {
      this.ensureRemoteUserPage(uid);
      const label = this.remoteStatsLabels.get(uid);
      if (label) {
        label.string = state.lastRemoteVideoStatsByUid[uid] ?? `Remote ${uid}`;
      }
    }
  }

  getLocalVideoNode(): Node | null {
    this.ensureBaseNodes();
    return this.localVideoSprite?.node ?? null;
  }

  getRemoteVideoNode(uid: number): Node | null {
    this.ensureBaseNodes();
    return this.ensureRemoteUserPage(uid);
  }

  bindLocalSpriteFrame(texture: Texture2D, spriteFrame: SpriteFrame): void {
    this.ensureBaseNodes();
    if (this.localVideoSprite) {
      spriteFrame.texture = texture;
      this.localVideoSprite.spriteFrame = spriteFrame;
    }
  }

  bindRemoteSpriteFrame(uid: number, texture: Texture2D, spriteFrame: SpriteFrame): void {
    this.ensureBaseNodes();
    this.ensureRemoteUserPage(uid);
    const sprite = this.remoteVideoSprites.get(uid);
    if (sprite) {
      spriteFrame.texture = texture;
      sprite.spriteFrame = spriteFrame;
    }
  }

  clearLocalVideoFrame(): void {
    this.ensureBaseNodes();
    if (this.localVideoSprite) {
      this.localVideoSprite.spriteFrame = null;
    }
    this.setLocalHint('Preview stopped');
  }

  clearRemoteVideoFrame(uid: number): void {
    this.ensureBaseNodes();
    const sprite = this.remoteVideoSprites.get(uid);
    if (sprite) {
      sprite.spriteFrame = null;
    }
    const hint = this.remoteHintLabels.get(uid);
    if (hint) {
      hint.string = `Remote ${uid}`;
    }
  }

  private ensureBaseNodes(): void {
    const stageWidth = this.stageWidth;
    const stageHeight = this.stageHeight;
    const viewportWidth = Math.max(1, stageWidth - STAGE_PADDING * 2);
    const viewportHeight = Math.max(1, stageHeight - STAGE_PADDING * 2);
    const contentWidth = Math.max(1, viewportWidth - VERTICAL_SCROLL_WIDTH);
    const localHeight = Math.max(280, stageHeight - REMOTE_ROW_HEIGHT - STAGE_CONTENT_GAP - STAGE_PADDING * 2);
    const contentHeight = localHeight + REMOTE_ROW_HEIGHT + STAGE_CONTENT_GAP;
    const localWidth = contentWidth;
    const localVideoWidth = Math.max(1, localWidth - VIDEO_INSET * 2);
    const localVideoHeight = Math.max(1, localHeight - VIDEO_INSET * 2);
    const rowWidth = Math.max(1, localWidth);
    const localY = contentHeight / 2 - localHeight / 2;
    const rowY = -contentHeight / 2 + REMOTE_ROW_HEIGHT / 2;
    const labelX = -localWidth / 2 + 16;
    const labelWidth = Math.max(120, Math.min(420, localWidth - 32));

    ensureTransform(this.node, stageWidth, stageHeight);
    const stageViewport = this.ensureScrollViewport('StageScrollView', stageWidth, stageHeight, viewportWidth, viewportHeight);
    const stageContent = this.ensureScrollContent(stageViewport, 'StageScrollContent', contentWidth, Math.max(viewportHeight, contentHeight));
    this.stageScrollView = stageViewport.getComponent(ScrollView) ?? stageViewport.addComponent(ScrollView);
    this.stageScrollView.horizontal = false;
    this.stageScrollView.vertical = true;
    this.stageScrollView.elastic = true;
    this.stageScrollView.inertia = true;
    this.stageScrollView.brake = 0.75;
    this.stageScrollView.content = stageContent;
    this.stageScrollContent = stageContent;

    this.localCard = this.ensureCard('LocalStage', 0, localY, localWidth, localHeight, stageContent);
    this.remoteThumbnailRow = this.ensureHorizontalScrollRow(stageContent, rowWidth, REMOTE_ROW_HEIGHT, rowY);
    this.remoteCard = this.remoteThumbnailRow;
    this.remoteThumbnailRow.active = this.remoteVideoNodes.size > 0;
    this.localVideoSprite = this.ensureSprite(this.localCard, 'LocalVideoSprite', localVideoWidth, localVideoHeight);
    this.localHintLabel = this.ensureLabel(
      this.localCard,
      'LocalHint',
      'Local preview',
      labelWidth,
      30,
      labelX + labelWidth / 2,
      -localHeight / 2 + 56,
    );
    this.localStatsLabel = this.ensureLabel(
      this.localCard,
      'LocalStatsLabel',
      'Local -',
      labelWidth,
      30,
      labelX + labelWidth / 2,
      -localHeight / 2 + 28,
    );
  }

  private ensureCard(name: string, x: number, y: number, width: number, height: number, parent = this.node): Node {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.active = true;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, height);
    drawPanel(node.getComponent(Graphics) ?? node.addComponent(Graphics), width, height);
    return node;
  }

  private ensureScrollViewport(name: string, stageWidth: number, stageHeight: number, width: number, height: number): Node {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(this.node);
    }
    node.layer = this.node.layer;
    node.active = true;
    node.setPosition(0, 0, 0);
    ensureTransform(node, width, height);
    node.getComponent(UITransform)?.setAnchorPoint(0.5, 0.5);
    node.getComponent(Mask) ?? node.addComponent(Mask);
    return node;
  }

  private ensureScrollContent(parent: Node, name: string, width: number, height: number): Node {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.active = true;
    node.setPosition(0, height / 2, 0);
    const transform = ensureTransform(node, width, height);
    transform.setAnchorPoint(0.5, 1);
    return node;
  }

  private ensureHorizontalScrollRow(parent: Node, width: number, height: number, y: number): Node {
    let viewport = parent.getChildByName('RemoteThumbnailRow');
    if (!viewport) {
      viewport = new Node('RemoteThumbnailRow');
      viewport.setParent(parent);
    }
    viewport.layer = parent.layer;
    viewport.active = true;
    viewport.setPosition(0, y, 0);
    ensureTransform(viewport, width, height);
    viewport.getComponent(Mask) ?? viewport.addComponent(Mask);

    let content = viewport.getChildByName('RemoteThumbnailContent');
    if (!content) {
      content = new Node('RemoteThumbnailContent');
      content.setParent(viewport);
    }
    content.layer = viewport.layer;
    content.active = true;
    const transform = ensureTransform(content, width, height);
    transform.setAnchorPoint(0, 0.5);
    content.setPosition(-width / 2 + REMOTE_ROW_INSET, 0, 0);

    this.remoteRowScrollView = viewport.getComponent(ScrollView) ?? viewport.addComponent(ScrollView);
    this.remoteRowScrollView.horizontal = true;
    this.remoteRowScrollView.vertical = false;
    this.remoteRowScrollView.elastic = true;
    this.remoteRowScrollView.inertia = true;
    this.remoteRowScrollView.brake = 0.75;
    this.remoteRowScrollView.content = content;
    this.remoteRowContent = content;
    return viewport;
  }

  private ensureSprite(parent: Node, name: string, width: number, height: number): Sprite {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.setPosition(0, 0, 0);
    ensureTransform(node, width, height);
    const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    return sprite;
  }

  private ensureLabel(
    parent: Node,
    name: string,
    text: string,
    width: number,
    height: number,
    x: number,
    y: number,
  ): Label {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, height);
    const label = node.getComponent(Label) ?? node.addComponent(Label);
    configureLabel(label, text, 14, COLORS.textMuted);
    node.setSiblingIndex(parent.children.length - 1);
    return label;
  }

  private ensureRemoteUserPage(uid: number): Node | null {
    if (this.remoteVideoNodes.has(uid)) {
      return this.remoteVideoNodes.get(uid) ?? null;
    }
    const parent = this.remoteRowContent ?? this.remoteThumbnailRow ?? this.node;
    const index = this.remoteVideoNodes.size;
    const x = this.remoteThumbX(index, this.remoteVideoNodes.size + 1);
    const pageNode = this.ensureCard(`RemoteUser_${uid}`, x, 0, REMOTE_THUMB_WIDTH, REMOTE_THUMB_HEIGHT, parent);
    const sprite = this.ensureSprite(
      pageNode,
      'VideoSprite',
      REMOTE_THUMB_WIDTH - VIDEO_INSET,
      REMOTE_THUMB_HEIGHT - VIDEO_INSET,
    );
    const hint = this.ensureLabel(pageNode, 'Hint', `Remote ${uid}`, 120, 22, 0, 20);
    const stats = this.ensureLabel(pageNode, `RemoteStats_${uid}`, `Remote ${uid}`, 126, 22, 0, -28);
    this.remoteVideoNodes.set(uid, pageNode);
    this.remoteVideoSprites.set(uid, sprite);
    this.remoteHintLabels.set(uid, hint);
    this.remoteStatsLabels.set(uid, stats);
    if (this.remoteThumbnailRow) {
      this.remoteThumbnailRow.active = true;
    }
    return pageNode;
  }

  private removeRemoteUserPage(uid: number): void {
    this.remoteVideoNodes.get(uid)?.destroy();
    this.remoteVideoNodes.delete(uid);
    this.remoteVideoSprites.delete(uid);
    this.remoteHintLabels.delete(uid);
    this.remoteStatsLabels.delete(uid);
  }

  private focusRemoteUser(uid: number): void {
    const node = this.remoteVideoNodes.get(uid);
    if (node) {
      node.setSiblingIndex((this.remoteThumbnailRow?.children.length ?? 1) - 1);
    }
  }

  private layoutRemoteThumbnails(): void {
    const nodes = [...this.remoteVideoNodes.values()];
    if (this.remoteThumbnailRow) {
      this.remoteThumbnailRow.active = nodes.length > 0;
    }
    if (this.remoteRowContent) {
      const contentWidth = Math.max(
        (this.stageWidth - STAGE_PADDING * 2 - VERTICAL_SCROLL_WIDTH),
        REMOTE_ROW_INSET * 2 + nodes.length * REMOTE_THUMB_WIDTH + Math.max(0, nodes.length - 1) * REMOTE_THUMB_GAP,
      );
      ensureTransform(this.remoteRowContent, contentWidth, REMOTE_ROW_HEIGHT);
      this.remoteRowContent.setPosition(
        -(this.stageWidth - STAGE_PADDING * 2 - VERTICAL_SCROLL_WIDTH) / 2 + REMOTE_ROW_INSET,
        0,
        0,
      );
    }
    nodes.forEach((node, index) => {
      node.setPosition(this.remoteThumbX(index, nodes.length), 0, 0);
    });
  }

  private remoteThumbX(index: number, count: number): number {
    return REMOTE_THUMB_WIDTH / 2 + index * (REMOTE_THUMB_WIDTH + REMOTE_THUMB_GAP);
  }
}
