# Agora RTC iOS Swift Package Manager Setup

Repository: https://github.com/AgoraIO/AgoraAudio_iOS.git
Version: 4.5.3-a1
Products: RtcBasic, AINS, AINSLL, AudioBeauty, ClearVision, ContentInspect, SpatialAudio, VirtualBackground, AIAEC, AIAECLL, VQA, FaceDetection, FaceCapture, LipSync, VideoCodecEnc, VideoAv1CodecEnc, ReplayKit

## Steps

1. Open the exported Xcode project.
2. Add a Swift Package dependency from the repository above.
3. Pin the dependency to tag 4.5.3-a1.
4. Link the package product to the app target.
5. Copy the bridge sources from the plugin template into the exported iOS project if they are not already present.
