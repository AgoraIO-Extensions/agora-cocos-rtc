package io.agora.cocos.rtc.render;

public interface AgoraRenderResultCallback {
    void onSuccess();

    void onError(String message);
}
