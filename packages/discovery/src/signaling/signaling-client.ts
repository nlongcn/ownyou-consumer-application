/**
 * Signaling Client - v13 Section 5.2.3
 *
 * WebSocket client for device discovery signaling.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

import type {
  SignalingConfig,
  SignalingMessage,
  SignalingMessageType,
  DeviceRegistration,
  WalletProvider,
} from '../types.js';

/**
 * Signaling client events
 */
export type SignalingClientEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; reason?: string }
  | { type: 'message'; message: SignalingMessage }
  | { type: 'error'; error: string };

/**
 * Signaling client interface
 */
export interface SignalingClient {
  /** Connect to signaling server */
  connect(): Promise<void>;
  /** Disconnect from signaling server */
  disconnect(): void;
  /** Send a message */
  send(message: Omit<SignalingMessage, 'from' | 'timestamp'>): Promise<void>;
  /** Subscribe to events */
  subscribe(callback: (event: SignalingClientEvent) => void): () => void;
  /** Check if connected */
  isConnected(): boolean;
}

/**
 * Create a signaling client
 */
export function createSignalingClient(
  config: SignalingConfig,
  registration: DeviceRegistration,
  wallet: WalletProvider
): SignalingClient {
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(event: SignalingClientEvent) => void>();

  function emit(event: SignalingClientEvent) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function calculateReconnectDelay(): number {
    const reconnect = config.reconnect || { baseDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 5 };
    const delay = Math.min(
      reconnect.baseDelayMs * Math.pow(2, reconnectAttempts),
      reconnect.maxDelayMs
    );
    // Add jitter (±25%)
    return delay * (0.75 + Math.random() * 0.5);
  }

  function startPingTimer() {
    stopPingTimer();
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        sendRaw({
          type: 'ping',
          payload: { timestamp: Date.now() },
        });
      }
    }, 30000);
  }

  function stopPingTimer() {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  }

  async function sendRaw(
    message: Omit<SignalingMessage, 'from' | 'timestamp' | 'signature'>
  ): Promise<void> {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to signaling server');
    }

    const fullMessage: SignalingMessage = {
      ...message,
      from: registration.deviceId,
      timestamp: Date.now(),
    };

    // Sign important messages
    if (['announce', 'offer', 'answer'].includes(message.type)) {
      const messageStr = JSON.stringify({
        type: fullMessage.type,
        from: fullMessage.from,
        to: fullMessage.to,
        timestamp: fullMessage.timestamp,
      });
      fullMessage.signature = await wallet.signMessage(messageStr);
    }

    ws.send(JSON.stringify(fullMessage));
  }

  async function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(config.server);

        ws.onopen = async () => {
          reconnectAttempts = 0;

          // Announce ourselves
          await sendRaw({
            type: 'announce',
            payload: {
              registration: {
                deviceId: registration.deviceId,
                walletAddress: registration.walletAddress,
                platform: registration.platform,
                deviceName: registration.deviceName,
              },
            },
          });

          startPingTimer();
          emit({ type: 'connected' });
          resolve();
        };

        ws.onclose = (event) => {
          stopPingTimer();
          emit({ type: 'disconnected', reason: event.reason || 'Connection closed' });
          scheduleReconnect();
        };

        ws.onerror = () => {
          emit({ type: 'error', error: 'WebSocket error' });
          reject(new Error('WebSocket connection failed'));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as SignalingMessage;

            // Handle pong internally
            if (message.type === 'pong') {
              return;
            }

            emit({ type: 'message', message });
          } catch {
            emit({ type: 'error', error: 'Invalid message format' });
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  function scheduleReconnect() {
    const reconnect = config.reconnect || { maxAttempts: 5 };

    if (reconnectAttempts >= reconnect.maxAttempts) {
      emit({ type: 'error', error: 'Max reconnection attempts reached' });
      return;
    }

    const delay = calculateReconnectDelay();
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      connect().catch(() => {
        // Error will trigger another reconnect via onclose/onerror
      });
    }, delay);
  }

  function disconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    stopPingTimer();
    reconnectAttempts = Infinity; // Prevent reconnection

    if (ws) {
      // Send leave message before closing
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: 'leave',
              from: registration.deviceId,
              timestamp: Date.now(),
              payload: {},
            })
          );
        } catch {
          // Ignore errors when sending leave message
        }
      }

      ws.close();
      ws = null;
    }
  }

  async function send(message: Omit<SignalingMessage, 'from' | 'timestamp'>): Promise<void> {
    await sendRaw(message);
  }

  function subscribe(callback: (event: SignalingClientEvent) => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function isConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
  }

  return {
    connect,
    disconnect,
    send,
    subscribe,
    isConnected,
  };
}

/**
 * Create a message to discover devices for a wallet
 */
export function createDiscoverMessage(walletAddress: string): Omit<SignalingMessage, 'from' | 'timestamp'> {
  return {
    type: 'discover' as SignalingMessageType,
    payload: { walletAddress },
  };
}

/**
 * Create an SDP offer message
 */
export function createOfferMessage(
  targetDeviceId: string,
  sdp: RTCSessionDescriptionInit
): Omit<SignalingMessage, 'from' | 'timestamp'> {
  return {
    type: 'offer' as SignalingMessageType,
    to: targetDeviceId,
    payload: { sdp },
  };
}

/**
 * Create an SDP answer message
 */
export function createAnswerMessage(
  targetDeviceId: string,
  sdp: RTCSessionDescriptionInit
): Omit<SignalingMessage, 'from' | 'timestamp'> {
  return {
    type: 'answer' as SignalingMessageType,
    to: targetDeviceId,
    payload: { sdp },
  };
}

/**
 * Create an ICE candidate message
 */
export function createIceCandidateMessage(
  targetDeviceId: string,
  candidate: RTCIceCandidateInit
): Omit<SignalingMessage, 'from' | 'timestamp'> {
  return {
    type: 'ice-candidate' as SignalingMessageType,
    to: targetDeviceId,
    payload: { candidate },
  };
}
