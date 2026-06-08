# Cocos Flutter-Style Basic Video Demo Design

## Context

The current Cocos `example/basic-call` demo has already been moved away from a monolithic runtime controller into a scene and prefab-backed component shape. It still presents most RTC capabilities as a large QA-oriented button grid.

The Flutter SDK example at `example/lib/examples/basic/join_channel_video` uses a different product shape:

- a basic video call page;
- one display area with local video and remote thumbnails;
- one actions area with channel, uid, profile, render, encoder, and join/leave controls;
- RTC state driven by event handlers and a remote user set;
- stats overlays rendered on top of local and remote video views.

This design adapts that example to Cocos Creator while keeping the existing Agora Cocos bridge and native render backend.

## Goals

- Make `example/basic-call` read as a basic video join-channel demo first, not as an API test matrix.
- Follow the Flutter example's interaction model: initialize video, show preview, let the user join or leave a channel, and show remote users as small video cards.
- Keep the current prefab/component architecture.
- Keep the current Android build and smoke flow.
- Preserve advanced RTC API buttons, but move them behind an advanced or diagnostics section.

## Non-Goals

- Do not add multi-scene routing.
- Do not replace the Agora Cocos SDK bridge.
- Do not implement Flutter widgets or import Flutter concepts literally.
- Do not require remote users for the demo to be usable.
- Do not commit a real Agora app id or token.

## Reference Behavior

The adapted behavior is based on these Flutter example patterns:

- `JoinChannelVideo` initializes `RtcEngine`, registers event handlers, enables video, and starts preview during setup.
- The join action reads channel and uid input, joins with `ChannelMediaOptions`, and toggles the primary button between join and leave.
- Remote users are tracked in a set and each uid owns or reuses a remote video controller.
- Local and remote videos are displayed in a stack, with remote views in a horizontal scroll row aligned near the top.
- Stats are shown as overlays on top of each video view.
- The actions area includes channel id, uid, render texture toggle, channel profile, video encoder config, join/leave, switch camera, and camera mute controls.

## Cocos UI Architecture

Keep `main.scene` as the only entry scene. The scene still contains `DemoRoot`, with panel components bound by Cocos script UUID:

- `AgoraRtcDemoRoot`
- `DemoHeaderPanel`
- `DemoActionPanel`
- `VideoStagePanel`
- `LogPanel`

The page layout changes from a QA grid to a two-zone basic video demo:

- `DemoActionPanel` becomes the left-side actions panel on Android landscape.
- `VideoStagePanel` becomes the right-side primary display area.
- `LogPanel` remains an overlay, opened from the actions panel.
- `DemoHeaderPanel` is either folded into the actions panel or kept as a compact status header inside it.

The scene remains Cocos-standard: components are bound to scene or prefab nodes, and repeated runtime content is created only for dynamic remote user cards.

## Screen Layout

### Landscape

Landscape is the primary target for Android smoke testing.

- Left actions column: fixed width, scrollable content.
- Right video area: fills remaining width.
- Local video: dominant stage.
- Remote videos: thumbnail row near the top-right of the video area.
- Stats overlay: bottom-left of each local or remote video card.
- Log overlay: full-screen or large floating overlay over the page when opened.

### Portrait

Portrait can be supported with the same nodes:

- Video stage fills the screen.
- Actions panel becomes a bottom drawer-like panel or lower fixed panel.

This pass should prioritize landscape correctness because the current Android project launches landscape.

## Actions Panel

The actions panel should contain these groups in this order:

1. Connection
   - Channel ID input
   - UID input
   - Channel profile selector: live broadcasting or communication
   - Join channel / Leave channel primary button

2. Preview and camera
   - Start preview / Stop preview
   - Switch camera
   - Camera on/off or mute local video
   - Mute all remote video

3. Render and encoder
   - Render backend selector mapped to Cocos supported backends: `engine-texture`, `surface-view`, `texture-view`
   - Video encoder preset selector: 360p, 540p, 720p
   - Apply encoder configuration button

