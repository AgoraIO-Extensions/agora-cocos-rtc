# Customer Delivery Note

Updated: `2026-05-20`

## Delivery Status

The current `Agora Cocos RTC SDK` is ready for customer-facing evaluation, internal QA, and project integration.

This delivery includes:

- unified JavaScript API
- Android and iOS native bridges
- local and remote video display
- reference example project
- Android and iOS export scripts
- baseline automated tests

## Deliverables

Recommended customer-facing files:

1. `dist/agora-rtc-cocos-plugin.zip`
2. `example/basic-call`
3. Integration and verification docs:
   - [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md)
   - [api-verification-matrix.md](api-verification-matrix.md)
   - [android-debug.md](android-debug.md)

Regenerate the SDK zip with:

```bash
./scripts/package-sdk.sh ./dist
```

Regenerate the combined customer delivery directory with:

```bash
./scripts/package-customer-delivery.sh ./dist/customer-delivery
```

## Capability Scope

### Unified API Surface

The SDK provides a unified JavaScript API for:

- Engine / Log
- Channel / Role
- Audio
- Video
- Native View / Render
- Mixing / Effect
- Parameters

See [Agora-Cocos-RTC-SDK-API-Guide.md](Agora-Cocos-RTC-SDK-API-Guide.md) for the complete list.

### Video Display

- Android
  - Local and remote video can be displayed.
  - `engine-texture` is connected so video can enter the Cocos texture pipeline.
- iOS
  - Local and remote video can be displayed.
  - The main delivery path also includes `engine-texture`.

### Example / QA

The example is a QA console, not only a minimal demo. It supports:

- initialization
- join and leave
- render backend switching
- local preview
- audio and video controls
- event and status inspection
- local and remote video area validation

## Platform Status

### Android

Android has reached the main delivery goals:

- native bridge is connected
- local and remote video are connected
- `engine-texture` is available
- export, build, install, and launch flow has been validated

### iOS

iOS has reached the main delivery goals:

- native bridge is connected
- local and remote video are connected
- example UI is visible
- signing, install, and launch flow has been validated on device

## Boundaries

Keep these boundaries explicit in customer-facing communication:

- Android
  - `setDefaultAudioRouteToSpeakerphone` is supported.
  - `setAudioSessionOperationRestriction` returns `unsupported`.
- iOS
  - `texture-view` is not a standalone primary delivery path.
  - The delivery focus is `surface-view` and `engine-texture`.
- Shared
  - `warning` is present only in the JavaScript type surface. Native callback delivery is not promised.
  - `EnableVideoObserver` is internal and not exposed as public API.
  - `PreloadEngine / UnloadEngine` semantics are covered by `initialize / destroy`.

## Verification Notes

The repository includes automated and platform-level validation:

- `npm test`
- Android export, build, install, and launch validation
- iOS export, build, signing, install, and launch validation

Real RTC validation still requires a valid `appId`, token, and `channelId`. Customers should run final device validation with their own Agora credentials.

## Recommended Customer Message

The current SDK version provides Android and iOS integration capability for Cocos Creator, including a unified JavaScript API, native bridges, an example project, and export scripts.

Local and remote video display paths are connected on both Android and iOS, so the SDK is ready for customer integration, joint debugging, and QA validation. Remaining platform differences are documented explicitly, and final media validation should be completed with customer-owned Agora credentials.
