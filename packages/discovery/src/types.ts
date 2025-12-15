/**
 * Discovery Types - v13 Section 5.2.3
 *
 * Types for device discovery and registration via Privy wallet identity.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

/**
 * Platform type
 */
export type Platform = 'tauri' | 'pwa';

/**
 * Device registration information
 */
export interface DeviceRegistration {
  /** Unique device identifier */
  deviceId: string;
  /** Wallet address (user identity) */
  walletAddress: string;
  /** Platform type */
  platform: Platform;
  /** Registration timestamp */
  timestamp: number;
  /** Signature proving ownership */
  signature: string;
  /** Device name (user-friendly) */
  deviceName?: string;
  /** Last seen timestamp */
  lastSeen?: number;
}

/**
 * Signaling server configuration
 */
export interface SignalingConfig {
  /** WebSocket server URL */
  server: string;
  /** STUN servers for NAT traversal */
  stunServers: string[];
  /** TURN server for relay */
  turnServer?: {
    url: string;
    username: string;
    credential: string;
  };
  /** Reconnection settings */
  reconnect?: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * Default signaling configuration
 *
 * NOTE: TURN credentials are placeholders.
 * Actual credentials must be derived from wallet at runtime using
 * deriveTurnCredentials() from @ownyou/sync/encryption/wallet-encryption.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */
export const DEFAULT_SIGNALING_CONFIG: SignalingConfig = {
  server: getEnvVar('VITE_SIGNALING_ENDPOINT', 'wss://signal.ownyou.app'),
  stunServers: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
  // TURN credentials are PLACEHOLDERS - must be derived from wallet at runtime
  // Do NOT use these defaults in production - call deriveTurnCredentials() instead
  turnServer: undefined, // Must be set via createSignalingConfigWithWallet()
  reconnect: {
    maxAttempts: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  },
};

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, defaultValue: string): string {
  if (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env) {
    const viteEnv = (import.meta as { env: Record<string, string> }).env;
    if (viteEnv[key]) {
      return viteEnv[key];
    }
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return defaultValue;
}

/**
 * Create signaling config with wallet-derived TURN credentials
 *
 * This is the proper way to configure TURN - credentials are derived
 * deterministically from the wallet signature.
 *
 * @param walletAddress - User's wallet address
 * @param turnCredentials - Credentials derived from wallet via deriveTurnCredentials()
 * @returns Complete signaling configuration
 */
export function createSignalingConfigWithWallet(
  walletAddress: string,
  turnCredentials: { username: string; credential: string }
): SignalingConfig {
  return {
    ...DEFAULT_SIGNALING_CONFIG,
    turnServer: {
      url: getEnvVar('VITE_TURN_ENDPOINT', 'turn:turn.ownyou.app:443'),
      username: turnCredentials.username,
      credential: turnCredentials.credential,
    },
  };
}

/**
 * Signaling message types
 */
export type SignalingMessageType =
  | 'announce'
  | 'discover'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'leave'
  | 'ping'
  | 'pong';

/**
 * Signaling message
 */
export interface SignalingMessage {
  /** Message type */
  type: SignalingMessageType;
  /** Sender device ID */
  from: string;
  /** Target device ID (optional for broadcasts) */
  to?: string;
  /** Message payload */
  payload: unknown;
  /** Timestamp */
  timestamp: number;
  /** Signature for authentication */
  signature?: string;
}

/**
 * Discovered peer
 */
export interface DiscoveredPeer {
  /** Device registration */
  registration: DeviceRegistration;
  /** Connection state */
  connectionState: 'discovered' | 'connecting' | 'connected' | 'disconnected';
  /** RTCPeerConnection (when connected) */
  rtcConnection?: RTCPeerConnection;
  /** Data channel (when connected) */
  dataChannel?: RTCDataChannel;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * NAT type
 */
export type NATType =
  | 'open'
  | 'full_cone'
  | 'restricted_cone'
  | 'port_restricted_cone'
  | 'symmetric'
  | 'unknown';

/**
 * NAT detection result
 */
export interface NATDetectionResult {
  /** Detected NAT type */
  type: NATType;
  /** External IP address */
  externalIP?: string;
  /** External port */
  externalPort?: number;
  /** Whether TURN relay is required */
  requiresTurn: boolean;
  /** Detection timestamp */
  timestamp: number;
}

/**
 * Wallet provider interface
 */
export interface WalletProvider {
  /** Get the wallet address */
  getWalletAddress(): Promise<string>;
  /** Sign a message */
  signMessage(message: string): Promise<string>;
}

/**
 * Device manager events
 */
export type DeviceManagerEvent =
  | { type: 'device_registered'; device: DeviceRegistration }
  | { type: 'peer_discovered'; peer: DiscoveredPeer }
  | { type: 'peer_connected'; peer: DiscoveredPeer }
  | { type: 'peer_disconnected'; deviceId: string }
  | { type: 'connection_error'; error: string; deviceId?: string }
  | { type: 'signaling_connected' }
  | { type: 'signaling_disconnected' }
  | { type: 'nat_detected'; result: NATDetectionResult };

/**
 * Device manager interface
 */
export interface DeviceManager {
  /** Initialize with wallet provider */
  initialize(wallet: WalletProvider): Promise<DeviceRegistration>;
  /** Start device discovery */
  startDiscovery(): Promise<void>;
  /** Stop device discovery */
  stopDiscovery(): Promise<void>;
  /** Get current device registration */
  getDeviceRegistration(): DeviceRegistration | null;
  /** Get discovered peers */
  getPeers(): DiscoveredPeer[];
  /** Connect to a specific peer */
  connectToPeer(deviceId: string): Promise<void>;
  /** Disconnect from a peer */
  disconnectFromPeer(deviceId: string): Promise<void>;
  /** Send data to a peer */
  sendToPeer(deviceId: string, data: unknown): Promise<void>;
  /** Subscribe to events */
  subscribe(callback: (event: DeviceManagerEvent) => void): () => void;
  /** Cleanup */
  destroy(): Promise<void>;
}
