/**
 * @ownyou/discovery - Device Discovery Package
 *
 * Provides device discovery and registration via Privy wallet identity.
 *
 * @see docs/sprints/ownyou-sprint10-spec.md
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

// Types
export type {
  Platform,
  DeviceRegistration,
  SignalingConfig,
  SignalingMessageType,
  SignalingMessage,
  DiscoveredPeer,
  NATType,
  NATDetectionResult,
  WalletProvider,
  DeviceManagerEvent,
  DeviceManager,
} from './types.js';

// Default configuration
export { DEFAULT_SIGNALING_CONFIG } from './types.js';

// Device Manager
export {
  createDeviceManager,
  type DeviceManagerConfig,
} from './device-manager.js';

// Device ID utilities
export {
  getOrCreateDeviceId,
  createDeviceIdFromWallet,
  getOrCreateDeviceSalt,
  clearDeviceId,
} from './device/device-id.js';

// Device Registration
export {
  registerDevice,
  verifyRegistrationSignature,
  getStoredRegistration,
  updateLastSeen,
  clearRegistration,
  isRegistrationValidForWallet,
} from './device/device-registration.js';

// Signaling
export {
  createSignalingClient,
  createDiscoverMessage,
  createOfferMessage,
  createAnswerMessage,
  createIceCandidateMessage,
  type SignalingClient,
  type SignalingClientEvent,
} from './signaling/signaling-client.js';

// NAT Detection
export {
  detectNATType,
  canConnectDirectly,
  getICEConfiguration,
} from './nat/nat-detection.js';

// Peer Connection
export {
  createPeerConnectionManager,
  type PeerConnectionManager,
  type PeerConnectionEvent,
} from './peer/peer-connection.js';
