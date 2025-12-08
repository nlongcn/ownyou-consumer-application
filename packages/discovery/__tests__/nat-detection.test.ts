/**
 * NAT Detection Tests
 */

import { describe, it, expect } from 'vitest';
import {
  canConnectDirectly,
  getICEConfiguration,
} from '../src/nat/nat-detection.js';
import type { NATType, NATDetectionResult, SignalingConfig } from '../src/types.js';

describe('NAT Detection', () => {
  describe('canConnectDirectly', () => {
    it('should return true for open NAT on both sides', () => {
      expect(canConnectDirectly('open', 'open')).toBe(true);
    });

    it('should return true for full cone NAT', () => {
      expect(canConnectDirectly('full_cone', 'full_cone')).toBe(true);
      expect(canConnectDirectly('open', 'full_cone')).toBe(true);
    });

    it('should return true for restricted cone NAT', () => {
      expect(canConnectDirectly('restricted_cone', 'restricted_cone')).toBe(true);
      expect(canConnectDirectly('full_cone', 'restricted_cone')).toBe(true);
    });

    it('should return false for symmetric NAT on both sides', () => {
      expect(canConnectDirectly('symmetric', 'symmetric')).toBe(false);
    });

    it('should return false for symmetric + port restricted', () => {
      expect(canConnectDirectly('symmetric', 'port_restricted_cone')).toBe(false);
      expect(canConnectDirectly('port_restricted_cone', 'symmetric')).toBe(false);
    });

    it('should return false for unknown NAT', () => {
      expect(canConnectDirectly('unknown', 'open')).toBe(false);
      expect(canConnectDirectly('open', 'unknown')).toBe(false);
    });
  });

  describe('getICEConfiguration', () => {
    const config: SignalingConfig = {
      server: 'wss://signal.test.com',
      stunServers: ['stun:stun.test.com:19302'],
      turnServer: {
        url: 'turn:turn.test.com:443',
        username: 'user',
        credential: 'pass',
      },
    };

    it('should include STUN servers', () => {
      const natResult: NATDetectionResult = {
        type: 'full_cone',
        requiresTurn: false,
        timestamp: Date.now(),
      };

      const iceConfig = getICEConfiguration(natResult, config);

      expect(iceConfig.iceServers).toBeDefined();
      expect(iceConfig.iceServers!.length).toBeGreaterThan(0);
      expect(iceConfig.iceServers![0].urls).toEqual(config.stunServers);
    });

    it('should include TURN server when required', () => {
      const natResult: NATDetectionResult = {
        type: 'symmetric',
        requiresTurn: true,
        timestamp: Date.now(),
      };

      const iceConfig = getICEConfiguration(natResult, config);

      expect(iceConfig.iceServers!.length).toBe(2);
      expect(iceConfig.iceServers![1].urls).toBe(config.turnServer!.url);
      expect(iceConfig.iceServers![1].username).toBe('user');
      expect(iceConfig.iceServers![1].credential).toBe('pass');
    });

    it('should use relay transport policy for symmetric NAT', () => {
      const natResult: NATDetectionResult = {
        type: 'symmetric',
        requiresTurn: true,
        timestamp: Date.now(),
      };

      const iceConfig = getICEConfiguration(natResult, config);

      expect(iceConfig.iceTransportPolicy).toBe('relay');
    });

    it('should use all transport policy for other NAT types', () => {
      const natResult: NATDetectionResult = {
        type: 'full_cone',
        requiresTurn: false,
        timestamp: Date.now(),
      };

      const iceConfig = getICEConfiguration(natResult, config);

      expect(iceConfig.iceTransportPolicy).toBe('all');
    });

    it('should not include TURN when not required', () => {
      const natResult: NATDetectionResult = {
        type: 'open',
        requiresTurn: false,
        timestamp: Date.now(),
      };

      const iceConfig = getICEConfiguration(natResult, config);

      expect(iceConfig.iceServers!.length).toBe(1);
    });
  });
});
