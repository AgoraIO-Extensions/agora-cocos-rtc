package io.agora.cocos.rtc.render;

import android.app.Activity;
import android.graphics.Rect;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

import io.agora.rtc2.Constants;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.video.VideoCanvas;

public abstract class AbstractNativeViewRenderBackend implements AgoraRenderBackend {
    protected RtcEngine rtcEngine;
    protected FrameLayout videoContainer;
    protected View localVideoView;
    protected final Map<Integer, View> remoteVideoViews = new HashMap<>();

    @Override
    public void bindEngine(RtcEngine rtcEngine) {
      this.rtcEngine = rtcEngine;
    }

    @Override
    public void release() {
      if (localVideoView != null && localVideoView.getParent() instanceof ViewGroup) {
        ((ViewGroup) localVideoView.getParent()).removeView(localVideoView);
      }
      for (View remoteView : remoteVideoViews.values()) {
        if (remoteView.getParent() instanceof ViewGroup) {
          ((ViewGroup) remoteView.getParent()).removeView(remoteView);
        }
      }
      remoteVideoViews.clear();
      localVideoView = null;
      videoContainer = null;
      rtcEngine = null;
    }

    @Override
    public void setupLocalVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      if (rtcEngine == null) {
        callback.onError("RtcEngine is not initialized.");
        return;
      }

