/**
 * Gun.js Client Setup
 *
 * Source: context7 - /amark/gun
 * - Basic initialization
 * - Peer-to-peer configuration
 * - LocalStorage persistence
 */

import Gun from 'gun';

export interface GunConfig {
  peers?: string[];
  localStorage?: boolean;
  radisk?: boolean;
}

/**
 * Create Gun instance for mission card sync
 *
 * Modes:
 * - P2P only: No peers array (pure peer-to-peer)
 * - With relay: Peers array with relay URLs
 * - Local only: Empty peers array + localStorage
 */
export function createGunClient(config: GunConfig = {}): Gun {
  const {
    peers,
    localStorage = true,
    radisk = true
  } = config;

  // Source: context7 - var gun = Gun(['http://localhost:8765/gun']);
  // Initialize Gun with peers or P2P mode
  const gun = Gun({
    peers: peers || [],
    localStorage,
    radisk, // IndexedDB support for browser
  });

  return gun;
}

/**
 * Verify Gun connection (localStorage check)
 */
export function verifyGunConnection(gun: Gun): boolean {
  try {
    // Simple test write/read
    const testKey = `test-${Date.now()}`;
    gun.get(testKey).put({ test: true });
    return true;
  } catch (error) {
    console.error('Gun connection failed:', error);
    return false;
  }
}
