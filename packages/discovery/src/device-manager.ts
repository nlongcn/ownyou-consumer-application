/**
 * Device Manager - v13 Section 5.2.3
 *
 * Main orchestrator for device discovery and peer connections.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

import type {
  DeviceManager,
  DeviceManagerEvent,
  DeviceRegistration,
  DiscoveredPeer,
  SignalingConfig,
  WalletProvider,
  NATDetectionResult,
} from './types.js';
import { DEFAULT_SIGNALING_CONFIG } from './types.js';
import { registerDevice, getStoredRegistration, isRegistrationValidForWallet } from './device/device-registration.js';
import { createSignalingClient, createDiscoverMessage, type SignalingClient } from './signaling/signaling-client.js';
import { detectNATType } from './nat/nat-detection.js';
import { createPeerConnectionManager, type PeerConnectionManager } from './peer/peer-connection.js';

/**
 * Device manager configuration
 */
export interface DeviceManagerConfig {
  /** Platform type */
  platform: 'tauri' | 'pwa';
  /** Signaling configuration */
  signaling?: SignalingConfig;
  /** Auto-connect to discovered peers */
  autoConnect?: boolean;
  /** Discovery interval in ms */
  discoveryIntervalMs?: number;
}

/**
 * Create a device manager
 */
export function createDeviceManager(config: DeviceManagerConfig): DeviceManager {
  const signalingConfig = config.signaling || DEFAULT_SIGNALING_CONFIG;
  const autoConnect = config.autoConnect ?? true;
  const discoveryIntervalMs = config.discoveryIntervalMs ?? 30000;

  let wallet: WalletProvider | null = null;
  let registration: DeviceRegistration | null = null;
  let signalingClient: SignalingClient | null = null;
  let peerManager: PeerConnectionManager | null = null;
  let natResult: NATDetectionResult | null = null;

  const peers = new Map<string, DiscoveredPeer>();
  const listeners = new Set<(event: DeviceManagerEvent) => void>();
  let discoveryInterval: ReturnType<typeof setInterval> | null = null;
  let isDiscovering = false;

  function emit(event: DeviceManagerEvent) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  async function initialize(walletProvider: WalletProvider): Promise<DeviceRegistration> {
    wallet = walletProvider;
    const walletAddress = await wallet.getWalletAddress();

    // Check for existing valid registration
    const stored = getStoredRegistration();
    if (isRegistrationValidForWallet(stored, walletAddress)) {
      registration = stored!;
    } else {
      // Register new device
      registration = await registerDevice(wallet, config.platform);
    }

    emit({ type: 'device_registered', device: registration });

    // Detect NAT type
    natResult = await detectNATType(signalingConfig);
    emit({ type: 'nat_detected', result: natResult });

    // Create signaling client
    signalingClient = createSignalingClient(signalingConfig, registration, wallet);

    // Set up signaling event handling
    signalingClient.subscribe((event) => {
      if (event.type === 'connected') {
        emit({ type: 'signaling_connected' });
      } else if (event.type === 'disconnected') {
        emit({ type: 'signaling_disconnected' });
      } else if (event.type === 'message') {
        handleSignalingMessage(event.message);
      } else if (event.type === 'error') {
        emit({ type: 'connection_error', error: event.error });
      }
    });

    // Create peer connection manager
    peerManager = createPeerConnectionManager(
      registration,
      signalingClient,
      signalingConfig,
      natResult
    );

    // Set up peer event handling
    peerManager.subscribe((event) => {
      if (event.type === 'connected') {
        emit({ type: 'peer_connected', peer: event.peer });
      } else if (event.type === 'disconnected') {
        emit({ type: 'peer_disconnected', deviceId: event.deviceId });
        peers.delete(event.deviceId);
      } else if (event.type === 'error') {
        emit({ type: 'connection_error', error: event.error, deviceId: event.deviceId });
      }
    });

    return registration;
  }

  function handleSignalingMessage(message: {
    type: string;
    from: string;
    payload: unknown;
  }) {
    if (message.type === 'announce') {
      // New device announced
      const payload = message.payload as { registration: Partial<DeviceRegistration> };
      const peerRegistration: DeviceRegistration = {
        deviceId: payload.registration.deviceId || message.from,
        walletAddress: payload.registration.walletAddress || '',
        platform: payload.registration.platform || 'pwa',
        timestamp: Date.now(),
        signature: '',
        deviceName: payload.registration.deviceName,
      };

      // Only track peers with the same wallet
      if (
        registration &&
        peerRegistration.walletAddress.toLowerCase() === registration.walletAddress.toLowerCase()
      ) {
        const peer: DiscoveredPeer = {
          registration: peerRegistration,
          connectionState: 'discovered',
          lastActivity: Date.now(),
        };

        peers.set(peerRegistration.deviceId, peer);
        emit({ type: 'peer_discovered', peer });

        // Auto-connect if enabled
        if (autoConnect && peerManager) {
          peerManager.connectToPeer(peer).catch((err) => {
            emit({
              type: 'connection_error',
              error: err instanceof Error ? err.message : 'Connection failed',
              deviceId: peerRegistration.deviceId,
            });
          });
        }
      }
    } else if (message.type === 'offer' || message.type === 'answer' || message.type === 'ice-candidate') {
      // WebRTC signaling
      if (peerManager) {
        peerManager
          .handleSignalingMessage(
            message.type as 'offer' | 'answer' | 'ice-candidate',
            message.from,
            message.payload
          )
          .catch((err) => {
            emit({
              type: 'connection_error',
              error: err instanceof Error ? err.message : 'Signaling error',
              deviceId: message.from,
            });
          });
      }
    }
  }

  async function startDiscovery(): Promise<void> {
    if (!signalingClient || !registration) {
      throw new Error('Device manager not initialized');
    }

    if (isDiscovering) {
      return;
    }

    isDiscovering = true;

    // Connect to signaling server
    await signalingClient.connect();

    // Send initial discovery request
    await signalingClient.send(createDiscoverMessage(registration.walletAddress));

    // Set up periodic discovery
    discoveryInterval = setInterval(async () => {
      if (signalingClient && signalingClient.isConnected() && registration) {
        await signalingClient.send(createDiscoverMessage(registration.walletAddress));
      }
    }, discoveryIntervalMs);
  }

  async function stopDiscovery(): Promise<void> {
    isDiscovering = false;

    if (discoveryInterval) {
      clearInterval(discoveryInterval);
      discoveryInterval = null;
    }

    if (signalingClient) {
      signalingClient.disconnect();
    }
  }

  function getDeviceRegistration(): DeviceRegistration | null {
    return registration;
  }

  function getPeers(): DiscoveredPeer[] {
    return Array.from(peers.values());
  }

  async function connectToPeer(deviceId: string): Promise<void> {
    if (!peerManager) {
      throw new Error('Device manager not initialized');
    }

    const peer = peers.get(deviceId);
    if (!peer) {
      throw new Error(`Peer ${deviceId} not found`);
    }

    await peerManager.connectToPeer(peer);
  }

  async function disconnectFromPeer(deviceId: string): Promise<void> {
    if (peerManager) {
      peerManager.disconnectFromPeer(deviceId);
    }
  }

  async function sendToPeer(deviceId: string, data: unknown): Promise<void> {
    if (!peerManager) {
      throw new Error('Device manager not initialized');
    }

    peerManager.sendToPeer(deviceId, data);
  }

  function subscribe(callback: (event: DeviceManagerEvent) => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  async function destroy(): Promise<void> {
    await stopDiscovery();

    if (peerManager) {
      peerManager.destroy();
      peerManager = null;
    }

    peers.clear();
    listeners.clear();
    registration = null;
    wallet = null;
    natResult = null;
  }

  return {
    initialize,
    startDiscovery,
    stopDiscovery,
    getDeviceRegistration,
    getPeers,
    connectToPeer,
    disconnectFromPeer,
    sendToPeer,
    subscribe,
    destroy,
  };
}
