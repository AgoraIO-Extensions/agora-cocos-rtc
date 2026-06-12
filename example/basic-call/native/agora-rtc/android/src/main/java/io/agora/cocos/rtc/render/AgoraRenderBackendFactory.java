package io.agora.cocos.rtc.render;

public final class AgoraRenderBackendFactory {
    private AgoraRenderBackendFactory() {}

    public static AgoraRenderBackend create(String backendType, AgoraRenderEventDispatcher eventDispatcher) {
      return new RawFrameTextureRenderBackend(eventDispatcher);
    }
}
