package io.agora.cocos.rtc.render;

import android.app.Activity;
import android.os.SystemClock;
import android.util.Log;

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
    private static final String LOG_TAG = "AgoraRtcEngineTexture";
    private static final long FRAME_DIAGNOSTIC_INTERVAL_MS = 2000L;
    private static final int REMOTE_TARGET_WIDTH = 854;
    private static final int REMOTE_TARGET_HEIGHT = 480;
    private static final int LOCAL_TARGET_WIDTH = 320;
    private static final int LOCAL_TARGET_HEIGHT = 180;

    private static final class TextureSlotState {
      final int slotId;
      final int width;
      final int height;
      final boolean mirror;

      TextureSlotState(int slotId, int width, int height, boolean mirror) {
        this.slotId = slotId;
        this.width = width;
        this.height = height;
        this.mirror = mirror;
      }
    }

    private static final class FrameDiagnosticState {
      long lastLogAtMs;
      int frames;
      int slotUpdates;

      void reset() {
        lastLogAtMs = 0L;
        frames = 0;
        slotUpdates = 0;
      }
    }

    private final AgoraRenderEventDispatcher eventDispatcher;
    private RtcEngine rtcEngine;
    private volatile boolean localTextureRequested;
    private volatile TextureSlotState localTextureSlot;
    private final Set<Integer> remoteTextureUids = ConcurrentHashMap.newKeySet();
    private final Map<Integer, TextureSlotState> remoteTextureSlots = new ConcurrentHashMap<>();
    private final FrameDiagnosticState localFrameDiagnostic = new FrameDiagnosticState();
    private final Map<Integer, FrameDiagnosticState> remoteFrameDiagnostics = new ConcurrentHashMap<>();

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
      localFrameDiagnostic.reset();
      remoteFrameDiagnostics.clear();
    }

    @Override
    public void setupLocalVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      CocosHelper.runOnGameThread(() -> {
        localTextureRequested = true;
        ensureLocalTextureSlot(params);
        callback.onSuccess();
      });
    }

    @Override
    public void setupRemoteVideoView(Activity activity, JSONObject params, AgoraRenderResultCallback callback) {
      CocosHelper.runOnGameThread(() -> {
        int uid = params != null ? params.optInt("uid") : 0;
        remoteTextureUids.add(uid);
        ensureRemoteTextureSlot(uid, params);
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
        remoteFrameDiagnostics.remove(uid);
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
      updateTextureSlot("local", 0, slot, videoFrame, localFrameDiagnostic);
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
      updateTextureSlot("remote", uid, slot, videoFrame, getRemoteFrameDiagnostic(uid));
      return true;
    }

    private void updateTextureSlot(
        String kind,
        int uid,
        TextureSlotState slot,
        VideoFrame videoFrame,
        FrameDiagnosticState diagnostic
    ) {
      if (videoFrame == null || videoFrame.getBuffer() == null) {
        return;
      }

      diagnostic.frames++;
      VideoFrame.I420Buffer i420Buffer = null;
      try {
        final int rotation = normalizeRotation(videoFrame.getRotation());
        final boolean mirror = slot.mirror;
        i420Buffer = videoFrame.getBuffer().toI420();
        if (i420Buffer == null) {
          return;
        }
        AgoraEngineTextureSlotBridge.nativeUpdateI420Slot(
            slot.slotId,
            i420Buffer.getDataY(),
            i420Buffer.getStrideY(),
            i420Buffer.getDataU(),
            i420Buffer.getStrideU(),
            i420Buffer.getDataV(),
            i420Buffer.getStrideV(),
            i420Buffer.getWidth(),
            i420Buffer.getHeight(),
            slot.width,
            slot.height,
            rotation,
            mirror
        );
        diagnostic.slotUpdates++;
        maybeLogFrameDiagnostic(kind, uid, slot, videoFrame, diagnostic);
      } finally {
        if (i420Buffer != null) {
          i420Buffer.release();
        }
      }
    }

    private FrameDiagnosticState getRemoteFrameDiagnostic(int uid) {
      FrameDiagnosticState existing = remoteFrameDiagnostics.get(uid);
      if (existing != null) {
        return existing;
      }
      FrameDiagnosticState created = new FrameDiagnosticState();
      FrameDiagnosticState previous = remoteFrameDiagnostics.putIfAbsent(uid, created);
      return previous != null ? previous : created;
    }

    private void maybeLogFrameDiagnostic(
        String kind,
        int uid,
        TextureSlotState slot,
        VideoFrame videoFrame,
        FrameDiagnosticState diagnostic
    ) {
      long now = SystemClock.elapsedRealtime();
      if (now - diagnostic.lastLogAtMs < FRAME_DIAGNOSTIC_INTERVAL_MS) {
        return;
      }
      diagnostic.lastLogAtMs = now;
      Log.i(
          LOG_TAG,
          "engine-texture frame kind=" + kind
              + " uid=" + uid
              + " slotId=" + slot.slotId
              + " src=" + videoFrame.getBuffer().getWidth() + "x" + videoFrame.getBuffer().getHeight()
              + " dst=" + slot.width + "x" + slot.height
              + " frames=" + diagnostic.frames
              + " slotUpdates=" + diagnostic.slotUpdates
      );
      diagnostic.frames = 0;
      diagnostic.slotUpdates = 0;
    }

    private int normalizeRotation(int rotation) {
      int normalized = rotation % 360;
      if (normalized < 0) {
        normalized += 360;
      }
      if (normalized == 90 || normalized == 180 || normalized == 270) {
        return normalized;
      }
      return 0;
    }

    private void ensureLocalTextureSlot(JSONObject params) {
      int width = resolveTextureWidth(params, true);
      int height = resolveTextureHeight(params, true);
      boolean mirror = resolveMirror(params);
      if (
          localTextureSlot != null
              && localTextureSlot.width == width
              && localTextureSlot.height == height
              && localTextureSlot.mirror == mirror
      ) {
        return;
      }
      releaseLocalTextureSlot();
      localTextureSlot = createTextureSlotState(width, height, mirror);
      dispatchTextureReadyEvent(
          "localVideoTextureReady",
          0,
          localTextureSlot.slotId,
          width,
          height
      );
    }

    private void ensureRemoteTextureSlot(int uid, JSONObject params) {
      if (uid == 0) {
        return;
      }
      int width = resolveTextureWidth(params, false);
      int height = resolveTextureHeight(params, false);
      boolean mirror = resolveMirror(params);
      TextureSlotState existing = remoteTextureSlots.get(uid);
      if (existing != null && existing.width == width && existing.height == height && existing.mirror == mirror) {
        return;
      }
      releaseRemoteTextureSlot(uid);
      TextureSlotState slot = createTextureSlotState(width, height, mirror);
      remoteTextureSlots.put(uid, slot);
      dispatchTextureReadyEvent(
          "remoteVideoTextureReady",
          uid,
          slot.slotId,
          width,
          height
      );
    }

    private int resolveTextureWidth(JSONObject params, boolean local) {
      int fallback = local ? LOCAL_TARGET_WIDTH : REMOTE_TARGET_WIDTH;
      return resolvePositiveInt(params, "textureWidth", params != null ? params.optInt("width", fallback) : fallback);
    }

    private int resolveTextureHeight(JSONObject params, boolean local) {
      int fallback = local ? LOCAL_TARGET_HEIGHT : REMOTE_TARGET_HEIGHT;
      return resolvePositiveInt(params, "textureHeight", params != null ? params.optInt("height", fallback) : fallback);
    }

    private boolean resolveMirror(JSONObject params) {
      return params != null && params.optInt("mirrorMode", 0) == 1;
    }

    private int resolvePositiveInt(JSONObject params, String key, int fallback) {
      int value = params != null ? params.optInt(key, fallback) : fallback;
      return Math.max(1, value);
    }

    private TextureSlotState createTextureSlotState(int width, int height, boolean mirror) {
      int slotId = AgoraEngineTextureSlotBridge.nativeCreateSlot(width, height);
      return new TextureSlotState(slotId, width, height, mirror);
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
