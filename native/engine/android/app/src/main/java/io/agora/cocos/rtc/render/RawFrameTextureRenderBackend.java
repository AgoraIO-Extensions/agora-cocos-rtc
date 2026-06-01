package io.agora.cocos.rtc.render;

import android.app.Activity;
import android.os.SystemClock;

import org.json.JSONException;
import org.json.JSONObject;

import com.cocos.lib.CocosHelper;

import io.agora.base.VideoFrame;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.video.IVideoFrameObserver;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class RawFrameTextureRenderBackend implements AgoraRenderBackend, IVideoFrameObserver {
    private static final long FRAME_INTERVAL_MS = 100L;
    private static final int REMOTE_TARGET_WIDTH = 854;
    private static final int REMOTE_TARGET_HEIGHT = 480;
    private static final int LOCAL_TARGET_WIDTH = 320;
    private static final int LOCAL_TARGET_HEIGHT = 180;

    private static final class TextureSlotState {
      final int slotId;
      final int width;
      final int height;

      TextureSlotState(int slotId, int width, int height) {
        this.slotId = slotId;
        this.width = width;
        this.height = height;
      }
    }

    private final AgoraRenderEventDispatcher eventDispatcher;
    private RtcEngine rtcEngine;
    private volatile boolean localTextureRequested;
    private volatile TextureSlotState localTextureSlot;
    private final Set<Integer> remoteTextureUids = ConcurrentHashMap.newKeySet();
    private final Map<Integer, TextureSlotState> remoteTextureSlots = new ConcurrentHashMap<>();
    private long lastLocalDispatchAtMs;
    private final Map<Integer, Long> lastRemoteDispatchAtMs = new ConcurrentHashMap<>();

    public RawFrameTextureRenderBackend(AgoraRenderEventDispatcher eventDispatcher) {
      this.eventDispatcher = eventDispatcher;
    }

    @Override
    public String getType() {
      return "engine-texture";
    }

    @Override
    public void bindEngine(RtcEngine rtcEngine) {
      this.rtcEngine = rtcEngine;
      if (this.rtcEngine != null) {
        int result = this.rtcEngine.registerVideoFrameObserver(this);
        dispatchBackendState("bindEngine", result, -1);
      }
    }

    @Override
    public void release() {
      if (rtcEngine != null) {
        rtcEngine.registerVideoFrameObserver(null);
      }
      rtcEngine = null;
      localTextureRequested = false;
      remoteTextureUids.clear();
      releaseLocalTextureSlot();
      releaseRemoteTextureSlots();
      lastRemoteDispatchAtMs.clear();
      lastLocalDispatchAtMs = 0L;
    }

    @Override
    public void setupLocalVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      CocosHelper.runOnGameThread(() -> {
        localTextureRequested = true;
        ensureLocalTextureSlot();
        callback.onSuccess();
      });
    }

    @Override
    public void setupRemoteVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      CocosHelper.runOnGameThread(() -> {
        int uid = params != null ? params.optInt("uid") : 0;
        remoteTextureUids.add(uid);
        ensureRemoteTextureSlot(uid);
        callback.onSuccess();
      });
    }

    @Override
    public void updateLocalVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      setupLocalVideoView(null, params, callback);
    }

    @Override
    public void updateRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      setupRemoteVideoView(null, params, callback);
    }

    @Override
    public void removeLocalVideoView(AgoraRenderResultCallback callback) {
      CocosHelper.runOnGameThread(() -> {
        localTextureRequested = false;
        releaseLocalTextureSlot();
        callback.onSuccess();
      });
    }

    @Override
    public void removeRemoteVideoView(JSONObject params, AgoraRenderResultCallback callback) {
      CocosHelper.runOnGameThread(() -> {
        int uid = params != null ? params.optInt("uid") : 0;
        remoteTextureUids.remove(uid);
        lastRemoteDispatchAtMs.remove(uid);
        releaseRemoteTextureSlot(uid);
        callback.onSuccess();
      });
    }

    @Override
    public void setNativeVideoOverlaySuspended(boolean suspended, AgoraRenderResultCallback callback) {
      callback.onSuccess();
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

    @Override
    public boolean onCaptureVideoFrame(int sourceType, VideoFrame videoFrame) {
      TextureSlotState slot = localTextureSlot;
      if (!localTextureRequested || slot == null) {
        return true;
      }
      dispatchFrameEvent("localVideoTextureUpdated", 0, slot, videoFrame);
      return true;
    }

    @Override
    public boolean onPreEncodeVideoFrame(int sourceType, VideoFrame videoFrame) {
      return true;
    }

    @Override
    public boolean onMediaPlayerVideoFrame(VideoFrame videoFrame, int mediaPlayerId) {
      return true;
    }

    @Override
    public int getVideoFrameProcessMode() {
      return PROCESS_MODE_READ_ONLY;
    }

    @Override
    public int getVideoFormatPreference() {
      return VIDEO_PIXEL_I420;
    }

    @Override
    public boolean getRotationApplied() {
      return false;
    }

    @Override
    public boolean getMirrorApplied() {
      return false;
    }

    @Override
    public int getObservedFramePosition() {
      return POSITION_POST_CAPTURER | POSITION_PRE_RENDERER;
    }

    @Override
    public boolean onRenderVideoFrame(String channelId, int uid, VideoFrame videoFrame) {
      TextureSlotState slot = remoteTextureSlots.get(uid);
      if (!remoteTextureUids.contains(uid) || slot == null) {
        return true;
      }
      dispatchFrameEvent("remoteVideoTextureUpdated", uid, slot, videoFrame);
      return true;
    }

    private void dispatchFrameEvent(String eventName, int uid, TextureSlotState slot, VideoFrame videoFrame) {
      if (eventDispatcher == null || videoFrame == null || videoFrame.getBuffer() == null) {
        return;
      }
      long now = SystemClock.elapsedRealtime();
      if ("localVideoTextureUpdated".equals(eventName)) {
        if (now - lastLocalDispatchAtMs < FRAME_INTERVAL_MS) {
          return;
        }
      } else {
        long last = lastRemoteDispatchAtMs.containsKey(uid) ? lastRemoteDispatchAtMs.get(uid) : 0L;
        if (now - last < FRAME_INTERVAL_MS) {
          return;
        }
      }

      VideoFrame.Buffer scaledBuffer = null;
      VideoFrame.I420Buffer i420Buffer = null;
      try {
        scaledBuffer = videoFrame.getBuffer().cropAndScale(
            0,
            0,
            videoFrame.getBuffer().getWidth(),
            videoFrame.getBuffer().getHeight(),
            slot.width,
            slot.height
        );
        i420Buffer = scaledBuffer.toI420();
        AgoraEngineTextureSlotBridge.nativeUpdateI420Slot(
            slot.slotId,
            i420Buffer.getDataY(),
            i420Buffer.getStrideY(),
            i420Buffer.getDataU(),
            i420Buffer.getStrideU(),
            i420Buffer.getDataV(),
            i420Buffer.getStrideV(),
            slot.width,
            slot.height
        );
        dispatchBackendState(eventName, 0, uid);
        if ("localVideoTextureUpdated".equals(eventName)) {
          lastLocalDispatchAtMs = now;
        } else {
          lastRemoteDispatchAtMs.put(uid, now);
        }
      } finally {
        if (i420Buffer != null) {
          i420Buffer.release();
        }
        if (scaledBuffer != null) {
          scaledBuffer.release();
        }
      }
    }

    private void ensureLocalTextureSlot() {
      if (localTextureSlot != null) {
        return;
      }
      localTextureSlot = createTextureSlotState(LOCAL_TARGET_WIDTH, LOCAL_TARGET_HEIGHT);
      dispatchTextureReadyEvent(
          "localVideoTextureReady",
          0,
          localTextureSlot.slotId,
          LOCAL_TARGET_WIDTH,
          LOCAL_TARGET_HEIGHT
      );
    }

    private void ensureRemoteTextureSlot(int uid) {
      if (uid == 0 || remoteTextureSlots.containsKey(uid)) {
        return;
      }
      TextureSlotState slot = createTextureSlotState(REMOTE_TARGET_WIDTH, REMOTE_TARGET_HEIGHT);
      remoteTextureSlots.put(uid, slot);
      dispatchTextureReadyEvent(
          "remoteVideoTextureReady",
          uid,
          slot.slotId,
          REMOTE_TARGET_WIDTH,
          REMOTE_TARGET_HEIGHT
      );
    }

    private TextureSlotState createTextureSlotState(int width, int height) {
      int slotId = AgoraEngineTextureSlotBridge.nativeCreateSlot(width, height);
      return new TextureSlotState(slotId, width, height);
    }

    private void releaseLocalTextureSlot() {
      TextureSlotState slot = localTextureSlot;
      if (slot == null) {
        return;
      }
      localTextureSlot = null;
      AgoraEngineTextureSlotBridge.nativeReleaseSlot(slot.slotId);
      dispatchTextureReleasedEvent("localVideoTextureReleased", 0, slot.slotId);
    }

    private void releaseRemoteTextureSlot(int uid) {
      TextureSlotState slot = remoteTextureSlots.remove(uid);
      if (slot == null) {
        return;
      }
      AgoraEngineTextureSlotBridge.nativeReleaseSlot(slot.slotId);
      dispatchTextureReleasedEvent("remoteVideoTextureReleased", uid, slot.slotId);
    }

    private void releaseRemoteTextureSlots() {
      for (Map.Entry<Integer, TextureSlotState> entry : remoteTextureSlots.entrySet()) {
        releaseRemoteTextureSlot(entry.getKey());
      }
      remoteTextureSlots.clear();
    }

    private void dispatchTextureReadyEvent(String eventName, int uid, int slotId, int width, int height) {
      if (eventDispatcher == null) {
        return;
      }
      try {
        JSONObject payload = new JSONObject()
            .put("slotId", slotId)
            .put("width", width)
            .put("height", height);
        if (uid != 0) {
          payload.put("uid", uid);
        }
        eventDispatcher.dispatchEvent(eventName, payload);
      } catch (JSONException ignored) {
      }
    }

    private void dispatchTextureReleasedEvent(String eventName, int uid, int slotId) {
      if (eventDispatcher == null) {
        return;
      }
      try {
        JSONObject payload = new JSONObject()
            .put("slotId", slotId);
        if (uid != 0) {
          payload.put("uid", uid);
        }
        eventDispatcher.dispatchEvent(eventName, payload);
      } catch (JSONException ignored) {
      }
    }

    private void dispatchBackendState(String phase, int result, int uid) {
      if (eventDispatcher == null) {
        return;
      }
      try {
        eventDispatcher.dispatchEvent(
            "renderBackendState",
            new JSONObject()
                .put("backend", getType())
                .put("phase", phase)
                .put("result", result)
                .put("uid", uid)
        );
      } catch (JSONException ignored) {
      }
    }
}
