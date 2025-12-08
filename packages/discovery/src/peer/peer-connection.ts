/**
 * Peer Connection Manager - v13 Section 5.2.3
 *
 * Manages WebRTC peer connections for device-to-device sync.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

import type {
  DiscoveredPeer,
  DeviceRegistration,
  SignalingConfig,
  NATDetectionResult,
} from '../types.js';
import { getICEConfiguration } from '../nat/nat-detection.js';
import type { SignalingClient } from '../signaling/signaling-client.js';
import {
  createOfferMessage,
  createAnswerMessage,
  createIceCandidateMessage,
} from '../signaling/signaling-client.js';

/**
 * Peer connection events
 */
export type PeerConnectionEvent =
  | { type: 'connected'; peer: DiscoveredPeer }
  | { type: 'disconnected'; deviceId: string }
  | { type: 'data'; deviceId: string; data: unknown }
  | { type: 'error'; deviceId: string; error: string };

/**
 * Peer connection manager
 */
export interface PeerConnectionManager {
  /** Connect to a peer */
  connectToPeer(peer: DiscoveredPeer): Promise<void>;
  /** Disconnect from a peer */
  disconnectFromPeer(deviceId: string): void;
  /** Send data to a peer */
  sendToPeer(deviceId: string, data: unknown): void;
  /** Handle incoming signaling message */
  handleSignalingMessage(
    type: 'offer' | 'answer' | 'ice-candidate',
    from: string,
    payload: unknown
  ): Promise<void>;
  /** Subscribe to events */
  subscribe(callback: (event: PeerConnectionEvent) => void): () => void;
  /** Get active connections */
  getActiveConnections(): Map<string, DiscoveredPeer>;
  /** Cleanup all connections */
  destroy(): void;
}

/**
 * Create a peer connection manager
 */
export function createPeerConnectionManager(
  localRegistration: DeviceRegistration,
  signalingClient: SignalingClient,
  config: SignalingConfig,
  natResult: NATDetectionResult
): PeerConnectionManager {
  const connections = new Map<string, DiscoveredPeer>();
  const pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  const listeners = new Set<(event: PeerConnectionEvent) => void>();

  function emit(event: PeerConnectionEvent) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function createRTCConnection(deviceId: string): RTCPeerConnection {
    const rtcConfig = getICEConfiguration(natResult, config);
    const pc = new RTCPeerConnection(rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingClient.send(createIceCandidateMessage(deviceId, event.candidate.toJSON()));
      }
    };

    pc.onconnectionstatechange = () => {
      const peer = connections.get(deviceId);
      if (!peer) return;

      switch (pc.connectionState) {
        case 'connected':
          peer.connectionState = 'connected';
          peer.lastActivity = Date.now();
          emit({ type: 'connected', peer });
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          peer.connectionState = 'disconnected';
          emit({ type: 'disconnected', deviceId });
          break;
      }
    };

    return pc;
  }

  function setupDataChannel(deviceId: string, channel: RTCDataChannel) {
    const peer = connections.get(deviceId);
    if (!peer) return;

    peer.dataChannel = channel;

    channel.onopen = () => {
      peer.connectionState = 'connected';
      peer.lastActivity = Date.now();
    };

    channel.onclose = () => {
      peer.connectionState = 'disconnected';
      emit({ type: 'disconnected', deviceId });
    };

    channel.onerror = (event) => {
      emit({ type: 'error', deviceId, error: (event as ErrorEvent).message || 'Data channel error' });
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        peer.lastActivity = Date.now();
        emit({ type: 'data', deviceId, data });
      } catch {
        emit({ type: 'error', deviceId, error: 'Invalid message format' });
      }
    };
  }

  async function connectToPeer(peer: DiscoveredPeer): Promise<void> {
    const deviceId = peer.registration.deviceId;

    // Don't connect to self
    if (deviceId === localRegistration.deviceId) {
      return;
    }

    // Check if already connected
    const existing = connections.get(deviceId);
    if (existing && existing.connectionState === 'connected') {
      return;
    }

    // Create new connection
    peer.connectionState = 'connecting';
    const pc = createRTCConnection(deviceId);
    peer.rtcConnection = pc;
    connections.set(deviceId, peer);

    // Create data channel (initiator creates the channel)
    const channel = pc.createDataChannel('sync', {
      ordered: true,
    });
    setupDataChannel(deviceId, channel);

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await signalingClient.send(createOfferMessage(deviceId, offer));

    // Apply any pending ICE candidates
    const pending = pendingCandidates.get(deviceId);
    if (pending) {
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.delete(deviceId);
    }
  }

  function disconnectFromPeer(deviceId: string): void {
    const peer = connections.get(deviceId);
    if (!peer) return;

    if (peer.dataChannel) {
      peer.dataChannel.close();
    }

    if (peer.rtcConnection) {
      peer.rtcConnection.close();
    }

    connections.delete(deviceId);
    pendingCandidates.delete(deviceId);
  }

  function sendToPeer(deviceId: string, data: unknown): void {
    const peer = connections.get(deviceId);
    if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
      throw new Error(`Not connected to peer ${deviceId}`);
    }

    peer.dataChannel.send(JSON.stringify(data));
    peer.lastActivity = Date.now();
  }

  async function handleSignalingMessage(
    type: 'offer' | 'answer' | 'ice-candidate',
    from: string,
    payload: unknown
  ): Promise<void> {
    const typedPayload = payload as Record<string, unknown>;

    if (type === 'offer') {
      // Incoming connection request
      let peer = connections.get(from);

      if (!peer) {
        // Create new peer entry
        peer = {
          registration: {
            deviceId: from,
            walletAddress: '', // Will be filled in by signaling
            platform: 'pwa',
            timestamp: Date.now(),
            signature: '',
          },
          connectionState: 'connecting',
          lastActivity: Date.now(),
        };
      }

      const pc = createRTCConnection(from);
      peer.rtcConnection = pc;
      peer.connectionState = 'connecting';
      connections.set(from, peer);

      // Handle incoming data channel
      pc.ondatachannel = (event) => {
        setupDataChannel(from, event.channel);
      };

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(typedPayload.sdp as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await signalingClient.send(createAnswerMessage(from, answer));

      // Apply any pending ICE candidates
      const pending = pendingCandidates.get(from);
      if (pending) {
        for (const candidate of pending) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.delete(from);
      }
    } else if (type === 'answer') {
      const peer = connections.get(from);
      if (!peer || !peer.rtcConnection) {
        return;
      }

      await peer.rtcConnection.setRemoteDescription(
        new RTCSessionDescription(typedPayload.sdp as RTCSessionDescriptionInit)
      );
    } else if (type === 'ice-candidate') {
      const peer = connections.get(from);

      if (!peer || !peer.rtcConnection) {
        // Store candidate for later
        if (!pendingCandidates.has(from)) {
          pendingCandidates.set(from, []);
        }
        pendingCandidates.get(from)!.push(typedPayload.candidate as RTCIceCandidateInit);
        return;
      }

      await peer.rtcConnection.addIceCandidate(
        new RTCIceCandidate(typedPayload.candidate as RTCIceCandidateInit)
      );
    }
  }

  function subscribe(callback: (event: PeerConnectionEvent) => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function getActiveConnections(): Map<string, DiscoveredPeer> {
    return new Map(connections);
  }

  function destroy(): void {
    for (const [deviceId] of connections) {
      disconnectFromPeer(deviceId);
    }
    listeners.clear();
  }

  return {
    connectToPeer,
    disconnectFromPeer,
    sendToPeer,
    handleSignalingMessage,
    subscribe,
    getActiveConnections,
    destroy,
  };
}
