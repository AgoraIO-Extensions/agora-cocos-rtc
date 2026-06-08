import { _decorator, Component, EditBox, Label, Node } from 'cc';
import {
  ACTION_LABELS,
  ADVANCED_ACTIONS,
  BASIC_VIDEO_ACTION_SECTIONS,
  DEFAULT_BUTTON_LAYOUT,
} from '../actions.ts';
import type {
  ActionResult,
  BasicVideoConfigState,
  ChannelProfile,
  DemoSessionState,
  RenderBackend,
  VideoEncoderPresetName,
} from '../types.ts';
import {
  type ButtonVariant,
  COLORS,
  ensureButtonNode,
  ensureLabelNode,
  ensureTransform,
  refreshButtonVariant,
} from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;

type ActionCallbacks = {
  onAction: (actionName: string) => void;
  onApplyConfig: (config: Partial<BasicVideoConfigState>) => void;
};

const CHANNEL_PROFILES: ChannelProfile[] = ['communication', 'liveBroadcasting'];
const RENDER_BACKENDS: RenderBackend[] = ['engine-texture', 'surface-view', 'texture-view'];
const VIDEO_ENCODERS: VideoEncoderPresetName[] = ['360p', '540p', '720p'];

@ccclass('DemoActionPanel')
export class DemoActionPanel extends Component {
  @property(Node)
  quickBar: Node | null = null;

  @property(Node)
  actionGrid: Node | null = null;

  private onAction: ((actionName: string) => void) | null = null;
  private onApplyConfig: ((config: Partial<BasicVideoConfigState>) => void) | null = null;
  private config: BasicVideoConfigState | null = null;
  private sessionState: DemoSessionState | null = null;
  private channelInput: EditBox | null = null;
  private uidInput: EditBox | null = null;
  private profileLabel: Label | null = null;
  private renderLabel: Label | null = null;
  private encoderLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private advancedToggleLabel: Label | null = null;
  private advancedSection: Node | null = null;
  private advancedVisible = false;
  private labels = new Map<string, Label>();
  private buttonNodes = new Map<string, Node>();
  private buttonSizes = new Map<string, { width: number; height: number }>();
  private results = new Map<string, ActionResult>();

  initialize(callbacks: ActionCallbacks | ((actionName: string) => void)): void {
    if (typeof callbacks === 'function') {
      this.onAction = callbacks;
      this.onApplyConfig = null;
    } else {
      this.onAction = callbacks.onAction;
      this.onApplyConfig = callbacks.onApplyConfig;
    }
    this.ensureContainers();
    this.ensureControls();
    this.refresh();
  }

  setConfig(config: BasicVideoConfigState): void {
    this.config = config;
    this.ensureControls();
    if (this.channelInput && this.channelInput.string !== config.channelId) {
      this.channelInput.string = config.channelId;
    }
    if (this.uidInput && this.uidInput.string !== String(config.uid)) {
      this.uidInput.string = String(config.uid);
    }
    this.refresh();
  }

  setSessionState(state: DemoSessionState): void {
    this.sessionState = state;
    this.refresh();
  }

  setActionResult(actionName: string, result: ActionResult): void {
    this.results.set(actionName, result);
    this.refreshButton(actionName);
  }

  refresh(): void {
    this.refreshConfigLabels();
    this.refreshStatus();
    this.refreshAdvancedToggle();
    for (const button of DEFAULT_BUTTON_LAYOUT) {
      this.refreshButton(button.name);
    }
  }

  private ensureContainers(): void {
    ensureTransform(this.node, 420, 620);
    if (this.quickBar) {
      this.quickBar.active = false;
    }
    if (this.actionGrid) {
      this.actionGrid.active = false;
    }
  }

  private ensureControls(): void {
    this.ensureContainers();
    const connection = this.ensureContainer('ConnectionSection', 0, 230, 390, 150);
    const preview = this.ensureContainer('PreviewCameraSection', 0, 70, 390, 150);
    const render = this.ensureContainer('RenderEncoderSection', 0, -80, 390, 130);
    const diagnostics = this.ensureContainer('DiagnosticsSection', 0, -205, 390, 92);
    this.advancedSection = this.ensureContainer('AdvancedSection', 0, -355, 390, 190);
    this.advancedSection.active = this.advancedVisible;

    this.buildConnectionSection(connection);
    this.buildPreviewSection(preview);
    this.buildRenderSection(render);
    this.buildDiagnosticsSection(diagnostics);
    this.buildAdvancedSection(this.advancedSection);
  }

