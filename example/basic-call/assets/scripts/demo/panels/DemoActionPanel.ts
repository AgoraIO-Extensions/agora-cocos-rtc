import { _decorator, Component, Label, Node } from 'cc';
import { ACTION_LABELS, BUTTON_SECTION_LAYOUT, DEFAULT_BUTTON_LAYOUT, SESSION_QUICK_BUTTONS } from '../actions.ts';
import type { ActionResult } from '../types.ts';
import { ensureButtonNode, ensureTransform } from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;

@ccclass('DemoActionPanel')
export class DemoActionPanel extends Component {
  @property(Node)
  quickBar: Node | null = null;

  @property(Node)
  actionGrid: Node | null = null;

  private onAction: ((actionName: string) => void) | null = null;
  private labels = new Map<string, Label>();
  private results = new Map<string, ActionResult>();

  initialize(onAction: (actionName: string) => void): void {
    this.onAction = onAction;
    this.ensureContainers();
    this.ensureButtons();
    this.refresh();
  }

  setActionResult(actionName: string, result: ActionResult): void {
    this.results.set(actionName, result);
    this.refreshButton(actionName);
  }

  refresh(): void {
    for (const button of DEFAULT_BUTTON_LAYOUT) {
      this.refreshButton(button.name);
    }
  }

  private ensureContainers(): void {
    ensureTransform(this.node, 420, 390);
    if (!this.quickBar) {
      this.quickBar = this.ensureContainer('QuickBar', 0, 160, 400, 44);
    }
    if (!this.actionGrid) {
      this.actionGrid = this.ensureContainer('ActionGrid', 0, 78, 400, 300);
    }
  }

  private ensureContainer(name: string, x: number, y: number, width: number, height: number): Node {
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

  private ensureButtons(): void {
    this.ensureButtonList(this.quickBar ?? this.node, [...SESSION_QUICK_BUTTONS], 3, 0);
    const names = BUTTON_SECTION_LAYOUT.flatMap((section) => [...section.buttons]);
    this.ensureButtonList(this.actionGrid ?? this.node, names, 3, 0);
  }

  private ensureButtonList(parent: Node, names: string[], columns: number, yOffset: number): void {
    names.forEach((name, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const { node, label } = ensureButtonNode(parent, `Action_${name}`, 124, 36, ACTION_LABELS[name] ?? name, 'secondary');
      node.setPosition((column - 1) * 132, yOffset - row * 44, 0);
      this.labels.set(name, label);
      node.off(Node.EventType.TOUCH_END);
      node.on(Node.EventType.TOUCH_END, () => this.onAction?.(name), this);
    });
  }

  private refreshButton(name: string): void {
    const label = this.labels.get(name);
    if (!label) {
      return;
    }
    const result = this.results.get(name) ?? 'idle';
    const suffix = result === 'ok' ? ' OK' : result === 'fail' ? ' FAIL' : '';
    label.string = `${ACTION_LABELS[name] ?? name}${suffix}`;
  }
}
