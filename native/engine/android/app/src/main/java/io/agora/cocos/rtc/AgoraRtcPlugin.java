package io.agora.cocos.rtc;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Queue;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import com.cocos.lib.CocosHelper;
import com.cocos.lib.GlobalObject;
import com.cocos.lib.JsbBridgeWrapper;

import io.agora.rtc2.ChannelMediaOptions;
import io.agora.rtc2.ClientRoleOptions;
import io.agora.rtc2.Constants;
import io.agora.rtc2.IAudioEffectManager;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.LeaveChannelOptions;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import io.agora.rtc2.UserInfo;
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
    private static final String PROTECTED_APP_TYPE_PARAMETERS = "{\"rtc.set_app_type\":10}";
    private static final int RTC_PERMISSION_REQUEST_CODE = 9108;
    private static final long NATIVE_QUERY_TIMEOUT_MS = 5000L;
    private static final String[] RTC_RUNTIME_PERMISSIONS = new String[] {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
    };
    private static final AgoraRtcPlugin INSTANCE = new AgoraRtcPlugin();

    private RtcEngine rtcEngine;
    private boolean attached;
    private boolean permissionRequestInFlight;
    private final Queue<PendingPermissionAction> pendingPermissionActions = new ArrayDeque<>();
    private String renderBackendType = "engine-texture";
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
            case "joinChannelWithUserAccount":
                handleJoinChannelWithUserAccount(requestId, params);
                break;
            case "getUserInfoByUserAccount":
                handleGetUserInfoByUserAccount(requestId, params);
                break;
            case "leaveChannel":
                handleLeaveChannel(requestId, params);
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
                handleStartPreview(requestId, params);
                break;
            case "stopPreview":
                handleStopPreview(requestId, params);
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
            case "pauseEffect":
                handlePauseEffect(requestId, params);
                break;
            case "resumeEffect":
                handleResumeEffect(requestId, params);
                break;
            case "setEffectsVolume":
                handleSetEffectsVolume(requestId, params);
                break;
            case "adjustAudioMixingPublishVolume":
                handleAdjustAudioMixingPublishVolume(requestId, params);
                break;
            case "adjustAudioMixingPlayoutVolume":
                handleAdjustAudioMixingPlayoutVolume(requestId, params);
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
        ClientRoleOptions options = buildClientRoleOptions(params != null ? params.optJSONObject("options") : null);
        int result = rtcEngine.setClientRole(agoraRole, options);
        if (result < 0) {
            dispatchAgoraError(requestId, "setClientRole", result);
            return;
        }
        dispatchOk(requestId);
    }

    private ClientRoleOptions buildClientRoleOptions(JSONObject params) {
        ClientRoleOptions options = new ClientRoleOptions();
        if (params != null && params.has("audienceLatencyLevel") && !params.isNull("audienceLatencyLevel")) {
            options.audienceLatencyLevel = params.optInt("audienceLatencyLevel", options.audienceLatencyLevel);
        }
        return options;
    }

    private void handleSetRenderBackend(String requestId, JSONObject params) {
        String backend = params != null ? params.optString("backend", "engine-texture") : "engine-texture";
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
            RtcEngineConfig config = buildRtcEngineConfig(context, appId, params);
            config.mEventHandler = new IRtcEngineEventHandler() {
                @Override
                public void onError(int err) {
                    dispatchEvent("error", jsonObject(
                            "code", err,
                            "message", RtcEngine.getErrorDescription(err)
                    ));
                }

                @Override
                public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
                    dispatchEvent("joinChannelSuccess", jsonObject(
                            "channelId", channel,
                            "uid", uid,
                            "elapsed", elapsed
                    ));
                }

                @Override
                public void onUserJoined(int uid, int elapsed) {
                    dispatchEvent("userJoined", jsonObject(
                            "uid", uid,
                            "elapsed", elapsed
                    ));
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
                    dispatchEvent("leaveChannel", toRtcStatsPayload(stats));
                }

                @Override
                public void onRtcStats(IRtcEngineEventHandler.RtcStats stats) {
                    dispatchEvent("rtcStats", toRtcStatsPayload(stats));
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
                public void onRemoteAudioStateChanged(int uid, int state, int reason, int elapsed) {
                    dispatchEvent("remoteAudioStateChanged", jsonObject(
                            "uid", uid,
                            "state", state,
                            "reason", reason,
                            "elapsed", elapsed
                    ));
                }

                @Override
                public void onLocalVideoStateChanged(Constants.VideoSourceType source, int state, int error) {
                    dispatchEvent("localVideoStateChanged", jsonObject(
                            "sourceType", mapLocalVideoSourceType(source),
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
            };
            rtcEngine = RtcEngine.create(config);
            if (rtcEngine == null) {
                dispatchError(requestId, "RtcEngine.create returned null.");
                return;
            }
            if (!applyProtectedParameters(rtcEngine, requestId, "initialize", params)) {
                rtcEngine = null;
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

    private RtcEngineConfig buildRtcEngineConfig(Context context, String appId, JSONObject params) {
        RtcEngineConfig config = new RtcEngineConfig();
        config.mContext = context;
        config.mAppId = appId;
        if (params == null) {
            return config;
        }
        config.mAreaCode = params.optInt("areaCode", config.mAreaCode);
        config.mChannelProfile = params.optInt("channelProfile", config.mChannelProfile);
        if (params.has("license") && !params.isNull("license")) {
            config.mLicense = params.optString("license", config.mLicense);
        }
        config.mAudioScenario = params.optInt("audioScenario", config.mAudioScenario);
        if (params.has("autoRegisterAgoraExtensions") && !params.isNull("autoRegisterAgoraExtensions")) {
            config.mAutoRegisterAgoraExtensions = params.optBoolean(
                    "autoRegisterAgoraExtensions",
                    config.mAutoRegisterAgoraExtensions
            );
        }
        if (params.has("domainLimit") && !params.isNull("domainLimit")) {
            config.mDomainLimit = params.optBoolean("domainLimit", config.mDomainLimit);
        }
        if (params.has("threadPriority") && !params.isNull("threadPriority")) {
            config.mThreadPriority = params.optInt("threadPriority");
        }
        if (params.has("nativeLibPath") && !params.isNull("nativeLibPath")) {
            config.mNativeLibPath = params.optString("nativeLibPath", config.mNativeLibPath);
        }

        JSONObject logConfigParams = params.optJSONObject("logConfig");
        if (logConfigParams != null) {
            RtcEngineConfig.LogConfig logConfig = new RtcEngineConfig.LogConfig();
            if (logConfigParams.has("filePath") && !logConfigParams.isNull("filePath")) {
                logConfig.filePath = logConfigParams.optString("filePath", logConfig.filePath);
            }
            logConfig.fileSizeInKB = logConfigParams.optInt("fileSizeInKB", logConfig.fileSizeInKB);
            logConfig.level = logConfigParams.optInt("level", logConfig.level);
            config.mLogConfig = logConfig;
        }

        JSONArray extensions = params.optJSONArray("extensions");
        if (extensions != null) {
            for (int index = 0; index < extensions.length(); index += 1) {
                String extensionName = extensions.optString(index);
                if (extensionName != null && !extensionName.trim().isEmpty()) {
                    config.addExtension(extensions.optString(index));
                }
            }
        }
        return config;
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
        boolean requiresCameraPermission = requiresCameraPermission(mediaOptions);
        boolean requiresMicrophonePermission = requiresMicrophonePermission(mediaOptions);

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
            dispatchAgoraError(requestId, "joinChannel", result);
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
        if (mediaOptions.has("publishSecondaryCameraTrack")) {
            options.publishSecondaryCameraTrack = optNullableBoolean(mediaOptions, "publishSecondaryCameraTrack");
        }
        if (mediaOptions.has("publishThirdCameraTrack")) {
            options.publishThirdCameraTrack = optNullableBoolean(mediaOptions, "publishThirdCameraTrack");
        }
        if (mediaOptions.has("publishFourthCameraTrack")) {
            options.publishFourthCameraTrack = optNullableBoolean(mediaOptions, "publishFourthCameraTrack");
        }
        if (mediaOptions.has("publishMicrophoneTrack")) {
            options.publishMicrophoneTrack = optNullableBoolean(mediaOptions, "publishMicrophoneTrack");
        }
        if (mediaOptions.has("publishScreenCaptureVideo")) {
            options.publishScreenCaptureVideo = optNullableBoolean(mediaOptions, "publishScreenCaptureVideo");
        }
        if (mediaOptions.has("publishScreenCaptureAudio")) {
            options.publishScreenCaptureAudio = optNullableBoolean(mediaOptions, "publishScreenCaptureAudio");
        }
        if (mediaOptions.has("publishCustomAudioTrack")) {
            options.publishCustomAudioTrack = optNullableBoolean(mediaOptions, "publishCustomAudioTrack");
        }
        if (mediaOptions.has("publishCustomAudioTrackId")) {
            options.publishCustomAudioTrackId = optNullableInteger(mediaOptions, "publishCustomAudioTrackId");
        }
        if (mediaOptions.has("publishCustomVideoTrack")) {
            options.publishCustomVideoTrack = optNullableBoolean(mediaOptions, "publishCustomVideoTrack");
        }
        if (mediaOptions.has("publishEncodedVideoTrack")) {
            options.publishEncodedVideoTrack = optNullableBoolean(mediaOptions, "publishEncodedVideoTrack");
        }
        if (mediaOptions.has("publishMediaPlayerAudioTrack")) {
            options.publishMediaPlayerAudioTrack = optNullableBoolean(mediaOptions, "publishMediaPlayerAudioTrack");
        }
        if (mediaOptions.has("publishMediaPlayerVideoTrack")) {
            options.publishMediaPlayerVideoTrack = optNullableBoolean(mediaOptions, "publishMediaPlayerVideoTrack");
        }
        if (mediaOptions.has("publishTranscodedVideoTrack")) {
            options.publishTranscodedVideoTrack = optNullableBoolean(mediaOptions, "publishTranscodedVideoTrack");
        }
        if (mediaOptions.has("publishMixedAudioTrack")) {
            options.publishMixedAudioTrack = optNullableBoolean(mediaOptions, "publishMixedAudioTrack");
        }
        if (mediaOptions.has("publishLipSyncTrack")) {
            options.publishLipSyncTrack = optNullableBoolean(mediaOptions, "publishLipSyncTrack");
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
        if (mediaOptions.has("publishMediaPlayerId")) {
            options.publishMediaPlayerId = optNullableInteger(mediaOptions, "publishMediaPlayerId");
        }
        if (mediaOptions.has("audienceLatencyLevel")) {
            options.audienceLatencyLevel = optNullableInteger(mediaOptions, "audienceLatencyLevel");
        }
        if (mediaOptions.has("defaultVideoStreamType")) {
            options.defaultVideoStreamType = optNullableInteger(mediaOptions, "defaultVideoStreamType");
        }
        if (mediaOptions.has("audioDelayMs")) {
            options.audioDelayMs = optNullableInteger(mediaOptions, "audioDelayMs");
        }
        if (mediaOptions.has("mediaPlayerAudioDelayMs")) {
            options.mediaPlayerAudioDelayMs = optNullableInteger(mediaOptions, "mediaPlayerAudioDelayMs");
        }
        if (mediaOptions.has("startPreview")) {
            options.startPreview = optNullableBoolean(mediaOptions, "startPreview");
        }
        if (mediaOptions.has("enableBuiltInMediaEncryption")) {
            options.enableBuiltInMediaEncryption = optNullableBoolean(mediaOptions, "enableBuiltInMediaEncryption");
        }
        if (mediaOptions.has("publishRhythmPlayerTrack")) {
            options.publishRhythmPlayerTrack = optNullableBoolean(mediaOptions, "publishRhythmPlayerTrack");
        }
        if (mediaOptions.has("isInteractiveAudience")) {
            options.isInteractiveAudience = optNullableBoolean(mediaOptions, "isInteractiveAudience");
        }
        if (mediaOptions.has("customVideoTrackId")) {
            options.customVideoTrackId = optNullableInteger(mediaOptions, "customVideoTrackId");
        }
        if (mediaOptions.has("isAudioFilterable")) {
            options.isAudioFilterable = optNullableBoolean(mediaOptions, "isAudioFilterable");
        }
        if (mediaOptions.has("enableMultipath")) {
            options.enableMultipath = optNullableBoolean(mediaOptions, "enableMultipath");
        }
        if (mediaOptions.has("uplinkMultipathMode")) {
            options.uplinkMultipathMode = optNullableInteger(mediaOptions, "uplinkMultipathMode");
        }
        if (mediaOptions.has("downlinkMultipathMode")) {
            options.downlinkMultipathMode = optNullableInteger(mediaOptions, "downlinkMultipathMode");
        }
        if (mediaOptions.has("preferMultipathType")) {
            options.preferMultipathType = optNullableInteger(mediaOptions, "preferMultipathType");
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

    private Integer optNullableInteger(JSONObject object, String key) {
        if (object == null || !object.has(key) || object.isNull(key)) {
            return null;
        }
        return object.optInt(key);
    }

    private boolean mediaOptionBoolean(JSONObject object, String key, boolean defaultValue) {
        Boolean value = optNullableBoolean(object, key);
        return value != null ? value : defaultValue;
    }

    private boolean requiresCameraPermission(JSONObject mediaOptions) {
        return mediaOptionBoolean(mediaOptions, "publishCameraTrack", true)
                || mediaOptionBoolean(mediaOptions, "startPreview", false)
                || mediaOptionBoolean(mediaOptions, "publishSecondaryCameraTrack", false)
                || mediaOptionBoolean(mediaOptions, "publishThirdCameraTrack", false)
                || mediaOptionBoolean(mediaOptions, "publishFourthCameraTrack", false);
    }

    private boolean requiresMicrophonePermission(JSONObject mediaOptions) {
        return mediaOptionBoolean(mediaOptions, "publishMicrophoneTrack", true);
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

    private void handleJoinChannelWithUserAccount(String requestId, JSONObject params) {
        String token = params != null ? params.optString("token") : "";
        String channelId = params != null ? params.optString("channelId") : "";
        String userAccount = params != null ? params.optString("userAccount") : "";

        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        if (channelId == null || channelId.trim().isEmpty()) {
            dispatchError(requestId, "Channel ID is required.");
            return;
        }
        if (userAccount == null || userAccount.trim().isEmpty()) {
            dispatchError(requestId, "User account is required.");
            return;
        }

        JSONObject mediaOptions = params != null ? params.optJSONObject("options") : null;
        boolean requiresCameraPermission = requiresCameraPermission(mediaOptions);
        boolean requiresMicrophonePermission = requiresMicrophonePermission(mediaOptions);

        ensureRtcPermissions(
                requestId,
                requiresCameraPermission,
                requiresMicrophonePermission,
                () -> continueJoinChannelWithUserAccount(requestId, token, channelId, userAccount, mediaOptions)
        );
    }

    private void continueJoinChannelWithUserAccount(String requestId, String token, String channelId, String userAccount, JSONObject mediaOptions) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }

        ChannelMediaOptions options = new ChannelMediaOptions();
        applyChannelMediaOptions(options, mediaOptions);
        int result = rtcEngine.joinChannelWithUserAccount(token, channelId, userAccount, options);
        if (result < 0) {
            dispatchAgoraError(requestId, "joinChannelWithUserAccount", result);
            return;
        }

        dispatchOk(requestId);
    }

    private void handleGetUserInfoByUserAccount(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        String userAccount = params != null ? params.optString("userAccount") : "";
        if (userAccount == null || userAccount.trim().isEmpty()) {
            dispatchError(requestId, "User account is required.");
            return;
        }

        UserInfo userInfo = new UserInfo();
        int result = rtcEngine.getUserInfoByUserAccount(userAccount, userInfo);
        if (result < 0) {
            dispatchAgoraError(requestId, "getUserInfoByUserAccount", result);
            return;
        }

        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true,
                "result", jsonObject(
                        "uid", userInfo.uid,
                        "userAccount", userInfo.userAccount
                )
        ));
    }

    private void handleGetErrorDescription(String requestId, JSONObject params) {
        int code = params != null ? params.optInt("code", 0) : 0;
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", true,
                "result", RtcEngine.getErrorDescription(code)
        ));
    }

    private int mapLocalVideoSourceType(Constants.VideoSourceType source) {
        if (source == null) {
            return 0;
        }
        return Constants.VideoSourceType.getValue(source);
    }

    private boolean isSupportedLocalTextureSourceType(JSONObject params) {
        return resolveVideoSourceTypeValue(params) == 0;
    }

    private int resolveVideoSourceTypeValue(JSONObject params) {
        if (params != null && params.has("videoSourceType") && !params.isNull("videoSourceType")) {
            return params.optInt("videoSourceType", 0);
        }
        return params != null ? params.optInt("sourceType", 0) : 0;
    }

    private int resolveMediaSourceTypeValue(JSONObject params) {
        if (params != null && params.has("mediaSourceType") && !params.isNull("mediaSourceType")) {
            return params.optInt("mediaSourceType", 2);
        }
        return params != null ? params.optInt("sourceType", 2) : 2;
    }

    private void handleSetupLocalVideoView(String requestId, JSONObject params) {
        Activity activity = requireActivity(requestId);
        if (activity == null) {
            return;
        }
        if (!isSupportedLocalTextureSourceType(params)) {
            dispatchInvalidArgumentError(
                    requestId,
                    "engine-texture local rendering supports only the primary camera source.",
                    "setupLocalVideoView",
                    "videoSourceType",
                    String.valueOf(resolveVideoSourceTypeValue(params))
            );
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
        if (!isSupportedLocalTextureSourceType(params)) {
            dispatchInvalidArgumentError(
                    requestId,
                    "engine-texture local rendering supports only the primary camera source.",
                    "updateLocalVideoView",
                    "videoSourceType",
                    String.valueOf(resolveVideoSourceTypeValue(params))
            );
            return;
        }
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

    private void handleStartPreview(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }

        ensureRtcPermissions(requestId, true, false, () -> continueStartPreview(requestId, params));
    }

    private void continueStartPreview(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }

        renderBackend.startPreview(params, requestCallback(requestId));
    }

    private void handleStopPreview(String requestId, JSONObject params) {
        renderBackend.stopPreview(params, requestCallback(requestId));
    }

    private void handleSwitchCamera(String requestId) {
        renderBackend.switchCamera(requestCallback(requestId));
    }

    private void handleLeaveChannel(String requestId, JSONObject params) {
        if (rtcEngine != null) {
            LeaveChannelOptions options = hasLeaveChannelOptions(params)
                    ? buildLeaveChannelOptions(params)
                    : new LeaveChannelOptions();
            int result = rtcEngine.leaveChannel(options);
            if (result < 0) {
                dispatchAgoraError(requestId, "leaveChannel", result);
                return;
            }
        }
        dispatchOk(requestId);
    }

    private boolean hasLeaveChannelOptions(JSONObject params) {
        return params != null
                && (params.has("stopAudioMixing")
                || params.has("stopAllEffect")
                || params.has("unloadAllEffect")
                || params.has("stopMicrophoneRecording"));
    }

    private LeaveChannelOptions buildLeaveChannelOptions(JSONObject params) {
        LeaveChannelOptions options = new LeaveChannelOptions();
        if (params == null) {
            return options;
        }
        if (params.has("stopAudioMixing") && !params.isNull("stopAudioMixing")) {
            options.stopAudioMixing = params.optBoolean("stopAudioMixing");
        }
        if (params.has("stopAllEffect") && !params.isNull("stopAllEffect")) {
            options.stopAllEffect = params.optBoolean("stopAllEffect");
        }
        if (params.has("unloadAllEffect") && !params.isNull("unloadAllEffect")) {
            options.unloadAllEffect = params.optBoolean("unloadAllEffect");
        }
        if (params.has("stopMicrophoneRecording") && !params.isNull("stopMicrophoneRecording")) {
            options.stopMicrophoneRecording = params.optBoolean("stopMicrophoneRecording");
        }
        return options;
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
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.enableLocalAudio(params == null || params.optBoolean("enabled", true));
        if (result < 0) {
            dispatchAgoraError(requestId, "enableLocalAudio", result);
            return;
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
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.enableLocalVideo(params == null || params.optBoolean("enabled", true));
        if (result < 0) {
            dispatchAgoraError(requestId, "enableLocalVideo", result);
            return;
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
        final AgoraRenderBackend backendToRelease = renderBackend;
        final RtcEngine engineToDestroy = rtcEngine;
        renderBackend = AgoraRenderBackendFactory.create(
                renderBackendType,
                this::dispatchEvent
        );
        rtcEngine = null;
        dispatchOk(requestId);
        if (backendToRelease != null) {
            CocosHelper.runOnGameThread(backendToRelease::release);
        }
        new Thread(() -> {
            if (engineToDestroy != null) {
                RtcEngine.destroy();
            }
        }).start();
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
        if (params != null) {
            configuration.minFrameRate = params.optInt("minFrameRate", configuration.minFrameRate);
            configuration.minBitrate = params.optInt("minBitrate", configuration.minBitrate);
        }
        configuration.orientationMode = mapOrientationMode(orientationMode);
        if (params != null && params.has("mirrorMode") && !params.isNull("mirrorMode")) {
            configuration.mirrorMode = mapMirrorMode(params.optInt("mirrorMode"));
        }
        if (params != null && params.has("degradationPreference") && !params.isNull("degradationPreference")) {
            configuration.degradationPrefer = mapDegradationPreference(params.optInt("degradationPreference"));
        }
        if (params != null && params.has("codecType") && !params.isNull("codecType")) {
            configuration.codecType = mapVideoCodecType(params.optInt("codecType"));
        }
        if (params != null && params.has("advancedVideoOptions") && !params.isNull("advancedVideoOptions")) {
            configuration.advanceOptions = buildAdvancedVideoOptions(params.optJSONObject("advancedVideoOptions"));
        }

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
        Constants.MediaSourceType sourceType = mapMediaSourceType(resolveMediaSourceTypeValue(params));
        int result = rtcEngine.setBeautyEffectOptions(enabled, beautyOptions, sourceType);
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
        if (config != null) {
            inspectConfig.extraInfo = config.optString("extraInfo", inspectConfig.extraInfo);
            inspectConfig.serverConfig = config.optString("serverConfig", inspectConfig.serverConfig);
            JSONArray modules = config.optJSONArray("modules");
            if (modules != null && modules.length() > 0) {
                inspectConfig.modules = new ContentInspectConfig.ContentInspectModule[modules.length()];
                for (int index = 0; index < modules.length(); index += 1) {
                    inspectConfig.modules[index] = buildContentInspectModule(modules.optJSONObject(index));
                }
            }
        }
        if (inspectConfig.modules == null || inspectConfig.modules.length == 0) {
            ContentInspectConfig.ContentInspectModule module = new ContentInspectConfig.ContentInspectModule();
            module.type = config != null ? config.optInt("module", ContentInspectConfig.CONTENT_INSPECT_TYPE_MODERATION) : ContentInspectConfig.CONTENT_INSPECT_TYPE_MODERATION;
            module.interval = config != null ? config.optInt("interval", 0) : 0;
            module.position = mapContentInspectModulePosition(config != null ? config.optInt("position", 2) : 2);
            inspectConfig.modules = new ContentInspectConfig.ContentInspectModule[] { module };
        }
        inspectConfig.moduleCount = inspectConfig.modules.length;

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
        final RtcEngine engine = rtcEngine;
        if (engine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        final AtomicBoolean completed = new AtomicBoolean(false);
        new Thread(() -> {
            try {
                int position = engine.getAudioMixingCurrentPosition();
                if (!completed.compareAndSet(false, true)) {
                    return;
                }
                dispatchResponse(jsonObject(
                        "requestId", requestId,
                        "ok", true,
                        "result", position
                ));
            } catch (Exception error) {
                if (completed.compareAndSet(false, true)) {
                    dispatchNativeExceptionError(requestId, "getAudioMixingCurrentPosition", error);
                }
            }
        }).start();
        new Thread(() -> {
            try {
                Thread.sleep(NATIVE_QUERY_TIMEOUT_MS);
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
            }
            if (completed.compareAndSet(false, true)) {
                dispatchNativeMethodError(
                        requestId,
                        "getAudioMixingCurrentPosition",
                        "Native request timed out in Android audio mixing query."
                );
            }
        }).start();
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

    private void handleAdjustAudioMixingPublishVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.adjustAudioMixingPublishVolume(params != null ? params.optInt("volume", 100) : 100);
        if (result < 0) {
            dispatchAgoraError(requestId, "adjustAudioMixingPublishVolume", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleAdjustAudioMixingPlayoutVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        int result = rtcEngine.adjustAudioMixingPlayoutVolume(params != null ? params.optInt("volume", 100) : 100);
        if (result < 0) {
            dispatchAgoraError(requestId, "adjustAudioMixingPlayoutVolume", result);
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
        int startPos = params != null ? params.optInt("startPos", 0) : 0;
        int result = effectManager.preloadEffect(soundId, path, startPos);
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

    private void handlePauseEffect(String requestId, JSONObject params) {
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
        int result = effectManager.pauseEffect(soundId);
        if (result < 0) {
            dispatchAgoraError(requestId, "pauseEffect", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleResumeEffect(String requestId, JSONObject params) {
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
        int result = effectManager.resumeEffect(soundId);
        if (result < 0) {
            dispatchAgoraError(requestId, "resumeEffect", result);
            return;
        }
        dispatchOk(requestId);
    }

    private void handleSetEffectsVolume(String requestId, JSONObject params) {
        if (rtcEngine == null) {
            dispatchError(requestId, "RtcEngine is not initialized.");
            return;
        }
        IAudioEffectManager effectManager = rtcEngine.getAudioEffectManager();
        if (effectManager == null) {
            dispatchError(requestId, "AudioEffectManager is unavailable.");
            return;
        }
        double volume = params != null ? params.optDouble("volume", 100.0) : 100.0;
        int result = effectManager.setEffectsVolume(volume);
        if (result < 0) {
            dispatchAgoraError(requestId, "setEffectsVolume", result);
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
        String parameterValue = params != null && params.has("parameters") && !params.isNull("parameters")
                ? params.optString("parameters", null)
                : null;
        if (parameterValue == null || parameterValue.trim().isEmpty()) {
            dispatchError(requestId, "Parameters are required.");
            return;
        }
        String parameters;
        try {
            parameters = mergeProtectedParameters(parameterValue);
        } catch (IllegalArgumentException error) {
            dispatchInvalidArgumentError(requestId, error.getMessage(), "setParameters", "parameters", parameterValue);
            return;
        }
        int result = rtcEngine.setParameters(parameters);
        if (result < 0) {
            dispatchAgoraError(requestId, "setParameters", result);
            return;
        }
        dispatchOk(requestId);
    }

    private boolean applyProtectedParameters(RtcEngine engine, String requestId, String method, JSONObject params) {
        String parameterValue = params != null ? params.optString("parameters", "") : "";
        String parameters;
        try {
            parameters = mergeProtectedParameters(parameterValue);
        } catch (IllegalArgumentException error) {
            dispatchInvalidArgumentError(requestId, error.getMessage(), method, "parameters", parameterValue);
            return false;
        }
        if (parameters == null || parameters.trim().isEmpty()) {
            dispatchError(requestId, "Parameters are required.");
            return false;
        }
        int result = engine.setParameters(parameters);
        if (result < 0) {
            dispatchAgoraError(requestId, method, result);
            return false;
        }
        return true;
    }

    private String mergeProtectedParameters(String parameterValue) {
        if (parameterValue == null || parameterValue.trim().isEmpty()) {
            return PROTECTED_APP_TYPE_PARAMETERS;
        }
        try {
            JSONObject clientParams = new JSONObject(parameterValue);
            clientParams.put("rtc.set_app_type", 10);
            return clientParams.toString();
        } catch (JSONException error) {
            throw new IllegalArgumentException("Parameters must be a valid JSON object string.");
        }
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
        return "engine-texture".equals(backend);
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
        dispatchNativeExceptionError(requestId, "", error);
    }

    private void dispatchNativeExceptionError(String requestId, String method, Exception error) {
        String message = error.getMessage();
        dispatchNativeMethodError(
                requestId,
                method,
                "Native request failed: " + (message != null ? message : error.getClass().getSimpleName())
        );
    }

    private void dispatchNativeMethodError(String requestId, String method, String message) {
        dispatchResponse(jsonObject(
                "requestId", requestId,
                "ok", false,
                "error", jsonObject(
                        "code", "native_failure",
                        "message", message,
                        "details", jsonObject(
                                "method", method,
                                "platform", "android"
                        )
                )
        ));
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

    private VideoEncoderConfiguration.MIRROR_MODE_TYPE mapMirrorMode(int value) {
        switch (value) {
            case 1:
                return VideoEncoderConfiguration.MIRROR_MODE_TYPE.MIRROR_MODE_ENABLED;
            case 2:
                return VideoEncoderConfiguration.MIRROR_MODE_TYPE.MIRROR_MODE_DISABLED;
            default:
                return VideoEncoderConfiguration.MIRROR_MODE_TYPE.MIRROR_MODE_AUTO;
        }
    }

    private VideoEncoderConfiguration.DEGRADATION_PREFERENCE mapDegradationPreference(int value) {
        switch (value) {
            case -1:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.MAINTAIN_AUTO;
            case 0:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.MAINTAIN_QUALITY;
            case 1:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.MAINTAIN_FRAMERATE;
            case 2:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.MAINTAIN_BALANCED;
            case 3:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.MAINTAIN_RESOLUTION;
            case 100:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.DISABLED;
            default:
                return VideoEncoderConfiguration.DEGRADATION_PREFERENCE.MAINTAIN_AUTO;
        }
    }

    private VideoEncoderConfiguration.VIDEO_CODEC_TYPE mapVideoCodecType(int value) {
        switch (value) {
            case 0:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_NONE;
            case 1:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_VP8;
            case 2:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_H264;
            case 3:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_H265;
            case 6:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_GENERIC;
            case 12:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_AV1;
            case 13:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_VP9;
            case 20:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_GENERIC_JPEG;
            default:
                return VideoEncoderConfiguration.VIDEO_CODEC_TYPE.VIDEO_CODEC_NONE;
        }
    }

    private VideoEncoderConfiguration.AdvanceOptions buildAdvancedVideoOptions(JSONObject params) {
        VideoEncoderConfiguration.AdvanceOptions options = new VideoEncoderConfiguration.AdvanceOptions();
        if (params == null) {
            return options;
        }
        options.encodingPreference = mapEncodingPreference(params.optInt("encodingPreference", -1));
        options.compressionPreference = mapCompressionPreference(params.optInt("compressionPreference", -1));
        options.encodeAlpha = params.optBoolean("encodeAlpha", options.encodeAlpha);
        return options;
    }

    private VideoEncoderConfiguration.ENCODING_PREFERENCE mapEncodingPreference(int value) {
        switch (value) {
            case -1:
                return VideoEncoderConfiguration.ENCODING_PREFERENCE.PREFER_AUTO;
            case 0:
                return VideoEncoderConfiguration.ENCODING_PREFERENCE.PREFER_SOFTWARE;
            case 1:
                return VideoEncoderConfiguration.ENCODING_PREFERENCE.PREFER_HARDWARE;
            default:
                return VideoEncoderConfiguration.ENCODING_PREFERENCE.PREFER_AUTO;
        }
    }

    private VideoEncoderConfiguration.COMPRESSION_PREFERENCE mapCompressionPreference(int value) {
        switch (value) {
            case -1:
                return VideoEncoderConfiguration.COMPRESSION_PREFERENCE.PREFER_COMPRESSION_AUTO;
            case 0:
                return VideoEncoderConfiguration.COMPRESSION_PREFERENCE.PREFER_LOW_LATENCY;
            case 1:
                return VideoEncoderConfiguration.COMPRESSION_PREFERENCE.PREFER_QUALITY;
            default:
                return VideoEncoderConfiguration.COMPRESSION_PREFERENCE.PREFER_COMPRESSION_AUTO;
        }
    }

    private ContentInspectConfig.ContentInspectModule buildContentInspectModule(JSONObject params) {
        ContentInspectConfig.ContentInspectModule module = new ContentInspectConfig.ContentInspectModule();
        module.type = params != null ? params.optInt("type", ContentInspectConfig.CONTENT_INSPECT_TYPE_MODERATION) : ContentInspectConfig.CONTENT_INSPECT_TYPE_MODERATION;
        module.interval = params != null ? params.optInt("interval", 0) : 0;
        module.position = mapContentInspectModulePosition(params != null ? params.optInt("position", 2) : 2);
        return module;
    }

    private Constants.VideoModulePosition mapContentInspectModulePosition(int value) {
        switch (value) {
            case 1:
                return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_POST_CAPTURER;
            case 4:
                return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_PRE_ENCODER;
            case 8:
                return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_POST_CAPTURER_ORIGIN;
            default:
                return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_PRE_RENDERER;
        }
    }

    private Constants.MediaSourceType mapMediaSourceType(int value) {
        for (Constants.MediaSourceType sourceType : Constants.MediaSourceType.values()) {
            if (Constants.MediaSourceType.getValue(sourceType) == value) {
                return sourceType;
            }
        }
        return Constants.MediaSourceType.PRIMARY_CAMERA_SOURCE;
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

    private JSONObject toRtcStatsPayload(IRtcEngineEventHandler.RtcStats stats) {
        return jsonObject(
                "duration", stats != null ? stats.totalDuration : 0,
                "txBytes", stats != null ? stats.txBytes : 0,
                "rxBytes", stats != null ? stats.rxBytes : 0,
                "txKBitRate", stats != null ? stats.txKBitRate : 0,
                "rxKBitRate", stats != null ? stats.rxKBitRate : 0,
                "txAudioBytes", stats != null ? stats.txAudioBytes : 0,
                "rxAudioBytes", stats != null ? stats.rxAudioBytes : 0,
                "txVideoBytes", stats != null ? stats.txVideoBytes : 0,
                "rxVideoBytes", stats != null ? stats.rxVideoBytes : 0,
                "txAudioKBitRate", stats != null ? stats.txAudioKBitRate : 0,
                "rxAudioKBitRate", stats != null ? stats.rxAudioKBitRate : 0,
                "txVideoKBitRate", stats != null ? stats.txVideoKBitRate : 0,
                "rxVideoKBitRate", stats != null ? stats.rxVideoKBitRate : 0,
                "lastmileDelay", stats != null ? stats.lastmileDelay : 0,
                "cpuTotalUsage", stats != null ? stats.cpuTotalUsage : 0,
                "gatewayRtt", stats != null ? stats.gatewayRtt : 0,
                "cpuAppUsage", stats != null ? stats.cpuAppUsage : 0,
                "users", stats != null ? stats.users : 0,
                "connectTimeMs", stats != null ? stats.connectTimeMs : 0,
                "txPacketLossRate", stats != null ? stats.txPacketLossRate : 0,
                "rxPacketLossRate", stats != null ? stats.rxPacketLossRate : 0,
                "memoryAppUsageRatio", stats != null ? stats.memoryAppUsageRatio : 0,
                "memoryTotalUsageRatio", stats != null ? stats.memoryTotalUsageRatio : 0,
                "memoryAppUsageInKbytes", stats != null ? stats.memoryAppUsageInKbytes : 0
        );
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
