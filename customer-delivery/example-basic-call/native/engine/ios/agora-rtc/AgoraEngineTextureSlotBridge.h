#import <Foundation/Foundation.h>
#import <CoreVideo/CoreVideo.h>

@class AgoraOutputVideoFrame;

NS_ASSUME_NONNULL_BEGIN

@interface AgoraEngineTextureSlotBridge : NSObject

+ (NSNumber *)createSlotWithWidth:(NSNumber *)width height:(NSNumber *)height;
+ (NSNumber *)isSlotReady:(NSNumber *)slotId;
+ (void)configureSlot:(NSNumber *)slotId options:(NSDictionary *)options;
+ (void)updateSlot:(NSNumber *)slotId rgbaData:(NSData *)rgbaData width:(NSNumber *)width height:(NSNumber *)height;
+ (void)updateSlot:(NSNumber *)slotId pixelBuffer:(CVPixelBufferRef)pixelBuffer;
+ (void)updateSlot:(NSNumber *)slotId videoFrame:(AgoraOutputVideoFrame *)videoFrame;
+ (void)releaseSlot:(NSNumber *)slotId;

@end

NS_ASSUME_NONNULL_END
