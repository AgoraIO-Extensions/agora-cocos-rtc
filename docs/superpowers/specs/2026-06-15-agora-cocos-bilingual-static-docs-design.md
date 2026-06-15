# Agora Cocos RTC Bilingual Static Docs Design

Date: 2026-06-15
Repo: `agora-cocos-rtc`
Status: Approved design, ready for implementation planning

## 1. Background

The current repository exposes usable SDK and example documentation in three places:

- root `README.md`
- SDK package `sdk/agora-rtc/README.md`
- example project `example/basic-call/README.md`

These files are technically useful, but they are not organized as a developer documentation experience. They do not yet provide:

- a clear first-run path for developers who know neither Agora RTC nor the Cocos integration
- a reference structure that matches how developers search for capabilities during implementation
- a consistent place to explain Cocos-specific rendering behavior, platform differences, and example-to-API mapping
- a bilingual Chinese/English experience with predictable switching

The goal of this work is to create a static HTML documentation set under `docs/` that feels like a real developer documentation site rather than a README bundle or a marketing landing page.

## 2. Audience

Primary audience:

- developers who are not familiar with Agora RTC
- developers who are not familiar with this Cocos integration

Secondary audience:

- developers who already know Agora RTC, but need to understand this repository's public surface, rendering model, and platform constraints

The information architecture must support both groups, but the first-release experience should prioritize first-time success.

## 3. Source Truth

The documentation must be derived from the current repo state, not from generic Agora assumptions.

Primary code truth surfaces:

- public client API: `sdk/agora-rtc/js/agora.ts`
- public types and event payloads: `sdk/agora-rtc/js/types.ts`
- example behavior and grouped demo actions:
  - `example/basic-call/assets/scripts/demo/RtcSessionService.ts`
  - `example/basic-call/assets/scripts/demo/AgoraRtcDemoRoot.ts`
  - `example/basic-call/assets/scripts/demo/panels/DemoActionPanel.ts`

Current public surface facts that the docs should explicitly reflect:

- `AgoraMethod` currently contains 61 public bridge method names
- `AgoraEventMap` currently contains 22 public event payload types
- the only current render backend is `engine-texture`
- the example app is a QA-oriented console, not a minimal visual showcase

## 4. Product Goal

Produce a bilingual static HTML documentation set that lets a first-time developer:

1. understand what this SDK is and what it ships
2. run the shortest useful path: initialize, join channel, preview, verify
3. discover grouped capabilities without reading native bridge code
4. deep-link into exact method, event, rendering, and platform details when needed

## 5. Non-Goals

This first release does not attempt to:

- migrate the docs to Docusaurus, VitePress, MkDocs, or another docs framework
- build a versioned documentation platform
- introduce server-side search or crawler-backed indexing
- auto-generate the full docs from source in the first pass
- document internal native bridge implementation details beyond what developers need for integration and debugging
- invent capabilities not present in the current repo surface

## 6. Recommended Experience Direction

The chosen direction is:

- onboarding-first developer docs
- full API reference coverage
- static HTML delivery
- bilingual Chinese/English switching

This is intentionally not:

- an API-reference-first dump
- a marketing portal that makes users click through cards before they can start integrating
- a file-tree-first technical archive

## 7. Information Architecture

The first release should ship these pages in both Chinese and English:

1. `Overview`
2. `Quickstart`
3. `Core APIs`
4. `Rendering`
5. `Example`
6. `Platform Notes`
7. `API Reference`

### 7.1 Reading Path for First-Time Developers

Primary reading path:

`Overview -> Quickstart -> Core APIs -> Rendering / Platform Notes`

Rationale:

- `Overview` explains the SDK package and success path
- `Quickstart` gets the user to first success quickly
- `Core APIs` groups capabilities by intent instead of by file
- `Rendering` and `Platform Notes` explain the repo-specific caveats that otherwise cause confusion later

### 7.2 Reading Path for Lookup Users

Secondary reading path:

`Overview -> Core APIs / API Reference -> Rendering / Example`

Rationale:

- lookup users still need one place to understand what this integration is
- after that, they should be able to jump directly to grouped APIs or exact anchors

## 8. Navigation Model

Desktop layout:

- persistent left navigation for page-level movement
- main content column for page body
- right rail for page-local anchors, prerequisites, warnings, and next actions

Mobile layout:

- top header with language toggle and nav trigger
- collapsible navigation drawer
- right-rail content folded inline below or above the relevant section

Rules:

- active page and current section must be visually obvious
- the language toggle must appear in the same place on every page
- navigation order must remain identical in both locales

## 9. Visual System

Recommended visual direction:

