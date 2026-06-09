# API and Callback Audit Design

Date: 2026-06-09

## Goal

Audit the currently exposed Agora Cocos RTC wrapper API and callback surface for missing parameters or cross-layer mismatches.

The audit is limited to API methods and callback events that this repository already exposes or declares. Agora Native SDK 4.5.3 capabilities that are not exposed by this wrapper are not treated as bugs; they may be noted only as optional enhancement candidates.

## Scope

Include:

- TypeScript public API in `sdk/agora-rtc/js/agora.ts`.
- TypeScript bridge contracts and events in `sdk/agora-rtc/js/types.ts`.
- SDK README API list in `sdk/agora-rtc/README.md`.
- Android native bridge templates under `sdk/agora-rtc/templates/android`.
- iOS native bridge templates under `sdk/agora-rtc/templates/ios`.
- Integration API call cases in `test_shard/integration_test_app/src/api_call_testcases.ts`.
- Local Agora 4.5.3 Android AAR and iOS headers only where a declared wrapper callback or method appears to drop an original native parameter.

Exclude:

- Full Agora Native SDK API coverage analysis.
- New API implementation.
- Device integration test execution.
- Any code changes beyond the audit report unless requested separately.

## Approach

Use an alignment matrix for the current wrapper surface:

- Compare `AgoraMethod` with `AgoraRtcClient` methods.
- Compare `AgoraMethod` with Android and iOS native switch handlers.
- Compare `AgoraMethod` with integration test cases.
- Compare README API Surface with `AgoraMethod`.
- Compare `AgoraEventMap` with native event dispatch sites across Android and iOS templates.
- For suspected missing callback payload fields, verify against the local 4.5.3 AAR or iOS headers.

## Output

Produce a Chinese audit report with these sections:

- API alignment summary.
- Callback alignment summary.
- Confirmed missing parameters.
- Documentation gaps.
- Type-declared events not emitted by current native templates.
- Optional enhancement candidates from Agora 4.5.3 signatures, clearly marked as not bugs.

Each finding should cite concrete files and line numbers.

## Known Initial Findings To Verify

Initial repository inspection suggests:

- The 54 bridge methods are aligned across TypeScript method union, client methods, Android handlers, iOS handlers, and integration API call cases.
- `setNativeVideoOverlaySuspended` exists in the wrapper and tests but is absent from the README API Surface.
- `joinChannelSuccess` and `userJoined` native callbacks include `elapsed` in Android and iOS SDK signatures, but the current wrapper payload types and native dispatch payloads do not expose it.
- `AgoraEventMap` declares `localVideoFrame`, `remoteVideoFrame`, and `warning`, but current native templates do not appear to emit those events.

These are starting hypotheses; the final audit must re-check evidence before stating them as conclusions.

## Validation

Validation is evidence-based and static:

- Run extraction commands and keep the resulting inventories for:
  - `AgoraMethod` values.
  - `AgoraRtcClient` public methods.
  - README API Surface rows.
  - Android native bridge handlers.
  - iOS native bridge handlers.
  - Integration API call cases.
  - `AgoraEventMap` declarations.
  - Android and iOS native event dispatch sites.
- Inspect native callback dispatch payloads directly.
- Use local Android AAR `javap` and local iOS headers for signature confirmation when needed.
- Do not claim runtime behavior beyond what static source and headers prove.

## Acceptance Criteria

- The audit report distinguishes confirmed bugs from documentation gaps and optional enhancements.
- The audit report is written in Chinese.
- Every finding category has concrete source references, including confirmed missing parameters, documentation gaps, type-declared events not emitted, and optional enhancement candidates.
- The report includes the inventory or matrix evidence used to support each classification.
- The report does not classify unexposed Agora Native SDK fields as wrapper bugs.
- No code is modified as part of the audit.
