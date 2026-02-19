/**
 * Sync server client for the dashboard.
 * Connects via WebSocket for real-time device events.
 */

const SYNC_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL || "http://localhost:8420";
const WS_URL = process.env.NEXT_PUBLIC_SYNC_WS_URL || "ws://localhost:8420/ws";

export interface DeviceStatus {
  device: string;
  status: string;
  last_seen: string;
  metadata?: string;
}

export interface SyncEvent {
  type: string;
  device: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ConversationRecord {
  id: string;
  device: string;
  started_at: string;
  ended_at: string;
  messages: Array<{
    role: "user" | "agent";
    text: string;
    timestamp: string;
  }>;
}

// REST calls
export async function fetchDevices(): Promise<DeviceStatus[]> {
  try {
    const res = await fetch(`${SYNC_URL}/api/devices`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchConversations(
  limit = 20
): Promise<ConversationRecord[]> {
  try {
    const res = await fetch(`${SYNC_URL}/api/conversations?limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// WebSocket
export function connectSync(
  onEvent: (event: SyncEvent) => void,
  onDevices?: (devices: DeviceStatus[]) => void
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout>;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[sync] connected");
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "initial_state" && onDevices) {
          onDevices(msg.devices);
        } else {
          onEvent(msg);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log("[sync] disconnected, reconnecting in 3s...");
      reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    clearTimeout(reconnectTimer);
    ws?.close();
  };
}