- Swiss/minimal documentation-first aesthetic
- IBM Plex Sans for body text
- JetBrains Mono for code, labels, and technical accents
- slate-based neutrals for structure
- restrained blue accents for active states and key guidance
- amber for warnings and caveats

Experience constraints:

- the docs should feel like an engineer tool, not a product homepage
- high signal density, but not an unreadable wall of API text
- code blocks should be short and paired with expected outcomes
- transitions should be subtle and should not create layout shift

## 10. Content Strategy

The content model must split narrative guidance from exact reference lookup.

### 10.1 Narrative Pages

Narrative pages:

- `Overview`
- `Quickstart`
- `Core APIs`
- `Rendering`
- `Example`
- `Platform Notes`

Purpose:

- teach flow, intent, mental model, and repo-specific caveats

These pages should answer:

- what should the developer do next
- why does this API family exist
- what success looks like
- what constraints matter in practice

### 10.2 Reference Pages

Reference page:

- `API Reference`

Purpose:

- serve as the authoritative deep-linkable lookup surface

This page should answer:

- exact method signature
- exact parameter meaning
- return and async behavior
- related events
- platform-specific caveats

### 10.3 Connection Between Narrative and Reference

Narrative pages should link to reference anchors instead of duplicating entire method docs.

Reference pages should link back to:

- quickstart usage contexts
- rendering behavior
- platform notes
- example validation flows

## 11. API Organization

The docs should organize public APIs by developer task, not by source file.

Recommended groups:

### 11.1 Engine and Session

- `createAgoraRtcClient`
- `initialize`
- `destroy`
- `getSdkVersion`
- `getErrorDescription`
- `setParameters`

### 11.2 Channel and Identity

- `setChannelProfile`
- `setClientRole`
- `joinChannel`
- `joinChannelWithUserAccount`
- `getUserInfoByUserAccount`
- `leaveChannel`
- `renewToken`

### 11.3 Audio

- `enableAudio`
- `enableLocalAudio`
- `muteLocalAudioStream`
- `muteRemoteAudioStream`
- `muteAllRemoteAudioStreams`
- `setAudioProfile`
- `enableAudioVolumeIndication`
- `setDefaultAudioRouteToSpeakerphone`
- `setEnableSpeakerphone`
- `isSpeakerphoneEnabled`
- `adjustPlaybackSignalVolume`
- `adjustUserPlaybackSignalVolume`
- `setAudioSessionOperationRestriction`

### 11.4 Video and Views

- `enableVideo`
- `enableLocalVideo`
- `muteLocalVideoStream`
- `muteRemoteVideoStream`
- `muteAllRemoteVideoStreams`
- `setVideoEncoderConfiguration`
- `setupLocalVideoView`
- `setupRemoteVideoView`
- `updateLocalVideoView`
- `updateRemoteVideoView`
- `removeLocalVideoView`
- `removeRemoteVideoView`
- `startPreview`
- `stopPreview`
- `switchCamera`

### 11.5 Rendering and Visual Controls

- `setRenderBackend`
- `setNativeVideoOverlaySuspended`
- `setBeautyEffectOptions`
- `enableContentInspect`

### 11.6 Mixing, Effects, and Diagnostics

- `startAudioMixing`
- `pauseAudioMixing`
- `resumeAudioMixing`
- `stopAudioMixing`
- `getAudioMixingCurrentPosition`
- `setAudioMixingPosition`
- `adjustAudioMixingVolume`
- `preloadEffect`
- `playEffect`
- `pauseEffect`
- `resumeEffect`
- `setEffectsVolume`
- `adjustAudioMixingPublishVolume`
- `adjustAudioMixingPlayoutVolume`
- `stopEffect`
- `setLogFilter`
- `setLogFile`

## 12. Event Documentation Strategy

Priority public events to document prominently:

- `joinChannelSuccess`
- `leaveChannel`
- `userJoined`
- `userOffline`
- `connectionStateChanged`
- `volumeIndication`
- `rtcStats`
- `localVideoTextureReady`
- `remoteVideoTextureReady`
- `renderBackendState`
- `contentInspectResult`
- `error`

Each event doc should state:

1. when it fires
2. payload shape from the public types
3. which methods usually lead to it
4. what developers typically do next

## 13. Rendering Documentation Strategy

The `Rendering` page is a core page, not an appendix.

It must explicitly document current repo truth:

- only `engine-texture` is currently supported as a render backend
- local and remote texture readiness are surfaced through events
- `displayNode` binding behavior matters for Cocos integration
- mirror behavior is part of the Cocos rendering path
- `setNativeVideoOverlaySuspended` exists for compatibility but should be explained in the context of the current texture-based delivery

