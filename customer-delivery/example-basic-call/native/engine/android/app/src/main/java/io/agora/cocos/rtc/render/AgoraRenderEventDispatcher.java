package io.agora.cocos.rtc.render;

import org.json.JSONObject;

public interface AgoraRenderEventDispatcher {
    void dispatchEvent(String eventName, JSONObject payload);
}
