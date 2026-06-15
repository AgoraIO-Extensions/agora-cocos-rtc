#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
#import "apple/JsbBridgeWrapper.h"
#import "apple/JsbBridge.h"

@interface DemoPermissionsPlugin : NSObject

+ (instancetype)sharedInstance;
+ (void)dispatchEventToScript:(NSString *)eventName payload:(NSString *)payload;
- (void)attachBridge;
- (void)handleScriptRequest:(NSString *)payload;

@end

@implementation DemoPermissionsPlugin {
    OnScriptEventListener _listener;
}

+ (instancetype)sharedInstance {
    static DemoPermissionsPlugin *plugin;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        plugin = [[DemoPermissionsPlugin alloc] init];
    });
    return plugin;
}

+ (void)dispatchEventToScript:(NSString *)eventName payload:(NSString *)payload {
    [[JsbBridge sharedInstance] sendToScript:eventName arg1:payload];
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _listener = ^(NSString *payload) {
            [self handleScriptRequest:payload];
        };
        _listener = [_listener copy];
    }
    return self;
}

- (void)attachBridge {
    [[JsbBridgeWrapper sharedInstance] addScriptEventListener:@"demo:permissions:request" listener:_listener];
}

- (void)handleScriptRequest:(NSString *)payload {
    NSData *data = [payload dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) {
        [self dispatchError:@"" message:@"Invalid demo permission payload."];
        return;
    }

    NSError *error = nil;
    NSDictionary *request = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    if (![request isKindOfClass:[NSDictionary class]] || error) {
        [self dispatchError:@"" message:@"Invalid demo permission payload."];
        return;
    }

    NSString *requestId = request[@"requestId"] ?: @"";
    NSString *permission = request[@"permission"] ?: @"";
    if ([permission isEqualToString:@"camera"]) {
        [self ensureCameraPermissionForRequestId:requestId];
        return;
    }
    if ([permission isEqualToString:@"microphone"]) {
        [self ensureMicrophonePermissionForRequestId:requestId];
        return;
    }

    [self dispatchError:requestId message:[NSString stringWithFormat:@"Unsupported demo permission: %@", permission]];
}

- (void)ensureCameraPermissionForRequestId:(NSString *)requestId {
    switch ([AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo]) {
        case AVAuthorizationStatusAuthorized:
            [self dispatchOk:requestId];
            return;
        case AVAuthorizationStatusDenied:
        case AVAuthorizationStatusRestricted:
            [self dispatchPermissionResult:NO requestId:requestId permission:@"camera"];
            return;
        case AVAuthorizationStatusNotDetermined:
            [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    [self dispatchPermissionResult:granted requestId:requestId permission:@"camera"];
                });
            }];
            return;
    }
}

- (void)ensureMicrophonePermissionForRequestId:(NSString *)requestId {
    AVAudioSession *audioSession = [AVAudioSession sharedInstance];
    if (@available(iOS 17.0, *)) {
        switch ([audioSession recordPermission]) {
            case AVAudioSessionRecordPermissionGranted:
                [self dispatchOk:requestId];
                return;
            case AVAudioSessionRecordPermissionDenied:
                [self dispatchPermissionResult:NO requestId:requestId permission:@"microphone"];
                return;
            case AVAudioSessionRecordPermissionUndetermined:
                [audioSession requestRecordPermission:^(BOOL granted) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [self dispatchPermissionResult:granted requestId:requestId permission:@"microphone"];
                    });
                }];
                return;
        }
    } else {
        switch ([audioSession recordPermission]) {
            case AVAudioSessionRecordPermissionGranted:
                [self dispatchOk:requestId];
                return;
            case AVAudioSessionRecordPermissionDenied:
                [self dispatchPermissionResult:NO requestId:requestId permission:@"microphone"];
                return;
            case AVAudioSessionRecordPermissionUndetermined:
                [audioSession requestRecordPermission:^(BOOL granted) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        [self dispatchPermissionResult:granted requestId:requestId permission:@"microphone"];
                    });
                }];
                return;
        }
    }
}

- (void)dispatchPermissionResult:(BOOL)granted requestId:(NSString *)requestId permission:(NSString *)permission {
    if (granted) {
        [self dispatchOk:requestId];
        return;
    }

    NSString *message = [permission isEqualToString:@"camera"]
        ? @"Camera permission is required."
        : @"Microphone permission is required.";
    [self dispatchError:requestId message:message];
}

- (void)dispatchOk:(NSString *)requestId {
    NSDictionary *payload = @{
        @"requestId": requestId ?: @"",
        @"ok": @YES,
    };
    [self.class dispatchPayload:payload];
}

- (void)dispatchError:(NSString *)requestId message:(NSString *)message {
    NSDictionary *payload = @{
        @"requestId": requestId ?: @"",
        @"ok": @NO,
        @"error": @{
            @"message": message ?: @"Demo permission request failed.",
        },
    };
    [self.class dispatchPayload:payload];
}

+ (void)dispatchPayload:(NSDictionary *)payload {
    NSError *error = nil;
    NSData *json = [NSJSONSerialization dataWithJSONObject:payload options:0 error:&error];
    if (!json || error) {
        return;
    }

    NSString *text = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
    if (!text) {
        return;
    }

    [DemoPermissionsPlugin dispatchEventToScript:@"demo:permissions:response" payload:text];
}

@end