4. Diagnostics
   - Open log
   - Refresh views
   - Optional advanced API section entry

The existing QA buttons should not dominate the initial viewport. If retained, they should sit under an `Advanced` area after the basic join-channel controls.

## Video Stage

`VideoStagePanel` owns:

- local video node;
- local placeholder state;
- remote user thumbnail nodes keyed by uid;
- remote active/focus state;
- per-video stats labels.

Local video should be available before joining after preview starts. Remote videos appear only when `onUserJoined`, `onFirstRemoteVideoFrame`, or video size events indicate a remote uid should be visible.

For Cocos native texture rendering, sprite frames remain bound through the existing engine-texture path. Surface or texture-view render backends can keep using the existing native overlay bridge where supported.

## Runtime State

Use a Flutter-like state model in `RtcSessionService`:

- `initialized`
- `joined`
- `previewStarted`
- `channelProfile`
- `renderBackend`
- `videoEncoderPreset`
- `localVideoMuted`
- `allRemoteVideoMuted`
- `remoteUserUids`
- `remoteVideoBindings`
- `lastRtcStatsSummary`
- `lastLocalVideoStatsSummary`
- `lastRemoteVideoStatsByUid`
- `lastVolumeByUid`
- `lastErrorMessage`

`RtcSessionService` emits state snapshots to `AgoraRtcDemoRoot`. Panels render snapshots and invoke callbacks; they do not call the Agora client directly.

## Data Flow

1. Cocos loads `main.scene`.
2. `AgoraRtcDemoRoot.onLoad` binds panel callbacks.
3. `AgoraRtcDemoRoot.start` loads config and creates `RtcSessionService`.
4. The service initializes RTC, registers event handlers, enables video, and starts local preview.
5. User edits channel/uid/profile/render/encoder settings in `DemoActionPanel`.
6. User taps Join.
7. The root delegates join to `RtcSessionService`.
8. RTC events update session state.
9. The root refreshes actions, stats, local video, remote thumbnails, and logs.
10. User taps Leave and the service leaves channel, clears remote users, and keeps preview available.

## Event Handling

The service should handle at least:

- error and warning callbacks;
- join success;
- user joined;
- user offline;
- leave channel;
- remote video state changed;
- first remote video decoded or first remote video frame;
- video size changed;
- rtc stats;
- local video stats;
- remote audio/video stats;
- audio volume indication.

Stats values should be summarized into short display strings suitable for Cocos labels.

## Error Handling

- Empty app id blocks initialization and displays an error.
- Empty channel id blocks join and displays an error.
- Invalid uid falls back to `0` or `1001`, matching the chosen config policy.
- Unsupported render backend changes are disabled while joined.
- Encoder config parsing errors show a UI error and do not call the engine.
- RTC command failures set the affected action to fail and append to the log.

## Testing

Add or update tests for:

- action registry now prioritizes join-channel controls over the QA matrix;
- demo root initializes video and preview but does not auto-join;
- session service owns remote uid set and remote video binding map;
- video panel owns local stage, remote thumbnails, and stats labels;
- Android script and customer packaging still include the new demo files;
- placeholder config still prevents committing real credentials.

Manual smoke:

- build Android with the ignored build config using the provided app id;
- install and launch;
- verify local preview appears;
- join channel;
- verify button state changes to Leave;
- verify preview, switch camera, mute local video, and leave actions;
- verify logs and stats update.

## Acceptance Criteria

- The first screen is a basic video call demo modeled after Flutter `join_channel_video`.
- Join/leave, channel id, uid, channel profile, preview, camera, render backend, and video encoder controls are visible before advanced QA actions.
- Local preview starts without requiring join.
- Remote users are shown as uid-keyed thumbnails.
- Stats overlays are visible on local and remote video cards.
- Advanced RTC API controls are still reachable but not the primary page.
- Android debug build installs and launches.
- `npm test` and `npm run typecheck` pass.

