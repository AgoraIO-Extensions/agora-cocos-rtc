# Agora Cocos RTC PoC — 工程交接文档

> **文档类型**：架构 + UI + API + 测试 + 日志子系统全量交接  
> **主工程路径**：`/Users/zhugaopeng/Work/agora-cocos-rtc`  
> **核心示例代码**：`example/basic-call/assets/scripts/AgoraRtcExampleController.ts`（约 4200 行）  
> **更新依据**：仓库当前代码与 2026-05 多轮真机/模拟器联调结论  

---

## 目录

1. [项目目标与仓库结构](#1-项目目标与仓库结构)
2. [架构设计](#2-架构设计)
3. [UI 设计](#3-ui-设计)
4. [API 实现与调用链](#4-api-实现与调用链)
5. [运行日志子系统（Log UI）](#5-运行日志子系统log-ui)
6. [测试方法与验证记录](#6-测试方法与验证记录)
7. [构建与调试命令](#7-构建与调试命令)
8. [已知问题与禁止事项](#8-已知问题与禁止事项)
9. [接手建议（优先级）](#9-接手建议优先级)
10. [关键文件索引](#10-关键文件索引)

---

## 1. 项目目标与仓库结构

### 1.1 目标

在 **Cocos Creator 3.8.x** 上验证 **Agora RTC 4.5.3** 的最小可用链路：

- TypeScript SDK 对外统一 API
- Android / iOS 原生桥接
- 三种视频渲染后端：`surface-view` / `texture-view` / `engine-texture`
- Example 提供 **QA 测试面板**（按钮、状态、全屏日志、本地/远端画面）

**不是**把 Agora App 嵌进 Cocos，而是：**Cocos 管页面，Agora 管 RTC 能力**。

### 1.2 目录

| 路径 | 职责 |
|------|------|
| `sdk/agora-rtc/` | 对客户交付的 SDK/plugin 源码（TS + 原生模板 + `sdk-config.json`） |
| `example/basic-call/` | Cocos 示例工程（单场景 `main.scene`） |
| `tests/` | Node 单元/结构测试（不启动 Cocos） |
| `scripts/` | `prepare-example`、`dev-ios`、`dev-android`、打包等 |
| `docs/` | 架构、构建、客户接入、API 矩阵 |

### 1.3 场景与挂载方式

- **唯一场景**：`example/basic-call/assets/scene/main.scene`
- **不在场景里序列化 Controller**（避免 Creator 覆盖动态 UI）
- **运行时挂载**：
  - `assets/scripts/AgoraRtcExampleBootstrap.ts` 在 `Director.EVENT_AFTER_SCENE_LAUNCH` 后把 `AgoraRtcExampleController` 加到 `Canvas`
  - 然后调用 `initializeUi()`

```text
main.scene (Canvas)
  └── [运行时] AgoraRtcExampleController
        └── 动态创建 __qa_left_pane / __qa_right_pane / __log_float_btn / __qa_log_page ...
```

---

## 2. 架构设计

### 2.1 五层模型

```text
┌─────────────────────────────────────────────────────────┐
│ 1. Example / QA 页面层                                   │
│    AgoraRtcExampleController.ts                          │
│    按钮、配置、HUD、日志页、视频区、调用 SDK               │
├─────────────────────────────────────────────────────────┤
│ 2. JS SDK 层                                             │
│    example/.../assets/agora-rtc-sdk/agora.ts             │
│    （由 scripts/prepare-example.sh 从 sdk/agora-rtc 同步）│
│    统一 Promise API、事件、超时、错误码                  │
├─────────────────────────────────────────────────────────┤
│ 3. 平台桥接层                                            │
│    Android: AgoraRtcPlugin.java                          │
│    iOS: AgoraRtcBridge.swift + AgoraRtcPlugin.mm         │
│    jsb request/response/event                             │
├─────────────────────────────────────────────────────────┤
│ 4. 视频纹理桥（engine-texture 路线）                     │
│    AgoraEngineTextureBridge.cpp / SlotBridge.mm 等       │
│    slotId → Cocos Texture2D → Sprite                     │
├─────────────────────────────────────────────────────────┤
│ 5. Agora Native SDK 4.5.3                              │
└─────────────────────────────────────────────────────────┘
```

更完整的分层说明见：`docs/customer-architecture-note.md`。

### 2.2 一次 API 调用的数据流

```text
用户点击按钮
  → Controller 方法（如 joinRtcChannel）
    → getClient() → createAgoraRtcClient({ bridgeRuntime: { native, sys } })
      → AgoraRtcClient.#invoke('joinChannel', params)
        → jsbBridgeWrapper 发送 agora:request
          → 原生 Plugin 调用 RtcEngine
            → agora:response / agora:event 回 JS
              → Promise resolve / client.on('joinChannelSuccess')
                → pushStatus() 写日志 + refreshSummary()
```

### 2.3 视频渲染三后端

| Backend | 含义 | Example 表现 |
|---------|------|----------------|
| `surface-view` | 原生 View 叠在 Cocos 上 | `setupLocalVideoView` / `setupRemoteVideoView` 传屏幕矩形 |
| `texture-view` | 原生 TextureView 类路线 | 同上，Android 侧重 |
| `engine-texture` | 帧 → native Texture2D → Cocos Sprite | **推荐 QA 默认**；日志页打开时不 suspend overlay，避免关页黑屏 |

切换后端：`cycleRenderBackend()` / 配置区「渲染」药丸 → `teardownRtc` 后按状态重新 `initialize` + `join`。

坐标换算：`worldRectToNativeOverlayRect()`（`agoraRtcHudLayout.ts`），从 `__qa_right_pane` 下视频节点算原生 overlay 矩形。

### 2.4 Example Controller 状态机（核心字段）

| 字段 | 含义 |
|------|------|
| `initialized` | 已 `initialize(appId)` |
| `joined` | 已进房（`joinChannelSuccess`） |
| `previewStarted` | 本地预览开 |
| `renderBackend` | 当前渲染后端 |
| `statusLines[]` | 运行日志（最多 500 行） |
| `logPageVisible` | 全屏日志页是否打开 |
| `actionResults` | 各按钮最近一次 ok/fail/idle（影响按钮配色） |

启动流程（`start()`）：

1. `loadRuntimeConfig()` ← `resources/agora-config.json`
2. `pushStatus` 就绪信息
3. **自动** `initializeRtc()` + `joinRtcChannel()`（失败只记日志，不阻断 UI）

### 2.5 动态 UI 原则

- **不依赖** Creator 里摆好的按钮节点（除 Canvas）
- 所有 QA 节点名以 `__` 前缀，常量在 Controller 顶部
- `ensureUi()` 幂等：有则更新布局，无则创建
- 横竖屏 / 分辨率变化：`layoutConsole()` 统一重排

---

## 3. UI 设计

### 3.1 整体布局（横屏 QA 面板）

```text
Canvas
├── __qa_left_pane（约 62% 宽）
│   ├── __qa_left_header（可滚动）
│   │   ├── 配置条：App/Token 摘要、Channel、UID、预设/应用/日志(N)
│   │   └── __example_settings_panel：渲染/场景/角色/编码
│   ├── __example_button_panel
│   │   ├── __session_quick_bar：初始化 | 加入 | 离开
│   │   └── ScrollView → __example_button_grid（分组按钮）
│   └── __example_status_scroll：底部状态摘要（2 行预览 + 滚动）
├── __qa_right_pane（约 38% 宽）
│   ├── __video_remote_card + 远端画面
│   └── __video_local_card + 本地画面
├── __log_float_btn（Canvas 子节点，右上角「日志 N」）
└── __qa_log_page（全屏日志 Modal，默认 inactive，首次点击才 ensureLogPage）
```

配色分层（HUD）：

- 配置行：浅灰蓝 `(214,226,240)`
- 摘要行：浅绿 `(170,210,188)`
- 状态行：琥珀 `(224,196,150)`
- 按钮：primary / danger / toggleOn / toggleOff + 成功绿 / 失败红

### 3.2 按钮区分组（`BUTTON_SECTION_LAYOUT`）

**蓝色标题（Session / Render / Mixer / Tools）不是按钮**，只有下面彩色按钮可点。

| 分组 | 按钮 | 中文标签 | 作用简述 |
|------|------|----------|----------|
| （快捷条） | Initialize / Join / Leave | 初始化 / 加入 / 离开 | RTC 生命周期 |
| **Session** | Preview, Views, Full Demo | 预览 / 刷新画面 / 完整演示 | 预览、重绑视图、跑全套 Demo |
| **Render** | Speaker, Mic, Cam, Audio, Video | 扬声器 / 麦 / 摄像头 / 音频 / 视频 | 设备开关 + 音视频 API 演示 |
| **Mixer** | Mixing, Effect, Diag | 混音 / 音效 / 诊断 | 混音文件、音效、诊断 API |
| **Tools** | Freeze, Clear | 冻结日志 / 清空日志 | 日志区控制 |

> **注意**：分组名 **Render** ≠ 顶栏「渲染 backend」。Backend 在设置区 `SETTINGS_ROWS` 的 `Backend` → `cycleRenderBackendSetting`。

按钮区在 **ScrollView** 内：Render / Mixer / Tools 可能在可视区域下方，需 **在左侧按钮面板内滑动** 才能点到。

### 3.3 日志入口与 HUD 诊断

| 入口 | 节点 | 行为 |
|------|------|------|
| 右上角 | `__log_float_btn` | 挂 **Canvas**（非 overlay 子节点，避免触摸被 ignore） |
| 配置行 | `__log_open_config` | 「日志(N)」 |
| 全局回退 | `input.on(TOUCH_END)` | 命中 float/config 区域时 `requestOpenLogPage` |
| HUD 第三行 | `logUiHudLine` | 显示触摸坐标、命中、页开闭（`setLogUiHud`） |

打开防抖：`lastLogUiOpenMs` 250ms 内忽略重复打开。

### 3.4 全屏日志页 UI 结构

```text
__qa_log_page（全屏，打开时 setSiblingIndex 置顶）
├── __log_page_dim（暗色底，ignoreUiHitTest，不关闭）
└── __log_page_panel
    ├── __log_page_header
    │   ├── 返回 → closeStatusLogPage（唯一关闭方式）
    │   ├── 清空 → clearStatusLog
    │   ├── 冻结 → toggleStatusFreeze
    │   └── __log_page_title「运行日志」（固定标题，不写业务摘要）
    └── __log_body_viewport（anchor 左上，BlockInputEvents）
        └── __log_body_clip（裁剪容器，Mask 挂在此子节点）
            ├── __log_body_clip_bg（深蓝 Graphics）
            └── __log_page_body（Label，Menlo 14，RESIZE_HEIGHT）
```

**刻意不用** 日志区 `ScrollView + Mask` 做滚动（曾触发 iOS `stencilStage` null）。滚动 = 单 Label + `logBodyScrollOffset` + 拖动手势。

---

## 4. API 实现与调用链

### 4.1 TypeScript SDK 入口

- 源：`sdk/agora-rtc/js/agora.ts`（同步到 `example/basic-call/assets/agora-rtc-sdk/`）
- 工厂：`createAgoraRtcClient(options?)`
- 协议：`#invoke(method, params)` → bridge request/response；`on(event)` 收 native 事件

公开 API 类别（节选）：

| 类别 | 代表方法 |
|------|----------|
| 生命周期 | `setRenderBackend`, `initialize`, `joinChannel`, `leaveChannel`, `destroy` |
| 音频 | `enableAudio`, `enableLocalAudio`, `mute*`, `setEnableSpeakerphone`, `startAudioMixing`, … |
| 视频 | `enableVideo`, `setupLocalVideoView`, `setupRemoteVideoView`, `startPreview`, … |
| 引擎纹理 | `getEngineTexture(slotId)`, `isEngineTextureReady(slotId)` |
| 演示/诊断 | `getSdkVersion`, `setLogFilter`, `setParameters`, … |

完整清单与验证边界：`docs/api-verification-matrix.md`、`docs/Agora-Cocos-RTC-SDK-API-Guide.md`。

### 4.2 Example 按钮 → SDK 映射

`DEFAULT_BUTTON_LAYOUT` 定义 `name` + `handler` 方法名；`bindAppButtonClick` 反射调用 `this[handler]`。

| 用户操作 | Controller 方法 | 主要 SDK 调用 |
|----------|-----------------|---------------|
| 初始化 | `initializeRtc` | `setRenderBackend`, `initialize`, `enableVideo`, `setupLocalVideoView`, `startPreview` |
| 加入 | `joinRtcChannel` | `joinChannel(token, channelId, uid)` |
| 离开 | `leaveRtcChannel` | `leaveChannel`, `removeRemoteVideoView` |
| 预览 | `togglePreview` | `startPreview` / `stopPreview` |
| 刷新画面 | `refreshRtcViews` | `remove*VideoView` + `setup*VideoView` |
| 扬声器/麦/摄像头 | `toggleSpeakerphone` 等 | 对应 enable/mute API |
| 完整演示 | `runCapabilityDemo` | 链式调用 `runChannelRoleDemo` → … → `runDiagnosticsDemo` |
| 混音/音效/诊断 | `runMixingDemo` 等 | 见 `example/basic-call/README.md` API 表 |

未实现或会失败的 API 走 `callAndLogFailure()`，**日志区显式失败**，不静默成功。

### 4.3 事件监听（Controller 内 `getClient()` 绑定）

| 事件 | UI 影响 |
|------|---------|
| `joinChannelSuccess` | `joined=true`，尝试 attach 远端 |
| `userJoined` / `userOffline` | 维护 `remoteUserUids`，iOS 延迟 attach 策略 |
| `localVideoTextureReady` / `remoteVideoTextureReady` | `bindNativeTextureSprite` |
| `rtcStats` / `volumeIndication` | 更新 summary 统计 |
| `connectionStateChanged` | `pushStatus` |
| `renderBackendState` | `applyEffectiveRenderBackend` 回退 |

### 4.4 配置加载

- 路径：`resources.load('agora-config', JsonAsset)`
- 字段：`appId`, `token`, `channelId`, `uid`, `renderBackend`
- 无配置时 HUD 显示 `Token 未配置`，Initialize/Join 可能抛错并在 HUD/日志体现

---

## 5. 运行日志子系统（Log UI）

### 5.1 数据模型

```ts
statusLines: string[]     // pushStatus 追加，slice(-500)
statusFrozen: boolean     // 冻结后不再 append
getFullLogText()           // join('\n')，时间正序：旧在上、新在下
```

空日志显示：`（暂无日志）`。

### 5.2 生命周期

| 阶段 | 行为 |
|------|------|
| 启动 | **不** `ensureLogPage()`（避免 inactive 节点挂 Mask） |
| 首次点击日志 | `ensureLogPage()` → `openStatusLogPage()` |
| 打开 | `logPageNode.active=true`，`layoutStatusLogPage`，`refreshLogPageContent`，`queueLogBodyViewportMask` |
| 关闭 | 仅「返回」；`disableLogBodyViewportMask`；恢复 float 按钮 |
| 新日志 | 若 `offset≈0` 且用户未手动滚动，保持底部（最新） |

### 5.3 滚动与坐标（当前实现，务必以此为准）

- viewport / Label / clip：**anchor (0, 1)** 左上对齐
- 位置：`bodyNode.y = -viewH + contentH - offset`
- `offset = 0`：内容**底边**对齐深蓝区底边 → **默认看到最新日志**
- `offset = maxScroll`：内容**顶边**对齐深蓝区顶边 → 看最旧
- `maxScroll = max(0, contentH - viewH)`
- 手势：`offset -= delta`（**手指上滑，正文随手指上移**，与拖动内容一致）

内容高度：`measureLogBodyContentHeight()` — 设 `string` + 宽 + `updateRenderData(true)` 读实测高度；失败则回退 `estimateLogBodyContentHeight`。

### 5.4 裁剪（Mask）策略

| 规则 | 原因 |
|------|------|
| Mask 只在 `__log_body_clip` 子节点 | 不与 viewport 上 BlockInputEvents 混用 |
| `stripLogViewportStencilComponents(viewport)` | 清理误挂在 viewport 的 Mask |
| `queueLogBodyViewportMask` 在 **页 active 后** `scheduleOnce` | inactive 时挂 Mask → `stencilStage` null |
| `try/catch`，失败则跳过 Mask | 保证「能打开」优先于裁剪 |
| 关闭页 `mask.enabled = false` | 降低 stencil 残留风险 |

### 5.5 关键函数表

| 函数 | 作用 |
|------|------|
| `requestOpenLogPage(source)` | 防抖 + try/catch + HUD |
| `ensureLogPage` / `buildLogPageBody` | 构建节点树 |
| `openStatusLogPage` / `closeStatusLogPage` | 开闭 |
| `applyLogBodyScrollPosition` | 滚动定位 |
| `bindLogBodyPanScroll` | 拖动手势 |
| `refreshLogPageContent` | 刷新文本与 offset |
| `layoutStatusLogPage` / `resizeLogPageBodyLayout` | 旋转 resize，避免每次 destroy body |
| `pushStatus` | 业务日志写入 |

### 5.6 日志相关踩坑简表

| 现象 | 根因 | 处理 |
|------|------|------|
| 点日志无反应 | overlay ignoreUiHitTest / toggle 开即关 | float 挂 Canvas；仅打开不 toggle |
| stencilStage 崩溃 | inactive 挂 Mask 或 viewport 无 Graphics | 延迟到 clip 子节点 + active 后 |
| 打开一片空白 | offset=max 或估算高度偏大 | offset=0 + 实测高度 |
| 滑动方向反 | offset 与 delta 符号 | `offset -= delta` |
| 文字出蓝框 | 无裁剪 | Mask on clip（可失败回退） |
| 标题变摘要 | refreshSummary 写错节点 | 只写 summaryLabel |

---

## 6. 测试方法与验证记录

### 6.1 自动化测试（Node，不启动 Cocos）

```bash
cd /path/to/agora-cocos-rtc
npm test
# 或
npm run verify   # test + prepare-example + package-sdk
```

| 测试文件 | 覆盖内容 |
|----------|----------|
| `tests/agora-client.test.ts` | TS SDK 请求封送、事件、超时、mock bridge |
| `tests/example-scene.test.ts` | 场景不序列化 Controller、bootstrap 挂载、按钮/HUD/纹理/iOS 远端策略等 **源码结构断言** |
| `tests/example-hud-layout.test.ts` | `worldRectToNativeOverlayRect` 坐标 |
| `tests/dev-ios-script.test.ts` / `dev-android-script.test.ts` | 构建脚本存在性与关键步骤 |
| `tests/native-templates.test.ts` | 原生模板文件 |
| `tests/package-sdk.test.ts` | 打包产物 |
| `tests/docs.test.ts` | 文档链接一致性 |

**说明**：当前 **没有** 日志 UI 的独立自动化测试；log-ui 依赖真机/模拟器 + 控制台 + HUD 肉眼验证。

### 6.2 手动测试 — iOS 模拟器（主要联调路径）

```bash
./scripts/dev-ios.sh
```

脚本流程：`prepare-example` → Cocos CLI 导出 iOS → `integrate-ios-project.rb` → `pod install` → `xcodebuild iphonesimulator` → 安装启动 `io.agora.agoraRtcEngineExample`。

**日志 UI 专项验证步骤**：

1. 启动后确认 HUD：`UI: 已就绪，请点「日志」或右上角`
2. 点右上角「日志 N」或配置区「日志(N)」
3. HUD 应变为 `UI: 页:开 条数:N`（非 `打开失败 stencilStage`）
4. 深蓝区内有字（至少 `（暂无日志）` 或带时间戳行）
5. 手指上滑：正文随手指向上；可看更早日志
6. 文字不溢出深蓝区（Mask 成功时）；若溢出但能打开，属 Mask 被 skip
7. 仅「返回」关闭；点暗色区域不关闭
8. 点主界面其它区域时 HUD 第三行显示触摸诊断坐标

**控制台抓取**：

```bash
./scripts/capture-log-ui-ios.sh
# 过滤 [agora-rtc][log-ui]
```

### 6.3 手动测试 — Android

```bash
./scripts/dev-android.sh
```

依赖 `local-maven`（可先 `node ./scripts/fetch-agora-maven.mjs`）。日志 UI 与 iOS 共用同一套 TS，但 **stencil/Mask 问题以 iOS native 最先暴露**。

### 6.4 手动测试 — RTC 主流程

| 步骤 | 预期 |
|------|------|
| 配置 `assets/resources/agora-config.json` | HUD 显示 channel，非「Token 未配置」 |
| 自动/手动 初始化 + 加入 | 日志有 Join；右侧远端/本地有画面（engine-texture） |
| Session：预览/刷新画面 | 日志有对应 status |
| Render：麦/摄像头 | 按钮文案 开/关 切换 |
| Full Demo | 连续多条 Demo 日志，部分 API 可能 fail 但可见 |
| Mixer：混音 | 可能因 `audio/demo-mix.mp3` 不存在而 fail（预期） |

### 6.5 Web Desktop 构建

`example/basic-call/build-configs/web-desktop-debug.json` — 用于 TS/逻辑快速验证，**无完整 native RTC**，不作为 log-ui / 视频主验收平台。

### 6.6 已验证 / 未验证（交接时状态）

| 项 | 状态 |
|----|------|
| `npm test` 结构测试 | 仓库内可跑 |
| iOS 模拟器编译 + 安装 | `dev-ios.sh` 已多次成功 |
| Android offline assembleDebug | 文档记载已成功 |
| 日志页打开（stencil 修复后） | 需接手者在当前分支再确认一次 |
| 日志 Mask 裁剪 | 延迟挂载，失败可跳过 |
| Log UI 自动化 E2E | **未做** |

---

## 7. 构建与调试命令

```bash
# 准备 example（同步 SDK 到 assets/agora-rtc-sdk）
./scripts/prepare-example.sh

# 单元测试
npm test

# iOS 模拟器一键
./scripts/dev-ios.sh

# Android
./scripts/dev-android.sh

# 日志 UI 控制台
./scripts/capture-log-ui-ios.sh

# 打包客户交付 zip
./scripts/package-sdk.sh
```

修改 `assets/scripts/*.ts` 或 `assets/agora-rtc-sdk/*` 后 **必须重新跑 dev 脚本** 才会进模拟器包。

---

## 8. 已知问题与禁止事项

### 8.1 已知限制

- iOS SPM 未完全写入 CMake 工程，走 CocoaPods + 集成脚本
- 部分 Demo API 在模拟器/无资源文件时预期失败
- 日志区 Mask 在部分时机仍可能失败，已降级为「可打开、可能不裁剪」
- `Surface`/`Texture`/`EngineTex` 按钮在 `DEFAULT_BUTTON_LAYOUT` 中但 **未** 放进 `BUTTON_SECTION_LAYOUT` 滚动区（仅设置区「渲染」循环切换）

### 8.2 禁止事项（Log / UI）

- 不要在 `__log_page_dim` 上绑点击关闭
- 不要对 `__qa_ui_overlay` 根 `ignoreUiHitTest` 且把可点按钮放其下
- 不要在 **日志页 inactive** 时挂 Mask
- 不要在 viewport 上直接挂 Mask（用 `__log_body_clip`）
- 不要 `refreshSummary()` 写入 `__log_page_title`
- 不要在 measure 时把 Label 高度设为 `1` 逼空内容区
- 不要在 `onLoad` 里无条件 `ensureLogPage()`（除非解决 inactive stencil）

---

## 9. 接手建议（优先级）

### P0 — 功能正确性

1. iOS 模拟器复测：打开日志页、滚动、裁剪、返回
2. 若 stencil 仍偶发：考虑 **无 Mask** + 按行切片显示（软件裁剪）
3. 确认 `npm test` 全绿

### P1 — 体验与结构

1. 日志页拆 **Prefab** 或独立 scene，减轻 Controller 体积
2. 按钮区：未进房时灰显或提示（现为可点但 API 失败）
3. `LogStore` 与 UI 解耦，便于业务复用

### P2 — 架构演进

1. `CallPanel` 组件：主界面 vs 日志 Modal vs 通话页
2. 离页 `leaveChannel` 生命周期
3. Log UI E2E（Detox / 原生 UI test）

---

## 10. 关键文件索引

| 文件 | 说明 |
|------|------|
| `example/basic-call/assets/scripts/AgoraRtcExampleController.ts` | QA UI + 日志 + 业务编排 |
| `example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts` | Controller 挂载 |
| `example/basic-call/assets/scripts/agoraRtcHudLayout.ts` | Overlay 坐标 |
| `example/basic-call/assets/agora-rtc-sdk/agora.ts` | Example 使用的 SDK 副本 |
| `sdk/agora-rtc/js/agora.ts` | SDK 源 |
| `example/basic-call/assets/scene/main.scene` | 唯一场景 |
| `scripts/dev-ios.sh` / `dev-android.sh` | 本地调试 |
| `scripts/capture-log-ui-ios.sh` | log-ui 日志流 |
| `docs/customer-architecture-note.md` | 客户向架构说明 |
| `docs/build-and-test.md` | 构建与测试说明 |
| `docs/api-verification-matrix.md` | API 验证矩阵 |
| `example/basic-call/README.md` | 按钮与 Demo API 对照 |

---

## 附录：日志 UI 调试关键字

```text
[agora-rtc][log-ui] open-request
[agora-rtc][log-ui] open-done
[agora-rtc][log-ui] open-error
[agora-rtc][log-ui] touch-end
[agora-rtc][log-ui] mask skipped
```

HUD 第三行（配置区下方状态条）在联调 log-ui 时会显示：`触摸(x,y) 浮:Y/n 配:Y/n 页:开/关`。

---

*本文档替代旧版「仅日志页」交接说明，涵盖全工程架构、UI、API 与测试；代码以仓库当前分支为准。*
