import AgoraRtcKit
import AVFoundation
import Foundation
import UIKit
import CoreVideo

@objcMembers
final class TextureSlotState: NSObject {
    let slotId: Int
    let width: Int
    let height: Int
    var readyDispatched = false

    init(slotId: Int, width: Int, height: Int) {
        self.slotId = slotId
        self.width = width
        self.height = height
    }
}

@objcMembers
final class AgoraRtcBridge: NSObject, AgoraRtcEngineDelegate, AgoraVideoFrameDelegate {
    private let responseEventName = "agora:response"
    private let callbackEventName = "agora:event"

    private var rtcEngine: AgoraRtcEngineKit?
    private var renderBackend = "surface-view"
    private var localCanvasView: UIView?
    private var localCanvas: AgoraRtcVideoCanvas?
    private var remoteCanvasViews: [UInt: UIView] = [:]
    private var remoteCanvases: [UInt: AgoraRtcVideoCanvas] = [:]
    private var localTextureRequested = false
    private var localTextureSlot: TextureSlotState?
    private var remoteTextureUids = Set<UInt>()
    private var remoteTextureSlots: [UInt: TextureSlotState] = [:]

    private func sharedInstance(named className: String) -> NSObject? {
        guard let type = NSClassFromString(className) as? NSObject.Type else {
            return nil
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("sharedInstance")
        guard typeObject.responds?(to: selector) == true, let unmanaged = typeObject.perform?(selector) else {
            return nil
        }
        return unmanaged.takeUnretainedValue() as? NSObject
    }

    private func dispatchToScript(event: String, payload: String) {
        if let pluginType = NSClassFromString("AgoraRtcPlugin") as? NSObject.Type {
            let pluginObject: AnyObject = pluginType
            let selector = NSSelectorFromString("dispatchEventToScript:payload:")
            if pluginObject.responds?(to: selector) == true {
                NSLog("[agora-rtc-native] dispatchToScript via AgoraRtcPlugin event=%@", event)
                _ = pluginObject.perform?(selector, with: event, with: payload)
                return
            }
        }

        if let bridge = sharedInstance(named: "JsbBridge") {
            let selector = NSSelectorFromString("sendToScript:arg1:")
            if bridge.responds(to: selector) {
                NSLog("[agora-rtc-native] dispatchToScript via JsbBridge event=%@", event)
                _ = bridge.perform(selector, with: event, with: payload)
                return
            }
        }

        if let wrapper = sharedInstance(named: "JsbBridgeWrapper") {
            let selector = NSSelectorFromString("dispatchEventToScript:arg:")
            if wrapper.responds(to: selector) {
                NSLog("[agora-rtc-native] dispatchToScript via JsbBridgeWrapper event=%@", event)
                _ = wrapper.perform(selector, with: event, with: payload)
                return
            }
        }

        NSLog("[agora-rtc-native] dispatchToScript failed event=%@ payload=%@", event, payload)
    }

    private func debugDispatchTargets() -> String {
        let plugin: AnyClass? = NSClassFromString("AgoraRtcPlugin")
        let bridge = sharedInstance(named: "JsbBridge")
        let wrapper = sharedInstance(named: "JsbBridgeWrapper")
        return "plugin=\(String(describing: plugin)) jsBridge=\(String(describing: bridge)) wrapper=\(String(describing: wrapper))"
    }

    private func qualifiedSwiftClassName(_ simpleName: String) -> String {
        guard let moduleName = Bundle.main.object(forInfoDictionaryKey: "CFBundleExecutable") as? String else {
            return simpleName
        }
        return "\(moduleName.replacingOccurrences(of: "-", with: "_")).\(simpleName)"
    }

    private func resolveSwiftClass(_ simpleName: String) -> AnyClass? {
        NSClassFromString(simpleName) ?? NSClassFromString(qualifiedSwiftClassName(simpleName))
    }

    private func instantiateBridgeClass(_ simpleName: String) -> NSObject? {
        guard let type = resolveSwiftClass(simpleName) as? NSObject.Type else {
            return nil
        }
        return type.init()
    }

    private func textureSlotBridgeClass() -> NSObject.Type? {
        guard let type = resolveSwiftClass("AgoraEngineTextureSlotBridge") as? NSObject.Type else {
            return nil
        }
        return type
    }

    private func createTextureSlot(width: Int, height: Int) -> Int? {
        guard let type = textureSlotBridgeClass() else {
            return nil
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("createSlotWithWidth:height:")
        guard typeObject.responds?(to: selector) == true,
              let unmanaged = typeObject.perform?(selector, with: NSNumber(value: width), with: NSNumber(value: height)),
              let slotNumber = unmanaged.takeUnretainedValue() as? NSNumber else {
            return nil
        }
        return slotNumber.intValue
    }

    private func updateTextureSlot(slotId: Int, pixelBuffer: CVPixelBuffer) {
        guard let type = textureSlotBridgeClass() else {
            return
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("updateSlot:pixelBuffer:")
        guard typeObject.responds?(to: selector) == true else {
            return
        }
        _ = typeObject.perform?(selector, with: NSNumber(value: slotId), with: pixelBuffer)
    }

    private func updateTextureSlot(slotId: Int, videoFrame: AgoraOutputVideoFrame) {
        guard let type = textureSlotBridgeClass() else {
            return
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("updateSlot:videoFrame:")
        guard typeObject.responds?(to: selector) == true else {
            return
        }
        _ = typeObject.perform?(selector, with: NSNumber(value: slotId), with: videoFrame)
    }

    private func releaseTextureSlot(slotId: Int) {
        guard let type = textureSlotBridgeClass() else {
            return
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("releaseSlot:")
        guard typeObject.responds?(to: selector) == true else {
            return
        }
        _ = typeObject.perform?(selector, with: NSNumber(value: slotId))
    }

    private func isTextureSlotReady(slotId: Int) -> Bool {
        guard let type = textureSlotBridgeClass() else {
            return false
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("isSlotReady:")
        guard typeObject.responds?(to: selector) == true,
              let unmanaged = typeObject.perform?(selector, with: NSNumber(value: slotId)),
              let ready = unmanaged.takeUnretainedValue() as? NSNumber else {
            return false
        }
        return ready.boolValue
    }

    func handleScriptRequest(_ payload: String) {
        NSLog("[agora-rtc-native] handleScriptRequest payload=%@", payload)
        guard
            let data = payload.data(using: .utf8),
            let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            NSLog("[agora-rtc-native] handleScriptRequest invalid payload")
            return
        }

        let method = request["method"] as? String ?? ""
        let requestId = request["requestId"] as? String ?? ""
        let params = request["params"] as? [String: Any] ?? [:]
        NSLog("[agora-rtc-native] parsed method=%@ requestId=%@", method, requestId)

        switch method {
        case "initialize":
            handleInitialize(requestId: requestId, params: params)
        case "getSdkVersion":
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
                "result": AgoraRtcEngineKit.getSdkVersion(),
            ])
        case "getErrorDescription":
            let code = params["code"] as? Int ?? 0
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
                "result": AgoraRtcEngineKit.getErrorDescription(code),
            ])
        case "setRenderBackend":
            guard let requestedBackend = requiredString(
                params,
                key: "backend",
                requestId: requestId,
                message: "Render backend is required."
            ) else {
                return
            }
            guard isSupportedRenderBackend(requestedBackend) else {
                dispatchInvalidArgumentError(
                    requestId: requestId,
                    message: "Unsupported render backend: \(requestedBackend)",
                    method: "setRenderBackend",
                    argumentName: "backend",
                    argumentValue: requestedBackend
                )
                return
            }
            if requestedBackend == "texture-view" {
                renderBackend = "surface-view"
                dispatchEvent(name: "renderBackendState", payload: [
                    "backend": requestedBackend,
                    "phase": "fallback",
                    "result": 0,
                    "uid": 0,
                    "fallbackBackend": renderBackend,
                    "platform": "ios",
                ])
            } else {
                renderBackend = requestedBackend
            }
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        case "setChannelProfile":
            requireEngine(requestId: requestId) { engine in
                let profile = (params["profile"] as? String) == "liveBroadcasting"
                    ? AgoraChannelProfile.liveBroadcasting
                    : AgoraChannelProfile.communication
                let result = engine.setChannelProfile(profile)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setClientRole":
            requireEngine(requestId: requestId) { engine in
                let role = (params["role"] as? String) == "audience"
                    ? AgoraClientRole.audience
                    : AgoraClientRole.broadcaster
                let result = engine.setClientRole(role)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "joinChannel":
            handleJoinChannel(requestId: requestId, params: params)
        case "leaveChannel":
            requireEngine(requestId: requestId) { engine in
                let result = engine.leaveChannel(nil)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "renewToken":
            requireEngine(requestId: requestId) { engine in
                let token = params["token"] as? String ?? ""
                let result = engine.renewToken(token)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "enableAudio":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? true
                let result = enabled ? engine.enableAudio() : engine.disableAudio()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "enableLocalAudio":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? true
                let result = engine.enableLocalAudio(enabled)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "enableAudioVolumeIndication":
            requireEngine(requestId: requestId) { engine in
                let interval = params["interval"] as? Int ?? 300
                let smooth = params["smooth"] as? Int ?? 3
                let reportVad = params["reportVad"] as? Bool ?? false
                let result = engine.enableAudioVolumeIndication(interval, smooth: smooth, reportVad: reportVad)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "muteLocalAudioStream":
            requireEngine(requestId: requestId) { engine in
                let muted = params["muted"] as? Bool ?? false
                let result = engine.muteLocalAudioStream(muted)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "muteRemoteAudioStream":
            requireEngine(requestId: requestId) { engine in
                let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)
                let muted = params["muted"] as? Bool ?? false
                let result = engine.muteRemoteAudioStream(uid, mute: muted)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "muteAllRemoteAudioStreams":
            requireEngine(requestId: requestId) { engine in
                let muted = params["muted"] as? Bool ?? false
                let result = engine.muteAllRemoteAudioStreams(muted)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "enableVideo":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? true
                let result = enabled ? engine.enableVideo() : engine.disableVideo()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "enableLocalVideo":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? true
                let result = engine.enableLocalVideo(enabled)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "muteLocalVideoStream":
            requireEngine(requestId: requestId) { engine in
                let muted = params["muted"] as? Bool ?? false
                let result = engine.muteLocalVideoStream(muted)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "muteRemoteVideoStream":
            requireEngine(requestId: requestId) { engine in
                let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)
                let muted = params["muted"] as? Bool ?? false
                let result = engine.muteRemoteVideoStream(uid, mute: muted)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "muteAllRemoteVideoStreams":
            requireEngine(requestId: requestId) { engine in
                let muted = params["muted"] as? Bool ?? false
                let result = engine.muteAllRemoteVideoStreams(muted)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setEnableSpeakerphone":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? true
                let result = engine.setEnableSpeakerphone(enabled)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "isSpeakerphoneEnabled":
            requireEngine(requestId: requestId) { engine in
                dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                    "result": engine.isSpeakerphoneEnabled(),
                ])
            }
        case "setAudioProfile":
            requireEngine(requestId: requestId) { engine in
                let profileValue = params["profile"] as? Int ?? AgoraAudioProfile.default.rawValue
                let profile = AgoraAudioProfile(rawValue: profileValue) ?? .default
                let result = engine.setAudioProfile(profile)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "adjustPlaybackSignalVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustPlaybackSignalVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "adjustUserPlaybackSignalVolume":
            requireEngine(requestId: requestId) { engine in
                let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustUserPlaybackSignalVolume(uid, volume: Int32(volume))
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setDefaultAudioRouteToSpeakerphone":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? true
                let result = engine.setDefaultAudioRouteToSpeakerphone(enabled)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setVideoEncoderConfiguration":
            requireEngine(requestId: requestId) { engine in
                let width = params["width"] as? Int ?? 640
                let height = params["height"] as? Int ?? 360
                let frameRate = params["frameRate"] as? Int ?? 15
                let bitrate = params["bitrate"] as? Int ?? AgoraVideoBitrateStandard
                let orientationModeValue = params["orientationMode"] as? Int ?? AgoraVideoOutputOrientationMode.adaptative.rawValue
                let orientationMode = AgoraVideoOutputOrientationMode(rawValue: orientationModeValue) ?? .adaptative
                let config = AgoraVideoEncoderConfiguration(
                    width: width,
                    height: height,
                    frameRate: frameRate,
                    bitrate: bitrate,
                    orientationMode: orientationMode,
                    mirrorMode: .auto
                )
                let result = engine.setVideoEncoderConfiguration(config)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setBeautyEffectOptions":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? false
                let optionsObject = params["options"] as? [String: Any] ?? [:]
                let options = AgoraBeautyOptions()
                if let contrastRaw = optionsObject["lighteningContrastLevel"] as? Int,
                   let contrast = AgoraLighteningContrastLevel(rawValue: UInt(contrastRaw)) {
                    options.lighteningContrastLevel = contrast
                }
                options.lighteningLevel = Float(optionsObject["lighteningLevel"] as? Double ?? 0.0)
                options.smoothnessLevel = Float(optionsObject["smoothnessLevel"] as? Double ?? 0.0)
                options.rednessLevel = Float(optionsObject["rednessLevel"] as? Double ?? 0.0)
                options.sharpnessLevel = Float(optionsObject["sharpnessLevel"] as? Double ?? 0.0)
                let result = engine.setBeautyEffectOptions(enabled, options: options)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setLogFilter":
            requireEngine(requestId: requestId) { engine in
                let level = UInt(params["level"] as? Int ?? 0)
                let result = engine.setLogFilter(level)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setLogFile":
            requireEngine(requestId: requestId) { engine in
                guard let path = requiredString(
                    params,
                    key: "path",
                    requestId: requestId,
                    message: "Log file path is required."
                ) else {
                    return
                }
                let result = engine.setLogFile(path)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setParameters":
            requireEngine(requestId: requestId) { engine in
                guard let parameters = requiredString(
                    params,
                    key: "parameters",
                    requestId: requestId,
                    message: "Parameters are required."
                ) else {
                    return
                }
                let result = engine.setParameters(parameters)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "enableContentInspect":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? false
                let configObject = params["config"] as? [String: Any] ?? [:]
                let module = AgoraContentInspectModule()
                if let moduleRaw = configObject["module"] as? Int,
                   let type = AgoraContentInspectType(rawValue: UInt(moduleRaw)) {
                    module.type = type
                }
                module.interval = configObject["interval"] as? Int ?? 0
                module.position = .preRenderer
                let config = AgoraContentInspectConfig()
                config.modules = [module]
                let result = engine.enableContentInspect(enabled, config: config)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "startAudioMixing":
            requireEngine(requestId: requestId) { engine in
                guard let path = requiredString(
                    params,
                    key: "path",
                    requestId: requestId,
                    message: "Audio mixing path is required."
                ) else {
                    return
                }
                let loopback = params["loopback"] as? Bool ?? false
                let cycle = params["cycle"] as? Int ?? 1
                let startPos = params["startPos"] as? Int ?? 0
                let result = engine.startAudioMixing(path, loopback: loopback, cycle: cycle, startPos: startPos)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "pauseAudioMixing":
            requireEngine(requestId: requestId) { engine in
                let result = engine.pauseAudioMixing()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "resumeAudioMixing":
            requireEngine(requestId: requestId) { engine in
                let result = engine.resumeAudioMixing()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "stopAudioMixing":
            requireEngine(requestId: requestId) { engine in
                let result = engine.stopAudioMixing()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "getAudioMixingCurrentPosition":
            requireEngine(requestId: requestId) { engine in
                dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                    "result": engine.getAudioMixingCurrentPosition(),
                ])
            }
        case "setAudioMixingPosition":
            requireEngine(requestId: requestId) { engine in
                let position = params["positionMs"] as? Int ?? 0
                let result = engine.setAudioMixingPosition(position)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "adjustAudioMixingVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustAudioMixingVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "preloadEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let path = params["path"] as? String ?? ""
                let result = engine.preloadEffect(soundId, filePath: path)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "playEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let path = params["path"] as? String ?? ""
                let loopCount = params["loopCount"] as? Int ?? 1
                let pitch = params["pitch"] as? Double ?? 1.0
                let pan = params["pan"] as? Double ?? 0.0
                let gain = params["gain"] as? Int ?? 100
                let publish = params["publish"] as? Bool ?? false
                let startPos = params["startPos"] as? Int ?? 0
                let result = engine.playEffect(soundId, filePath: path, loopCount: loopCount, pitch: pitch, pan: pan, gain: gain, publish: publish, startPos: Int32(startPos))
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "stopEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let result = engine.stopEffect(soundId)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setAudioSessionOperationRestriction":
            requireEngine(requestId: requestId) { engine in
                let rawValue = UInt(params["restriction"] as? Int ?? 0)
                let restriction = AgoraAudioSessionOperationRestriction(rawValue: rawValue)
                engine.setAudioSessionOperationRestriction(restriction)
                dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                ])
            }
        case "startPreview":
            requireEngine(requestId: requestId) { engine in
                ensureRtcPermissions(requestId: requestId) {
                    guard self.rtcEngine != nil else {
                        self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                        return
                    }
                    let result = engine.startPreview()
                    self.dispatchResult(requestId: requestId, method: method, result: result)
                }
            }
        case "stopPreview":
            requireEngine(requestId: requestId) { engine in
                let result = engine.stopPreview()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "switchCamera":
            requireEngine(requestId: requestId) { engine in
                let result = engine.switchCamera()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "destroy":
            _ = rtcEngine?.setVideoFrameDelegate(nil)
            AgoraRtcEngineKit.destroy()
            rtcEngine = nil
            clearAllVideoViews()
            releaseAllTextureSlots()
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        case "setupLocalVideoView":
            handleSetupLocalVideoView(requestId: requestId, params: params)
        case "setupRemoteVideoView":
            handleSetupRemoteVideoView(requestId: requestId, params: params)
        case "updateLocalVideoView":
            handleUpdateLocalVideoView(requestId: requestId, params: params)
        case "updateRemoteVideoView":
            handleUpdateRemoteVideoView(requestId: requestId, params: params)
        case "removeLocalVideoView":
            handleRemoveLocalVideoView(requestId: requestId)
        case "removeRemoteVideoView":
            handleRemoveRemoteVideoView(requestId: requestId, params: params)
        case "setNativeVideoOverlaySuspended":
            let suspended = params["suspended"] as? Bool ?? true
            DispatchQueue.main.async {
                self.localCanvasView?.isHidden = suspended
                for view in self.remoteCanvasViews.values {
                    view.isHidden = suspended
                }
                self.dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                ])
            }
        default:
            dispatchUnsupported(requestId: requestId, method: method)
        }
    }

    private func handleInitialize(requestId: String, params: [String: Any]) {
        let appId = (params["appId"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !appId.isEmpty else {
            dispatchError(requestId: requestId, message: "App ID is required.")
            return
        }

        rtcEngine = AgoraRtcEngineKit.sharedEngine(withAppId: appId, delegate: self)
        _ = rtcEngine?.setVideoFrameDelegate(self)
        dispatchResponse([
            "requestId": requestId,
            "ok": true,
        ])
    }

    private func handleJoinChannel(requestId: String, params: [String: Any]) {
        guard let engine = rtcEngine else {
            dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
            return
        }

        let token = params["token"] as? String
        guard let channelId = requiredString(
            params,
            key: "channelId",
            requestId: requestId,
            message: "Channel ID is required."
        ) else {
            return
        }
        let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)

        if let mediaOptionParams = params["options"] as? [String: Any] {
            let mediaOptions = buildChannelMediaOptions(mediaOptionParams)
            let requiresCameraPermission = mediaOptionBool(mediaOptionParams, key: "publishCameraTrack", defaultValue: true)
            let requiresMicrophonePermission = mediaOptionBool(mediaOptionParams, key: "publishMicrophoneTrack", defaultValue: true)
            ensureRtcPermissions(
                requestId: requestId,
                requiresCamera: requiresCameraPermission,
                requiresMicrophone: requiresMicrophonePermission
            ) {
                guard let engine = self.rtcEngine else {
                    self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                    return
                }
                let result = engine.joinChannel(
                    byToken: token,
                    channelId: channelId,
                    uid: uid,
                    mediaOptions: mediaOptions,
                    joinSuccess: nil
                )
                self.dispatchResult(requestId: requestId, method: "joinChannel", result: result)
            }
        } else {
            ensureRtcPermissions(requestId: requestId) {
                guard let engine = self.rtcEngine else {
                    self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                    return
                }
                let result = engine.joinChannel(
                    byToken: token,
                    channelId: channelId,
                    info: nil,
                    uid: uid,
                    joinSuccess: nil
                )
                self.dispatchResult(requestId: requestId, method: "joinChannel", result: result)
            }
        }
    }

    private func buildChannelMediaOptions(_ params: [String: Any]?) -> AgoraRtcChannelMediaOptions {
        let options = AgoraRtcChannelMediaOptions()
        guard let params else {
            return options
        }
        if let rawValue = params["clientRoleType"] {
            options.clientRoleType = parseClientRoleType(rawValue)
        }
        if let rawValue = params["channelProfile"] {
            options.channelProfile = parseChannelProfile(rawValue)
        }
        if let value = params["publishCameraTrack"] as? Bool {
            options.publishCameraTrack = value
        }
        if let value = params["publishMicrophoneTrack"] as? Bool {
            options.publishMicrophoneTrack = value
        }
        if let value = params["autoSubscribeAudio"] as? Bool {
            options.autoSubscribeAudio = value
        }
        if let value = params["autoSubscribeVideo"] as? Bool {
            options.autoSubscribeVideo = value
        }
        if let value = params["enableAudioRecordingOrPlayout"] as? Bool {
            options.enableAudioRecordingOrPlayout = value
        }
        if let value = params["token"] as? String {
            options.token = value
        }
        if let value = params["parameters"] as? String {
            options.parameters = value
        }
        return options
    }

    private func mediaOptionBool(_ params: [String: Any]?, key: String, defaultValue: Bool) -> Bool {
        guard let value = params?[key] as? Bool else {
            return defaultValue
        }
        return value
    }

    private func parseClientRoleType(_ rawValue: Any) -> AgoraClientRole {
        if let value = rawValue as? Int {
            return AgoraClientRole(rawValue: value) ?? .broadcaster
        }
        if let value = rawValue as? UInt {
            return AgoraClientRole(rawValue: Int(value)) ?? .broadcaster
        }
        if let value = rawValue as? String, value == "audience" {
            return .audience
        }
        return .broadcaster
    }

    private func parseChannelProfile(_ rawValue: Any) -> AgoraChannelProfile {
        if let value = rawValue as? Int {
            return AgoraChannelProfile(rawValue: value) ?? .liveBroadcasting
        }
        if let value = rawValue as? UInt {
            return AgoraChannelProfile(rawValue: Int(value)) ?? .liveBroadcasting
        }
        if let value = rawValue as? String, value == "communication" {
            return .communication
        }
        return .liveBroadcasting
    }

    private func requireEngine(requestId: String, action: (AgoraRtcEngineKit) -> Void) {
        guard let engine = rtcEngine else {
            dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
            return
        }
        action(engine)
    }

    private func ensureRtcPermissions(
        requestId: String,
        requiresCamera: Bool = true,
        requiresMicrophone: Bool = true,
        action: @escaping () -> Void
    ) {
        let continueWithMicrophone = {
            guard requiresMicrophone else {
                DispatchQueue.main.async {
                    action()
                }
                return
            }
            self.ensureMicrophonePermission { microphoneGranted in
                guard microphoneGranted else {
                    self.dispatchError(requestId: requestId, message: "Microphone permission is required.")
                    return
                }
                DispatchQueue.main.async {
                    action()
                }
            }
        }
        guard requiresCamera else {
            continueWithMicrophone()
            return
        }
        ensureCameraPermission { cameraGranted in
            guard cameraGranted else {
                self.dispatchError(requestId: requestId, message: "Camera permission is required.")
                return
            }
            continueWithMicrophone()
        }
    }

    private func ensureCameraPermission(completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                completion(granted)
            }
        case .denied, .restricted:
            completion(false)
        @unknown default:
            completion(false)
        }
    }

    private func ensureMicrophonePermission(completion: @escaping (Bool) -> Void) {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted:
            completion(true)
        case .undetermined:
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                completion(granted)
            }
        case .denied:
            completion(false)
        @unknown default:
            completion(false)
        }
    }

    private func requiredString(
        _ params: [String: Any],
        key: String,
        requestId: String,
        message: String
    ) -> String? {
        let value = (params[key] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty {
            dispatchError(requestId: requestId, message: message)
            return nil
        }
        return value
    }

    private func isSupportedRenderBackend(_ backend: String) -> Bool {
        backend == "surface-view" || backend == "texture-view" || backend == "engine-texture"
    }

    private func handleSetupLocalVideoView(requestId: String, params: [String: Any]) {
        requireEngine(requestId: requestId) { engine in
            if self.renderBackend == "engine-texture" {
                self.localTextureRequested = true
                self.ensureLocalTextureSlot()
                self.dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                ])
                return
            }
            DispatchQueue.main.async {
                let view = self.localCanvasView ?? UIView(frame: self.rect(from: params))
                self.attachToRootView(view)
                view.frame = self.rect(from: params)
                self.localCanvasView = view
                if let rootView = UIApplication.shared.delegate?.window??.rootViewController?.view {
                    NSLog("[agora-rtc-native] setupLocalVideoView frame=%@ rootBounds=%@", NSCoder.string(for: view.frame), NSCoder.string(for: rootView.bounds))
                }

                let canvas = self.localCanvas ?? AgoraRtcVideoCanvas()
                canvas.uid = 0
                canvas.view = view
                canvas.renderMode = self.renderMode(from: params)
                canvas.mirrorMode = .auto
                let result = engine.setupLocalVideo(canvas)
                if result == 0 {
                    self.localCanvas = canvas
                    _ = engine.setLocalRenderMode(self.renderMode(from: params), mirror: .auto)
                    self.dispatchResponse([
                        "requestId": requestId,
                        "ok": true,
                    ])
                } else {
                    self.dispatchResult(requestId: requestId, method: "setupLocalVideoView", result: result)
                }
            }
        }
    }

    private func handleSetupRemoteVideoView(requestId: String, params: [String: Any]) {
        requireEngine(requestId: requestId) { engine in
            let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)
            if self.renderBackend == "engine-texture" {
                self.remoteTextureUids.insert(uid)
                self.ensureRemoteTextureSlot(uid)
                self.dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                ])
                return
            }
            DispatchQueue.main.async {
                let view = self.remoteCanvasViews[uid] ?? UIView(frame: self.rect(from: params))
                self.attachToRootView(view)
                view.frame = self.rect(from: params)
                self.remoteCanvasViews[uid] = view
                if let rootView = UIApplication.shared.delegate?.window??.rootViewController?.view {
                    NSLog("[agora-rtc-native] setupRemoteVideoView uid=%u frame=%@ rootBounds=%@", uid, NSCoder.string(for: view.frame), NSCoder.string(for: rootView.bounds))
                }

                let canvas = self.remoteCanvases[uid] ?? AgoraRtcVideoCanvas()
                canvas.uid = uid
                canvas.view = view
                canvas.renderMode = self.renderMode(from: params)
                canvas.mirrorMode = .auto
                let result = engine.setupRemoteVideo(canvas)
                if result == 0 {
                    self.remoteCanvases[uid] = canvas
                    _ = engine.setRemoteRenderMode(uid, mode: self.renderMode(from: params), mirror: .auto)
                    self.dispatchResponse([
                        "requestId": requestId,
                        "ok": true,
                    ])
                } else {
                    self.dispatchResult(requestId: requestId, method: "setupRemoteVideoView", result: result)
                }
            }
        }
    }

    private func handleUpdateLocalVideoView(requestId: String, params: [String: Any]) {
        DispatchQueue.main.async {
            guard let view = self.localCanvasView else {
                self.dispatchError(requestId: requestId, message: "Local video view is not attached.")
                return
            }
            view.frame = self.rect(from: params)
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func handleUpdateRemoteVideoView(requestId: String, params: [String: Any]) {
        let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)
        DispatchQueue.main.async {
            guard let view = self.remoteCanvasViews[uid] else {
                self.dispatchError(requestId: requestId, message: "Remote video view is not attached.")
                return
            }
            view.frame = self.rect(from: params)
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func handleRemoveLocalVideoView(requestId: String) {
        if renderBackend == "engine-texture" {
            localTextureRequested = false
            releaseLocalTextureSlot()
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
            return
        }
        DispatchQueue.main.async {
            self.localCanvas?.view = nil
            self.localCanvasView?.removeFromSuperview()
            self.localCanvas = nil
            self.localCanvasView = nil
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func handleRemoveRemoteVideoView(requestId: String, params: [String: Any]) {
        let uid = params["uid"] as? UInt ?? UInt(params["uid"] as? Int ?? 0)
        if renderBackend == "engine-texture" {
            remoteTextureUids.remove(uid)
            releaseRemoteTextureSlot(uid)
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
            return
        }
        DispatchQueue.main.async {
            self.remoteCanvases[uid]?.view = nil
            self.remoteCanvasViews[uid]?.removeFromSuperview()
            self.remoteCanvases.removeValue(forKey: uid)
            self.remoteCanvasViews.removeValue(forKey: uid)
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func attachToRootView(_ view: UIView) {
        guard let rootView = UIApplication.shared.delegate?.window??.rootViewController?.view else {
            return
        }
        if view.superview !== rootView {
            rootView.addSubview(view)
        }
    }

    private func clearAllVideoViews() {
        localCanvas?.view = nil
        localCanvasView?.removeFromSuperview()
        localCanvas = nil
        localCanvasView = nil
        for (_, canvas) in remoteCanvases {
            canvas.view = nil
        }
        for (_, view) in remoteCanvasViews {
            view.removeFromSuperview()
        }
        remoteCanvases.removeAll()
        remoteCanvasViews.removeAll()
    }

    private func ensureLocalTextureSlot() {
        if localTextureSlot != nil {
            return
        }
        let width = 320
        let height = 180
        guard let slotId = createTextureSlot(width: width, height: height) else {
            return
        }
        localTextureSlot = TextureSlotState(slotId: slotId, width: width, height: height)
    }

    private func ensureRemoteTextureSlot(_ uid: UInt) {
        if remoteTextureSlots[uid] != nil {
            return
        }
        let width = 854
        let height = 480
        guard let slotId = createTextureSlot(width: width, height: height) else {
            return
        }
        remoteTextureSlots[uid] = TextureSlotState(slotId: slotId, width: width, height: height)
    }

    private func releaseLocalTextureSlot() {
        guard let slot = localTextureSlot else {
            return
        }
        localTextureSlot = nil
        releaseTextureSlot(slotId: slot.slotId)
        dispatchEvent(name: "localVideoTextureReleased", payload: [
            "slotId": slot.slotId,
        ])
    }

    private func releaseRemoteTextureSlot(_ uid: UInt) {
        guard let slot = remoteTextureSlots.removeValue(forKey: uid) else {
            return
        }
        releaseTextureSlot(slotId: slot.slotId)
        dispatchEvent(name: "remoteVideoTextureReleased", payload: [
            "uid": uid,
            "slotId": slot.slotId,
        ])
    }

    private func releaseAllTextureSlots() {
        releaseLocalTextureSlot()
        let allRemoteUids = Array(remoteTextureSlots.keys)
        for uid in allRemoteUids {
            releaseRemoteTextureSlot(uid)
        }
        remoteTextureUids.removeAll()
    }

    private func updateTextureSlot(_ slot: TextureSlotState, videoFrame: AgoraOutputVideoFrame) {
        updateTextureSlot(slotId: slot.slotId, videoFrame: videoFrame)
        dispatchTextureReadyIfNeeded(slot, kind: "local", uid: nil)
    }

    private func updateRemoteTextureSlot(_ slot: TextureSlotState, uid: UInt, videoFrame: AgoraOutputVideoFrame) {
        updateTextureSlot(slotId: slot.slotId, videoFrame: videoFrame)
        dispatchTextureReadyIfNeeded(slot, kind: "remote", uid: uid)
    }

    private func dispatchTextureReadyIfNeeded(_ slot: TextureSlotState, kind: String, uid: UInt?) {
        if !slot.readyDispatched {
            let eventName = kind == "local" ? "localVideoTextureReady" : "remoteVideoTextureReady"
            func dispatchReady() {
                guard self.isTextureSlotReady(slotId: slot.slotId) else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                        dispatchReady()
                    }
                    return
                }
                if slot.readyDispatched {
                    return
                }
                slot.readyDispatched = true
                var payload: [String: Any] = [
                    "slotId": slot.slotId,
                    "width": slot.width,
                    "height": slot.height,
                ]
                if let uid {
                    payload["uid"] = uid
                }
                self.dispatchEvent(name: eventName, payload: payload)
            }
            dispatchReady()
        }
    }

    private func rect(from params: [String: Any]) -> CGRect {
        let scale = Double(UIScreen.main.scale)
        let x = (params["x"] as? Double ?? 0) / scale
        let y = (params["y"] as? Double ?? 0) / scale
        let width = (params["width"] as? Double ?? 320) / scale
        let height = (params["height"] as? Double ?? 240) / scale
        return CGRect(x: x, y: y, width: width, height: height)
    }

    private func renderMode(from params: [String: Any]) -> AgoraVideoRenderMode {
        let mode = params["renderMode"] as? String ?? "hidden"
        return mode == "fit" ? .fit : .hidden
    }

    private func dispatchResult(requestId: String, method: String, result: Int32) {
        if result == 0 {
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
            return
        }
        dispatchResponse([
            "requestId": requestId,
            "ok": false,
            "error": [
                "code": "native_failure",
                "message": "\(method) failed: \(result)",
                "details": [
                    "method": method,
                    "platform": "ios",
                    "agoraCode": result,
                ],
            ],
        ])
    }

    private func dispatchUnsupported(requestId: String, method: String) {
        dispatchResponse([
            "requestId": requestId,
            "ok": false,
            "error": [
                "code": "native_failure",
                "message": "Unsupported on current platform",
                "details": [
                    "method": method,
                    "platform": "ios",
                ],
            ],
        ])
    }

    private func dispatchError(requestId: String, message: String) {
        dispatchResponse([
            "requestId": requestId,
            "ok": false,
            "error": [
                "code": "native_failure",
                "message": message,
            ],
        ])
    }

    private func dispatchInvalidArgumentError(
        requestId: String,
        message: String,
        method: String,
        argumentName: String,
        argumentValue: String
    ) {
        dispatchResponse([
            "requestId": requestId,
            "ok": false,
            "error": [
                "code": "invalid_argument",
                "message": message,
                "details": [
                    "method": method,
                    argumentName: argumentValue,
                    "platform": "ios",
                ],
            ],
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didOccurError errorCode: AgoraErrorCode) {
        dispatchEvent(name: "error", payload: [
            "code": errorCode.rawValue,
            "message": "AgoraRtcEngineKit error: \(errorCode.rawValue)",
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinChannel channel: String, withUid uid: UInt, elapsed: Int) {
        dispatchEvent(name: "joinChannelSuccess", payload: [
            "channelId": channel,
            "uid": uid,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didRejoinChannel channel: String, withUid uid: UInt, elapsed: Int) {
        dispatchEvent(name: "rejoinChannelSuccess", payload: [
            "channelId": channel,
            "uid": uid,
            "elapsed": elapsed,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didLeaveChannelWith stats: AgoraChannelStats) {
        dispatchEvent(name: "leaveChannel", payload: [
            "duration": stats.duration,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, reportRtcStats stats: AgoraChannelStats) {
        dispatchEvent(name: "rtcStats", payload: [
            "duration": stats.duration,
            "txBytes": stats.txBytes,
            "rxBytes": stats.rxBytes,
            "txAudioKBitrate": stats.txAudioKBitrate,
            "rxAudioKBitrate": stats.rxAudioKBitrate,
            "txVideoKBitrate": stats.txVideoKBitrate,
            "rxVideoKBitrate": stats.rxVideoKBitrate,
            "txKBitrate": stats.txKBitrate,
            "rxKBitrate": stats.rxKBitrate,
            "users": stats.userCount,
            "txPacketLossRate": stats.txPacketLossRate,
            "rxPacketLossRate": stats.rxPacketLossRate,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinedOfUid uid: UInt, elapsed: Int) {
        dispatchEvent(name: "userJoined", payload: [
            "uid": uid,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, firstRemoteVideoDecodedOfUid uid: UInt, size: CGSize, elapsed: Int) {
        NSLog("[agora-rtc-native] firstRemoteVideoDecoded uid=%u size=%@ elapsed=%d", uid, NSCoder.string(for: size), elapsed)
        dispatchEvent(name: "remoteVideoStateChanged", payload: [
            "uid": uid,
            "state": 2,
            "reason": 0,
            "elapsed": elapsed,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, firstRemoteVideoFrameOfUid uid: UInt, size: CGSize, elapsed: Int) {
        NSLog("[agora-rtc-native] firstRemoteVideoFrame uid=%u size=%@ elapsed=%d", uid, NSCoder.string(for: size), elapsed)
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, remoteVideoStateChangedOfUid uid: UInt, state: AgoraVideoRemoteState, reason: AgoraVideoRemoteReason, elapsed: Int) {
        NSLog("[agora-rtc-native] remoteVideoStateChanged uid=%u state=%ld reason=%ld elapsed=%d", uid, state.rawValue, reason.rawValue, elapsed)
        dispatchEvent(name: "remoteVideoStateChanged", payload: [
            "uid": uid,
            "state": state.rawValue,
            "reason": reason.rawValue,
            "elapsed": elapsed,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didOfflineOfUid uid: UInt, reason: AgoraUserOfflineReason) {
        dispatchEvent(name: "userOffline", payload: [
            "uid": uid,
            "reason": reason.rawValue,
        ])
    }

    func rtcEngineConnectionDidInterrupted(_ engine: AgoraRtcEngineKit) {
        dispatchEvent(name: "connectionInterrupted", payload: [:])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, connectionChangedTo state: AgoraConnectionState, reason: AgoraConnectionChangedReason) {
        dispatchEvent(name: "connectionStateChanged", payload: [
            "state": state.rawValue,
            "reason": reason.rawValue,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, audioMixingStateChanged state: AgoraAudioMixingStateType, reasonCode: AgoraAudioMixingReasonCode) {
        dispatchEvent(name: "audioMixingStateChanged", payload: [
            "state": state.rawValue,
            "reason": reasonCode.rawValue,
        ])
        if state == .stopped && reasonCode == .allLoopsCompleted {
            dispatchEvent(name: "audioMixingFinished", payload: [:])
        }
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, reportAudioVolumeIndicationOfSpeakers speakers: [AgoraRtcAudioVolumeInfo], totalVolume: Int) {
        dispatchEvent(name: "volumeIndication", payload: [
            "speakers": speakers.map { speaker in
                [
                    "uid": speaker.uid,
                    "volume": speaker.volume,
                    "vad": speaker.vad,
                    "voicePitch": speaker.voicePitch,
                ]
            },
            "totalVolume": totalVolume,
        ])
    }

    func getVideoFrameProcessMode() -> AgoraVideoFrameProcessMode {
        return .readOnly
    }

    func getVideoFormatPreference() -> AgoraVideoFormat {
        return .default
    }

    func getObservedFramePosition() -> AgoraVideoFramePosition {
        return [.postCapture, .preRenderer]
    }

    func getRotationApplied() -> Bool {
        return false
    }

    func getMirrorApplied() -> Bool {
        return false
    }

    func onCapture(_ videoFrame: AgoraOutputVideoFrame, sourceType: AgoraVideoSourceType) -> Bool {
        guard renderBackend == "engine-texture" else {
            return true
        }
        guard localTextureRequested, let slot = localTextureSlot else {
            return true
        }
        updateTextureSlot(slot, videoFrame: videoFrame)
        return true
    }

    func onRenderVideoFrame(_ videoFrame: AgoraOutputVideoFrame, uid: UInt, channelId: String) -> Bool {
        guard renderBackend == "engine-texture" else {
            return true
        }
        let isTracked = remoteTextureUids.contains(uid)
        let slot = remoteTextureSlots[uid]
        guard isTracked, let slot else {
            return true
        }
        updateRemoteTextureSlot(slot, uid: uid, videoFrame: videoFrame)
        return true
    }

    private func dispatchResponse(_ object: [String: Any]) {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [weak self] in
                self?.dispatchResponse(object)
            }
            return
        }
        guard
            let data = try? JSONSerialization.data(withJSONObject: object),
            let text = String(data: data, encoding: .utf8)
        else {
            NSLog("[agora-rtc-native] dispatchResponse serialization failed")
            return
        }

        NSLog("[agora-rtc-native] dispatchResponse event=%@ payload=%@", responseEventName, text)
        NSLog("[agora-rtc-native] dispatchResponse targets=%@", debugDispatchTargets())
        dispatchToScript(event: responseEventName, payload: text)
    }

    private func dispatchEvent(name: String, payload: [String: Any]) {
        dispatchResponse([
            "eventName": name,
            "payload": payload,
        ], event: callbackEventName)
    }

    private func dispatchResponse(_ object: [String: Any], event: String) {
        if !Thread.isMainThread {
            DispatchQueue.main.async { [weak self] in
                self?.dispatchResponse(object, event: event)
            }
            return
        }
        guard
            let data = try? JSONSerialization.data(withJSONObject: object),
            let text = String(data: data, encoding: .utf8)
        else {
            NSLog("[agora-rtc-native] dispatchResponse serialization failed event=%@", event)
            return
        }

        NSLog("[agora-rtc-native] dispatchResponse event=%@ payload=%@", event, text)
        NSLog("[agora-rtc-native] dispatchResponse targets=%@", debugDispatchTargets())
        dispatchToScript(event: event, payload: text)
    }
}
