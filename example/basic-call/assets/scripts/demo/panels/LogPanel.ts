import { _decorator, Component, HorizontalTextAlignment, Label, Mask, Node, ScrollView, VerticalTextAlignment } from 'cc';
import { bindButtonTouch, ensureButtonNode, ensureTransform } from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;
const LOG_PANEL_MARGIN = 18;
const LOG_PANEL_MAX_WIDTH = 720;
const LOG_PANEL_MAX_HEIGHT = 560;
const LOG_PANEL_MIN_WIDTH = 360;
const LOG_PANEL_MIN_HEIGHT = 220;
const LOG_PANEL_BUTTON_HEIGHT = 34;
const LOG_PANEL_BODY_GAP = 12;
const LOG_PANEL_BUTTON_GAP = 10;

@ccclass('LogPanel')
export class LogPanel extends Component {
  @property(Label)
  bodyLabel: Label | null = null;

  @property(ScrollView)
  scrollView: ScrollView | null = null;

  @property(Node)
  closeButton: Node | null = null;

  @property(Node)
  clearButton: Node | null = null;

  @property(Node)
  freezeButton: Node | null = null;

  private onClose: (() => void) | null = null;
  private onClear: (() => void) | null = null;
  private onFreeze: (() => void) | null = null;
  private visibleWidth = 640;
  private visibleHeight = 520;
  private nodesReady = false;

  initialize(callbacks: {
    onClose: () => void;
    onClear: () => void;
    onFreeze: () => void;
  }): void {
    this.onClose = callbacks.onClose;
    this.onClear = callbacks.onClear;
    this.onFreeze = callbacks.onFreeze;
    this.ensureFallbackNodes();
    this.bind(this.closeButton, () => this.onClose?.());
    this.bind(this.clearButton, () => this.onClear?.());
    this.bind(this.freezeButton, () => this.onFreeze?.());
    this.hide();
  }

  applyLayout(visibleWidth: number, visibleHeight: number): void {
    this.visibleWidth = visibleWidth;
    this.visibleHeight = visibleHeight;
    if (!this.node.active) {
      return;
    }
    this.ensureFallbackNodes();
    this.layoutExistingNodes();
  }

