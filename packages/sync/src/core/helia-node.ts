/**
 * Helia Node - v13 Section 5.2.1
 *
 * Creates and manages a Helia IPFS node for OrbitDB.
 * Supports both PWA (in-browser) and Tauri (desktop) environments.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.1
 * @see https://github.com/ipfs/helia
 */

// Note: These imports will be available once dependencies are installed
// import { createHelia, type Helia } from 'helia'
// import { createLibp2p, type Libp2p } from 'libp2p'
// import { LevelBlockstore } from 'blockstore-level'
// import { MemoryBlockstore } from 'blockstore-core'

/**
 * Helia node configuration
 */
export interface HeliaNodeConfig {
  /** Platform type affects storage and networking */
  platform: 'tauri' | 'pwa';
  /** Storage directory for persistent data (Tauri only) */
  storageDir?: string;
  /** Bootstrap peers to connect to */
  bootstrapPeers?: string[];
  /** Whether to enable relay (for NAT traversal) */
  enableRelay?: boolean;
}

/**
 * Helia node interface (type-safe wrapper)
 */
export interface HeliaNode {
  /** The underlying Helia instance */
  helia: unknown; // Would be Helia type
  /** The libp2p instance for networking */
  libp2p: unknown; // Would be Libp2p type
  /** Get the node's peer ID */
  getPeerId(): string;
  /** Get multiaddrs the node is listening on */
  getMultiaddrs(): string[];
  /** Connect to a peer by multiaddr */
  connect(multiaddr: string): Promise<void>;
  /** Stop the node */
  stop(): Promise<void>;
}

/**
 * Default bootstrap peers for IPFS network
 */
export const DEFAULT_BOOTSTRAP_PEERS = [
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
];

/**
 * Create a Helia node for cross-device sync
 *
 * This function creates and initializes a Helia IPFS node configured
 * for the OwnYou sync layer. The node can run in both browser (PWA)
 * and desktop (Tauri) environments.
 *
 * @param config - Node configuration
 * @returns Configured Helia node
 *
 * @example
 * ```typescript
 * const node = await createHeliaNode({
 *   platform: 'pwa',
 *   enableRelay: true,
 * });
 *
 * console.log('Peer ID:', node.getPeerId());
 * console.log('Addresses:', node.getMultiaddrs());
 * ```
 */
export async function createHeliaNode(config: HeliaNodeConfig): Promise<HeliaNode> {
  const { platform, storageDir, bootstrapPeers = DEFAULT_BOOTSTRAP_PEERS, enableRelay = true } = config;

  // Dynamic imports to handle environment differences
  const { createHelia } = await import('helia');
  const { createLibp2p } = await import('libp2p');

  // Platform-specific blockstore
  let blockstore: unknown;

  if (platform === 'tauri' && storageDir) {
    // Persistent storage for desktop
    const { LevelBlockstore } = await import('blockstore-level');
    blockstore = new LevelBlockstore(`${storageDir}/ipfs/blocks`);
  } else {
    // In-memory for PWA (will use IndexedDB via OrbitDB)
    const { MemoryBlockstore } = await import('blockstore-core');
    blockstore = new MemoryBlockstore();
  }

  // Create libp2p with appropriate configuration
  const libp2pConfig = await getLibp2pConfig({
    platform,
    bootstrapPeers,
    enableRelay,
  });

  const libp2p = await createLibp2p(libp2pConfig);

  // Create Helia instance
  const helia = await createHelia({
    libp2p,
    blockstore: blockstore as Parameters<typeof createHelia>[0]['blockstore'],
  });

  return {
    helia,
    libp2p,

    getPeerId(): string {
      return (libp2p as { peerId: { toString(): string } }).peerId.toString();
    },

    getMultiaddrs(): string[] {
      return (libp2p as { getMultiaddrs(): Array<{ toString(): string }> })
        .getMultiaddrs()
        .map((ma) => ma.toString());
    },

    async connect(multiaddr: string): Promise<void> {
      const { multiaddr: createMultiaddr } = await import('@multiformats/multiaddr');
      const ma = createMultiaddr(multiaddr);
      await (libp2p as { dial(ma: unknown): Promise<unknown> }).dial(ma);
    },

    async stop(): Promise<void> {
      await (helia as { stop(): Promise<void> }).stop();
    },
  };
}

/**
 * Get libp2p configuration based on platform
 */
async function getLibp2pConfig(options: {
  platform: 'tauri' | 'pwa';
  bootstrapPeers: string[];
  enableRelay: boolean;
}): Promise<object> {
  const { platform, bootstrapPeers, enableRelay } = options;

  // Import transport modules
  const { webSockets } = await import('@libp2p/websockets');
  const { webRTC } = await import('@libp2p/webrtc');
  const { noise } = await import('@chainsafe/libp2p-noise');
  const { yamux } = await import('@chainsafe/libp2p-yamux');
  const { gossipsub } = await import('@chainsafe/libp2p-gossipsub');
  const { identify } = await import('@libp2p/identify');
  const { bootstrap } = await import('@libp2p/bootstrap');

  const transports = [webSockets(), webRTC()];
  const connectionEncrypters = [noise()];
  const streamMuxers = [yamux()];

  const peerDiscovery = bootstrapPeers.length > 0 ? [bootstrap({ list: bootstrapPeers })] : [];

  const config: Record<string, unknown> = {
    transports,
    connectionEncrypters,
    streamMuxers,
    peerDiscovery,
    services: {
      identify: identify(),
      pubsub: gossipsub(),
    },
  };

  // Add relay for NAT traversal
  if (enableRelay) {
    const { circuitRelayTransport } = await import('@libp2p/circuit-relay-v2');
    (config.transports as unknown[]).push(circuitRelayTransport());
  }

  // Tauri-specific configuration
  if (platform === 'tauri') {
    const { tcp } = await import('@libp2p/tcp');
    (config.transports as unknown[]).push(tcp());

    config.addresses = {
      listen: ['/ip4/0.0.0.0/tcp/0', '/ip4/0.0.0.0/tcp/0/ws'],
    };
  } else {
    // PWA - browser environment
    config.addresses = {
      listen: ['/webrtc'],
    };
  }

  return config;
}

/**
 * Check if Helia/IPFS dependencies are available
 */
export async function checkHeliaAvailability(): Promise<{
  available: boolean;
  missingDeps: string[];
}> {
  const requiredDeps = ['helia', 'libp2p', '@chainsafe/libp2p-gossipsub'];
  const missingDeps: string[] = [];

  for (const dep of requiredDeps) {
    try {
      await import(dep);
    } catch {
      missingDeps.push(dep);
    }
  }

  return {
    available: missingDeps.length === 0,
    missingDeps,
  };
}
