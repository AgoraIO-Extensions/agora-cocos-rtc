# Agora Cocos RTC SDK

*English*

Use Agora RTC SDK with Cocos Creator.

This repository contains the Cocos extension package, native bridge templates, and a basic-call example project for validating the Agora RTC 4.5.3 integration on Android and iOS.

- The SDK package is under `sdk/agora-rtc`.
- The example project is under `example/basic-call`.
- Build and integration helpers are under `scripts`.

## Prerequisites

- Cocos Creator 3.8.8
- Node.js 18+
- Android Studio / Android SDK / JDK 17 for Android builds
- Xcode 15+ and CocoaPods for iOS builds
- A valid Agora App ID. A token and channel ID are required for real RTC join validation.

## Usage

1. Clone the repository.
  ```bash
   git clone git@github.com:AgoraIO-Extensions/agora-cocos-rtc.git
   cd Agora-Cocos-RTC-SDK
  ```
2. Install dependencies and run the repository checks.
  ```bash
   npm install
   npm test
  ```
3. Prepare the Cocos example project.
  ```bash
   ./scripts/prepare-example.sh
  ```
4. Configure the runtime credentials in:
  ```text
   example/basic-call/assets/resources/agora-config.json
  ```
5. Open `example/basic-call` with Cocos Creator 3.8.8, or run a platform script:
  ```bash
   ./scripts/dev-android.sh
   ./scripts/dev-ios.sh
  ```
6. Build a distributable extension package when needed.
  ```bash
   ./scripts/package-sdk.sh ./dist
  ```

## Repository Layout

- `sdk/agora-rtc`: Cocos extension and SDK package delivered to customers.
- `sdk/agora-rtc/js`: TypeScript API wrapper.
- `sdk/agora-rtc/templates/android`: Android bridge template.
- `sdk/agora-rtc/templates/ios`: iOS bridge template.
- `example/basic-call`: Cocos QA example project.
- `tests`: Node.js regression tests for SDK packaging, bridge wiring, and example behavior.
- `scripts`: Local build, package, dependency update, and platform validation helpers.

## Help

For more information:

- See [Basic Call Example](example/basic-call/README.md) for the Cocos example workflow.
- See [Agora RTC Cocos Plugin](sdk/agora-rtc/README.md) for the SDK package contents and API surface.
- Run `npm test` or `npm run verify` for local validation.
- Run `./scripts/dev-android.sh` or `./scripts/dev-ios.sh` for platform validation.

## Appendix

### Create an Account and Obtain an App ID

To use Agora RTC, obtain an App ID from the Agora Console:

1. Create a developer account at [agora.io](https://dashboard.agora.io/signin/).
2. Open **Projects** > **Project List** in the dashboard.
3. Copy the App ID into `example/basic-call/assets/resources/agora-config.json`.
4. Add a token and channel ID if your project has App Certificate enabled.
