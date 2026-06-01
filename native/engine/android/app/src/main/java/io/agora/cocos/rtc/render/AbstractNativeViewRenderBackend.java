package io.agora.cocos.rtc.render;

import android.app.Activity;
import android.view.View;
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
          rtcEngine.setupLocalVideo(new VideoCanvas(
              localVideoView,
              resolveRenderMode(params),
              0
          ));
        } else if (localVideoView.getParent() == null) {
          videoContainer.addView(localVideoView);
        }

        applyLayout(localVideoView, params);
        callback.onSuccess();
      });
    }

    @Override
    public void setupRemoteVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      if (rtcEngine == null) {
        callback.onError("RtcEngine is not initialized.");
        return;
      }

      final int uid = params != null ? params.optInt("uid") : 0;
      activity.runOnUiThread(() -> {
        ensureVideoContainer(activity);
        View remoteView = remoteVideoViews.get(uid);
        if (remoteView == null) {
          remoteView = createRendererView(activity, false);
          remoteVideoViews.put(uid, remoteView);
          videoContainer.addView(remoteView);
          rtcEngine.setupRemoteVideo(new VideoCanvas(
              remoteView,
              resolveRenderMode(params),
              uid
          ));
        } else if (remoteView.getParent() == null) {
          videoContainer.addView(remoteView);
        }

        applyLayout(remoteView, params);
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
      callback.onSuccess();
    }

    @Override
    public void updateRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      int uid = params != null ? params.optInt("uid") : 0;
      View remoteView = remoteVideoViews.get(uid);
      if (remoteView == null) {
        callback.onError("Remote video view is not attached.");
        return;
      }
      applyLayout(remoteView, params);
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
      int uid = params != null ? params.optInt("uid") : 0;
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
      return "fit".equals(renderMode) ? Constants.RENDER_MODE_FIT : Constants.RENDER_MODE_HIDDEN;
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
