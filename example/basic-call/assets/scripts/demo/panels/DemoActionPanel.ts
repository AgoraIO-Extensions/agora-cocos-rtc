import { _decorator, Component, EditBox, Label, Mask, Node, ScrollView, UITransform } from 'cc';
import {
  ACTION_LABELS,
  ADVANCED_ACTIONS,
  BASIC_VIDEO_ACTION_SECTIONS,
  DEFAULT_BUTTON_LAYOUT,
} from '../actions.ts';
import { DEMO_CASES, type DemoCaseDefinition } from '../cases/caseRegistry.ts';
import type {
  ActionResult,
  BasicVideoConfigState,
  ChannelProfile,
  DemoSessionState,
  VideoEncoderPresetName,
} from '../types.ts';
import {
  bindButtonTouch,
  type ButtonVariant,
  COLORS,
  configureLabel,
  ensureButtonNode,
  ensureLabelNode,
  ensureTransform,
  refreshButtonVariant,
} from '../ui/uiStyles.ts';

const { ccclass, property } = _decorator;

type ActionCallbacks = {
  onAction: (actionName: string) => void;
  onApplyConfig: (config: Partial<BasicVideoConfigState>) => void;
  onSelectCase?: (caseName: string) => void;
  onBackToCases?: () => void | Promise<void>;
};

const CHANNEL_PROFILES: ChannelProfile[] = ['communication', 'liveBroadcasting'];
const VIDEO_ENCODERS: VideoEncoderPresetName[] = ['360p', '540p', '720p'];
const AUDIO_EFFECT_MIXING_CASE_NAME = 'AudioEffectMixing';
const ACTION_PANEL_WIDTH = 420;
const ACTION_PANEL_VIEW_HEIGHT = 620;
const ACTION_PANEL_CONTENT_WIDTH = 390;
const CONTENT_TOP_PADDING = 24;
const CONTENT_BOTTOM_PADDING = 28;
const SECTION_GAP = 18;
const CASE_ACTION_COLUMNS = 2;
const CASE_ACTION_ROW_GAP = 42;

@ccclass('DemoActionPanel')
export class DemoActionPanel extends Component {
  @property(Node)
  quickBar: Node | null = null;

  @property(Node)
  actionGrid: Node | null = null;

  private onAction: ((actionName: string) => void) | null = null;
  private onApplyConfig: ((config: Partial<BasicVideoConfigState>) => void) | null = null;
  private onSelectCase: ((caseName: string) => void) | null = null;
  private onBackToCases: (() => void | Promise<void>) | null = null;
  private config: BasicVideoConfigState | null = null;
  private sessionState: DemoSessionState | null = null;
  private cases: readonly DemoCaseDefinition[] = DEMO_CASES;
  private selectedCase: DemoCaseDefinition | null = null;
  private lastRenderedCaseName: string | null = null;
  private channelInput: EditBox | null = null;
  private uidInput: EditBox | null = null;
  private profileLabel: Label | null = null;
  private encoderLabel: Label | null = null;
  private statusLabel: Label | null = null;
  private advancedToggleLabel: Label | null = null;
  private advancedSection: Node | null = null;
  private advancedVisible = false;
  private labels = new Map<string, Label>();
  private buttonNodes = new Map<string, Node>();
  private buttonSizes = new Map<string, { width: number; height: number }>();
  private results = new Map<string, ActionResult>();
  private scrollView: ScrollView | null = null;
  private scrollContent: Node | null = null;
  private contentCursorY = -CONTENT_TOP_PADDING;
  private blurInputsTimer: ReturnType<typeof setTimeout> | null = null;

