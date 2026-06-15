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
        __weak typeof(self) weakSelf = self;
        _listener = ^(NSString *payload) {
            [weakSelf handleScriptRequest:payload];
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
        case AVAuthorizationStatusNotDetermined:
            dispatch_async(dispatch_get_main_queue(), ^{
                [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
                    [self dispatchPermissionResult:granted requestId:requestId permission:@"camera"];
                }];
            });
            return;
        case AVAuthorizationStatusDenied:
        case AVAuthorizationStatusRestricted:
        default:
            [self dispatchError:requestId message:@"Camera permission is required."];
            return;
    }
}

- (void)ensureMicrophonePermissionForRequestId:(NSString *)requestId {
    switch ([[AVAudioSession sharedInstance] recordPermission]) {
        case AVAudioSessionRecordPermissionGranted:
            [self dispatchOk:requestId];
            return;
        case AVAudioSessionRecordPermissionUndetermined:
            dispatch_async(dispatch_get_main_queue(), ^{
                [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
                    [self dispatchPermissionResult:granted requestId:requestId permission:@"microphone"];
                }];
            });
            return;
        case AVAudioSessionRecordPermissionDenied:
        default:
            [self dispatchError:requestId message:@"Microphone permission is required."];
            return;
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
    [self dispatchResponse:@{
        @"requestId": requestId ?: @"",
        @"ok": @YES,
    }];
}

- (void)dispatchError:(NSString *)requestId message:(NSString *)message {
    [self dispatchResponse:@{
        @"requestId": requestId ?: @"",
        @"ok": @NO,
        @"error": @{
            @"message": message ?: @"Demo permission request failed.",
        },
    }];
}

- (void)dispatchResponse:(NSDictionary *)response {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:response options:0 error:&error];
    if (!data || error) {
        return;
    }
    NSString *payload = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    if (!payload) {
        return;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
        [DemoPermissionsPlugin dispatchEventToScript:@"demo:permissions:response" payload:payload];
    });
}

@end
