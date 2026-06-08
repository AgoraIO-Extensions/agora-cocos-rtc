# Cocos Prefab Demo Refactor Design

## Context

The current `example/basic-call` demo uses Cocos Creator 3.8.8 with a single start scene:

- Scene: `example/basic-call/assets/scene/main.scene`
- Bootstrap: `example/basic-call/assets/scripts/AgoraRtcExampleBootstrap.ts`
- Main controller: `example/basic-call/assets/scripts/AgoraRtcExampleController.ts`

The current controller dynamically mounts itself on `Canvas`, creates almost all UI nodes in TypeScript, and also owns RTC lifecycle, action dispatch, log overlay, settings, video rendering, and layout. This works, but it is not a standard Cocos UI authoring shape because the page structure is mostly invisible in the scene or prefab assets.

## Goal

Refactor the demo toward a Cocos-standard prefab and component binding architecture while preserving runtime behavior:

- Keep `main.scene` as the single entry scene.
- Put visible demo structure into scene or prefab assets instead of creating the entire app shell from one controller.
- Split UI panels and RTC orchestration into focused components.
- Preserve existing app config loading, auto initialize and join, local preview, remote video rendering, log view, settings, and button actions.
- Keep the existing Android demo build and smoke verification path working.

## Non-Goals

- Do not redesign the product UI visually in this pass.
- Do not introduce multi-scene routing.
- Do not replace the Agora SDK bridge or native texture/surface rendering path.
- Do not change the public demo behavior unless needed to preserve the behavior after component extraction.

## Architecture

`main.scene` remains the start scene and contains `Canvas`, `Main Camera`, and a demo root node. The demo root is the composition point for prefab-backed panels.

The new root component is `AgoraRtcDemoRoot`. It replaces the bootstrap-time dynamic `Canvas.addComponent(AgoraRtcExampleController)` path. Its responsibilities are:

- load runtime config from `agora-config.json` and override helpers;
- create and own the RTC session service;
- coordinate panel initialization;
- handle top-level lifecycle such as auto initialize and join;
- relay session state to UI panels.

The RTC operations move behind `RtcSessionService`. This service wraps the existing `createAgoraRtcClient` usage and owns initialization, join, leave, preview, event listeners, local and remote user state, and RTC stats forwarding. The service should not create UI nodes.

UI is split into prefab-backed panel components:

- `DemoHeaderPanel`: channel, uid, app/config summary, settings rows, and log button entry points.
- `DemoActionPanel`: quick buttons and API button grid, based on a typed action registry.
- `VideoStagePanel`: local and remote video cards, sprite/texture binding, hints, titles, and remote page selection.
- `LogPanel`: runtime log overlay, back/clear/freeze controls, scroll body, and visibility state.

## Asset Layout

Add Cocos assets under `example/basic-call/assets/prefabs/`:

- `DemoRoot.prefab`
- `HeaderPanel.prefab`
- `ActionPanel.prefab`
- `VideoStagePanel.prefab`
- `LogPanel.prefab`

The scene should instantiate or reference `DemoRoot`. `DemoRoot` binds panel nodes or prefab instances through `@property` references. Panel internals should be explicit enough that a developer opening Cocos Creator can see the page structure and adjust layout without reading a 5000-line controller.

TypeScript assets should move toward this layout:

- `assets/scripts/demo/AgoraRtcDemoRoot.ts`
- `assets/scripts/demo/RtcSessionService.ts`
- `assets/scripts/demo/actions.ts`
- `assets/scripts/demo/panels/DemoHeaderPanel.ts`
- `assets/scripts/demo/panels/DemoActionPanel.ts`
- `assets/scripts/demo/panels/VideoStagePanel.ts`
- `assets/scripts/demo/panels/LogPanel.ts`
- `assets/scripts/demo/ui/uiStyles.ts`

The old `AgoraRtcExampleController.ts` can remain temporarily as a migration source, but new scene wiring should use the new components.

## Data Flow

1. Cocos loads `main.scene`.
2. `AgoraRtcDemoRoot.onLoad` receives bound panel references and initializes panel callbacks.
3. `AgoraRtcDemoRoot.start` loads runtime config and refreshes header/log state.
4. Root creates `RtcSessionService`, initializes RTC, and joins the channel using the same default auto-join behavior as the current demo.
5. UI actions from `DemoActionPanel` call typed handlers on the root.
6. The root delegates RTC operations to `RtcSessionService`.
7. `RtcSessionService` emits state updates and event summaries.
8. Root updates `DemoHeaderPanel`, `VideoStagePanel`, `LogPanel`, and button states.

This keeps RTC behavior separate from Cocos node construction and keeps panels focused on presentation and input.

## Routing And Panels

The demo should still be a single scene. It does not need a general app router. `LogPanel` is treated as a named overlay panel with explicit `show`, `hide`, and `setLines` methods. Settings remain inside `DemoHeaderPanel` unless they grow into a separate overlay later.

This is closer to normal Cocos practice than the current dynamic page creation because page structure is represented by nodes, prefabs, and component references.

## Error Handling

RTC errors should be handled at the root/service boundary:

- `RtcSessionService` returns failed promises for failed RTC commands.
- `AgoraRtcDemoRoot` catches command failures, records log lines, updates the last error summary, and asks panels to refresh.
- Panel components do not swallow RTC errors. They only invoke callbacks and display state passed by the root.
- Missing prefab or component references should fail loudly in logs and keep the app from silently building partial UI.

## Compatibility

The current runtime config file and app id path remain unchanged:

- `example/basic-call/assets/resources/agora-config.json`
- `resolveAgoraExampleConfig`

The current render backend default remains `engine-texture` unless the existing config or property overrides it. Android runtime permissions and native bridge behavior are not changed by this refactor.

## Migration Strategy

Implement in stages to reduce risk:

1. Add new component and panel files plus prefab assets.
2. Wire `main.scene` to `DemoRoot` and new components.
3. Move action registry constants out of the old controller.
4. Move log panel behavior into `LogPanel`.
5. Move video node references and rendering updates into `VideoStagePanel`.
6. Move RTC command methods and event binding into `RtcSessionService`.
7. Remove the bootstrap dynamic controller mount once the scene has an explicit root component.
8. Keep behavior parity checks after each major extraction.

## Verification

After implementation:

- run TypeScript or Cocos build checks available in the repo;
- build Android debug for `example/basic-call`;
- install the APK on the emulator;
- grant camera and microphone permissions;
- launch the demo with app id `dd8dfbf0f9484a8c960546ffe4ba4dce`;
- verify auto initialize and join, local preview, runtime log panel, settings display, and representative audio/video action buttons.

Use the proxy environment requested by the user when dependency or Gradle network access is needed:

```sh
export http_proxy=http://127.0.0.1:7892
export https_proxy=http://127.0.0.1:7892
export all_proxy=http://127.0.0.1:7892
```

## Acceptance Criteria

- `main.scene` no longer depends on bootstrap code dynamically attaching the old monolithic controller to `Canvas`.
- The main demo UI is represented by prefab or scene nodes with bound panel components.
- RTC lifecycle is separated from panel rendering code.
- Existing demo behavior remains available: config load, auto join, leave, preview, log overlay, settings, local video, remote video, and action buttons.
- Android debug build and emulator smoke test pass.
