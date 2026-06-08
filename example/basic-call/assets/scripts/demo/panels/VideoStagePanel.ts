import {
  _decorator,
  Component,
  Label,
  Node,
  Sprite,
  SpriteFrame,
  Texture2D,
} from 'cc';
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

  private remoteHintLabels = new Map<number, Label>();
  private remoteVideoSprites = new Map<number, Sprite>();
  private remoteVideoNodes = new Map<number, Node>();

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
    const sprite = this.remoteVideoSprites.get(uid);
    if (sprite) {
      spriteFrame.texture = texture;
      sprite.spriteFrame = spriteFrame;
    }
  }

  private ensureBaseNodes(): void {
    ensureTransform(this.node, 520, 520);
    this.remoteCard ??= this.ensureCard('RemoteCard', 0, 105, 500, 300);
    this.localCard ??= this.ensureCard('LocalCard', 145, -160, 200, 112);
    if (!this.localVideoSprite) {
      this.localVideoSprite = this.ensureSprite(this.localCard, 'LocalVideoSprite', 200, 112);
    }
    if (!this.localHintLabel) {
      this.localHintLabel = this.ensureLabel(this.localCard, 'LocalHint', 'Local preview', 200, 32, 0, 0);
    }
  }

  private ensureCard(name: string, x: number, y: number, width: number, height: number): Node {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(this.node);
    }
    node.layer = this.node.layer;
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
    const parent = this.remoteCard ?? this.node;
    const pageNode = this.ensureCard(`RemoteUser_${uid}`, 0, 0, 500, 300);
    pageNode.setParent(parent);
    pageNode.setPosition(0, 0, 0);
    const sprite = this.ensureSprite(pageNode, 'VideoSprite', 500, 300);
    const hint = this.ensureLabel(pageNode, 'Hint', `Remote ${uid}`, 300, 32, 0, 0);
    this.remoteVideoNodes.set(uid, pageNode);
    this.remoteVideoSprites.set(uid, sprite);
    this.remoteHintLabels.set(uid, hint);
    return pageNode;
  }

  private removeRemoteUserPage(uid: number): void {
    this.remoteVideoNodes.get(uid)?.destroy();
    this.remoteVideoNodes.delete(uid);
    this.remoteVideoSprites.delete(uid);
    this.remoteHintLabels.delete(uid);
  }

  private focusRemoteUser(uid: number): void {
    const node = this.remoteVideoNodes.get(uid);
    if (node) {
      node.setSiblingIndex((this.remoteCard?.children.length ?? 1) - 1);
    }
  }
}
