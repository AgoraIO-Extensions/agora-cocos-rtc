package io.agora.cocos.rtc;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Queue;
import java.util.Set;

import com.cocos.lib.CocosHelper;
import com.cocos.lib.GlobalObject;
import com.cocos.lib.JsbBridgeWrapper;

import io.agora.rtc2.ChannelMediaOptions;
import io.agora.rtc2.Constants;
import io.agora.rtc2.IAudioEffectManager;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.cocos.rtc.render.AgoraRenderBackend;
import io.agora.cocos.rtc.render.AgoraRenderBackendFactory;
import io.agora.cocos.rtc.render.AgoraRenderResultCallback;
import io.agora.rtc2.video.BeautyOptions;
import io.agora.rtc2.video.ContentInspectConfig;
import io.agora.rtc2.video.VideoEncoderConfiguration;

/**
 * Template bridge for the initial integration.
 * The exported Android project should call attachBridge() during app startup
 * and forward Activity permission results into onRequestPermissionsResult().
 */
public final class AgoraRtcPlugin {
    private static final String RESPONSE_EVENT = "agora:response";
    private static final String CALLBACK_EVENT = "agora:event";
    private static final String REQUEST_EVENT = "agora:request";
    private static final int RTC_PERMISSION_REQUEST_CODE = 9108;
    private static final String[] RTC_RUNTIME_PERMISSIONS = new String[] {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
    };
    private static final AgoraRtcPlugin INSTANCE = new AgoraRtcPlugin();

    private RtcEngine rtcEngine;
    private boolean attached;
    private boolean permissionRequestInFlight;
    private final Queue<PendingPermissionAction> pendingPermissionActions = new ArrayDeque<>();
    private String renderBackendType = "surface-view";
    private AgoraRenderBackend renderBackend = AgoraRenderBackendFactory.create(
            renderBackendType,
            this::dispatchEvent
    );

    public static AgoraRtcPlugin getInstance() {
        return INSTANCE;
    }

