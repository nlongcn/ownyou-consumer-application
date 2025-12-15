/**
 * Endpoints Configuration - v13 Section 5.2
 *
 * Centralized endpoint configuration with environment variable support.
 * Provides default values for production while allowing overrides.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2
 */

/**
 * Endpoint configuration interface
 */
export interface EndpointsConfig {
  /** Backup service endpoint */
  backup: string;
  /** Signaling server for WebRTC */
  signaling: string;
  /** TURN server for NAT traversal */
  turn: {
    url: string;
    /** Port for TURN server */
    port: number;
  };
  /** STUN servers for peer discovery */
  stun: string[];
  /** IPFS bootstrap peers */
  ipfsBootstrap: string[];
}

/**
 * Get environment variable with fallback
 *
 * Supports both Vite (import.meta.env) and Node.js (process.env) environments.
 */
function getEnvVar(key: string, defaultValue: string): string {
  // Check Vite environment variables
  if (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env) {
    const viteEnv = (import.meta as { env: Record<string, string> }).env;
    if (viteEnv[key]) {
      return viteEnv[key];
    }
  }

  // Check Node.js environment variables
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) {
      return process.env[key];
    }
  }

  return defaultValue;
}

/**
 * Default production endpoints
 */
const DEFAULT_ENDPOINTS: EndpointsConfig = {
  backup: 'https://backup.ownyou.app/v1',
  signaling: 'wss://signal.ownyou.app',
  turn: {
    url: 'turn.ownyou.app',
    port: 443,
  },
  stun: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
  ],
  ipfsBootstrap: [
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
  ],
};

/**
 * Get configured endpoints
 *
 * Uses environment variables if available, otherwise falls back to defaults.
 *
 * Environment variables:
 * - VITE_BACKUP_ENDPOINT: Backup service URL
 * - VITE_SIGNALING_ENDPOINT: Signaling server WebSocket URL
 * - VITE_TURN_URL: TURN server hostname
 * - VITE_TURN_PORT: TURN server port
 *
 * @returns Configured endpoints
 */
export function getEndpoints(): EndpointsConfig {
  return {
    backup: getEnvVar('VITE_BACKUP_ENDPOINT', DEFAULT_ENDPOINTS.backup),
    signaling: getEnvVar('VITE_SIGNALING_ENDPOINT', DEFAULT_ENDPOINTS.signaling),
    turn: {
      url: getEnvVar('VITE_TURN_URL', DEFAULT_ENDPOINTS.turn.url),
      port: parseInt(getEnvVar('VITE_TURN_PORT', String(DEFAULT_ENDPOINTS.turn.port)), 10),
    },
    stun: DEFAULT_ENDPOINTS.stun, // STUN servers rarely need overriding
    ipfsBootstrap: DEFAULT_ENDPOINTS.ipfsBootstrap,
  };
}

/**
 * Get the full TURN server URL
 */
export function getTurnServerUrl(): string {
  const endpoints = getEndpoints();
  return `turn:${endpoints.turn.url}:${endpoints.turn.port}`;
}

/**
 * Get the backup endpoint URL
 */
export function getBackupEndpoint(): string {
  return getEndpoints().backup;
}

/**
 * Get the signaling server URL
 */
export function getSignalingEndpoint(): string {
  return getEndpoints().signaling;
}

/**
 * Check if we're running in development mode
 */
export function isDevelopment(): boolean {
  return getEnvVar('NODE_ENV', 'production') === 'development' ||
         getEnvVar('VITE_MODE', 'production') === 'development';
}

/**
 * Get test/development endpoints
 *
 * For use in testing and development environments.
 */
export function getTestEndpoints(): EndpointsConfig {
  return {
    backup: 'https://backup.test.ownyou.app/v1',
    signaling: 'wss://signal.test.ownyou.app',
    turn: {
      url: 'turn.test.ownyou.app',
      port: 443,
    },
    stun: DEFAULT_ENDPOINTS.stun,
    ipfsBootstrap: [], // No bootstrap peers for isolated testing
  };
}

/**
 * Validate endpoint configuration
 */
export function validateEndpoints(endpoints: EndpointsConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!endpoints.backup.startsWith('http')) {
    errors.push('Backup endpoint must be a valid HTTP(S) URL');
  }

  if (!endpoints.signaling.startsWith('ws')) {
    errors.push('Signaling endpoint must be a valid WebSocket URL');
  }

  if (endpoints.turn.port < 1 || endpoints.turn.port > 65535) {
    errors.push('TURN port must be between 1 and 65535');
  }

  if (endpoints.stun.length === 0) {
    errors.push('At least one STUN server is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
