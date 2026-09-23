# Agora RTC iOS CocoaPods Setup

Pod: AgoraAudio_Special_iOS
Version: 4.5.3.5.BASIC

## Steps

1. Open the exported Xcode project directory.
2. Generate the Podfile with `node scripts/generate-ios-podfile.mjs`.
3. Run `pod install` in the exported iOS project directory.
4. Open the generated workspace and build the app target.