    public void attachBridge() {
        if (attached) {
            return;
        }
        attached = true;
        JsbBridgeWrapper.getInstance().addScriptEventListener(REQUEST_EVENT, payload -> {
            String requestId = "";
            try {
                requestId = extractRequestId(payload);
                handleScriptRequest(payload);
            } catch (JSONException error) {
                dispatchError("", "Invalid script payload: " + error.getMessage());
            } catch (Exception error) {
                dispatchNativeExceptionError(requestId, error);
            }
        });
    }

    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != RTC_PERMISSION_REQUEST_CODE) {
            return;
        }

        permissionRequestInFlight = false;
        Set<String> deniedPermissions = new HashSet<>();
        if (grantResults == null || grantResults.length == 0) {
            addAllRtcRuntimePermissions(deniedPermissions);
        } else if (permissions == null || permissions.length == 0) {
            addAllRtcRuntimePermissions(deniedPermissions);
        } else {
            for (int index = 0; index < grantResults.length && index < permissions.length; index += 1) {
                if (grantResults[index] != PackageManager.PERMISSION_GRANTED) {
                    deniedPermissions.add(permissions[index]);
                }
            }
        }

        resumePendingPermissionActions(deniedPermissions);
    }

    private void resumePendingPermissionActions(Set<String> deniedPermissions) {
        while (!pendingPermissionActions.isEmpty() && !permissionRequestInFlight) {
            PendingPermissionAction pendingAction = pendingPermissionActions.poll();
            if (requiresDeniedRtcPermission(pendingAction, deniedPermissions)) {
                dispatchError(pendingAction.requestId, "Camera and microphone permissions are required.");
                continue;
            }
            ensureRtcPermissions(
                    pendingAction.requestId,
                    pendingAction.requiresCamera,
                    pendingAction.requiresMicrophone,
                    pendingAction.action
            );
        }
    }

    private boolean requiresDeniedRtcPermission(PendingPermissionAction pendingAction, Set<String> deniedPermissions) {
        return (pendingAction.requiresCamera && deniedPermissions.contains(Manifest.permission.CAMERA))
                || (pendingAction.requiresMicrophone && deniedPermissions.contains(Manifest.permission.RECORD_AUDIO));
    }

    private void addAllRtcRuntimePermissions(Set<String> permissions) {
        for (String permission : RTC_RUNTIME_PERMISSIONS) {
            permissions.add(permission);
        }
    }

    public void handleScriptRequest(String payload) throws JSONException {
        JSONObject request = new JSONObject(payload);
        String method = request.optString("method");
        String requestId = request.optString("requestId");
        JSONObject params = request.optJSONObject("params");

        switch (method) {
            case "setRenderBackend":
                handleSetRenderBackend(requestId, params);
                break;
            case "initialize":
                handleInitialize(requestId, params);
                break;
            case "getSdkVersion":
                handleGetSdkVersion(requestId);
                break;
            case "getErrorDescription":
                handleGetErrorDescription(requestId, params);
                break;
            case "setLogFilter":
                handleSetLogFilter(requestId, params);
                break;
            case "setLogFile":
                handleSetLogFile(requestId, params);
                break;
            case "setChannelProfile":
                handleSetChannelProfile(requestId, params);
                break;
            case "setClientRole":
                handleSetClientRole(requestId, params);
                break;
            case "joinChannel":
                handleJoinChannel(requestId, params);
                break;
            case "leaveChannel":
                handleLeaveChannel(requestId);
                break;
            case "renewToken":
                handleRenewToken(requestId, params);
                break;
            case "enableAudio":
                handleEnableAudio(requestId, params);
                break;
            case "enableLocalAudio":
                handleEnableLocalAudio(requestId, params);
                break;
            case "muteLocalAudioStream":
                handleMuteLocalAudioStream(requestId, params);
                break;
            case "muteRemoteAudioStream":
                handleMuteRemoteAudioStream(requestId, params);
                break;
            case "muteAllRemoteAudioStreams":
                handleMuteAllRemoteAudioStreams(requestId, params);
                break;
            case "setAudioProfile":
                handleSetAudioProfile(requestId, params);
                break;
            case "enableAudioVolumeIndication":
                handleEnableAudioVolumeIndication(requestId, params);
                break;
            case "setDefaultAudioRouteToSpeakerphone":
                handleSetDefaultAudioRouteToSpeakerphone(requestId, params);
                break;
            case "setEnableSpeakerphone":
                handleSetEnableSpeakerphone(requestId, params);
                break;
            case "isSpeakerphoneEnabled":
                handleIsSpeakerphoneEnabled(requestId);
                break;
            case "adjustPlaybackSignalVolume":
                handleAdjustPlaybackSignalVolume(requestId, params);
                break;
            case "adjustUserPlaybackSignalVolume":
                handleAdjustUserPlaybackSignalVolume(requestId, params);
                break;
            case "setAudioSessionOperationRestriction":
                handleSetAudioSessionOperationRestriction(requestId, params);
                break;
            case "enableVideo":
                handleEnableVideo(requestId, params);
                break;
            case "enableLocalVideo":
                handleEnableLocalVideo(requestId, params);
                break;
            case "muteLocalVideoStream":
                handleMuteLocalVideoStream(requestId, params);
                break;
            case "muteRemoteVideoStream":
                handleMuteRemoteVideoStream(requestId, params);
                break;
            case "muteAllRemoteVideoStreams":
                handleMuteAllRemoteVideoStreams(requestId, params);
                break;
            case "destroy":
                handleDestroy(requestId);
                break;
            case "setVideoEncoderConfiguration":
                handleSetVideoEncoderConfiguration(requestId, params);
                break;
            case "setupLocalVideoView":
                handleSetupLocalVideoView(requestId, params);
                break;
            case "setupRemoteVideoView":
                handleSetupRemoteVideoView(requestId, params);
                break;
            case "updateLocalVideoView":
                handleUpdateLocalVideoView(requestId, params);
                break;
            case "updateRemoteVideoView":
                handleUpdateRemoteVideoView(requestId, params);
                break;
            case "removeLocalVideoView":
                handleRemoveLocalVideoView(requestId);
                break;
            case "removeRemoteVideoView":
                handleRemoveRemoteVideoView(requestId, params);
                break;
            case "setNativeVideoOverlaySuspended":
                handleSetNativeVideoOverlaySuspended(requestId, params);
                break;
            case "startPreview":
                handleStartPreview(requestId);
                break;
            case "stopPreview":
                handleStopPreview(requestId);
                break;
            case "switchCamera":
                handleSwitchCamera(requestId);
                break;
            case "setBeautyEffectOptions":
                handleSetBeautyEffectOptions(requestId, params);
                break;
            case "enableContentInspect":
                handleEnableContentInspect(requestId, params);
                break;
            case "startAudioMixing":
                handleStartAudioMixing(requestId, params);
                break;
            case "pauseAudioMixing":
                handlePauseAudioMixing(requestId);
                break;
            case "resumeAudioMixing":
                handleResumeAudioMixing(requestId);
                break;
            case "stopAudioMixing":
                handleStopAudioMixing(requestId);
                break;
            case "getAudioMixingCurrentPosition":
                handleGetAudioMixingCurrentPosition(requestId);
                break;
            case "setAudioMixingPosition":
                handleSetAudioMixingPosition(requestId, params);
                break;
            case "adjustAudioMixingVolume":
                handleAdjustAudioMixingVolume(requestId, params);
                break;
            case "preloadEffect":
                handlePreloadEffect(requestId, params);
                break;
            case "playEffect":
                handlePlayEffect(requestId, params);
                break;
            case "stopEffect":
                handleStopEffect(requestId, params);
                break;
            case "setParameters":
                handleSetParameters(requestId, params);
                break;
            default:
                dispatchUnsupported(requestId, method);
                break;
        }
    }

    private void handleGetSdkVersion(String requestId) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true,
                "result", RtcEngine.getSdkVersion()
        ));
    }

    private void handleSetLogFilter(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.setLogFilter(params != null ? params.optInt("level", 0) : 0);
        if (result < 0) {
            dispatchAgoraError(requestId, "setLogFilter", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetLogFile(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String path = params != null ? params.optString("path", "") : "";
        if (path == null || path.trim().isEmpty()) {
            dispatchError(requestId, "Log file path is required.");
            return;
        }
        int result = rtcEngine.setLogFile(path);
        if (result < 0) {
            dispatchAgoraError(requestId, "setLogFile", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetChannelProfile(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String profile = params != null ? params.optString("profile", "communication") : "communication";
        int agoraProfile = "liveBroadcasting".equals(profile)
                ? Constants.CHANNEL_PROFILE_LIVE_BROADCASTING
                : Constants.CHANNEL_PROFILE_COMMUNICATION;
        int result = rtcEngine.setChannelProfile(agoraProfile);
        if (result < 0) {
            dispatchAgoraError(requestId, "setChannelProfile", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetClientRole(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String role = params != null ? params.optString("role", "broadcaster") : "broadcaster";
        int agoraRole = "audience".equals(role)
                ? Constants.CLIENT_ROLE_AUDIENCE
                : Constants.CLIENT_ROLE_BROADCASTER;
        int result = rtcEngine.setClientRole(agoraRole);
        if (result < 0) {
            dispatchAgoraError(requestId, "setClientRole", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetRenderBackend(String requestId, JSONObject params) {
        String backend = params != null ? params.optString("backend", "surface-view") : "surface-view";
        if (backend == null || backend.trim().isEmpty()) {
            dispatchError(requestId, "Render backend is required.");
            return;
        }
        if (!isSupportedRenderBackend(backend)) {
            dispatchInvalidArgumentError(
                    requestId,
                    "Unsupported render backend: " + backend,
                    "setRenderBackend",
                    "backend",
                    backend
            );
            return;
        }

        if (backend.equals(renderBackendType) && renderBackend != null) {
            dispatchOk(requestId);
            return;
        }

        try {
            AgoraRenderBackend nextBackend = AgoraRenderBackendFactory.create(backend, this::dispatchEvent);
            if (renderBackend != null) {
                renderBackend.release();
            }
            renderBackendType = backend;
            renderBackend = nextBackend;
            if (rtcEngine != null) {
                renderBackend.bindEngine(rtcEngine);
            }
        } catch (Exception error) {
            dispatchNativeExceptionError(requestId, error);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleInitialize(String requestId, JSONObject params) {
        String appId = params != null ? params.optString("appId") : "";
        if (appId == null || appId.trim().isEmpty()) {
            dispatchError(requestId, "App ID is required.");
            return;
        }

        Context context = GlobalObject.getActivity();
        if (context == null) {
            context = GlobalObject.getContext();
        }
        if (context == null) {
            dispatchError(requestId, "Android context is unavailable.");
            return;
        }

        try {
            rtcEngine = RtcEngine.create(context, appId, new IRtcEngineEventHandler() {
                @Override
                public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
                    dispatchEvent("joinChannelSuccess", jsonObject(
                            "channelId", channel,
                            "uid", uid
                    ));
                }

                @Override
                public void onUserJoined(int uid, int elapsed) {
                    dispatchEvent("userJoined", jsonObject("uid", uid));
                }

                @Override
                public void onUserOffline(int uid, int reason) {
                    dispatchEvent("userOffline", jsonObject(
                            "uid", uid,
                            "reason", reason
                    ));
                }

                @Override
                public void onLeaveChannel(IRtcEngineEventHandler.RtcStats stats) {
                    dispatchEvent("leaveChannel", jsonObject(
                            "duration", stats != null ? stats.totalDuration : 0
                    ));
                }

                @Override
                public void onRtcStats(IRtcEngineEventHandler.RtcStats stats) {
                    dispatchEvent("rtcStats", jsonObject(
                            "duration", stats != null ? stats.totalDuration : 0,
                            "txBytes", stats != null ? stats.txBytes : 0,
                            "rxBytes", stats != null ? stats.rxBytes : 0,
                            "txKBitRate", stats != null ? stats.txKBitRate : 0,
                            "rxKBitRate", stats != null ? stats.rxKBitRate : 0,
                            "users", stats != null ? stats.users : 0,
                            "txPacketLossRate", stats != null ? stats.txPacketLossRate : 0,
                            "rxPacketLossRate", stats != null ? stats.rxPacketLossRate : 0
                    ));
                }

                @Override
                public void onRejoinChannelSuccess(String channel, int uid, int elapsed) {
                    dispatchEvent("rejoinChannelSuccess", jsonObject(
                            "channelId", channel,
                            "uid", uid,
                            "elapsed", elapsed
                    ));
                }

                @Override
                public void onConnectionInterrupted() {
                    dispatchEvent("connectionInterrupted", jsonObject());
                }

                @Override
                public void onConnectionStateChanged(int state, int reason) {
                    dispatchEvent("connectionStateChanged", jsonObject(
                            "state", state,
                            "reason", reason
                    ));
                }

                @Override
                public void onRemoteVideoStateChanged(int uid, int state, int reason, int elapsed) {
                    dispatchEvent("remoteVideoStateChanged", jsonObject(
                            "uid", uid,
                            "state", state,
                            "reason", reason,
                            "elapsed", elapsed
                    ));
                }

                @Override
                public void onLocalVideoStateChanged(Constants.VideoSourceType source, int state, int error) {
                    dispatchEvent("localVideoStateChanged", jsonObject(
                            "sourceType", source != null ? source.ordinal() : 0,
                            "state", state,
                            "error", error
                    ));
                }

                @Override
                public void onFirstLocalAudioFramePublished(int elapsed) {
                    dispatchEvent("firstLocalAudioFramePublished", jsonObject(
                            "elapsed", elapsed
                    ));
                }

                @Override
                public void onAudioMixingFinished() {
                    dispatchEvent("audioMixingFinished", jsonObject());
                }

                @Override
                public void onAudioMixingStateChanged(int state, int reason) {
                    dispatchEvent("audioMixingStateChanged", jsonObject(
                            "state", state,
                            "reason", reason
                    ));
                }

                @Override
                public void onContentInspectResult(int result) {
                    dispatchEvent("contentInspectResult", jsonObject(
                            "result", result
                    ));
                }

                @Override
                public void onAudioVolumeIndication(IRtcEngineEventHandler.AudioVolumeInfo[] speakers, int totalVolume) {
                    dispatchEvent("volumeIndication", jsonObject(
                            "speakers", toAudioVolumeArray(speakers),
                            "totalVolume", totalVolume
                    ));
                }
            });
            if (rtcEngine == null) {
                dispatchError(requestId, "RtcEngine.create returned null.");
                return;
            }
            if (renderBackend != null) {
                renderBackend.bindEngine(rtcEngine);
            }
            dispatchOk(requestId);
        } catch (Exception error) {
            dispatchError(requestId, "RtcEngine.create failed: " + error.getMessage());
        }
    }

    private void handleJoinChannel(String requestId, JSONObject params) {
        String token = params != null ? params.optString("token") : "";
        String channelId = params != null ? params.optString("channelId") : "";
        int uid = params != null ? params.optInt("uid") : 0;

        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        if (channelId == null || channelId.trim().isEmpty()) {
            dispatchError(requestId, "Channel ID is required.");
            return;
        }

        JSONObject mediaOptions = params != null ? params.optJSONObject("options") : null;
        boolean requiresCameraPermission = mediaOptionBoolean(mediaOptions, "publishCameraTrack", true);
        boolean requiresMicrophonePermission = mediaOptionBoolean(mediaOptions, "publishMicrophoneTrack", true);

        ensureRtcPermissions(
                requestId,
                requiresCameraPermission,
                requiresMicrophonePermission,
                () -> continueJoinChannel(requestId, token, channelId, uid, mediaOptions)
        );
    }

    private void continueJoinChannel(String requestId, String token, String channelId, int uid, JSONObject mediaOptions) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }

        ChannelMediaOptions options = new ChannelMediaOptions();
        applyChannelMediaOptions(options, mediaOptions);
        int result = rtcEngine.joinChannel(token, channelId, uid, options);
        if (result < 0) {
            dispatchError(requestId, "RtcEngine.joinChannel failed: " + result);
            return;
        }

        dispatchOk(requestId);
    }

    private void applyChannelMediaOptions(ChannelMediaOptions options, JSONObject mediaOptions) {
        if (mediaOptions == null) {
            return;
        }
        if (mediaOptions.has("clientRoleType") && !mediaOptions.isNull("clientRoleType")) {
            options.clientRoleType = parseClientRoleType(mediaOptions.opt("clientRoleType"));
        }
        if (mediaOptions.has("channelProfile") && !mediaOptions.isNull("channelProfile")) {
            options.channelProfile = parseChannelProfile(mediaOptions.opt("channelProfile"));
        }
        if (mediaOptions.has("publishCameraTrack")) {
            options.publishCameraTrack = optNullableBoolean(mediaOptions, "publishCameraTrack");
        }
        if (mediaOptions.has("publishMicrophoneTrack")) {
            options.publishMicrophoneTrack = optNullableBoolean(mediaOptions, "publishMicrophoneTrack");
        }
        if (mediaOptions.has("autoSubscribeAudio")) {
            options.autoSubscribeAudio = optNullableBoolean(mediaOptions, "autoSubscribeAudio");
        }
        if (mediaOptions.has("autoSubscribeVideo")) {
            options.autoSubscribeVideo = optNullableBoolean(mediaOptions, "autoSubscribeVideo");
        }
        if (mediaOptions.has("enableAudioRecordingOrPlayout")) {
            options.enableAudioRecordingOrPlayout = optNullableBoolean(mediaOptions, "enableAudioRecordingOrPlayout");
        }
        if (mediaOptions.has("startPreview")) {
            options.startPreview = optNullableBoolean(mediaOptions, "startPreview");
        }
        if (mediaOptions.has("token") && !mediaOptions.isNull("token")) {
            options.token = mediaOptions.optString("token");
        }
        if (mediaOptions.has("parameters") && !mediaOptions.isNull("parameters")) {
            options.parameters = mediaOptions.optString("parameters");
        }
    }

    private Boolean optNullableBoolean(JSONObject object, String key) {
        if (object == null || !object.has(key) || object.isNull(key)) {
            return null;
        }
        return object.optBoolean(key);
    }

    private boolean mediaOptionBoolean(JSONObject object, String key, boolean defaultValue) {
        Boolean value = optNullableBoolean(object, key);
        return value != null ? value : defaultValue;
    }

    private int parseClientRoleType(Object rawValue) {
        if (rawValue instanceof Number) {
            return ((Number) rawValue).intValue();
        }
        String value = String.valueOf(rawValue);
        if ("audience".equals(value)) {
            return Constants.CLIENT_ROLE_AUDIENCE;
        }
        return Constants.CLIENT_ROLE_BROADCASTER;
    }

    private int parseChannelProfile(Object rawValue) {
        if (rawValue instanceof Number) {
            return ((Number) rawValue).intValue();
        }
        String value = String.valueOf(rawValue);
        if ("communication".equals(value)) {
            return Constants.CHANNEL_PROFILE_COMMUNICATION;
        }
        return Constants.CHANNEL_PROFILE_LIVE_BROADCASTING;
    }

    private void handleGetErrorDescription(String requestId, JSONObject params) {
        int code = params != null ? params.optInt("code", 0) : 0;
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true,
                "result", RtcEngine.getErrorDescription(code)
        ));
    }

    private void handleSetupLocalVideoView(String requestId, JSONObject params) {
        Activity activity = requireActivity(requestId);
        if (activity == null) {
            return;
        }
        renderBackend.setupLocalVideoView(activity, params, requestCallback(requestId));
    }

    private void handleSetupRemoteVideoView(String requestId, JSONObject params) {
        Activity activity = requireActivity(requestId);
        if (activity == null) {
            return;
        }
        renderBackend.setupRemoteVideoView(activity, params, requestCallback(requestId));
    }

    private void handleUpdateLocalVideoView(String requestId, JSONObject params) {
        renderBackend.updateLocalVideoView(params, requestCallback(requestId));
    }

    private void handleUpdateRemoteVideoView(String requestId, JSONObject params) {
        renderBackend.updateRemoteVideoView(params, requestCallback(requestId));
    }

    private void handleRemoveLocalVideoView(String requestId) {
        renderBackend.removeLocalVideoView(requestCallback(requestId));
    }

    private void handleRemoveRemoteVideoView(String requestId, JSONObject params) {
        renderBackend.removeRemoteVideoView(params, requestCallback(requestId));
    }

    private void handleSetNativeVideoOverlaySuspended(String requestId, JSONObject params) {
        boolean suspended = params == null || params.optBoolean("suspended", true);
        renderBackend.setNativeVideoOverlaySuspended(suspended, requestCallback(requestId));
    }

    private void handleStartPreview(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }

        ensureRtcPermissions(requestId, true, false, () -> continueStartPreview(requestId));
    }

    private void continueStartPreview(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }

        renderBackend.startPreview(requestCallback(requestId));
    }

    private void handleStopPreview(String requestId) {
        renderBackend.stopPreview(requestCallback(requestId));
    }

    private void handleSwitchCamera(String requestId) {
        renderBackend.switchCamera(requestCallback(requestId));
    }

    private void handleLeaveChannel(String requestId) {
        if (rtcEngine != null) {
            rtcEngine.leaveChannel();
        }
        dispatchOk(requestId);
    }

    private void handleRenewToken(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String token = params != null ? params.optString("token", "") : "";
        int result = rtcEngine.renewToken(token);
        if (result < 0) {
            dispatchAgoraError(requestId, "renewToken", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleEnableAudio(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        boolean enabled = params == null || params.optBoolean("enabled", true);
        int result = enabled ? rtcEngine.enableAudio() : rtcEngine.disableAudio();
        if (result < 0) {
            dispatchAgoraError(requestId, "enableAudio", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleEnableLocalAudio(String requestId, JSONObject params) {
        if (rtcEngine != null) {
            rtcEngine.enableLocalAudio(params != null && params.optBoolean("enabled", true));
        }
        dispatchOk(requestId);
    }

    private void handleMuteLocalAudioStream(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.muteLocalAudioStream(params != null && params.optBoolean("muted", false));
        if (result < 0) {
            dispatchAgoraError(requestId, "muteLocalAudioStream", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleMuteRemoteAudioStream(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int uid = params != null ? params.optInt("uid", 0) : 0;
        int result = rtcEngine.muteRemoteAudioStream(uid, params != null && params.optBoolean("muted", false));
        if (result < 0) {
            dispatchAgoraError(requestId, "muteRemoteAudioStream", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleMuteAllRemoteAudioStreams(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.muteAllRemoteAudioStreams(params != null && params.optBoolean("muted", false));
        if (result < 0) {
            dispatchAgoraError(requestId, "muteAllRemoteAudioStreams", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetAudioProfile(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int profile = params != null ? params.optInt("profile", 0) : 0;
        int scenario = params != null ? params.optInt("scenario", 0) : 0;
        int result = rtcEngine.setAudioProfile(profile, scenario);
        if (result < 0) {
            dispatchAgoraError(requestId, "setAudioProfile", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleEnableAudioVolumeIndication(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int interval = params != null ? params.optInt("interval", 300) : 300;
        int smooth = params != null ? params.optInt("smooth", 3) : 3;
        boolean reportVad = params != null && params.optBoolean("reportVad", false);
        int result = rtcEngine.enableAudioVolumeIndication(interval, smooth, reportVad);
        if (result < 0) {
            dispatchAgoraError(requestId, "enableAudioVolumeIndication", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetDefaultAudioRouteToSpeakerphone(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.setDefaultAudioRoutetoSpeakerphone(params == null || params.optBoolean("enabled", true));
        if (result < 0) {
            dispatchAgoraError(requestId, "setDefaultAudioRouteToSpeakerphone", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetEnableSpeakerphone(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.setEnableSpeakerphone(params == null || params.optBoolean("enabled", true));
        if (result < 0) {
            dispatchAgoraError(requestId, "setEnableSpeakerphone", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleIsSpeakerphoneEnabled(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true,
                "result", rtcEngine.isSpeakerphoneEnabled()
        ));
    }

    private void handleAdjustPlaybackSignalVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.adjustPlaybackSignalVolume(params != null ? params.optInt("volume", 100) : 100);
        if (result < 0) {
            dispatchAgoraError(requestId, "adjustPlaybackSignalVolume", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleAdjustUserPlaybackSignalVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int uid = params != null ? params.optInt("uid", 0) : 0;
        int volume = params != null ? params.optInt("volume", 100) : 100;
        int result = rtcEngine.adjustUserPlaybackSignalVolume(uid, volume);
        if (result < 0) {
            dispatchAgoraError(requestId, "adjustUserPlaybackSignalVolume", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetAudioSessionOperationRestriction(String requestId, JSONObject params) {
        dispatchUnsupported(requestId, "setAudioSessionOperationRestriction");
    }

    private void handleEnableVideo(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        boolean enabled = params == null || params.optBoolean("enabled", true);
        int result = enabled ? rtcEngine.enableVideo() : rtcEngine.disableVideo();
        if (result < 0) {
            dispatchAgoraError(requestId, "enableVideo", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleEnableLocalVideo(String requestId, JSONObject params) {
        if (rtcEngine != null) {
            rtcEngine.enableLocalVideo(params != null && params.optBoolean("enabled", true));
        }
        dispatchOk(requestId);
    }

    private void handleMuteLocalVideoStream(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.muteLocalVideoStream(params != null && params.optBoolean("muted", false));
        if (result < 0) {
            dispatchAgoraError(requestId, "muteLocalVideoStream", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleMuteRemoteVideoStream(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int uid = params != null ? params.optInt("uid", 0) : 0;
        int result = rtcEngine.muteRemoteVideoStream(uid, params != null && params.optBoolean("muted", false));
        if (result < 0) {
            dispatchAgoraError(requestId, "muteRemoteVideoStream", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleMuteAllRemoteVideoStreams(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.muteAllRemoteVideoStreams(params != null && params.optBoolean("muted", false));
        if (result < 0) {
            dispatchAgoraError(requestId, "muteAllRemoteVideoStreams", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleDestroy(String requestId) {
        if (renderBackend != null) {
            renderBackend.release();
        }
        if (rtcEngine != null) {
            RtcEngine.destroy();
            rtcEngine = null;
        }
        dispatchOk(requestId);
    }

    private void handleSetVideoEncoderConfiguration(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int width = params != null ? params.optInt("width", 640) : 640;
        int height = params != null ? params.optInt("height", 360) : 360;
        int frameRate = params != null ? params.optInt("frameRate", 15) : 15;
        int bitrate = params != null ? params.optInt("bitrate", 0) : 0;
        int orientationMode = params != null ? params.optInt("orientationMode", 0) : 0;

        VideoEncoderConfiguration configuration = new VideoEncoderConfiguration();
        configuration.dimensions = new VideoEncoderConfiguration.VideoDimensions(width, height);
        configuration.frameRate = frameRate;
        configuration.bitrate = bitrate;
        configuration.orientationMode = mapOrientationMode(orientationMode);

        int result = rtcEngine.setVideoEncoderConfiguration(configuration);
        if (result < 0) {
            dispatchAgoraError(requestId, "setVideoEncoderConfiguration", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetBeautyEffectOptions(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        boolean enabled = params != null && params.optBoolean("enabled", false);
        JSONObject options = params != null ? params.optJSONObject("options") : null;
        BeautyOptions beautyOptions = new BeautyOptions();
        if (options != null) {
            beautyOptions.lighteningContrastLevel = options.optInt("lighteningContrastLevel", BeautyOptions.LIGHTENING_CONTRAST_NORMAL);
            beautyOptions.lighteningLevel = (float) options.optDouble("lighteningLevel", 0.0);
            beautyOptions.smoothnessLevel = (float) options.optDouble("smoothnessLevel", 0.0);
            beautyOptions.rednessLevel = (float) options.optDouble("rednessLevel", 0.0);
            beautyOptions.sharpnessLevel = (float) options.optDouble("sharpnessLevel", 0.0);
        }
        int result = rtcEngine.setBeautyEffectOptions(enabled, beautyOptions);
        if (result < 0) {
            dispatchAgoraError(requestId, "setBeautyEffectOptions", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleEnableContentInspect(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        boolean enabled = params != null && params.optBoolean("enabled", false);
        JSONObject config = params != null ? params.optJSONObject("config") : null;
        ContentInspectConfig inspectConfig = new ContentInspectConfig();
        ContentInspectConfig.ContentInspectModule module = new ContentInspectConfig.ContentInspectModule();
        module.type = config != null ? config.optInt("module", ContentInspectConfig.CONTENT_INSPECT_TYPE_MODERATION) : ContentInspectConfig.CONTENT_INSPECT_TYPE_MODERATION;
        module.interval = config != null ? config.optInt("interval", 0) : 0;
        module.position = Constants.VideoModulePosition.VIDEO_MODULE_POSITION_PRE_RENDERER;
        inspectConfig.modules = new ContentInspectConfig.ContentInspectModule[] { module };
        inspectConfig.moduleCount = 1;

        int result = rtcEngine.enableContentInspect(enabled, inspectConfig);
        if (result < 0) {
            dispatchAgoraError(requestId, "enableContentInspect", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleStartAudioMixing(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String path = params != null ? params.optString("path", "") : "";
        if (path == null || path.trim().isEmpty()) {
            dispatchError(requestId, "Audio mixing path is required.");
            return;
        }
        boolean loopback = params != null && params.optBoolean("loopback", false);
        int cycle = params != null ? params.optInt("cycle", 1) : 1;
        int startPos = params != null ? params.optInt("startPos", 0) : 0;
        int result = rtcEngine.startAudioMixing(path, loopback, cycle, startPos);
        if (result < 0) {
            dispatchAgoraError(requestId, "startAudioMixing", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handlePauseAudioMixing(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.pauseAudioMixing();
        if (result < 0) {
            dispatchAgoraError(requestId, "pauseAudioMixing", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleResumeAudioMixing(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.resumeAudioMixing();
        if (result < 0) {
            dispatchAgoraError(requestId, "resumeAudioMixing", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleStopAudioMixing(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.stopAudioMixing();
        if (result < 0) {
            dispatchAgoraError(requestId, "stopAudioMixing", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleGetAudioMixingCurrentPosition(String requestId) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true,
                "result", rtcEngine.getAudioMixingCurrentPosition()
        ));
    }

    private void handleSetAudioMixingPosition(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.setAudioMixingPosition(params != null ? params.optInt("positionMs", 0) : 0);
        if (result < 0) {
            dispatchAgoraError(requestId, "setAudioMixingPosition", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleAdjustAudioMixingVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.adjustAudioMixingVolume(params != null ? params.optInt("volume", 100) : 100);
        if (result < 0) {
            dispatchAgoraError(requestId, "adjustAudioMixingVolume", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handlePreloadEffect(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        int soundId = params != null ? params.optInt("soundId", 0) : 0;
        String path = params != null ? params.optString("path", "") : "";
        int result = effectManager.preloadEffect(soundId, path);
        if (result < 0) {
            dispatchAgoraError(requestId, "preloadEffect", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handlePlayEffect(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        int soundId = params != null ? params.optInt("soundId", 0) : 0;
        String path = params != null ? params.optString("path", "") : "";
        int loopCount = params != null ? params.optInt("loopCount", 1) : 1;
        double pitch = params != null ? params.optDouble("pitch", 1.0) : 1.0;
        double pan = params != null ? params.optDouble("pan", 0.0) : 0.0;
        double gain = params != null ? params.optDouble("gain", 100.0) : 100.0;
        boolean publish = params != null && params.optBoolean("publish", false);
        int startPos = params != null ? params.optInt("startPos", 0) : 0;
        int result = effectManager.playEffect(soundId, path, loopCount, pitch, pan, gain, publish, startPos);
        if (result < 0) {
            dispatchAgoraError(requestId, "playEffect", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleStopEffect(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        int result = effectManager.stopEffect(params != null ? params.optInt("soundId", 0) : 0);
        if (result < 0) {
            dispatchAgoraError(requestId, "stopEffect", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetParameters(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String parameters = params != null ? params.optString("parameters", "") : "";
        if (parameters == null || parameters.trim().isEmpty()) {
            dispatchError(requestId, "Parameters are required.");
            return;
        }
        int result = rtcEngine.setParameters(parameters);
        if (result < 0) {
            dispatchAgoraError(requestId, "setParameters", result);
            return;
        }
        dispatchOk(requestId);
    }

    private Activity requireActivity(String requestId) {
        Activity activity = GlobalObject.getActivity();
        if (activity == null) {
            dispatchError(requestId, "Android activity is unavailable.");
        }
        return activity;
    }

    private void ensureRtcPermissions(String requestId, Runnable action) {
        ensureRtcPermissions(requestId, true, true, action);
    }

    private void ensureRtcPermissions(
            String requestId,
            boolean requiresCamera,
            boolean requiresMicrophone,
            Runnable action
    ) {
        if (!requiresCamera && !requiresMicrophone) {
            action.run();
            return;
        }

        Activity activity = requireActivity(requestId);
        if (activity == null) {
            return;
        }

        if (hasRtcPermissions(activity, requiresCamera, requiresMicrophone)) {
            action.run();
            return;
        }

        pendingPermissionActions.add(new PendingPermissionAction(requestId, requiresCamera, requiresMicrophone, action));
        if (permissionRequestInFlight) {
            return;
        }

        permissionRequestInFlight = true;
        activity.runOnUiThread(() ->
                activity.requestPermissions(
                        missingRtcPermissions(activity, requiresCamera, requiresMicrophone),
                        RTC_PERMISSION_REQUEST_CODE
                )
        );
    }

    private boolean hasRtcPermissions(Activity activity) {
        return hasRtcPermissions(activity, true, true);
    }

    private boolean hasRtcPermissions(Activity activity, boolean requiresCamera, boolean requiresMicrophone) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        return missingRtcPermissions(activity, requiresCamera, requiresMicrophone).length == 0;
    }

    private String[] missingRtcPermissions(Activity activity) {
        return missingRtcPermissions(activity, true, true);
    }

    private String[] missingRtcPermissions(Activity activity, boolean requiresCamera, boolean requiresMicrophone) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return new String[0];
        }

        ArrayList<String> missingPermissions = new ArrayList<>();
        if (requiresCamera && activity.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            missingPermissions.add(Manifest.permission.CAMERA);
        }
        if (
                requiresMicrophone &&
                activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
        ) {
            missingPermissions.add(Manifest.permission.RECORD_AUDIO);
        }
        return missingPermissions.toArray(new String[0]);
    }

    private AgoraRenderResultCallback requestCallback(String requestId) {
        return new AgoraRenderResultCallback() {
            @Override
            public void onSuccess() {
                dispatchOk(requestId);
            }

            @Override
            public void onError(String message) {
                dispatchError(requestId, message);
            }
        };
    }

    private boolean isSupportedRenderBackend(String backend) {
        return "surface-view".equals(backend)
                || "texture-view".equals(backend)
                || "engine-texture".equals(backend);
    }

    private String extractRequestId(String payload) {
        try {
            return new JSONObject(payload).optString("requestId", "");
        } catch (JSONException error) {
            return "";
        }
    }

    private void dispatchOk(String requestId) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true
        ));
    }

    private void dispatchError(String requestId, String message) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", false,
                "error", jsonObject(
                        "code", "native_failure",
                        "message", message
                )
        ));
    }

    private void dispatchInvalidArgumentError(
            String requestId,
            String message,
            String method,
            String argumentName,
            String argumentValue
    ) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", false,
                "error", jsonObject(
                        "code", "invalid_argument",
                        "message", message,
                        "details", jsonObject(
                                "method", method,
                                argumentName, argumentValue,
                                "platform", "android"
                        )
                )
        ));
    }

    private void dispatchNativeExceptionError(String requestId, Exception error) {
        String message = error.getMessage();
        dispatchError(
                requestId,
                "Native request failed: " + (message != null ? message : error.getClass().getSimpleName())
        );
    }

    private void dispatchUnsupported(String requestId, String method) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", false,
                "error", jsonObject(
                        "code", "native_failure",
                        "message", "Unsupported on current platform",
                        "details", jsonObject(
                                "method", method,
                                "platform", "android"
                        )
                )
        ));
    }

    private void dispatchAgoraError(String requestId, String method, int agoraCode) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", false,
                "error", jsonObject(
                        "code", "native_failure",
                        "message", method + " failed: " + agoraCode,
                        "details", jsonObject(
                                "method", method,
                                "platform", "android",
                                "agoraCode", agoraCode
                        )
                )
        ));
    }

    private void dispatchResponse(JSONObject response) {
        CocosHelper.runOnGameThread(() ->
                JsbBridgeWrapper.getInstance().dispatchEventToScript(RESPONSE_EVENT, response.toString())
        );
    }

    private VideoEncoderConfiguration.ORIENTATION_MODE mapOrientationMode(int value) {
        switch (value) {
            case 1:
                return VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_FIXED_LANDSCAPE;
            case 2:
                return VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_FIXED_PORTRAIT;
            default:
                return VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_ADAPTIVE;
        }
    }

    private void dispatchEvent(String eventName, JSONObject payload) {
        JSONObject event = jsonObject(
                "eventName", eventName,
                "payload", payload
        );
        CocosHelper.runOnGameThread(() ->
                JsbBridgeWrapper.getInstance().dispatchEventToScript(CALLBACK_EVENT, event.toString())
        );
    }

    private JSONObject jsonObject(Object... keyValues) {
        JSONObject object = new JSONObject();
        try {
            for (int index = 0; index < keyValues.length; index += 2) {
                object.put(String.valueOf(keyValues[index]), keyValues[index + 1]);
            }
        } catch (JSONException error) {
            throw new IllegalStateException("Failed to build JSON payload.", error);
        }
        return object;
    }

    private org.json.JSONArray toAudioVolumeArray(IRtcEngineEventHandler.AudioVolumeInfo[] speakers) {
        org.json.JSONArray array = new org.json.JSONArray();
        if (speakers == null) {
            return array;
        }
        for (IRtcEngineEventHandler.AudioVolumeInfo speaker : speakers) {
            if (speaker == null) {
                continue;
            }
            array.put(jsonObject(
                    "uid", speaker.uid,
                    "volume", speaker.volume,
                    "vad", speaker.vad,
                    "voicePitch", speaker.voicePitch
            ));
        }
        return array;
    }

    private static final class PendingPermissionAction {
        private final String requestId;
        private final boolean requiresCamera;
        private final boolean requiresMicrophone;
        private final Runnable action;

        private PendingPermissionAction(
                String requestId,
                boolean requiresCamera,
                boolean requiresMicrophone,
                Runnable action
        ) {
            this.requestId = requestId;
            this.requiresCamera = requiresCamera;
            this.requiresMicrophone = requiresMicrophone;
            this.action = action;
        }
    }
}
