import { native } from 'cc';

type DemoPermissionName = 'camera' | 'microphone';

type DemoPermissionRequest = {
  requestId: string;
  permission: DemoPermissionName;
};

type DemoPermissionResponse = {
  requestId: string;
  ok: boolean;
  error?: {
    message?: string;
  };
};

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: () => void;
  timer: ReturnType<typeof setTimeout>;
};

const REQUEST_EVENT = 'demo:permissions:request';
const RESPONSE_EVENT = 'demo:permissions:response';
const REQUEST_TIMEOUT_MS = 20_000;

let requestCounter = 0;

function createRequestId(): string {
  requestCounter += 1;
  return `demo-permission-${Date.now()}-${requestCounter}`;
}

class DemoPermissionsClient {
  private readonly pending = new Map<string, PendingRequest>();
  private listenerAttached = false;

  private readonly responseListener = (payload: string) => {
    this.handleResponse(payload);
  };

  async ensureCameraPermission(): Promise<void> {
    await this.ensurePermission('camera');
  }

  async ensureMicrophonePermission(): Promise<void> {
    await this.ensurePermission('microphone');
  }

  private ensureBridgeListener(): void {
    if (this.listenerAttached) {
      return;
    }
    const transport = this.requireTransport();
    transport.addNativeEventListener?.(RESPONSE_EVENT, this.responseListener);
    this.listenerAttached = true;
  }

  private ensurePermission(permission: DemoPermissionName): Promise<void> {
    this.ensureBridgeListener();
    const transport = this.requireTransport();
    const requestId = createRequestId();
    const payload: DemoPermissionRequest = { requestId, permission };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timed out waiting for demo ${permission} permission response.`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });
      transport.dispatchEventToNative?.(REQUEST_EVENT, JSON.stringify(payload));
    });
  }

  private handleResponse(payload: string): void {
    let response: DemoPermissionResponse;
    try {
      response = JSON.parse(payload) as DemoPermissionResponse;
    } catch {
      return;
    }

    const pending = this.pending.get(response.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(response.requestId);

    if (response.ok) {
      pending.resolve();
      return;
    }

    pending.reject(new Error(response.error?.message ?? 'Demo permission request failed.'));
  }

  private requireTransport() {
    const transport = native.jsbBridgeWrapper;
    if (
      !transport ||
      typeof transport.dispatchEventToNative !== 'function' ||
      typeof transport.addNativeEventListener !== 'function'
    ) {
      throw new Error('Demo permissions require a native JSB bridge transport.');
    }
    return transport;
  }
}

const demoPermissionsClient = new DemoPermissionsClient();

export function ensureCameraPermission(): Promise<void> {
  return demoPermissionsClient.ensureCameraPermission();
}

export function ensureMicrophonePermission(): Promise<void> {
  return demoPermissionsClient.ensureMicrophonePermission();
}