  private ensureContainer(name: string, x: number, y: number, width: number, height: number): Node {
    let node = this.node.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(this.node);
    }
    node.layer = this.node.layer;
    node.active = true;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, height);
    return node;
  }

  private buildConnectionSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Connection', 14, COLORS.textPrimary);
    title.node.setPosition(-180, 58, 0);
    ensureLabelNode(parent, 'ChannelLabel', 174, 20, 'Channel', 12).node.setPosition(-92, 34, 0);
    ensureLabelNode(parent, 'UidLabel', 78, 20, 'UID', 12).node.setPosition(95, 34, 0);
    this.channelInput = this.ensureEditBox(parent, 'ChannelInput', -92, 8, 174, this.config?.channelId ?? 'demo');
    this.uidInput = this.ensureEditBox(parent, 'UidInput', 95, 8, 78, String(this.config?.uid ?? 1001));
    this.statusLabel = ensureLabelNode(parent, 'StatusLabel', 360, 22, '', 12, COLORS.textMuted);
    this.statusLabel.node.setPosition(-180, -22, 0);
    const join = this.ensureActionButton(parent, 'JoinChannel', 0, -52, 210, 38, 'primary');
    join.node.off(Node.EventType.TOUCH_END);
    join.node.on(Node.EventType.TOUCH_END, () => {
      this.applyInputs();
      this.onAction?.('JoinChannel');
    }, this);
  }

  private buildPreviewSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Preview and camera', 14, COLORS.textPrimary);
    title.node.setPosition(-180, 58, 0);
    this.buildButtonList(parent, ['StartPreview', 'SwitchCamera', 'MuteLocalVideo', 'MuteAllRemoteVideo'], 2, 20);
  }

  private buildRenderSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Render and encoder', 14, COLORS.textPrimary);
    title.node.setPosition(-180, 48, 0);
    this.profileLabel = this.ensureToggleButton(parent, 'ProfileToggle', -120, 10, 112, 'secondary', () => this.cycleProfile());
    this.renderLabel = this.ensureToggleButton(parent, 'RenderToggle', 0, 10, 112, 'secondary', () => this.cycleRenderBackend());
    this.encoderLabel = this.ensureToggleButton(parent, 'EncoderToggle', 120, 10, 112, 'secondary', () => this.cycleEncoder());
    this.buildButtonList(parent, ['ApplyEncoder'], 1, -44);
  }

  private buildDiagnosticsSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 22, 'Diagnostics', 14, COLORS.textPrimary);
    title.node.setPosition(-180, 32, 0);
    this.buildButtonList(parent, ['RefreshViews', 'OpenLog'], 2, -6);
    const advanced = ensureButtonNode(parent, 'AdvancedToggle', 118, 32, 'Advanced', 'ghost');
    advanced.node.setPosition(132, -6, 0);
    this.advancedToggleLabel = advanced.label;
    advanced.node.off(Node.EventType.TOUCH_END);
    advanced.node.on(Node.EventType.TOUCH_END, () => {
      this.advancedVisible = !this.advancedVisible;
      if (this.advancedSection) {
        this.advancedSection.active = this.advancedVisible;
      }
      this.refreshAdvancedToggle();
    }, this);
  }

  private buildAdvancedSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 22, 'Advanced', 14, COLORS.textPrimary);
    title.node.setPosition(-180, 82, 0);
    const names = BASIC_VIDEO_ACTION_SECTIONS.find((section) => section.title === 'Advanced')?.buttons
      ?? ADVANCED_ACTIONS.map((action) => action.name);
    this.buildButtonList(parent, [...names], 3, 50, 112, 28, 118, 34);
  }

  private buildButtonList(
    parent: Node,
    names: string[],
    columns: number,
    yOffset: number,
    width = columns === 1 ? 210 : 176,
    height = 34,
    columnGap = 184,
    rowGap = 42,
  ): void {
    names.forEach((name, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = (column - (columns - 1) / 2) * columnGap;
      const y = yOffset - row * rowGap;
      this.ensureActionButton(parent, name, x, y, width, height, this.defaultVariantForAction(name));
    });
  }

  private ensureActionButton(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    variant: ButtonVariant,
  ): { node: Node; label: Label } {
    const { node, label } = ensureButtonNode(parent, `Action_${name}`, width, height, ACTION_LABELS[name] ?? name, variant);
    node.setPosition(x, y, 0);
    node.off(Node.EventType.TOUCH_END);
    node.on(Node.EventType.TOUCH_END, () => this.onAction?.(name), this);
    this.labels.set(name, label);
    this.buttonNodes.set(name, node);
    this.buttonSizes.set(name, { width, height });
    return { node, label };
  }

  private ensureToggleButton(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    variant: ButtonVariant,
    handler: () => void,
  ): Label {
    const { node, label } = ensureButtonNode(parent, name, width, 34, '', variant);
    node.setPosition(x, y, 0);
    node.off(Node.EventType.TOUCH_END);
    node.on(Node.EventType.TOUCH_END, handler, this);
    return label;
  }

  private ensureEditBox(parent: Node, name: string, x: number, y: number, width: number, value: string): EditBox {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, 30);
    const editBox = node.getComponent(EditBox) ?? node.addComponent(EditBox);
    editBox.string = editBox.string || value;
    editBox.placeholder = name === 'UidInput' ? '1001' : 'demo';
    return editBox;
  }

  private refreshButton(name: string): void {
    const label = this.labels.get(name);
    if (!label) {
      return;
    }
    const result = this.results.get(name) ?? 'idle';
    const baseLabel = this.dynamicActionLabel(name);
    const suffix = result === 'ok' ? ' OK' : result === 'fail' ? ' FAIL' : '';
    label.string = `${baseLabel}${suffix}`;
    const node = this.buttonNodes.get(name);
    const size = this.buttonSizes.get(name);
    if (node && size) {
      refreshButtonVariant(node, size.width, size.height, this.variantForActionState(name));
    }
  }

  private dynamicActionLabel(name: string): string {
    if (name === 'JoinChannel' && this.sessionState?.joined) {
      return 'Leave Channel';
    }
    if (name === 'StartPreview' && this.sessionState?.previewStarted) {
      return 'Stop Preview';
    }
    if (name === 'MuteLocalVideo') {
      return this.sessionState?.localVideoMuted ? 'Camera Off' : 'Camera On';
    }
    if (name === 'MuteAllRemoteVideo') {
      return this.sessionState?.allRemoteVideoMuted ? 'Remote Video Off' : 'Remote Video On';
    }
    return ACTION_LABELS[name] ?? name;
  }

  private defaultVariantForAction(name: string): ButtonVariant {
    if (name === 'JoinChannel') {
      return 'primary';
    }
    if (name === 'Leave') {
      return 'danger';
    }
    return 'secondary';
  }

  private variantForActionState(name: string): ButtonVariant {
    if (name === 'JoinChannel' && this.sessionState?.joined) {
      return 'danger';
    }
    if (name === 'StartPreview' && this.sessionState?.previewStarted) {
      return 'toggleOn';
    }
    if (name === 'MuteLocalVideo' && !this.sessionState?.localVideoMuted) {
      return 'toggleOn';
    }
    if (name === 'MuteAllRemoteVideo' && !this.sessionState?.allRemoteVideoMuted) {
      return 'toggleOn';
    }
    return this.defaultVariantForAction(name);
  }

  private refreshConfigLabels(): void {
    if (this.profileLabel) {
      this.profileLabel.string = `Profile\n${this.config?.channelProfile ?? 'communication'}`;
    }
    if (this.renderLabel) {
      this.renderLabel.string = `Render\n${this.config?.renderBackend ?? 'engine-texture'}`;
    }
    if (this.encoderLabel) {
      this.encoderLabel.string = `Encoder\n${this.config?.videoEncoderPresetName ?? '360p'}`;
    }
  }

  private refreshStatus(): void {
    if (!this.statusLabel) {
      return;
    }
    const state = this.sessionState;
    const initialized = state?.initialized ? 'ready' : 'idle';
    const joined = state?.joined ? 'joined' : 'not joined';
    const remoteCount = state?.remoteUserUids.length ?? 0;
    this.statusLabel.string = `${initialized} · ${joined} · remote ${remoteCount}`;
  }

  private refreshAdvancedToggle(): void {
    if (this.advancedToggleLabel) {
      this.advancedToggleLabel.string = this.advancedVisible ? 'Hide Advanced' : 'Advanced';
    }
  }

  private applyInputs(): void {
    const parsedUid = Number(this.uidInput?.string ?? '');
    this.onApplyConfig?.({
      channelId: this.channelInput?.string.trim() || this.config?.channelId || 'demo',
      uid: Number.isFinite(parsedUid) ? Math.max(0, Math.floor(parsedUid)) : this.config?.uid ?? 1001,
    });
  }

  private cycleProfile(): void {
    const current = this.config?.channelProfile ?? 'communication';
    const index = CHANNEL_PROFILES.indexOf(current);
    const next = CHANNEL_PROFILES[(index + 1) % CHANNEL_PROFILES.length];
    this.onApplyConfig?.({ channelProfile: next });
  }

  private cycleRenderBackend(): void {
    const current = this.config?.renderBackend ?? 'engine-texture';
    const index = RENDER_BACKENDS.indexOf(current);
    const next = RENDER_BACKENDS[(index + 1) % RENDER_BACKENDS.length];
    this.onApplyConfig?.({ renderBackend: next });
  }

  private cycleEncoder(): void {
    const current = this.config?.videoEncoderPresetName ?? '360p';
    const index = VIDEO_ENCODERS.indexOf(current);
    const next = VIDEO_ENCODERS[(index + 1) % VIDEO_ENCODERS.length];
    this.onApplyConfig?.({ videoEncoderPresetName: next });
  }
}