  initialize(callbacks: ActionCallbacks | ((actionName: string) => void)): void {
    if (typeof callbacks === 'function') {
      this.onAction = callbacks;
      this.onApplyConfig = null;
      this.onSelectCase = null;
      this.onBackToCases = null;
    } else {
      this.onAction = callbacks.onAction;
      this.onApplyConfig = callbacks.onApplyConfig;
      this.onSelectCase = callbacks.onSelectCase ?? null;
      this.onBackToCases = callbacks.onBackToCases ?? null;
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

  setCaseState(cases: readonly DemoCaseDefinition[], selectedCase: DemoCaseDefinition | null): void {
    this.cases = cases;
    this.selectedCase = selectedCase;
    this.ensureControls();
    this.scheduleBlurInputs();
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
    ensureTransform(this.node, ACTION_PANEL_WIDTH, ACTION_PANEL_VIEW_HEIGHT);
    this.ensureScrollContainers();
    if (this.quickBar) {
      this.quickBar.active = false;
    }
    if (this.actionGrid) {
      this.actionGrid.active = false;
    }
  }

  private ensureControls(): void {
    this.ensureContainers();
    const renderKey = this.selectedCase?.name ?? `__caseList:${this.cases.length}`;
    if (this.lastRenderedCaseName === renderKey) {
      return;
    }
    this.lastRenderedCaseName = renderKey;
    if (!this.selectedCase) {
      this.renderCaseList();
      return;
    }
    this.renderCaseControls();
  }

  private renderCaseList(): void {
    this.clearScrollContent();
    const content = this.requireScrollContent();
    this.resetContentFlow();
    ensureLabelNode(content, 'CaseListTitle', 360, 28, 'APIExample', 18, COLORS.textPrimary)
      .node.setPosition(0, this.contentCursorY - 14, 0);
    this.contentCursorY -= 58;

    let currentSection = '';
    for (const item of this.cases) {
      if (item.section !== currentSection) {
        currentSection = item.section;
        ensureLabelNode(content, `CaseSection_${currentSection}`, 360, 24, currentSection, 15, COLORS.textMuted)
          .node.setPosition(0, this.contentCursorY - 12, 0);
        this.contentCursorY -= 38;
      }
      const variant = item.name === AUDIO_EFFECT_MIXING_CASE_NAME ? 'primary' : 'secondary';
      const button = ensureButtonNode(content, `Case_${item.name}`, 330, 36, item.name, variant);
      button.node.setPosition(0, this.contentCursorY - 18, 0);
      bindButtonTouch(button.node, () => this.onSelectCase?.(item.name), this);
      this.contentCursorY -= 44;
    }
    this.applyContentHeight();
  }

  private renderCaseControls(): void {
    this.clearScrollContent();
    const content = this.requireScrollContent();
    this.resetContentFlow();
    ensureLabelNode(content, 'CaseTitle', 260, 28, this.selectedCase?.name ?? '', 16, COLORS.textPrimary)
      .node.setPosition(40, this.contentCursorY - 14, 0);
    const back = ensureButtonNode(content, 'BackButton', 92, 32, 'Back', 'ghost');
    back.node.setPosition(-140, this.contentCursorY - 14, 0);
    bindButtonTouch(back.node, () => { void this.onBackToCases?.(); }, this);
    this.contentCursorY -= 58;

    const connection = this.appendSection('ConnectionSection', 150);
    const optionsHeight = this.caseOptionsSectionHeight();
    const preview = this.appendSection('PreviewCameraSection', optionsHeight);
    const actionCount = this.selectedCase?.actions.length ?? 0;
    const actionHeight = this.caseActionSectionHeight(actionCount);
    const actions = this.appendSection('RenderEncoderSection', actionHeight);
    const diagnostics = this.appendSection('DiagnosticsSection', 92);

    this.buildConnectionSection(connection);
    this.buildSelectedCaseOptions(preview, optionsHeight);
    this.buildCaseActionButtons(actions, actionHeight);
    this.buildCaseUtilitySection(diagnostics);
    this.applyContentHeight();
  }

  private clearScrollContent(): void {
    const content = this.requireScrollContent();
    for (const child of [...content.children]) {
      child.removeFromParent();
      child.destroy();
    }
    this.labels.clear();
    this.buttonNodes.clear();
    this.buttonSizes.clear();
    this.channelInput = null;
    this.uidInput = null;
    this.profileLabel = null;
    this.encoderLabel = null;
    this.statusLabel = null;
    this.advancedToggleLabel = null;
    this.advancedSection = null;
    if (this.blurInputsTimer) {
      clearTimeout(this.blurInputsTimer);
      this.blurInputsTimer = null;
    }
  }

  private ensureScrollContainers(): void {
    let scrollNode = this.node.getChildByName('ActionScrollView');
    if (!scrollNode) {
      scrollNode = new Node('ActionScrollView');
      scrollNode.setParent(this.node);
    }
    scrollNode.layer = this.node.layer;
    scrollNode.active = true;
    scrollNode.setPosition(0, 0, 0);
    ensureTransform(scrollNode, ACTION_PANEL_WIDTH, ACTION_PANEL_VIEW_HEIGHT);

    const mask = scrollNode.getComponent(Mask) ?? scrollNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const scrollView = scrollNode.getComponent(ScrollView) ?? scrollNode.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;
    scrollView.inertia = true;
    scrollView.brake = 0.75;
    scrollView.elastic = true;

    let content = scrollNode.getChildByName('ActionScrollContent');
    if (!content) {
      content = new Node('ActionScrollContent');
      content.setParent(scrollNode);
    }
    content.layer = scrollNode.layer;
    content.active = true;
    const currentTransform = content.getComponent(UITransform);
    const currentHeight = currentTransform?.height ?? ACTION_PANEL_VIEW_HEIGHT;
    const transform = ensureTransform(
      content,
      ACTION_PANEL_CONTENT_WIDTH,
      Math.max(ACTION_PANEL_VIEW_HEIGHT, currentHeight),
    );
    transform.setAnchorPoint(0.5, 1);

    this.scrollView = scrollView;
    this.scrollContent = content;
    scrollView.content = this.scrollContent;
  }

  private requireScrollContent(): Node {
    this.ensureScrollContainers();
    if (!this.scrollContent) {
      throw new Error('ActionScrollContent is unavailable');
    }
    return this.scrollContent;
  }

  private resetContentFlow(): void {
    this.contentCursorY = -CONTENT_TOP_PADDING;
  }

  private appendSection(name: string, height: number): Node {
    const section = this.ensureContainer(
      this.requireScrollContent(),
      name,
      0,
      this.contentCursorY - height / 2,
      ACTION_PANEL_CONTENT_WIDTH,
      height,
    );
    this.contentCursorY -= height + SECTION_GAP;
    return section;
  }

  private applyContentHeight(): void {
    const content = this.requireScrollContent();
    const contentHeight = Math.max(
      ACTION_PANEL_VIEW_HEIGHT,
      Math.ceil(-this.contentCursorY + CONTENT_BOTTOM_PADDING),
    );
    const transform = ensureTransform(content, ACTION_PANEL_CONTENT_WIDTH, contentHeight);
    transform.setAnchorPoint(0.5, 1);
    this.scrollView?.scrollToTop(0, false);
  }

  private ensureContainer(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.active = true;
    node.setPosition(x, y, 0);
    ensureTransform(node, width, height);
    return node;
  }

  private buildConnectionSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Connection', 14, COLORS.textPrimary);
    title.node.setPosition(0, 58, 0);
    ensureLabelNode(parent, 'ChannelLabel', 174, 20, 'Channel', 12).node.setPosition(-92, 34, 0);
    ensureLabelNode(parent, 'UidLabel', 78, 20, 'UID', 12).node.setPosition(95, 34, 0);
    this.channelInput = this.ensureEditBox(parent, 'ChannelInput', -92, 8, 174, this.config?.channelId ?? 'demo');
    this.uidInput = this.ensureEditBox(parent, 'UidInput', 95, 8, 78, String(this.config?.uid ?? 0));
    this.statusLabel = ensureLabelNode(parent, 'StatusLabel', 360, 22, '', 12, COLORS.textMuted);
    this.statusLabel.node.setPosition(0, -22, 0);
    const join = this.ensureActionButton(parent, 'JoinChannel', 0, -52, 210, 38, 'primary');
    bindButtonTouch(join.node, () => {
      this.applyInputs();
      this.onAction?.('JoinChannel');
    }, this);
  }

  private buildPreviewSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Preview and camera', 14, COLORS.textPrimary);
    title.node.setPosition(0, 58, 0);
    this.buildButtonList(parent, ['StartPreview', 'SwitchCamera', 'MuteLocalVideo', 'MuteAllRemoteVideo'], 2, 20);
  }

