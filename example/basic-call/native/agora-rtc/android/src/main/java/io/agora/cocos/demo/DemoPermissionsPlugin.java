package io.agora.cocos.demo;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import com.cocos.lib.GlobalObject;
import com.cocos.lib.JsbBridgeWrapper;

public final class DemoPermissionsPlugin {
    private static final String REQUEST_EVENT = "demo:permissions:request";
    private static final String RESPONSE_EVENT = "demo:permissions:response";
    private static final int DEMO_PERMISSION_REQUEST_CODE = 9110;
    private static final DemoPermissionsPlugin INSTANCE = new DemoPermissionsPlugin();

    private boolean attached;
    private PendingPermissionRequest pendingRequest;

    public static DemoPermissionsPlugin getInstance() {
        return INSTANCE;
    }

    public void attachBridge() {
        if (attached) {
            return;
        }
        attached = true;
        JsbBridgeWrapper.getInstance().addScriptEventListener(REQUEST_EVENT, payload -> {
            try {
                handleScriptRequest(payload);
            } catch (JSONException error) {
                dispatchError("", "Invalid demo permission payload: " + error.getMessage());
            } catch (Exception error) {
                dispatchError("", "Demo permission request failed: " + error.getMessage());
            }
        });
    }

    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != DEMO_PERMISSION_REQUEST_CODE || pendingRequest == null) {
            return;
        }

        PendingPermissionRequest currentRequest = pendingRequest;
        pendingRequest = null;

        boolean granted = grantResults != null
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;

        if (granted) {
            dispatchOk(currentRequest.requestId);
            return;
        }

        dispatchError(currentRequest.requestId, requiredPermissionMessage(currentRequest.permission));
    }

    private void handleScriptRequest(String payload) throws JSONException {
        JSONObject request = new JSONObject(payload);
        String requestId = request.optString("requestId");
        String permission = request.optString("permission");

        if (!"camera".equals(permission) && !"microphone".equals(permission)) {
            dispatchError(requestId, "Unsupported demo permission: " + permission);
            return;
        }

        ensurePermission(requestId, permission);
    }

    private void ensurePermission(String requestId, String permission) {
        Activity activity = requireActivity(requestId);
        if (activity == null) {
            return;
        }

        if (hasPermission(activity, permission)) {
            dispatchOk(requestId);
            return;
        }

        if (pendingRequest != null) {
            dispatchError(requestId, "Another demo permission request is already in flight.");
            return;
        }

        pendingRequest = new PendingPermissionRequest(requestId, permission);
        activity.runOnUiThread(() ->
                activity.requestPermissions(
                        new String[] { androidPermission(permission) },
                        DEMO_PERMISSION_REQUEST_CODE
                )
        );
    }

    private Activity requireActivity(String requestId) {
        Activity activity = GlobalObject.getActivity();
        if (activity == null) {
            dispatchError(requestId, "Android activity is unavailable.");
        }
        return activity;
    }

    private boolean hasPermission(Activity activity, String permission) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }
        return activity.checkSelfPermission(androidPermission(permission)) == PackageManager.PERMISSION_GRANTED;
    }

    private String androidPermission(String permission) {
        return "camera".equals(permission) ? Manifest.permission.CAMERA : Manifest.permission.RECORD_AUDIO;
    }

    private String requiredPermissionMessage(String permission) {
        return "camera".equals(permission)
                ? "Camera permission is required."
                : "Microphone permission is required.";
    }

    private void dispatchOk(String requestId) {
        dispatchResponse(requestId, true, null);
    }

    private void dispatchError(String requestId, String message) {
        dispatchResponse(requestId, false, message);
    }

    private void dispatchResponse(String requestId, boolean ok, String message) {
        try {
            JSONObject response = new JSONObject();
            response.put("requestId", requestId);
            response.put("ok", ok);
            if (message != null) {
                JSONObject error = new JSONObject();
                error.put("message", message);
                response.put("error", error);
            }
            JsbBridgeWrapper.getInstance().dispatchEventToScript(RESPONSE_EVENT, response.toString());
        } catch (JSONException ignored) {
            // Ignore JSON serialization failures for demo-only permission responses.
        }
    }

    private static final class PendingPermissionRequest {
        private final String requestId;
        private final String permission;

        private PendingPermissionRequest(String requestId, String permission) {
            this.requestId = requestId;
            this.permission = permission;
        }
    }
}