This page should let developers understand the render model without reading the native bridge internals.

## 14. Example Documentation Strategy

The `Example` page should document the real QA console in `example/basic-call`, not present it as a generic showcase.

It should explain:

- the grouped actions exposed in the UI
- how `Full Demo`, `Channel`, `Mixing`, `Effect`, and `Diag` map back to public APIs
- how the example can be used as a validation surface during integration
- which runtime events are observable during the example flow

## 15. Bilingual Delivery Model

The docs must support Chinese and English switching via explicit locale paths.

Recommended path structure:

- `docs/assets/...`
- `docs/zh/index.html`
- `docs/zh/quickstart.html`
- `docs/zh/core-apis.html`
- `docs/zh/rendering.html`
- `docs/zh/example.html`
- `docs/zh/platform-notes.html`
- `docs/zh/api-reference.html`
- mirrored equivalents under `docs/en/...`

Rules:

- both locales must use the same slug names
- both locales must use the same page order
- the language toggle should preserve the current page whenever the counterpart exists
- each page must remain readable without client-side hydration

Rejected approach:

- one HTML page containing both languages and hiding one locale with JS

Reason:

- it increases page noise
- it makes maintenance harder
- it weakens link stability

## 16. Static HTML Technical Shape

Recommended implementation shape:

- hand-authored static HTML pages
- one shared `docs/assets/app.css`
- one shared `docs/assets/app.js`
- optional lightweight `search-index.js` if local client-side search is included in the first pass

This is intentionally simpler than adopting a docs framework for v1, but more disciplined than unmanaged standalone HTML files.

The page shell should be shared across all pages so that:

- navigation stays consistent
- bilingual parity is easier to maintain
- responsive behavior is centralized
- TOC and active-section behavior can be reused

## 17. Repo Constraint: `docs/` Ignore Rule

Current repo fact:

- `.gitignore` currently contains a literal `docs/` ignore rule

Implementation requirement:

- narrow the ignore behavior so the user-facing static site under `docs/` can be committed normally
- preserve any intended ignore behavior only for the specific internal subtree that should remain ignored, based on user preference

This means implementation must treat `.gitignore` normalization as part of the docs delivery work, not as a follow-up cleanup.

## 18. Acceptance Criteria

The first release is complete when all of the following are true:

- the site is browsable locally as a real static HTML doc set
- all target pages exist in both Chinese and English
- the primary onboarding path is coherent and runnable
- public methods and priority events are covered
- rendering behavior and platform caveats are understandable without reading native bridge code
- desktop and mobile layouts are both usable
- language switching works from subpages
- narrative pages and reference pages cross-link correctly

## 19. Verification Strategy

Implementation verification should include:

- open the generated site in a browser and click every page
- verify Chinese/English switching from multiple subpages
- verify responsive layouts at 375px, 768px, 1024px, and 1440px
- verify page anchors, active TOC states, and mobile navigation behavior
- cross-check documented methods against `sdk/agora-rtc/js/agora.ts`
- cross-check documented event payloads against `sdk/agora-rtc/js/types.ts`

## 20. Risks and Mitigations

### 20.1 Bilingual Drift

Risk:

- Chinese and English pages diverge in structure or coverage

Mitigation:

- identical slug names
- identical page order
- shared shell and navigation model
- release checklist that checks locale parity

### 20.2 API Drift

Risk:

- reference content falls out of sync with source

Mitigation:

- source-backed verification during implementation
- if maintenance cost rises later, add a helper generator in a future phase

### 20.3 Mobile Layout Clutter

Risk:

- left nav, right rail, and anchor systems compete on small screens

Mitigation:

- use a mobile drawer for global nav
- convert right-rail helpers into inline blocks on mobile
- prioritize current-page reading over chrome

### 20.4 Hidden Platform Constraints

Risk:

- important differences are buried on a single “limitations” page

Mitigation:

- repeat critical caveats inline near the related API or flow
- also provide one consolidated `Platform Notes` page

## 21. Recommended Implementation Sequence

1. normalize the `docs/` path and ignore-rule constraints
2. build shared page shell, CSS, and JS
3. implement the bilingual navigation model
4. implement `Overview` and `Quickstart`
5. implement `Core APIs`, `Rendering`, and `Example`
6. implement `Platform Notes` and `API Reference`
7. verify parity, responsiveness, and source alignment

## 22. Decision Summary

This design chooses:

- onboarding-first docs over reference-first docs
- bilingual static HTML over Markdown-only output
- task-based API grouping over file-based grouping
- a real developer documentation experience over a marketing-style portal

The first release should help new developers succeed quickly while still giving experienced users accurate, deep-linkable source-backed reference material.
