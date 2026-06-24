#import <Foundation/Foundation.h>
#import "apple/JsbBridgeWrapper.h"
#import "apple/JsbBridge.h"

/**
 * Native bridge registrar.
 * Integrate this file into the exported iOS target and forward Cocos bridge payloads
 * to `AgoraRtcBridge`.
 */
@interface AgoraRtcPlugin : NSObject

+ (instancetype)sharedInstance;
+ (void)dispatchEventToScript:(NSString *)eventName payload:(NSString *)payload;
- (void)attachBridge;
- (void)handleScriptRequest:(NSString *)payload;

@end

@implementation AgoraRtcPlugin {
    id _bridge;
    OnScriptEventListener _listener;
    ICallback _bridgeCallback;
}

+ (Class)resolveBridgeClass {
    Class bridgeClass = NSClassFromString(@"AgoraRtcBridge");
    if (bridgeClass) {
        return bridgeClass;
    }

    NSString *moduleName = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"CFBundleExecutable"];
    if (!moduleName.length) {
        return nil;
    }

    moduleName = [moduleName stringByReplacingOccurrencesOfString:@"-" withString:@"_"];
    NSString *qualifiedName = [NSString stringWithFormat:@"%@.%@", moduleName, @"AgoraRtcBridge"];
    return NSClassFromString(qualifiedName);
}

+ (instancetype)sharedInstance {
    static AgoraRtcPlugin *plugin;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        plugin = [[AgoraRtcPlugin alloc] init];
    });
    return plugin;
}

+ (void)dispatchEventToScript:(NSString *)eventName payload:(NSString *)payload {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[JsbBridge sharedInstance] sendToScript:eventName arg1:payload];
    });
}

- (instancetype)init {
    self = [super init];
    if (self) {
        Class bridgeClass = [AgoraRtcPlugin resolveBridgeClass];
        NSLog(@"[agora-rtc-native] AgoraRtcPlugin init bridgeClass=%@", bridgeClass);
        if (bridgeClass) {
            _bridge = [bridgeClass new];
        }
        NSLog(@"[agora-rtc-native] AgoraRtcPlugin init bridge=%@", _bridge);
        _listener = ^(NSString *payload) {
            if (_bridge && [_bridge respondsToSelector:@selector(handleScriptRequest:)]) {
                NSLog(@"[agora-rtc-native] listener request payload=%@", payload);
                [_bridge handleScriptRequest:payload];
            }
        };
        _listener = [_listener copy];
        _bridgeCallback = ^(NSString *eventName, NSString *arg) {
            NSLog(@"[agora-rtc-native] bridge callback event=%@ arg=%@", eventName, arg);
            if (![eventName isEqualToString:@"agora:request"]) {
                return;
            }
            if (_bridge && [_bridge respondsToSelector:@selector(handleScriptRequest:)]) {
                [_bridge handleScriptRequest:arg];
            }
        };
        _bridgeCallback = [_bridgeCallback copy];
    }
    return self;
}

- (void)attachBridge {
    NSLog(@"[agora-rtc-native] attachBridge bridge=%@", _bridge);
    [[JsbBridgeWrapper sharedInstance] addScriptEventListener:@"agora:request" listener:_listener];
    [[JsbBridge sharedInstance] setCallback:_bridgeCallback];
}

- (void)handleScriptRequest:(NSString *)payload {
    if (_bridge && [_bridge respondsToSelector:@selector(handleScriptRequest:)]) {
        [_bridge handleScriptRequest:payload];
    }
}

@end
