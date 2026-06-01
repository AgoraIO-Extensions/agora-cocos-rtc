package io.agora.cocos.rtc.render;

import android.app.Activity;

import org.json.JSONObject;

import io.agora.rtc2.RtcEngine;

public interface AgoraRenderBackend {
    String getType();

    void bindEngine(RtcEngine rtcEngine);

    void release();

    void setupLocalVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback);

    void setupRemoteVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback);

    void updateLocalVideoView(JSONObject params, AgoraRenderResultCallback callback);

    void updateRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback);

    void removeLocalVideoView(AgoraRenderResultCallback callback);

    void removeRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback);

    void setNativeVideoOverlaySuspended(boolean suspended, AgoraRenderResultCallback callback);

    void startPreview(AgoraRenderResultCallback callback);

    void stopPreview(AgoraRenderResultCallback callback);

    void switchCamera(AgoraRenderResultCallback callback);
}
