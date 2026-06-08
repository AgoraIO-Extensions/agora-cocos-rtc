import {
  _decorator,
  Component,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
} from 'cc';
import type { DemoSessionState } from '../types.ts';
import { COLORS, configureLabel, ensureTransform } from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;

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

  private remoteHintLabels = new Map<number, Label>();
  private remoteVideoSprites = new Map<number, Sprite>();
  private remoteVideoNodes = new Map<number, Node>();
  private remoteStatsLabels = new Map<number, Label>();

  initialize(): void {
    this.ensureBaseNodes();
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

  private ensureBaseNodes(): void {
    ensureTransform(this.node, 820, 620);
    this.localCard = this.ensureCard('LocalStage', 0, 0, 780, 520);
    this.remoteThumbnailRow = this.ensureCard('RemoteThumbnailRow', 0, 235, 760, 112);
    this.remoteCard = this.remoteThumbnailRow;
    this.localVideoSprite = this.ensureSprite(this.localCard, 'LocalVideoSprite', 780, 520);
    this.localHintLabel = this.ensureLabel(this.localCard, 'LocalHint', 'Local preview', 240, 32, -350, -220);
    this.localStatsLabel = this.ensureLabel(this.localCard, 'LocalStatsLabel', 'Local -', 340, 32, -340, -250);
  }

  private ensureCard(name: string, x: number, y: number, width: number, height: number, parent = this.node): Node {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, height);
    return node;
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
    return node.getComponent(Sprite) ?? node.addComponent(Sprite);
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
    return label;
  }

  private ensureRemoteUserPage(uid: number): Node | null {
    if (this.remoteVideoNodes.has(uid)) {
      return this.remoteVideoNodes.get(uid) ?? null;
    }
    const parent = this.remoteThumbnailRow ?? this.node;
    const index = this.remoteVideoNodes.size;
    const x = -300 + index * 150;
    const pageNode = this.ensureCard(`RemoteUser_${uid}`, x, 0, 136, 86, parent);
    const sprite = this.ensureSprite(pageNode, 'VideoSprite', 136, 86);
    const hint = this.ensureLabel(pageNode, 'Hint', `Remote ${uid}`, 120, 22, 0, 20);
    const stats = this.ensureLabel(pageNode, `RemoteStats_${uid}`, `Remote ${uid}`, 126, 22, 0, -28);
    this.remoteVideoNodes.set(uid, pageNode);
    this.remoteVideoSprites.set(uid, sprite);
    this.remoteHintLabels.set(uid, hint);
    this.remoteStatsLabels.set(uid, stats);
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
    [...this.remoteVideoNodes.values()].forEach((node, index) => {
      node.setPosition(-300 + index * 150, 0, 0);
    });
  }
}