  private buildRenderSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Render and encoder', 14, COLORS.textPrimary);
    title.node.setPosition(0, 48, 0);
    this.profileLabel = this.ensureToggleButton(parent, 'ProfileToggle', -72, 10, 132, 'secondary', () => this.cycleProfile());
    this.encoderLabel = this.ensureToggleButton(parent, 'EncoderToggle', 72, 10, 132, 'secondary', () => this.cycleEncoder());
    this.buildButtonList(parent, ['ApplyEncoder'], 1, -44);
  }

  private buildDiagnosticsSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 22, 'Diagnostics', 14, COLORS.textPrimary);
    title.node.setPosition(0, 32, 0);
    this.buildButtonList(parent, ['RefreshViews', 'OpenLog'], 2, -6);
    const advanced = ensureButtonNode(parent, 'AdvancedToggle', 118, 32, 'Advanced', 'ghost');
    advanced.node.setPosition(132, -6, 0);
    this.advancedToggleLabel = advanced.label;
    bindButtonTouch(advanced.node, () => {
      this.advancedVisible = !this.advancedVisible;
      if (this.advancedSection) {
        this.advancedSection.active = this.advancedVisible;
      }
      this.refreshAdvancedToggle();
    }, this);
  }

  private buildAdvancedSection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 22, 'Advanced', 14, COLORS.textPrimary);
    title.node.setPosition(0, 82, 0);
    const names = BASIC_VIDEO_ACTION_SECTIONS.find((section) => section.title === 'Advanced')?.buttons
      ?? ADVANCED_ACTIONS.map((action) => action.name);
    this.buildButtonList(parent, [...names], 3, 50, 112, 28, 118, 34);
  }

  private buildSelectedCaseOptions(parent: Node, sectionHeight: number): void {
    const titleY = sectionHeight / 2 - 18;
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Case options', 14, COLORS.textPrimary);
    title.node.setPosition(0, titleY, 0);
    switch (this.selectedCase?.name) {
      case 'AudioEffectMixing':
        this.buildAudioEffectMixingControls(parent, titleY);
        return;
      case 'SetBeautyEffect':
        this.buildBeautyControls(parent, titleY);
        return;
      case 'SetVideoEncoderConfiguration':
        this.buildEncoderControls(parent, titleY);
        return;
      case 'SetContentInspect':
        this.buildContentInspectControls(parent, titleY);
        return;
      default:
        ensureLabelNode(parent, 'DefaultCaseOptionsLabel', 340, 20, `Mode: ${this.selectedCase?.displayMode ?? 'audio'}`, 11, COLORS.textMuted)
          .node.setPosition(0, titleY - 36, 0);
    }
  }

  private buildAudioEffectMixingControls(parent: Node, titleY: number): void {
    const state = this.sessionState?.audioEffectMixing;
    ensureLabelNode(parent, 'AudioEffectUrlLabel', 340, 20, 'Effect: webdemo.agora.io/ding.mp3', 11, COLORS.textMuted)
      .node.setPosition(0, titleY - 30, 0);
    ensureLabelNode(parent, 'AudioMixingAssetLabel', 340, 20, 'Mixing: Agora.io-Interactions.mp3', 11, COLORS.textMuted)
      .node.setPosition(0, titleY - 54, 0);
    ensureLabelNode(parent, 'AudioMixingStateLabel', 340, 20, state?.remoteAudioStateSummary ?? '-', 11, COLORS.textMuted)
      .node.setPosition(0, titleY - 78, 0);
  }

  private buildBeautyControls(parent: Node, titleY: number): void {
    ensureLabelNode(parent, 'BeautyOptionsLabel', 340, 20, 'Beauty: contrast / lightening / smooth / red / sharp', 11, COLORS.textMuted)
      .node.setPosition(0, titleY - 36, 0);
  }

  private buildEncoderControls(parent: Node, titleY: number): void {
    ensureLabelNode(parent, 'EncoderOptionsLabel', 340, 20, 'Encoder: 640x480 / 480x480 / 480x240', 11, COLORS.textMuted)
      .node.setPosition(0, titleY - 36, 0);
  }

  private buildContentInspectControls(parent: Node, titleY: number): void {
    ensureLabelNode(parent, 'ContentInspectOptionsLabel', 340, 20, 'ContentInspect: module 0 interval 2s', 11, COLORS.textMuted)
      .node.setPosition(0, titleY - 36, 0);
  }

  private buildCaseActionButtons(parent: Node, sectionHeight: number): void {
    const titleY = sectionHeight / 2 - 18;
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 24, 'Actions', 14, COLORS.textPrimary);
    title.node.setPosition(0, titleY, 0);
    const selectedCase = this.selectedCase;
    const names = selectedCase ? selectedCase.actions.filter((name) => name !== 'JoinChannel') : [];
    this.buildButtonList(parent, [...names], CASE_ACTION_COLUMNS, titleY - 38, 176, 32, 184, CASE_ACTION_ROW_GAP);
  }

  private caseOptionsSectionHeight(): number {
    return this.selectedCase?.name === AUDIO_EFFECT_MIXING_CASE_NAME ? 124 : 82;
  }

  private caseActionSectionHeight(actionCount: number): number {
    const rows = Math.max(1, Math.ceil(actionCount / CASE_ACTION_COLUMNS));
    return 96 + (rows - 1) * CASE_ACTION_ROW_GAP;
  }

  private buildCaseUtilitySection(parent: Node): void {
    const title = ensureLabelNode(parent, 'SectionTitle', 360, 22, 'Diagnostics', 14, COLORS.textPrimary);
    title.node.setPosition(0, 32, 0);
    this.buildButtonList(parent, ['RefreshViews', 'OpenLog'], 2, -6);
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
    bindButtonTouch(node, () => this.onAction?.(name), this);
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
    bindButtonTouch(node, handler, this);
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
    editBox.placeholder = name === 'UidInput' ? '0' : 'demo';
    editBox.textLabel = this.ensureEditBoxLabel(node, 'TEXT_LABEL', width - 12, value, COLORS.textPrimary);
    editBox.placeholderLabel = this.ensureEditBoxLabel(node, 'PLACEHOLDER_LABEL', width - 12, editBox.placeholder, COLORS.textMuted);
    editBox.string = editBox.string || value;
    editBox.maxLength = name === 'UidInput' ? 10 : 64;
    return editBox;
  }

  private blurInputs(): void {
    this.channelInput?.blur?.();
    this.uidInput?.blur?.();
  }

  private scheduleBlurInputs(): void {
    if (this.blurInputsTimer) {
      clearTimeout(this.blurInputsTimer);
    }
    this.blurInputsTimer = setTimeout(() => {
      this.blurInputsTimer = null;
      this.blurInputs();
    }, 0);
  }

  private ensureEditBoxLabel(parent: Node, name: string, width: number, text: string, color = COLORS.textPrimary): Label {
    let node = parent.getChildByName(name);
    if (!node) {
      node = new Node(name);
      node.setParent(parent);
    }
    node.layer = parent.layer;
    node.setPosition(0, 0, 0);
    ensureTransform(node, width, 28);
    const label = node.getComponent(Label) ?? node.addComponent(Label);
    label.horizontalAlign = 1;
    label.verticalAlign = 1;
    label.overflow = 1;
    configureLabel(label, text, 16, color);
    return label;
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
    if (name === 'PlayEffect') {
      return this.sessionState?.audioEffectMixing.effectPlaying ? 'Stop Effect' : 'Play Effect';
    }
    if (name === 'StartAudioMixing') {
      return this.sessionState?.audioEffectMixing.audioMixingStarted ? 'Stop Mixing' : 'Start Mixing';
    }
    if (name === 'SetEffectsVolume') {
      return `Effect ${this.sessionState?.audioEffectMixing.effectsVolume ?? 100}`;
    }
    if (name === 'AudioMixingPublishVolume') {
      return `Pub ${this.sessionState?.audioEffectMixing.audioMixingPublishVolume ?? 100}`;
    }
    if (name === 'AudioMixingPlayoutVolume') {
      return `Play ${this.sessionState?.audioEffectMixing.audioMixingPlayoutVolume ?? 100}`;
    }
    if (name === 'AudioMixingVolume') {
      return `Mix ${this.sessionState?.audioEffectMixing.audioMixingVolume ?? 100}`;
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
    if (name === 'PlayEffect' && this.sessionState?.audioEffectMixing.effectPlaying) {
      return 'toggleOn';
    }
    if (name === 'StartAudioMixing' && this.sessionState?.audioEffectMixing.audioMixingStarted) {
      return 'toggleOn';
    }
    return this.defaultVariantForAction(name);
  }

  private refreshConfigLabels(): void {
    if (this.profileLabel) {
      this.profileLabel.string = `Profile\n${this.config?.channelProfile ?? 'communication'}`;
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
      uid: Number.isFinite(parsedUid) ? Math.max(0, Math.floor(parsedUid)) : this.config?.uid ?? 0,
    });
  }

  private cycleProfile(): void {
    const current = this.config?.channelProfile ?? 'communication';
    const index = CHANNEL_PROFILES.indexOf(current);
    const next = CHANNEL_PROFILES[(index + 1) % CHANNEL_PROFILES.length];
    this.onApplyConfig?.({ channelProfile: next });
  }

  private cycleEncoder(): void {
    const current = this.config?.videoEncoderPresetName ?? '360p';
    const index = VIDEO_ENCODERS.indexOf(current);
    const next = VIDEO_ENCODERS[(index + 1) % VIDEO_ENCODERS.length];
    this.onApplyConfig?.({ videoEncoderPresetName: next });
  }
}
