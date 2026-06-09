import { _decorator, Component, Label, Node, ScrollView } from 'cc';
import { ensureButtonNode, ensureTransform } from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;

@ccclass('LogPanel')
export class LogPanel extends Component {
  @property(Label)
  bodyLabel: Label | null = null;

  @property(ScrollView)
  scrollView: ScrollView | null = null;

  @property(Node)
  backButton: Node | null = null;

  @property(Node)
  clearButton: Node | null = null;

  @property(Node)
  freezeButton: Node | null = null;

  private onClose: (() => void) | null = null;
  private onClear: (() => void) | null = null;
  private onFreeze: (() => void) | null = null;

  initialize(callbacks: {
    onClose: () => void;
    onClear: () => void;
    onFreeze: () => void;
  }): void {
    this.onClose = callbacks.onClose;
    this.onClear = callbacks.onClear;
    this.onFreeze = callbacks.onFreeze;
    this.ensureFallbackNodes();
    this.bind(this.backButton, () => this.onClose?.());
    this.bind(this.clearButton, () => this.onClear?.());
    this.bind(this.freezeButton, () => this.onFreeze?.());
    this.hide();
  }

  show(): void {
    this.ensureFallbackNodes();
    this.node.active = true;
    this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1);
    this.scrollView?.scrollToBottom(0, false);
  }

  hide(): void {
    this.node.active = false;
  }

  setLines(lines: string[]): void {
    this.ensureFallbackNodes();
    if (this.bodyLabel) {
      this.bodyLabel.string = lines.join('\n');
    }
    if (this.node.active) {
      this.scrollView?.scrollToBottom(0, false);
    }
  }

  private ensureFallbackNodes(): void {
    ensureTransform(this.node, 640, 520);
    if (!this.bodyLabel) {
      let bodyNode = this.node.getChildByName('BodyLabel');
      if (!bodyNode) {
        bodyNode = new Node('BodyLabel');
        bodyNode.setParent(this.node);
      }
      bodyNode.layer = this.node.layer;
      bodyNode.setPosition(0, -20, 0);
      ensureTransform(bodyNode, 590, 420);
      this.bodyLabel = bodyNode.getComponent(Label) ?? bodyNode.addComponent(Label);
      this.bodyLabel.fontSize = 13;
      this.bodyLabel.lineHeight = 18;
    }
    this.backButton ??= ensureButtonNode(this.node, 'BackButton', 80, 34, 'Back', 'secondary').node;
    this.clearButton ??= ensureButtonNode(this.node, 'ClearButton', 80, 34, 'Clear', 'ghost').node;
    this.freezeButton ??= ensureButtonNode(this.node, 'FreezeButton', 90, 34, 'Freeze', 'ghost').node;
    this.backButton.setPosition(-240, 230, 0);
    this.clearButton.setPosition(-150, 230, 0);
    this.freezeButton.setPosition(-50, 230, 0);
  }

  private bind(node: Node | null, handler: () => void): void {
    node?.off(Node.EventType.TOUCH_END);
    node?.on(Node.EventType.TOUCH_END, handler, this);
  }
}
