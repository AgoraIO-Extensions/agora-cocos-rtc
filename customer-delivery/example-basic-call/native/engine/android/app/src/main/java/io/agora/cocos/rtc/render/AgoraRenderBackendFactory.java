package io.agora.cocos.rtc.render;

public final class AgoraRenderBackendFactory {
    private AgoraRenderBackendFactory() {}

    public static AgoraRenderBackend create(String backendType, AgoraRenderEventDispatcher eventDispatcher) {
      if ("texture-view".equals(backendType)) {
        return new TextureViewRenderBackend();
      }

      if ("engine-texture".equals(backendType)) {
        return new RawFrameTextureRenderBackend(eventDispatcher);
      }

      return new SurfaceViewRenderBackend();
    }
}
