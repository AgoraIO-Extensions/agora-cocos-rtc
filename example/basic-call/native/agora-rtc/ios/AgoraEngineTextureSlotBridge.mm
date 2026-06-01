#import "AgoraEngineTextureSlotBridge.h"

#import <AgoraRtcKit/AgoraObjects.h>
#include "agora/AgoraEngineTextureBridge.h"

@implementation AgoraEngineTextureSlotBridge

+ (NSNumber *)createSlotWithWidth:(NSNumber *)width height:(NSNumber *)height {
    int slotId = agora::cocos::create_agora_engine_texture_slot(width.intValue, height.intValue);
    return @(slotId);
}

+ (NSNumber *)isSlotReady:(NSNumber *)slotId {
    return @(agora::cocos::is_agora_engine_texture_slot_ready(slotId.intValue));
}

+ (void)updateSlot:(NSNumber *)slotId rgbaData:(NSData *)rgbaData width:(NSNumber *)width height:(NSNumber *)height {
    if (rgbaData == nil || rgbaData.length == 0) {
        return;
    }
    agora::cocos::update_agora_engine_texture_slot(
        slotId.intValue,
        static_cast<const uint8_t *>(rgbaData.bytes),
        static_cast<size_t>(rgbaData.length),
        width.intValue,
        height.intValue
    );
}

+ (void)updateSlot:(NSNumber *)slotId pixelBuffer:(CVPixelBufferRef)pixelBuffer {
    if (pixelBuffer == nil) {
        return;
    }
    CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    void *baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer);
    size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
    size_t width = CVPixelBufferGetWidth(pixelBuffer);
    size_t height = CVPixelBufferGetHeight(pixelBuffer);
    if (baseAddress != NULL && bytesPerRow > 0 && height > 0) {
        NSData *data = [NSData dataWithBytes:baseAddress length:bytesPerRow * height];
        [self updateSlot:slotId rgbaData:data width:@((NSInteger)width) height:@((NSInteger)height)];
    }
    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
}

+ (void)updateSlot:(NSNumber *)slotId videoFrame:(AgoraOutputVideoFrame *)videoFrame {
    if (videoFrame == nil) {
        return;
    }

    switch (videoFrame.type) {
        case 12:
            if (videoFrame.pixelBuffer == nil) {
                return;
            }
            CVPixelBufferLockBaseAddress(videoFrame.pixelBuffer, kCVPixelBufferLock_ReadOnly);
            {
                uint8_t *yBase = static_cast<uint8_t *>(CVPixelBufferGetBaseAddressOfPlane(videoFrame.pixelBuffer, 0));
                uint8_t *uvBase = static_cast<uint8_t *>(CVPixelBufferGetBaseAddressOfPlane(videoFrame.pixelBuffer, 1));
                size_t yStride = CVPixelBufferGetBytesPerRowOfPlane(videoFrame.pixelBuffer, 0);
                size_t uvStride = CVPixelBufferGetBytesPerRowOfPlane(videoFrame.pixelBuffer, 1);
                size_t width = CVPixelBufferGetWidth(videoFrame.pixelBuffer);
                size_t height = CVPixelBufferGetHeight(videoFrame.pixelBuffer);
                if (yBase != NULL && uvBase != NULL && yStride > 0 && uvStride > 0) {
                    agora::cocos::update_agora_engine_texture_nv12_slot(
                        slotId.intValue,
                        yBase,
                        static_cast<int>(yStride),
                        uvBase,
                        static_cast<int>(uvStride),
                        static_cast<int>(width),
                        static_cast<int>(height)
                    );
                }
            }
            CVPixelBufferUnlockBaseAddress(videoFrame.pixelBuffer, kCVPixelBufferLock_ReadOnly);
            break;
        case 13:
        case 14:
            [self updateSlot:slotId pixelBuffer:videoFrame.pixelBuffer];
            break;
        case 1:
            if (videoFrame.yBuffer == nil || videoFrame.uBuffer == nil || videoFrame.vBuffer == nil) {
                return;
            }
            agora::cocos::update_agora_engine_texture_i420_slot(
                slotId.intValue,
                static_cast<const uint8_t *>(videoFrame.yBuffer),
                static_cast<int>(videoFrame.yStride),
                static_cast<const uint8_t *>(videoFrame.uBuffer),
                static_cast<int>(videoFrame.uStride),
                static_cast<const uint8_t *>(videoFrame.vBuffer),
                static_cast<int>(videoFrame.vStride),
                static_cast<int>(videoFrame.width),
                static_cast<int>(videoFrame.height)
            );
            break;
        default:
            break;
    }
}

+ (void)releaseSlot:(NSNumber *)slotId {
    agora::cocos::release_agora_engine_texture_slot(slotId.intValue);
}

@end
