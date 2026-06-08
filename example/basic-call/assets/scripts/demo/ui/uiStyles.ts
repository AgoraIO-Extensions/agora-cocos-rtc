import {
  Button,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  UITransform,
  VerticalTextAlignment,
} from 'cc';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'toggleOn' | 'toggleOff';

export const COLORS = {
  panelFill: new Color(12, 18, 28, 236),
  panelStroke: new Color(78, 112, 138, 210),
  textPrimary: new Color(230, 240, 250, 255),
  textMuted: new Color(166, 182, 198, 255),
  ok: new Color(28, 108, 88, 255),
  fail: new Color(178, 56, 56, 255),
  primary: new Color(42, 118, 178, 255),
  secondary: new Color(44, 58, 76, 255),
};

export function ensureTransform(node: Node, width: number, height: number): UITransform {
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  return transform;
}

export function configureLabel(label: Label, text: string, fontSize: number, color = COLORS.textPrimary): void {
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = fontSize + 4;
  label.useSystemFont = true;
  label.fontFamily = 'Arial';
  label.color = color;
  label.horizontalAlign = HorizontalTextAlignment.LEFT;
  label.verticalAlign = VerticalTextAlignment.CENTER;
}

export function drawPanel(graphics: Graphics, width: number, height: number): void {
  graphics.clear();
  graphics.fillColor = COLORS.panelFill;
  graphics.strokeColor = COLORS.panelStroke;
  graphics.lineWidth = 1;
  graphics.roundRect(-width / 2, -height / 2, width, height, 6);
  graphics.fill();
  graphics.stroke();
}

export function drawButton(graphics: Graphics, width: number, height: number, variant: ButtonVariant): void {
  graphics.clear();
  const fill = variant === 'primary'
    ? COLORS.primary
    : variant === 'danger'
      ? COLORS.fail
      : variant === 'toggleOn'
        ? COLORS.ok
        : COLORS.secondary;
  graphics.fillColor = fill;
  graphics.strokeColor = new Color(96, 130, 160, 220);
  graphics.lineWidth = 1;
  graphics.roundRect(-width / 2, -height / 2, width, height, 6);
  graphics.fill();
  graphics.stroke();
}

export function ensureButtonNode(
  parent: Node,
  name: string,
  width: number,
  height: number,
  text: string,
  variant: ButtonVariant,
): { node: Node; label: Label } {
  let node = parent.getChildByName(name);
  if (!node) {
    node = new Node(name);
    node.setParent(parent);
  }
  node.layer = parent.layer;
  node.active = true;
  ensureTransform(node, width, height);

  let bgNode = node.getChildByName('Background');
  if (!bgNode) {
    bgNode = new Node('Background');
    bgNode.setParent(node);
  }
  bgNode.layer = parent.layer;
  bgNode.setPosition(0, 0, 0);
  ensureTransform(bgNode, width, height);
  drawButton(bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics), width, height, variant);

  let labelNode = node.getChildByName('Label');
  if (!labelNode) {
    labelNode = new Node('Label');
    labelNode.setParent(node);
  }
  labelNode.layer = parent.layer;
  labelNode.setPosition(0, 0, 0);
  ensureTransform(labelNode, width - 8, height);
  const label = labelNode.getComponent(Label) ?? labelNode.addComponent(Label);
  configureLabel(label, text, 14);
  label.horizontalAlign = HorizontalTextAlignment.CENTER;

  node.getComponent(Button) ?? node.addComponent(Button);
  return { node, label };
}

export function ensureLabelNode(
  parent: Node,
  name: string,
  width: number,
  height: number,
  text: string,
  fontSize = 13,
  color = COLORS.textMuted,
): Label {
  let node = parent.getChildByName(name);
  if (!node) {
    node = new Node(name);
    node.setParent(parent);
  }
  node.layer = parent.layer;
  ensureTransform(node, width, height);
  const label = node.getComponent(Label) ?? node.addComponent(Label);
  configureLabel(label, text, fontSize, color);
  return label;
}

export function refreshButtonVariant(node: Node, width: number, height: number, variant: ButtonVariant): void {
  const bgNode = node.getChildByName('Background');
  if (!bgNode) {
    return;
  }
  drawButton(bgNode.getComponent(Graphics) ?? bgNode.addComponent(Graphics), width, height, variant);
}
