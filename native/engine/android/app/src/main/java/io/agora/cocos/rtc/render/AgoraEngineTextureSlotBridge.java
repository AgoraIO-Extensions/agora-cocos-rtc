package io.agora.cocos.rtc.render;

import java.nio.ByteBuffer;

final class AgoraEngineTextureSlotBridge {
    private AgoraEngineTextureSlotBridge() {}

    static native int nativeCreateSlot(int width, int height);

    static native void nativeUpdateSlot(int slotId, ByteBuffer rgbaBuffer, int rgbaLength, int width, int height);

    static native void nativeUpdateI420Slot(
        int slotId,
        ByteBuffer dataY,
        int strideY,
        ByteBuffer dataU,
        int strideU,
        ByteBuffer dataV,
        int strideV,
        int width,
        int height,
        int targetWidth,
        int targetHeight,
        int rotation,
        boolean mirror
    );

    static native void nativeReleaseSlot(int slotId);
}