  show(): void {
    this.ensureFallbackNodes();
    this.node.active = true;
    this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1);
  }

  hide(): void {
    this.node.active = false;
  }

  setLines(lines: string[]): void {
    if (!this.node.active) {
      return;
    }
    this.ensureFallbackNodes();
    if (this.bodyLabel) {
      this.bodyLabel.string = lines.join('\n');
    }
    this.layoutExistingNodes();
    this.scrollView?.scrollToBottom(0, false);
  }

  private ensureFallbackNodes(): void {
    if (this.nodesReady) {
      return;
    }
    const { panelWidth, panelHeight } = this.resolvePanelSize();
    ensureTransform(this.node, panelWidth, panelHeight);

    let scrollNode = this.node.getChildByName('LogScrollView');
    if (!scrollNode) {
      scrollNode = new Node('LogScrollView');
      scrollNode.setParent(this.node);
    }
    scrollNode.layer = this.node.layer;
    scrollNode.active = true;
    const mask = scrollNode.getComponent(Mask) ?? scrollNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;
    const scrollView = scrollNode.getComponent(ScrollView) ?? scrollNode.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.elastic = true;
    this.scrollView = scrollView;

    let contentNode = scrollNode.getChildByName('LogScrollContent');
    if (!contentNode) {
      contentNode = new Node('LogScrollContent');
      contentNode.setParent(scrollNode);
    }
    contentNode.layer = scrollNode.layer;
    contentNode.active = true;
    ensureTransform(contentNode, panelWidth - LOG_PANEL_MARGIN * 2, panelHeight).setAnchorPoint(0.5, 1);
    scrollView.content = contentNode;

    if (!this.bodyLabel) {
      let bodyNode = contentNode.getChildByName('BodyLabel');
      if (!bodyNode) {
        bodyNode = new Node('BodyLabel');
        bodyNode.setParent(contentNode);
      }
      bodyNode.layer = contentNode.layer;
      this.bodyLabel = bodyNode.getComponent(Label) ?? bodyNode.addComponent(Label);
      this.bodyLabel.fontSize = 13;
      this.bodyLabel.lineHeight = 18;
      this.bodyLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
      this.bodyLabel.enableWrapText = true;
      this.bodyLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
      this.bodyLabel.verticalAlign = VerticalTextAlignment.TOP;
    }

    this.closeButton ??= ensureButtonNode(this.node, 'CloseButton', 80, 34, 'Close', 'secondary').node;
    this.clearButton ??= ensureButtonNode(this.node, 'ClearButton', 80, 34, 'Clear', 'ghost').node;
    this.freezeButton ??= ensureButtonNode(this.node, 'FreezeButton', 90, 34, 'Freeze', 'ghost').node;
    this.nodesReady = true;
  }

  private bind(node: Node | null, handler: () => void): void {
    if (node) {
      bindButtonTouch(node, handler, this);
    }
  }

  private resolvePanelSize(): { panelWidth: number; panelHeight: number } {
    return {
      panelWidth: Math.max(
        LOG_PANEL_MIN_WIDTH,
        Math.min(LOG_PANEL_MAX_WIDTH, this.visibleWidth - LOG_PANEL_MARGIN * 2),
      ),
      panelHeight: Math.max(
        LOG_PANEL_MIN_HEIGHT,
        Math.min(LOG_PANEL_MAX_HEIGHT, this.visibleHeight - LOG_PANEL_MARGIN * 2),
      ),
    };
  }

  private layoutExistingNodes(): void {
    const { panelWidth, panelHeight } = this.resolvePanelSize();
    ensureTransform(this.node, panelWidth, panelHeight);

    const bodyWidth = panelWidth - LOG_PANEL_MARGIN * 2;
    const bodyHeight = panelHeight - LOG_PANEL_BUTTON_HEIGHT - LOG_PANEL_BODY_GAP - LOG_PANEL_MARGIN * 2;
    const scrollNode = this.node.getChildByName('LogScrollView');
    if (scrollNode) {
      scrollNode.setPosition(0, -LOG_PANEL_BUTTON_HEIGHT / 2 - LOG_PANEL_BODY_GAP / 2, 0);
      ensureTransform(scrollNode, bodyWidth, bodyHeight);
      const contentNode = scrollNode.getChildByName('LogScrollContent');
      if (contentNode) {
        const contentHeight = Math.max(bodyHeight, this.estimateBodyHeight(bodyWidth));
        ensureTransform(contentNode, bodyWidth, contentHeight).setAnchorPoint(0.5, 1);
        contentNode.setPosition(0, bodyHeight / 2, 0);
        const bodyNode = contentNode.getChildByName('BodyLabel');
        if (bodyNode) {
          bodyNode.setPosition(0, -contentHeight / 2, 0);
          ensureTransform(bodyNode, bodyWidth - 12, contentHeight);
        }
      }
    }

    const buttonTop = panelHeight / 2 - LOG_PANEL_MARGIN - LOG_PANEL_BUTTON_HEIGHT / 2;
    const buttonRight = panelWidth / 2 - LOG_PANEL_MARGIN;
    const closeWidth = 80;
    const clearWidth = 80;
    const freezeWidth = 90;
    if (this.closeButton) {
      this.closeButton.setPosition(
        buttonRight - freezeWidth - clearWidth - closeWidth / 2 - LOG_PANEL_BUTTON_GAP * 2,
        buttonTop,
        0,
      );
    }
    if (this.clearButton) {
      this.clearButton.setPosition(
        buttonRight - freezeWidth - clearWidth / 2 - LOG_PANEL_BUTTON_GAP,
        buttonTop,
        0,
      );
    }
    if (this.freezeButton) {
      this.freezeButton.setPosition(buttonRight - freezeWidth / 2, buttonTop, 0);
    }
  }

  private estimateBodyHeight(bodyWidth: number): number {
    if (!this.bodyLabel) {
      return LOG_PANEL_MIN_HEIGHT;
    }
    const labelWidth = bodyWidth - 12;
    const labelTransform = ensureTransform(this.bodyLabel.node, labelWidth, 1);
    this.bodyLabel.updateRenderData(true);
    const measuredHeight = Math.max(this.bodyLabel.lineHeight, labelTransform.contentSize.height);
    return Math.max(LOG_PANEL_MIN_HEIGHT, measuredHeight + LOG_PANEL_MARGIN);
  }
}
