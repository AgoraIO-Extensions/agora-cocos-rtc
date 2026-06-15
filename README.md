# Agora Cocos RTC SDK

*English*

Use Agora RTC SDK with Cocos Creator.

This repository contains the Cocos extension package and native bridge templates for Agora RTC 4.5.3 integrations on Android and iOS.

- The SDK package is under `sdk/agora-rtc`.
- Release helpers are under `scripts`.

## Prerequisites

- Cocos Creator 3.8.8
- Node.js 18+
- Android Studio / Android SDK / JDK 17 for Android integrations
- Xcode 15+ and CocoaPods for iOS integrations
- A valid Agora App ID.

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
3. Build a distributable extension package when needed.
  ```bash
   ./scripts/package-sdk.sh ./dist
  ```

## Repository Layout

- `sdk/agora-rtc`: Cocos extension and SDK package delivered to customers.
- `sdk/agora-rtc/js`: TypeScript API wrapper.
- `sdk/agora-rtc/templates/android`: Android bridge template.
- `sdk/agora-rtc/templates/ios`: iOS bridge template.
- `tests`: Node.js regression tests for SDK packaging and bridge wiring.
- `scripts`: Local package, dependency update, and release helpers.

## Help

For more information:

- See [Agora RTC Cocos Plugin](sdk/agora-rtc/README.md) for the SDK package contents and API surface.
- Browse the bilingual static developer docs at `docs/zh/index.html` or `docs/en/index.html`.
- Run `npm test` or `npm run verify` for local validation.

## Appendix

### Create an Account and Obtain an App ID

To use Agora RTC, obtain an App ID from the Agora Console:

1. Create a developer account at [agora.io](https://dashboard.agora.io/signin/).
2. Open **Projects** > **Project List** in the dashboard.
3. Copy the App ID into your Cocos project configuration.
4. Generate and pass a token if your project has App Certificate enabled.
