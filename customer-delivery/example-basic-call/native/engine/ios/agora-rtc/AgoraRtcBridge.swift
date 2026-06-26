import AgoraRtcKit
import Foundation
import UIKit
import CoreVideo

@objcMembers
final class TextureSlotState: NSObject {
    let slotId: Int
    let width: Int
    let height: Int
    let renderMode: AgoraVideoRenderMode
    let observerPosition: AgoraVideoFramePosition
    var readyDispatched = false

    init(slotId: Int, width: Int, height: Int, renderMode: AgoraVideoRenderMode, observerPosition: AgoraVideoFramePosition) {
        self.slotId = slotId
        self.width = width
        self.height = height
        self.renderMode = renderMode
        self.observerPosition = observerPosition
    }
}

private enum AgoraRtcBridgeParameterError: LocalizedError {
    case invalidJsonObjectString

    var errorDescription: String? {
        switch self {
        case .invalidJsonObjectString:
            return "Parameters must be a valid JSON object string."
        }
    }
}

@objcMembers
final class AgoraRtcBridge: NSObject, AgoraRtcEngineDelegate, AgoraVideoFrameDelegate {
    private let responseEventName = "agora:response"
    private let callbackEventName = "agora:event"
    private let protectedAppTypeParameters = "{\"rtc.set_app_type\":10}"

    private var rtcEngine: AgoraRtcEngineKit?
    private var renderBackend = "engine-texture"
    private var localTextureRequested = false
    private var localTextureSlot: TextureSlotState?
    private var remoteTextureUids = Set<UInt>()
    private var remoteTextureSlots: [UInt: TextureSlotState] = [:]
    private var observedFramePosition: AgoraVideoFramePosition = [.postCapture, .preRenderer]

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

