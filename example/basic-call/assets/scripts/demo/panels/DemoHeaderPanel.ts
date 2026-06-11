import { _decorator, Component, EditBox, Label, Node } from 'cc';
import type { DemoSessionState, RuntimeConfigState } from '../types.ts';
import { bindButtonTouch, COLORS, configureLabel, ensureButtonNode, ensureTransform } from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;

@ccclass('DemoHeaderPanel')
export class DemoHeaderPanel extends Component {
  @property(Label)
  configLabel: Label | null = null;

  @property(Label)
  summaryLabel: Label | null = null;

  @property(EditBox)
  channelInput: EditBox | null = null;

  @property(EditBox)
  uidInput: EditBox | null = null;

  @property(Node)
  logButton: Node | null = null;

  @property(Node)
  applyButton: Node | null = null;

  private onOpenLog: (() => void) | null = null;
  private onApplyConfig: ((channelId: string, uid: number) => void) | null = null;

  initialize(callbacks: {
    onOpenLog: () => void;
    onApplyConfig: (channelId: string, uid: number) => void;
  }): void {
    this.onOpenLog = callbacks.onOpenLog;
    this.onApplyConfig = callbacks.onApplyConfig;
    this.ensureFallbackNodes();
    this.bind(this.logButton, () => this.onOpenLog?.());
    this.bind(this.applyButton, () => this.applyConfigFromInputs());
  }

  setConfig(config: RuntimeConfigState): void {
    this.ensureFallbackNodes();
    if (this.configLabel) {
      const tokenState = config.token ? 'configured' : 'not configured';
      this.configLabel.string = `App ${this.maskAppId(config.appId)}  ·  Token ${tokenState}\nChannel ${config.channelId}  ·  UID ${config.uid}\nRender ${config.renderBackend}`;
    }
    if (this.channelInput && this.channelInput.string !== config.channelId) {
      this.channelInput.string = config.channelId;
    }
    if (this.uidInput && this.uidInput.string !== String(config.uid)) {
      this.uidInput.string = String(config.uid);
    }
  }

  setSummary(state: DemoSessionState): void {
    this.ensureFallbackNodes();
    if (!this.summaryLabel) {
      return;
    }
    this.summaryLabel.string = [
      `Initialized ${state.initialized ? 'yes' : 'no'} · Joined ${state.joined ? 'yes' : 'no'} · Preview ${state.previewStarted ? 'on' : 'off'}`,
      `Remote users ${state.remoteUserUids.length} · Last error ${state.lastErrorMessage}`,
      `RTC ${state.lastRtcStatsSummary} · Volume ${state.lastVolumeSummary}`,
    ].join('\n');
  }

  applyConfigFromInputs(): void {
    const channelId = this.channelInput?.string.trim() || 'demo';
    const parsedUid = Number(this.uidInput?.string ?? '');
    const uid = Number.isFinite(parsedUid) && parsedUid >= 0 ? Math.floor(parsedUid) : 0;
    this.onApplyConfig?.(channelId, uid);
  }

  private ensureFallbackNodes(): void {
    ensureTransform(this.node, 420, 150);
    this.configLabel ??= this.ensureLabel('ConfigLabel', 400, 64, 0, 42, COLORS.textPrimary);
    this.summaryLabel ??= this.ensureLabel('SummaryLabel', 400, 64, 0, -24, COLORS.textMuted);

    if (!this.channelInput) {
      this.channelInput = this.ensureEditBox('ChannelInput', -110, -74, 150, 'channel');
    }
    if (!this.uidInput) {
      this.uidInput = this.ensureEditBox('UidInput', 50, -74, 78, 'uid');
    }
    if (!this.applyButton) {
      this.applyButton = ensureButtonNode(this.node, 'ApplyButton', 70, 32, 'Apply', 'secondary').node;
      this.applyButton.setPosition(150, -74, 0);
    }
    if (!this.logButton) {
      this.logButton = ensureButtonNode(this.node, 'LogButton', 64, 32, 'Log', 'primary').node;
      this.logButton.setPosition(220, 48, 0);
    }
  }

  private ensureLabel(name: string, width: number, height: number, x: number, y: number, color = COLORS.textPrimary): Label {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(this.node);
    }
    node.layer = this.node.layer;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, height);
    const label = node.getComponent(Label) ?? node.addComponent(Label);
    configureLabel(label, '', 14, color);
    return label;
  }

  private ensureEditBox(name: string, x: number, y: number, width: number, placeholder: string): EditBox {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(this.node);
    }
    node.layer = this.node.layer;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, 30);
    const editBox = node.getComponent(EditBox) ?? node.addComponent(EditBox);
    editBox.placeholder = placeholder;
    return editBox;
  }

  private bind(node: Node | null, handler: () => void): void {
    if (node) {
      bindButtonTouch(node, handler, this);
    }
  }

  private maskAppId(appId: string): string {
    if (appId.length <= 8) {
      return appId || '-';
    }
    return `${appId.slice(0, 4)}...${appId.slice(-4)}`;
  }
}