      activity.runOnUiThread(() -> {
        ensureVideoContainer(activity);
        if (localVideoView == null) {
          localVideoView = createRendererView(activity, true);
          videoContainer.addView(localVideoView);
        } else if (localVideoView.getParent() == null) {
          videoContainer.addView(localVideoView);
        }

        applyLayout(localVideoView, params);
        rtcEngine.setupLocalVideo(buildVideoCanvas(localVideoView, params, 0));
        rtcEngine.setLocalRenderMode(resolveRenderMode(params), resolveMirrorMode(params));
        callback.onSuccess();
      });
    }

    @Override
    public void setupRemoteVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      if (rtcEngine == null) {
        callback.onError("RtcEngine is not initialized.");
        return;
      }

      final int uid = resolveUid(params, 0);
      activity.runOnUiThread(() -> {
        ensureVideoContainer(activity);
        View remoteView = remoteVideoViews.get(uid);
        if (remoteView == null) {
          remoteView = createRendererView(activity, false);
          remoteVideoViews.put(uid, remoteView);
          videoContainer.addView(remoteView);
        } else if (remoteView.getParent() == null) {
          videoContainer.addView(remoteView);
        }

        applyLayout(remoteView, params);
        rtcEngine.setupRemoteVideo(buildVideoCanvas(remoteView, params, uid));
        rtcEngine.setRemoteRenderMode(uid, resolveRenderMode(params), resolveMirrorMode(params));
        callback.onSuccess();
      });
    }

    @Override
    public void updateLocalVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      if (localVideoView == null) {
        callback.onError("Local video view is not attached.");
        return;
      }
      applyLayout(localVideoView, params);
      if (rtcEngine != null) {
        rtcEngine.setupLocalVideo(buildVideoCanvas(localVideoView, params, 0));
        rtcEngine.setLocalRenderMode(resolveRenderMode(params), resolveMirrorMode(params));
      }
      callback.onSuccess();
    }

    @Override
    public void updateRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      int uid = resolveUid(params, 0);
      View remoteView = remoteVideoViews.get(uid);
      if (remoteView == null) {
        callback.onError("Remote video view is not attached.");
        return;
      }
      applyLayout(remoteView, params);
      if (rtcEngine != null) {
        rtcEngine.setupRemoteVideo(buildVideoCanvas(remoteView, params, uid));
        rtcEngine.setRemoteRenderMode(uid, resolveRenderMode(params), resolveMirrorMode(params));
      }
      callback.onSuccess();
    }

    @Override
    public void removeLocalVideoView(AgoraRenderResultCallback callback) {
      if (localVideoView != null && localVideoView.getParent() instanceof ViewGroup) {
        ((ViewGroup) localVideoView.getParent()).removeView(localVideoView);
      }
      localVideoView = null;
      callback.onSuccess();
    }

    @Override
    public void removeRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      int uid = resolveUid(params, 0);
      View remoteView = remoteVideoViews.remove(uid);
      if (remoteView != null && remoteView.getParent() instanceof ViewGroup) {
        ((ViewGroup) remoteView.getParent()).removeView(remoteView);
      }
      callback.onSuccess();
    }

    @Override
    public void setNativeVideoOverlaySuspended(boolean suspended, AgoraRenderResultCallback callback) {
      Activity activity = com.cocos.lib.GlobalObject.getActivity();
      if (activity == null) {
        callback.onError("Activity unavailable.");
        return;
      }
      activity.runOnUiThread(() -> {
        if (videoContainer != null) {
          videoContainer.setVisibility(suspended ? View.GONE : View.VISIBLE);
        }
        if (localVideoView != null) {
          localVideoView.setVisibility(suspended ? View.GONE : View.VISIBLE);
        }
        for (View remoteView : remoteVideoViews.values()) {
          remoteView.setVisibility(suspended ? View.GONE : View.VISIBLE);
        }
        callback.onSuccess();
      });
    }

    @Override
    public void startPreview(AgoraRenderResultCallback callback) {
      if (rtcEngine == null) {
        callback.onError("RtcEngine is not initialized.");
        return;
      }

      rtcEngine.enableVideo();
      int result = rtcEngine.startPreview();
      if (result < 0) {
        callback.onError("RtcEngine.startPreview failed: " + result);
        return;
      }
      callback.onSuccess();
    }

    @Override
    public void stopPreview(AgoraRenderResultCallback callback) {
      if (rtcEngine == null) {
        callback.onError("RtcEngine is not initialized.");
        return;
      }

      int result = rtcEngine.stopPreview();
      if (result < 0) {
        callback.onError("RtcEngine.stopPreview failed: " + result);
        return;
      }
      callback.onSuccess();
    }

    @Override
    public void switchCamera(AgoraRenderResultCallback callback) {
      if (rtcEngine == null) {
        callback.onError("RtcEngine is not initialized.");
        return;
      }

      int result = rtcEngine.switchCamera();
      if (result < 0) {
        callback.onError("RtcEngine.switchCamera failed: " + result);
        return;
      }
      callback.onSuccess();
    }

    protected abstract View createRendererView(Activity activity, boolean local);

    protected void ensureVideoContainer(Activity activity) {
      if (videoContainer != null) {
        return;
      }

      FrameLayout container = new FrameLayout(activity);
      container.setLayoutParams(new FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
      ));
      activity.addContentView(container, container.getLayoutParams());
      videoContainer = container;
    }

    protected int resolveRenderMode(JSONObject params) {
      String renderMode = params != null ? params.optString("renderMode", "hidden") : "hidden";
      return "adaptive".equals(renderMode) ? Constants.RENDER_MODE_ADAPTIVE
          : "fit".equals(renderMode) ? Constants.RENDER_MODE_FIT
          : Constants.RENDER_MODE_HIDDEN;
    }

    private VideoCanvas buildVideoCanvas(View view, JSONObject params, int fallbackUid) {
      VideoCanvas canvas = new VideoCanvas(view, resolveRenderMode(params), resolveUid(params, fallbackUid));
      canvas.uid = resolveUid(params, fallbackUid);
      canvas.subviewUid = resolveSubviewUid(params);
      canvas.renderMode = resolveRenderMode(params);
      canvas.mirrorMode = resolveMirrorMode(params);
      canvas.setupMode = resolveVideoViewSetupMode(params);
      canvas.sourceType = resolveVideoSourceType(params);
      canvas.mediaPlayerId = resolveMediaPlayerId(params);
      if (params != null) {
        Rect cropArea = resolveCropArea(params.optJSONObject("cropArea"));
        if (cropArea != null) {
          canvas.rect = cropArea;
        }
        canvas.enableAlphaMask = params.optBoolean("enableAlphaMask", canvas.enableAlphaMask);
        canvas.backgroundColor = params.optInt("backgroundColor", canvas.backgroundColor);
        canvas.position = resolveVideoModulePosition(params);
      }
      return canvas;
    }

    protected int resolveUid(JSONObject params, int fallbackUid) {
      return params != null ? params.optInt("uid", fallbackUid) : fallbackUid;
    }

    protected int resolveSubviewUid(JSONObject params) {
      return params != null ? params.optInt("subviewUid", 0) : 0;
    }

    protected int resolveMirrorMode(JSONObject params) {
      return params != null ? params.optInt("mirrorMode", 0) : 0;
    }

    protected int resolveVideoViewSetupMode(JSONObject params) {
      return params != null ? params.optInt("setupMode", 0) : 0;
    }

    protected int resolveVideoSourceType(JSONObject params) {
      return params != null ? params.optInt("sourceType", 0) : 0;
    }

    protected int resolveMediaPlayerId(JSONObject params) {
      return params != null ? params.optInt("mediaPlayerId", 0) : 0;
    }

    protected Rect resolveCropArea(JSONObject cropArea) {
      if (cropArea == null) {
        return null;
      }
      return new Rect(
          cropArea.optInt("x", 0),
          cropArea.optInt("y", 0),
          cropArea.optInt("x", 0) + cropArea.optInt("width", 0),
          cropArea.optInt("y", 0) + cropArea.optInt("height", 0)
      );
    }

    protected Constants.VideoModulePosition resolveVideoModulePosition(JSONObject params) {
      if (params == null || !params.has("position") || params.isNull("position")) {
        return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_POST_CAPTURER;
      }
      switch (params.optInt("position", 1)) {
        case 2:
          return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_PRE_RENDERER;
        case 4:
          return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_PRE_ENCODER;
        case 8:
          return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_POST_CAPTURER_ORIGIN;
        case 1:
        default:
          return Constants.VideoModulePosition.VIDEO_MODULE_POSITION_POST_CAPTURER;
      }
    }

    protected void applyLayout(View targetView, JSONObject params) {
      int width = params != null ? params.optInt("width", 320) : 320;
      int height = params != null ? params.optInt("height", 240) : 240;
      int x = params != null ? params.optInt("x") : 0;
      int y = params != null ? params.optInt("y") : 0;

      FrameLayout.LayoutParams layoutParams = new FrameLayout.LayoutParams(width, height);
      layoutParams.leftMargin = x;
      layoutParams.topMargin = y;
      targetView.setLayoutParams(layoutParams);
    }
}