    private func runOnMainQueue(sync: Bool = true, _ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
            return
        }
        if sync {
            DispatchQueue.main.sync(execute: block)
            return
        }
        DispatchQueue.main.async(execute: block)
    }

    private func runOnMainQueueSync(_ block: () -> Void) {
        if Thread.isMainThread {
            block()
            return
        }
        DispatchQueue.main.sync(execute: block)
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

    private func configureTextureSlot(slotId: Int, width: Int, height: Int, renderMode: AgoraVideoRenderMode) {
        guard let type = textureSlotBridgeClass() else {
            return
        }
        let typeObject: AnyObject = type
        let selector = NSSelectorFromString("configureSlot:options:")
        guard typeObject.responds?(to: selector) == true else {
            return
        }
        _ = typeObject.perform?(
            selector,
            with: NSNumber(value: slotId),
            with: [
                "width": width,
                "height": height,
                "renderMode": Int(renderMode.rawValue),
            ]
        )
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
            let request = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
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
            renderBackend = requestedBackend
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
                let agoraRole = (params["role"] as? String) == "audience"
                    ? AgoraClientRole.audience
                    : AgoraClientRole.broadcaster
                let options = buildClientRoleOptions(params["options"] as? [String: Any])
                let result = engine.setClientRole(agoraRole, options: options)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "joinChannel":
            handleJoinChannel(requestId: requestId, params: params)
        case "joinChannelWithUserAccount":
            handleJoinChannelWithUserAccount(requestId: requestId, params: params)
        case "getUserInfoByUserAccount":
            handleGetUserInfoByUserAccount(requestId: requestId, params: params)
        case "leaveChannel":
            requireEngine(requestId: requestId) { engine in
                let result: Int32
                if hasLeaveChannelOptions(params) {
                    result = engine.leaveChannel(buildLeaveChannelOptions(params), leaveChannelBlock: nil)
                } else {
                    result = engine.leaveChannel(nil)
                }
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
                let uid = uintValue(params["uid"] ?? 0)
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
                let uid = uintValue(params["uid"] ?? 0)
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
                let scenarioValue = params["scenario"] as? Int ?? AgoraAudioScenario.default.rawValue
                let scenario = AgoraAudioScenario(rawValue: scenarioValue) ?? .default
                let result = engine.setAudioProfile(profile, scenario: scenario)
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
                let uid = uintValue(params["uid"] ?? 0)
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
                let frameRateValue = params["frameRate"] as? Int ?? 15
                let frameRate = AgoraVideoFrameRate(rawValue: frameRateValue) ?? AgoraVideoFrameRate(rawValue: 15)!
                let bitrate = params["bitrate"] as? Int ?? AgoraVideoBitrateStandard
                let orientationModeValue = params["orientationMode"] as? Int ?? AgoraVideoOutputOrientationMode.adaptative.rawValue
                let orientationMode = AgoraVideoOutputOrientationMode(rawValue: orientationModeValue) ?? .adaptative
                let mirrorModeValue = params["mirrorMode"] as? Int ?? Int(AgoraVideoMirrorMode.auto.rawValue)
                let mirrorMode = AgoraVideoMirrorMode(rawValue: UInt(mirrorModeValue)) ?? .auto
                let config = AgoraVideoEncoderConfiguration()
                config.dimensions = CGSize(width: CGFloat(width), height: CGFloat(height))
                config.frameRate = frameRate.rawValue
                config.bitrate = bitrate
                config.orientationMode = orientationMode
                config.mirrorMode = mirrorMode
                config.minBitrate = params["minBitrate"] as? Int ?? config.minBitrate
                if let degradationPreferenceRawValue = params["degradationPreference"] {
                    let degradationPreferenceValue = intValue(degradationPreferenceRawValue)
                    if let degradationPreference = AgoraDegradationPreference(rawValue: degradationPreferenceValue) {
                        config.degradationPreference = degradationPreference
                    }
                }
                if let codecTypeRawValue = params["codecType"] {
                    let codecTypeValue = intValue(codecTypeRawValue)
                    if let codecType = AgoraVideoCodecType(rawValue: codecTypeValue) {
                        config.codecType = codecType
                    }
                }
                if let advancedVideoOptionsParams = params["advancedVideoOptions"] as? [String: Any] {
                    config.advancedVideoOptions = buildAdvancedVideoOptions(advancedVideoOptionsParams)
                }
                let result = engine.setVideoEncoderConfiguration(config)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setBeautyEffectOptions":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? false
                let optionsObject = params["options"] as? [String: Any] ?? [:]
                let options = AgoraBeautyOptions()
                let sourceType = mediaSourceType(from: params)
                if let contrastRaw = optionsObject["lighteningContrastLevel"] as? Int,
                   let contrast = AgoraLighteningContrastLevel(rawValue: UInt(contrastRaw)) {
                    options.lighteningContrastLevel = contrast
                }
                options.lighteningLevel = Float(optionsObject["lighteningLevel"] as? Double ?? 0.0)
                options.smoothnessLevel = Float(optionsObject["smoothnessLevel"] as? Double ?? 0.0)
                options.rednessLevel = Float(optionsObject["rednessLevel"] as? Double ?? 0.0)
                options.sharpnessLevel = Float(optionsObject["sharpnessLevel"] as? Double ?? 0.0)
                let result = engine.setBeautyEffectOptions(enabled, options: options, sourceType: sourceType)
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
                let parameterValue = params["parameters"]
                guard let parameterValue else {
                    self.dispatchError(requestId: requestId, message: "Parameters are required.")
                    return
                }
                if let stringValue = parameterValue as? String,
                   stringValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.dispatchError(requestId: requestId, message: "Parameters are required.")
                    return
                }
                do {
                    let parameters = try mergeProtectedParameters(parameterValue, allowEmpty: false)
                    guard !parameters.isEmpty else {
                        self.dispatchError(requestId: requestId, message: "Parameters are required.")
                        return
                    }
                    let result = engine.setParameters(parameters)
                    dispatchResult(requestId: requestId, method: method, result: result)
                } catch let error as AgoraRtcBridgeParameterError {
                    self.dispatchInvalidArgumentError(
                        requestId: requestId,
                        message: error.localizedDescription,
                        method: method,
                        argumentName: "parameters",
                        argumentValue: String(describing: parameterValue ?? "")
                    )
                } catch {
                    self.dispatchError(requestId: requestId, message: error.localizedDescription)
                    return
                }
            }
        case "enableContentInspect":
            requireEngine(requestId: requestId) { engine in
                let enabled = params["enabled"] as? Bool ?? false
                let configObject = params["config"] as? [String: Any] ?? [:]
                let config = AgoraContentInspectConfig()
                let extraInfo = configObject["extraInfo"] as? String
                config.extraInfo = extraInfo
                let serverConfig = configObject["serverConfig"] as? String
                config.serverConfig = serverConfig
                config.modules = buildContentInspectModules(configObject)
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
        case "adjustAudioMixingPublishVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustAudioMixingPublishVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "adjustAudioMixingPlayoutVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.adjustAudioMixingPlayoutVolume(volume)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "preloadEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let path = params["path"] as? String ?? ""
                let startPos = Int32(params["startPos"] as? Int ?? 0)
                let result = engine.preloadEffect(soundId, filePath: path, startPos: startPos)
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
        case "pauseEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let result = engine.pauseEffect(soundId)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "resumeEffect":
            requireEngine(requestId: requestId) { engine in
                let soundId = Int32(params["soundId"] as? Int ?? 0)
                let result = engine.resumeEffect(soundId)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "setEffectsVolume":
            requireEngine(requestId: requestId) { engine in
                let volume = params["volume"] as? Int ?? 100
                let result = engine.setEffectsVolume(volume)
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
                let sourceType = videoSourceType(from: params)
                let result = engine.startPreview(sourceType)
                self.dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "stopPreview":
            requireEngine(requestId: requestId) { engine in
                let sourceType = videoSourceType(from: params)
                let result = engine.stopPreview(sourceType)
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "switchCamera":
            requireEngine(requestId: requestId) { engine in
                let result = engine.switchCamera()
                dispatchResult(requestId: requestId, method: method, result: result)
            }
        case "destroy":
            runOnMainQueue {
                let engineToDestroy = self.rtcEngine
                _ = engineToDestroy?.setVideoFrameDelegate(nil)
                self.rtcEngine = nil
                self.releaseAllTextureSlots()
                if engineToDestroy != nil {
                    AgoraRtcEngineKit.destroy()
                }
                self.dispatchResponse([
                    "requestId": requestId,
                    "ok": true,
                ])
            }
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
            dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
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

        let config = AgoraRtcEngineConfig()
        config.appId = appId
        if let channelProfileValue = params["channelProfile"] as? Int,
           let channelProfile = AgoraChannelProfile(rawValue: channelProfileValue) {
            config.channelProfile = channelProfile
        }
        if let license = params["license"] as? String {
            config.license = license
        }
        if let audioScenarioValue = params["audioScenario"] as? Int,
           let audioScenario = AgoraAudioScenario(rawValue: audioScenarioValue) {
            config.audioScenario = audioScenario
        }
        if let areaCodeValue = params["areaCode"] as? UInt {
            config.areaCode = AgoraAreaCodeType(rawValue: areaCodeValue) ?? config.areaCode
        } else if let areaCodeValue = params["areaCode"] as? Int {
            config.areaCode = AgoraAreaCodeType(rawValue: UInt(areaCodeValue)) ?? config.areaCode
        }
        if let threadPriorityValue = params["threadPriority"] as? Int,
           let threadPriority = AgoraThreadPriorityType(rawValue: threadPriorityValue) {
            config.threadPriority = threadPriority
        }
        if let domainLimit = params["domainLimit"] as? Bool {
            config.domainLimit = domainLimit
        }
        if let autoRegisterAgoraExtensions = params["autoRegisterAgoraExtensions"] as? Bool {
            config.autoRegisterAgoraExtensions = autoRegisterAgoraExtensions
        }
        if let logConfigParams = params["logConfig"] as? [String: Any] {
            let logConfig = AgoraLogConfig()
            logConfig.filePath = logConfigParams["filePath"] as? String
            logConfig.fileSizeInKB = logConfigParams["fileSizeInKB"] as? Int ?? logConfig.fileSizeInKB
            if let levelValue = logConfigParams["level"] as? Int,
               let level = AgoraLogLevel(rawValue: levelValue) {
                logConfig.level = level
            } else if let levelValue = logConfigParams["level"] as? UInt,
                      let level = AgoraLogLevel(rawValue: Int(levelValue)) {
                logConfig.level = level
            }
            config.logConfig = logConfig
        }

        runOnMainQueue {
            self.rtcEngine = AgoraRtcEngineKit.sharedEngine(with: config, delegate: self)
            guard let engine = self.rtcEngine else {
                self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                return
            }
            guard self.applyProtectedParameters(engine: engine, requestId: requestId, method: "initialize", params: params) else {
                self.cleanupFailedInitialize(engine)
                return
            }
            _ = engine.setVideoFrameDelegate(self)
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func cleanupFailedInitialize(_ engine: AgoraRtcEngineKit) {
        if self.rtcEngine === engine {
            self.rtcEngine = nil
        }
        _ = engine.setVideoFrameDelegate(nil)
        self.releaseAllTextureSlots()
        AgoraRtcEngineKit.destroy()
    }

    private func applyProtectedParameters(engine: AgoraRtcEngineKit, requestId: String, method: String, params: [String: Any]) -> Bool {
        let parameterValue = params["parameters"]
        let parameters: String
        do {
            parameters = try mergeProtectedParameters(parameterValue)
        } catch let error as AgoraRtcBridgeParameterError {
            dispatchInvalidArgumentError(requestId: requestId, message: error.localizedDescription, method: method, argumentName: "parameters", argumentValue: String(describing: parameterValue ?? ""))
            return false
        } catch {
            dispatchError(requestId: requestId, message: error.localizedDescription)
            return false
        }
        let result = engine.setParameters(parameters)
        if result < 0 {
            dispatchAgoraError(requestId: requestId, method: method, result: result)
            return false
        }
        return true
    }

    private func mergeProtectedParameters(_ parameterValue: Any?, allowEmpty: Bool = true) throws -> String {
        if let stringValue = parameterValue as? String {
            let trimmed = stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                if allowEmpty {
                    return protectedAppTypeParameters
                }
                throw AgoraRtcBridgeParameterError.missingParameters
            }
            guard let data = trimmed.data(using: .utf8),
                  var clientParams = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
                throw AgoraRtcBridgeParameterError.invalidJsonObjectString
            }
            if !allowEmpty && clientParams.isEmpty {
                throw AgoraRtcBridgeParameterError.missingParameters
            }
            clientParams["rtc.set_app_type"] = 10
            guard let parametersData = try? JSONSerialization.data(withJSONObject: clientParams),
                  let serialized = String(data: parametersData, encoding: .utf8) else {
                throw AgoraRtcBridgeParameterError.invalidJsonObjectString
            }
            return serialized
        }

        guard parameterValue != nil else {
            if allowEmpty {
                return protectedAppTypeParameters
            }
            throw AgoraRtcBridgeParameterError.missingParameters
        }

        if JSONSerialization.isValidJSONObject(parameterValue as Any),
           var clientParams = parameterValue as? [String: Any] {
            if !allowEmpty && clientParams.isEmpty {
                throw AgoraRtcBridgeParameterError.missingParameters
            }
            clientParams["rtc.set_app_type"] = 10
            guard let parametersData = try? JSONSerialization.data(withJSONObject: clientParams),
                  let serialized = String(data: parametersData, encoding: .utf8) else {
                throw AgoraRtcBridgeParameterError.invalidJsonObjectString
            }
            return serialized
        }

        throw AgoraRtcBridgeParameterError.invalidJsonObjectString
    }

    private func handleJoinChannel(requestId: String, params: [String: Any]) {
        guard rtcEngine != nil else {
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
        let uid = uintValue(params["uid"] ?? 0)
        NSLog("[agora-rtc-native] handleJoinChannel requestId=%@ channel=%@ uid=%u options=%@", requestId, channelId, uid, String(describing: params["options"]))

        if let mediaOptionParams = params["options"] as? [String: Any] {
            let mediaOptions = buildChannelMediaOptions(mediaOptionParams)
            func mediaOptionBool(_ params: [String: Any]?, key: String, defaultValue: Bool) -> Bool {
                return self.mediaOptionBool(params, key: key, defaultValue: defaultValue)
            }
            guard let engine = self.rtcEngine else {
                self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                return
            }
            if mediaOptionBool(mediaOptionParams, key: "startPreview", defaultValue: false) {
                let previewResult = engine.startPreview(self.videoSourceType(from: mediaOptionParams))
                NSLog("[agora-rtc-native] handleJoinChannel startPreview result=%d requestId=%@", previewResult, requestId)
                guard previewResult >= 0 else {
                    self.dispatchResult(requestId: requestId, method: "startPreview", result: previewResult)
                    return
                }
            }
            let result = engine.joinChannel(
                byToken: token,
                channelId: channelId,
                uid: uid,
                mediaOptions: mediaOptions,
                joinSuccess: nil
            )
            NSLog("[agora-rtc-native] handleJoinChannel joinChannel result=%d requestId=%@", result, requestId)
            self.dispatchResult(requestId: requestId, method: "joinChannel", result: result)
        } else {
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
            NSLog("[agora-rtc-native] handleJoinChannel joinChannel result=%d requestId=%@", result, requestId)
            self.dispatchResult(requestId: requestId, method: "joinChannel", result: result)
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
        if let value = params["publishSecondaryCameraTrack"] as? Bool {
            options.publishSecondaryCameraTrack = value
        }
        if let value = params["publishMicrophoneTrack"] as? Bool {
            options.publishMicrophoneTrack = value
        }
        if let value = params["publishScreenCaptureVideo"] as? Bool {
            options.publishScreenCaptureVideo = value
        }
        if let value = params["publishScreenCaptureAudio"] as? Bool {
            options.publishScreenCaptureAudio = value
        }
        if let value = params["publishCustomAudioTrack"] as? Bool {
            options.publishCustomAudioTrack = value
        }
        if let value = params["publishCustomAudioTrackId"] as? Int {
            options.publishCustomAudioTrackId = value
        }
        if let value = params["publishCustomVideoTrack"] as? Bool {
            options.publishCustomVideoTrack = value
        }
        if let value = params["publishEncodedVideoTrack"] as? Bool {
            options.publishEncodedVideoTrack = value
        }
        if let value = params["publishMediaPlayerAudioTrack"] as? Bool {
            options.publishMediaPlayerAudioTrack = value
        }
        if let value = params["publishMediaPlayerVideoTrack"] as? Bool {
            options.publishMediaPlayerVideoTrack = value
        }
        if let value = params["publishTranscodedVideoTrack"] as? Bool {
            options.publishTranscodedVideoTrack = value
        }
        if let value = params["publishMixedAudioTrack"] as? Bool {
            options.publishMixedAudioTrack = value
        }
        if let value = params["publishLipSyncTrack"] as? Bool {
            options.publishLipSyncTrack = value
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
        if let value = params["publishMediaPlayerId"] as? Int {
            options.publishMediaPlayerId = value
        }
        if let rawValue = params["audienceLatencyLevel"] {
            options.audienceLatencyLevel = parseAudienceLatencyLevel(rawValue)
        }
        if let rawValue = params["defaultVideoStreamType"] {
            options.defaultVideoStreamType = parseVideoStreamType(rawValue)
        }
        if let value = params["audioDelayMs"] as? Int {
            options.audioDelayMs = value
        }
        if let value = params["mediaPlayerAudioDelayMs"] as? Int {
            options.mediaPlayerAudioDelayMs = value
        }
        if let value = params["token"] as? String {
            options.token = value
        }
        if let value = params["enableBuiltInMediaEncryption"] as? Bool {
            options.enableBuiltInMediaEncryption = value
        }
        if let value = params["publishRhythmPlayerTrack"] as? Bool {
            options.publishRhythmPlayerTrack = value
        }
        if let value = params["isInteractiveAudience"] as? Bool {
            options.isInteractiveAudience = value
        }
        if let value = params["customVideoTrackId"] as? Int {
            options.customVideoTrackId = value
        }
        if let value = params["isAudioFilterable"] as? Bool {
            options.isAudioFilterable = value
        }
        if let value = params["enableMultipath"] as? Bool {
            options.enableMultipath = value
        }
        if let rawValue = params["uplinkMultipathMode"] {
            options.uplinkMultipathMode = parseMultipathMode(rawValue)
        }
        if let rawValue = params["downlinkMultipathMode"] {
            options.downlinkMultipathMode = parseMultipathMode(rawValue)
        }
        if let rawValue = params["preferMultipathType"] {
            options.preferMultipathType = parseMultipathType(rawValue)
        }
        if let value = params["startPreview"] as? Bool {
            _ = value
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

    private func hasLeaveChannelOptions(_ params: [String: Any]) -> Bool {
        return params["stopAudioMixing"] != nil
            || params["stopAllEffect"] != nil
            || params["unloadAllEffect"] != nil
            || params["stopMicrophoneRecording"] != nil
    }

    private func buildLeaveChannelOptions(_ params: [String: Any]) -> AgoraLeaveChannelOptions {
        let options = AgoraLeaveChannelOptions()
        if let value = params["stopAudioMixing"] as? Bool {
            options.stopAudioMixing = value
        }
        if let value = params["stopAllEffect"] as? Bool {
            options.stopAllEffect = value
        }
        if let value = params["unloadAllEffect"] as? Bool {
            options.unloadAllEffect = value
        }
        if let value = params["stopMicrophoneRecording"] as? Bool {
            options.stopMicrophoneRecording = value
        }
        return options
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

    private func parseAudienceLatencyLevel(_ rawValue: Any) -> AgoraAudienceLatencyLevelType {
        let value = intValue(rawValue)
        return AgoraAudienceLatencyLevelType(rawValue: value) ?? AgoraAudienceLatencyLevelType(rawValue: 0)!
    }

    private func parseVideoStreamType(_ rawValue: Any) -> AgoraVideoStreamType {
        let value = intValue(rawValue)
        return AgoraVideoStreamType(rawValue: value) ?? AgoraVideoStreamType(rawValue: 0)!
    }

    private func parseContentInspectModulePosition(_ rawValue: Any) -> AgoraVideoModulePosition {
        let value = intValue(rawValue)
        return AgoraVideoModulePosition(rawValue: value) ?? .preRenderer
    }

    private func parseMultipathMode(_ rawValue: Any) -> AgoraMultipathMode {
        let value = intValue(rawValue)
        return AgoraMultipathMode(rawValue: value) ?? AgoraMultipathMode(rawValue: 0)!
    }

    private func parseMultipathType(_ rawValue: Any) -> AgoraMultipathType {
        let value = intValue(rawValue)
        return AgoraMultipathType(rawValue: value) ?? AgoraMultipathType(rawValue: 99)!
    }

    private func buildClientRoleOptions(_ params: [String: Any]?) -> AgoraClientRoleOptions {
        let options = AgoraClientRoleOptions()
        if let rawValue = params?["audienceLatencyLevel"] {
            options.audienceLatencyLevel = parseAudienceLatencyLevel(rawValue)
        }
        return options
    }

    private func buildAdvancedVideoOptions(_ params: [String: Any]?) -> AgoraAdvancedVideoOptions {
        let options = AgoraAdvancedVideoOptions()
        let encodingPreferenceValue = intValue(params?["encodingPreference"] ?? -1)
        options.encodingPreference = AgoraEncodingPreference(rawValue: encodingPreferenceValue) ?? AgoraEncodingPreference(rawValue: -1)!
        let compressionPreferenceValue = intValue(params?["compressionPreference"] ?? -1)
        options.compressionPreference = AgoraCompressionPreference(rawValue: compressionPreferenceValue) ?? AgoraCompressionPreference(rawValue: -1)!
        options.encodeAlpha = params?["encodeAlpha"] as? Bool ?? false
        return options
    }

    private func buildContentInspectModules(_ params: [String: Any]) -> [AgoraContentInspectModule] {
        if let moduleParams = params["modules"] as? [[String: Any]], !moduleParams.isEmpty {
            return moduleParams.map { buildContentInspectModule($0) }
        }
        return [buildContentInspectModule([
            "type": params["module"] ?? 1,
            "interval": params["interval"] ?? 0,
            "position": params["position"] ?? AgoraVideoModulePosition.preRenderer.rawValue,
        ])]
    }

    private func buildContentInspectModule(_ params: [String: Any]) -> AgoraContentInspectModule {
        let module = AgoraContentInspectModule()
        let typeValue = UInt(intValue(params["type"] ?? 1))
        module.type = AgoraContentInspectType(rawValue: typeValue) ?? AgoraContentInspectType(rawValue: 1)!
        module.interval = intValue(params["interval"] ?? 0)
        applyContentInspectModulePosition(module, rawValue: params["position"] ?? AgoraVideoModulePosition.preRenderer.rawValue)
        return module
    }

    private func applyContentInspectModulePosition(_ module: AgoraContentInspectModule, rawValue: Any) {
        let selector = NSSelectorFromString("setPosition:")
        guard module.responds(to: selector) else {
            return
        }
        module.setValue(NSNumber(value: parseContentInspectModulePosition(rawValue).rawValue), forKey: "position")
    }

    private func intValue(_ rawValue: Any) -> Int {
        if let value = rawValue as? Int {
            return value
        }
        if let value = rawValue as? UInt {
            return Int(value)
        }
        if let value = rawValue as? NSNumber {
            return value.intValue
        }
        if let value = rawValue as? String {
            return Int(value) ?? 0
        }
        return 0
    }

    private func handleJoinChannelWithUserAccount(requestId: String, params: [String: Any]) {
        guard rtcEngine != nil else {
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
        guard let userAccount = requiredString(
            params,
            key: "userAccount",
            requestId: requestId,
            message: "User account is required."
        ) else {
            return
        }

        if let mediaOptionParams = params["options"] as? [String: Any] {
            let mediaOptions = buildChannelMediaOptions(mediaOptionParams)
            guard let engine = self.rtcEngine else {
                self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                return
            }
            if self.mediaOptionBool(mediaOptionParams, key: "startPreview", defaultValue: false) {
                let previewResult = engine.startPreview(self.videoSourceType(from: mediaOptionParams))
                guard previewResult >= 0 else {
                    self.dispatchResult(requestId: requestId, method: "startPreview", result: previewResult)
                    return
                }
            }
            let result = engine.joinChannel(
                byToken: token,
                channelId: channelId,
                userAccount: userAccount,
                mediaOptions: mediaOptions,
                joinSuccess: nil
            )
            self.dispatchResult(requestId: requestId, method: "joinChannelWithUserAccount", result: result)
        } else {
            guard let engine = self.rtcEngine else {
                self.dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                return
            }
            let result = engine.joinChannel(byToken: token,
                channelId: channelId,
                userAccount: userAccount,
                joinSuccess: nil
            )
            self.dispatchResult(requestId: requestId, method: "joinChannelWithUserAccount", result: result)
        }
    }

    private func handleGetUserInfoByUserAccount(requestId: String, params: [String: Any]) {
        guard let engine = rtcEngine else {
            dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
            return
        }
        guard let userAccount = requiredString(
            params,
            key: "userAccount",
            requestId: requestId,
            message: "User account is required."
        ) else {
            return
        }

        var errorCode = AgoraErrorCode.noError
        guard let userInfo = engine.getUserInfo(byUserAccount: userAccount, withError: &errorCode) else {
            dispatchResult(requestId: requestId, method: "getUserInfoByUserAccount", result: Int32(errorCode.rawValue))
            return
        }

        dispatchResponse([
            "requestId": requestId,
            "ok": true,
            "result": [
                "uid": userInfo.uid,
                "userAccount": userInfo.userAccount ?? userAccount,
            ],
        ])
    }

    private func requireEngine(requestId: String, action: (AgoraRtcEngineKit) -> Void) {
        runOnMainQueueSync {
            guard let engine = rtcEngine else {
                dispatchError(requestId: requestId, message: "RtcEngine is not initialized.")
                return
            }
            action(engine)
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

    private func isSupportedRenderBackend(_ backend: String) -> Bool { backend == "engine-texture" }

    private func isSupportedLocalTextureSourceType(_ sourceType: AgoraVideoSourceType) -> Bool {
        return sourceType == .camera
    }

    private func validateLocalTextureSourceType(requestId: String, params: [String: Any]) -> Bool {
        let sourceType = videoSourceType(from: params)
        guard isSupportedLocalTextureSourceType(sourceType) else {
            dispatchInvalidArgumentError(
                requestId: requestId,
                message: "engine-texture local rendering supports only the primary camera source.",
                method: "setupLocalVideoView",
                argumentName: "sourceType",
                argumentValue: "\(sourceType.rawValue)"
            )
            return false
        }
        return true
    }

    private func handleSetupLocalVideoView(requestId: String, params: [String: Any]) {
        requireEngine(requestId: requestId) { _ in
            guard self.validateLocalTextureSourceType(requestId: requestId, params: params) else {
                return
            }
            self.localTextureRequested = true
            self.ensureLocalTextureSlot(params)
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func handleSetupRemoteVideoView(requestId: String, params: [String: Any]) {
        requireEngine(requestId: requestId) { _ in
            let uid = uintValue(params["uid"] ?? 0)
            self.remoteTextureUids.insert(uid)
            self.ensureRemoteTextureSlot(uid, params: params)
            self.dispatchResponse([
                "requestId": requestId,
                "ok": true,
            ])
        }
    }

    private func handleUpdateLocalVideoView(requestId: String, params: [String: Any]) {
        guard validateLocalTextureSourceType(requestId: requestId, params: params) else {
            return
        }
        localTextureRequested = true
        ensureLocalTextureSlot(params)
        dispatchResponse([
            "requestId": requestId,
            "ok": true,
        ])
    }

    private func handleUpdateRemoteVideoView(requestId: String, params: [String: Any]) {
        let uid = uintValue(params["uid"] ?? 0)
        remoteTextureUids.insert(uid)
        ensureRemoteTextureSlot(uid, params: params)
        dispatchResponse([
            "requestId": requestId,
            "ok": true,
        ])
    }

    private func handleRemoveLocalVideoView(requestId: String) {
        localTextureRequested = false
        releaseLocalTextureSlot()
        dispatchResponse([
            "requestId": requestId,
            "ok": true,
        ])
    }

    private func handleRemoveRemoteVideoView(requestId: String, params: [String: Any]) {
        let uid = uintValue(params["uid"] ?? 0)
        remoteTextureUids.remove(uid)
        releaseRemoteTextureSlot(uid)
        dispatchResponse([
            "requestId": requestId,
            "ok": true,
        ])
    }

    private func ensureLocalTextureSlot(_ params: [String: Any]) {
        let width = resolveTextureWidth(params, local: true)
        let height = resolveTextureHeight(params, local: true)
        let renderMode = self.renderMode(from: params)
        let observerPosition = resolveFrameObserverPosition(
            params,
            supportedPositions: [.postCapture, .preEncoder],
            fallbackPosition: .postCapture
        )
        if let localTextureSlot,
           localTextureSlot.width == width,
           localTextureSlot.height == height,
           localTextureSlot.renderMode == renderMode,
            localTextureSlot.observerPosition == observerPosition {
            refreshObservedFramePosition()
            return
        }
        releaseLocalTextureSlot()
        guard let slotId = createTextureSlot(width: width, height: height) else {
            return
        }
        localTextureSlot = TextureSlotState(
            slotId: slotId,
            width: width,
            height: height,
            renderMode: renderMode,
            observerPosition: observerPosition
        )
        configureTextureSlot(slotId: slotId, width: width, height: height, renderMode: renderMode)
        refreshObservedFramePosition()
    }

    private func ensureRemoteTextureSlot(_ uid: UInt, params: [String: Any]) {
        let width = resolveTextureWidth(params, local: false)
        let height = resolveTextureHeight(params, local: false)
        let renderMode = self.renderMode(from: params)
        let observerPosition = resolveFrameObserverPosition(
            params,
            supportedPositions: .preRenderer,
            fallbackPosition: .preRenderer
        )
        if let slot = remoteTextureSlots[uid],
           slot.width == width,
           slot.height == height,
           slot.renderMode == renderMode,
            slot.observerPosition == observerPosition {
            refreshObservedFramePosition()
            return
        }
        releaseRemoteTextureSlot(uid)
        guard let slotId = createTextureSlot(width: width, height: height) else {
            return
        }
        remoteTextureSlots[uid] = TextureSlotState(
            slotId: slotId,
            width: width,
            height: height,
            renderMode: renderMode,
            observerPosition: observerPosition
        )
        configureTextureSlot(slotId: slotId, width: width, height: height, renderMode: renderMode)
        refreshObservedFramePosition()
    }

    private func releaseLocalTextureSlot() {
        guard let slot = localTextureSlot else {
            return
        }
        localTextureSlot = nil
        releaseTextureSlot(slotId: slot.slotId)
        refreshObservedFramePosition()
        dispatchEvent(name: "localVideoTextureReleased", payload: [
            "slotId": slot.slotId,
        ])
    }

    private func releaseRemoteTextureSlot(_ uid: UInt) {
        guard let slot = remoteTextureSlots.removeValue(forKey: uid) else {
            return
        }
        releaseTextureSlot(slotId: slot.slotId)
        refreshObservedFramePosition()
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

    private func applyVideoCanvasParams(_ canvas: AgoraRtcVideoCanvas, params: [String: Any], fallbackUid: UInt) {
        canvas.uid = uintValue(params["uid"] ?? fallbackUid)
        canvas.subviewUid = uintValue(params["subviewUid"] ?? canvas.subviewUid)
        canvas.renderMode = renderMode(from: params)
        canvas.mirrorMode = mirrorMode(from: params)
        canvas.setupMode = videoViewSetupMode(from: params)
        canvas.sourceType = videoSourceType(from: params)
        canvas.mediaPlayerId = Int32(intValue(params["mediaPlayerId"] ?? canvas.mediaPlayerId))
        if let cropArea = rectValue(params["cropArea"]) {
            canvas.cropArea = cropArea
        }
        canvas.backgroundColor = uint32Value(params["backgroundColor"] ?? canvas.backgroundColor)
        canvas.enableAlphaMask = boolValue(params["enableAlphaMask"] ?? canvas.enableAlphaMask)
        canvas.position = videoModulePosition(from: params)
    }

    private func renderMode(from params: [String: Any]) -> AgoraVideoRenderMode {
        let mode = params["renderMode"] as? String ?? "hidden"
        switch mode {
        case "adaptive":
            return .adaptive
        case "fit":
            return .fit
        default:
            return .hidden
        }
    }

    private func mirrorMode(from params: [String: Any]) -> AgoraVideoMirrorMode {
        let value = intValue(params["mirrorMode"] ?? AgoraVideoMirrorMode.auto.rawValue)
        return AgoraVideoMirrorMode(rawValue: UInt(value)) ?? .auto
    }

    private func videoViewSetupMode(from params: [String: Any]) -> AgoraVideoViewSetupMode {
        let value = intValue(params["setupMode"] ?? AgoraVideoViewSetupMode.replace.rawValue)
        return AgoraVideoViewSetupMode(rawValue: value) ?? .replace
    }

    private func videoSourceType(from params: [String: Any]) -> AgoraVideoSourceType {
        let value: Int
        if params["videoSourceType"] != nil {
            value = intValue(params["videoSourceType"]!)
        } else {
            value = intValue(params["sourceType"] ?? AgoraVideoSourceType.camera.rawValue)
        }
        return AgoraVideoSourceType(rawValue: value) ?? .camera
    }

    private func mediaSourceType(from params: [String: Any]) -> AgoraMediaSourceType {
        let value: Int
        if params["mediaSourceType"] != nil {
            value = intValue(params["mediaSourceType"]!)
        } else {
            value = intValue(params["sourceType"] ?? AgoraMediaSourceType.primaryCamera.rawValue)
        }
        return AgoraMediaSourceType(rawValue: value) ?? .primaryCamera
    }

    private func videoModulePosition(from params: [String: Any]) -> AgoraVideoModulePosition {
        let value = intValue(params["position"] ?? AgoraVideoModulePosition.postCapture.rawValue)
        return AgoraVideoModulePosition(rawValue: value) ?? .postCapture
    }

    private func rectValue(_ rawValue: Any?) -> CGRect? {
        guard let params = rawValue as? [String: Any] else {
            return nil
        }
        return CGRect(
            x: CGFloat(doubleValue(params["x"] ?? 0)),
            y: CGFloat(doubleValue(params["y"] ?? 0)),
            width: CGFloat(doubleValue(params["width"] ?? 0)),
            height: CGFloat(doubleValue(params["height"] ?? 0))
        )
    }

    private func resolveTextureWidth(_ params: [String: Any], local: Bool) -> Int {
        let fallback = local ? 320 : 854
        return max(1, intValue(params["textureWidth"] ?? params["width"] ?? fallback))
    }

    private func resolveTextureHeight(_ params: [String: Any], local: Bool) -> Int {
        let fallback = local ? 180 : 480
        return max(1, intValue(params["textureHeight"] ?? params["height"] ?? fallback))
    }

    private func resolveFrameObserverPosition(
        _ params: [String: Any],
        supportedPositions: AgoraVideoFramePosition,
        fallbackPosition: AgoraVideoFramePosition
    ) -> AgoraVideoFramePosition {
        let rawPosition = intValue(params["position"] ?? frameObserverRawValue(fallbackPosition))
        var position: AgoraVideoFramePosition = []
        if rawPosition & Int(AgoraVideoModulePosition.postCapture.rawValue) != 0 {
            position.insert(.postCapture)
        }
        if rawPosition & Int(AgoraVideoModulePosition.preRenderer.rawValue) != 0 {
            position.insert(.preRenderer)
        }
        if rawPosition & Int(AgoraVideoModulePosition.preEncoder.rawValue) != 0 {
            position.insert(.preEncoder)
        }
        position.formIntersection(supportedPositions)
        return position.isEmpty ? fallbackPosition : position
    }

    private func frameObserverRawValue(_ position: AgoraVideoFramePosition) -> Int {
        var value = 0
        if position.contains(.postCapture) {
            value |= Int(AgoraVideoModulePosition.postCapture.rawValue)
        }
        if position.contains(.preRenderer) {
            value |= Int(AgoraVideoModulePosition.preRenderer.rawValue)
        }
        if position.contains(.preEncoder) {
            value |= Int(AgoraVideoModulePosition.preEncoder.rawValue)
        }
        return value
    }

    private func refreshObservedFramePosition() {
        var nextPosition: AgoraVideoFramePosition = []
        if localTextureRequested, let localTextureSlot {
            nextPosition.formUnion(localTextureSlot.observerPosition)
        }
        for (uid, slot) in remoteTextureSlots where remoteTextureUids.contains(uid) {
            nextPosition.formUnion(slot.observerPosition)
        }
        if nextPosition.isEmpty {
            nextPosition = [.postCapture, .preRenderer]
        }
        if observedFramePosition == nextPosition {
            return
        }
        observedFramePosition = nextPosition
        _ = rtcEngine?.setVideoFrameDelegate(self)
        dispatchEvent(name: "renderBackendState", payload: [
            "backend": "engine-texture",
            "phase": "observerPosition",
            "result": 0,
            "uid": 0,
        ])
    }

    private func uintValue(_ rawValue: Any) -> UInt {
        if let value = rawValue as? UInt {
            return value
        }
        if let value = rawValue as? Int {
            return value < 0 ? 0 : UInt(value)
        }
        if let value = rawValue as? NSNumber {
            return value.intValue < 0 ? 0 : value.uintValue
        }
        if let value = rawValue as? String, let parsed = UInt(value) {
            return parsed
        }
        return 0
    }

    private func uint32Value(_ rawValue: Any) -> UInt32 {
        if let value = rawValue as? UInt32 {
            return value
        }
        if let value = rawValue as? UInt {
            return UInt32(clamping: value)
        }
        if let value = rawValue as? Int {
            return value < 0 ? 0 : UInt32(clamping: UInt(value))
        }
        if let value = rawValue as? NSNumber {
            return value.intValue < 0 ? 0 : UInt32(clamping: value.uintValue)
        }
        if let value = rawValue as? String, let parsed = UInt32(value) {
            return parsed
        }
        return 0
    }

    private func boolValue(_ rawValue: Any) -> Bool {
        if let value = rawValue as? Bool {
            return value
        }
        if let value = rawValue as? NSNumber {
            return value.boolValue
        }
        if let value = rawValue as? String {
            return value == "true" || value == "1"
        }
        return false
    }

    private func doubleValue(_ rawValue: Any) -> Double {
        if let value = rawValue as? Double {
            return value
        }
        if let value = rawValue as? Int {
            return Double(value)
        }
        if let value = rawValue as? UInt {
            return Double(value)
        }
        if let value = rawValue as? NSNumber {
            return value.doubleValue
        }
        if let value = rawValue as? String {
            return Double(value) ?? 0
        }
        return 0
    }

    private func channelStatsPayload(_ stats: AgoraChannelStats) -> [String: Any] {
        return [
            "duration": stats.duration,
            "txBytes": stats.txBytes,
            "rxBytes": stats.rxBytes,
            "txAudioKBitRate": stats.txAudioKBitrate,
            "rxAudioKBitRate": stats.rxAudioKBitrate,
            "txVideoKBitRate": stats.txVideoKBitrate,
            "rxVideoKBitRate": stats.rxVideoKBitrate,
            "txAudioBytes": stats.txAudioBytes,
            "txVideoBytes": stats.txVideoBytes,
            "rxAudioBytes": stats.rxAudioBytes,
            "rxVideoBytes": stats.rxVideoBytes,
            "lastmileDelay": stats.lastmileDelay,
            "users": stats.userCount,
            "cpuAppUsage": stats.cpuAppUsage,
            "cpuTotalUsage": stats.cpuTotalUsage,
            "gatewayRtt": stats.gatewayRtt,
            "memoryAppUsageRatio": stats.memoryAppUsageRatio,
            "memoryTotalUsageRatio": stats.memoryTotalUsageRatio,
            "memoryAppUsageInKbytes": stats.memoryAppUsageInKbytes,
            "connectTimeMs": stats.connectTimeMs,
            "txKBitRate": stats.txKBitrate,
            "rxKBitRate": stats.rxKBitrate,
            "txPacketLossRate": stats.txPacketLossRate,
            "rxPacketLossRate": stats.rxPacketLossRate,
        ]
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

    private func dispatchAgoraError(requestId: String, method: String, result: Int32) {
        dispatchResult(requestId: requestId, method: method, result: result)
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
        NSLog("[agora-rtc-native] didJoinChannel channel=%@ uid=%u elapsed=%d", channel, uid, elapsed)
        dispatchEvent(name: "joinChannelSuccess", payload: [
            "channelId": channel,
            "uid": uid,
            "elapsed": elapsed,
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
        dispatchEvent(name: "leaveChannel", payload: channelStatsPayload(stats))
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, reportRtcStats stats: AgoraChannelStats) {
        dispatchEvent(name: "rtcStats", payload: channelStatsPayload(stats))
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didJoinedOfUid uid: UInt, elapsed: Int) {
        dispatchEvent(name: "userJoined", payload: [
            "uid": uid,
            "elapsed": elapsed,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, firstLocalAudioFramePublished elapsed: Int) {
        dispatchEvent(name: "firstLocalAudioFramePublished", payload: [
            "elapsed": elapsed,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, contentInspectResult result: AgoraContentInspectResult) {
        dispatchEvent(name: "contentInspectResult", payload: [
            "result": result.rawValue,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, localVideoStateChangedOf state: AgoraVideoLocalState, reason: AgoraLocalVideoStreamReason, sourceType: AgoraVideoSourceType) {
        dispatchEvent(name: "localVideoStateChanged", payload: [
            "sourceType": sourceType.rawValue,
            "state": state.rawValue,
            "error": reason.rawValue,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, firstRemoteVideoDecodedOfUid uid: UInt, size: CGSize, elapsed: Int) {
        NSLog("[agora-rtc-native] firstRemoteVideoDecoded uid=%u size=%@ elapsed=%d", uid, NSCoder.string(for: size), elapsed)
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

    func rtcEngine(_ engine: AgoraRtcEngineKit, remoteAudioStateChangedOfUid uid: UInt, state: AgoraAudioRemoteState, reason: AgoraAudioRemoteReason, elapsed: Int) {
        dispatchEvent(name: "remoteAudioStateChanged", payload: [
            "uid": uid,
            "state": state.rawValue,
            "reason": reason.rawValue,
            "elapsed": elapsed,
        ])
    }

    func rtcEngine(_ engine: AgoraRtcEngineKit, didOfflineOfUid uid: UInt, reason: AgoraUserOfflineReason) {
        remoteTextureUids.remove(uid)
        releaseRemoteTextureSlot(uid)
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
        return .cvPixelNV12
    }

    func getObservedFramePosition() -> AgoraVideoFramePosition {
        return observedFramePosition
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
        guard localTextureRequested,
              let slot = localTextureSlot,
              slot.observerPosition.contains(.postCapture) else {
            return true
        }
        updateTextureSlot(slot, videoFrame: videoFrame)
        return true
    }

    func onPreEncode(_ videoFrame: AgoraOutputVideoFrame, sourceType: AgoraVideoSourceType) -> Bool {
        guard renderBackend == "engine-texture" else {
            return true
        }
        guard localTextureRequested,
              let slot = localTextureSlot,
              slot.observerPosition.contains(.preEncoder) else {
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
        guard isTracked,
              let slot,
              slot.observerPosition.contains(.preRenderer) else {
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
