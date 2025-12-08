/**
 * NAT Detection - v13 Section 5.2.3
 *
 * Detects NAT type to determine if TURN relay is needed.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 5.2.3
 */

import type { NATType, NATDetectionResult, SignalingConfig } from '../types.js';

/**
 * Detect NAT type using STUN servers
 *
 * NAT types and their P2P implications:
 * - open: Direct connection possible
 * - full_cone: P2P usually works
 * - restricted_cone: P2P usually works with proper timing
 * - port_restricted_cone: P2P works but may need STUN
 * - symmetric: P2P difficult, TURN likely required
 */
export async function detectNATType(config: SignalingConfig): Promise<NATDetectionResult> {
  const startTime = Date.now();

  try {
    // Create RTCPeerConnection with STUN servers
    const rtcConfig: RTCConfiguration = {
      iceServers: config.stunServers.map((url) => ({ urls: url })),
    };

    const pc = new RTCPeerConnection(rtcConfig);
    const candidates: RTCIceCandidate[] = [];

    // Collect ICE candidates
    const candidatePromise = new Promise<void>((resolve) => {
      let gatheringTimeout: ReturnType<typeof setTimeout>;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          candidates.push(event.candidate);
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(gatheringTimeout);
          resolve();
        }
      };

      // Timeout after 5 seconds
      gatheringTimeout = setTimeout(resolve, 5000);
    });

    // Create data channel to trigger ICE gathering
    pc.createDataChannel('nat-detection');

    // Create and set local description
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering
    await candidatePromise;

    // Analyze candidates
    const result = analyzeNATFromCandidates(candidates);

    // Cleanup
    pc.close();

    return {
      ...result,
      timestamp: startTime,
    };
  } catch {
    return {
      type: 'unknown',
      requiresTurn: true,
      timestamp: startTime,
    };
  }
}

/**
 * Analyze NAT type from ICE candidates
 */
function analyzeNATFromCandidates(
  candidates: RTCIceCandidate[]
): Omit<NATDetectionResult, 'timestamp'> {
  const srflxCandidates = candidates.filter((c) => c.type === 'srflx');
  const hostCandidates = candidates.filter((c) => c.type === 'host');
  const relayCandidates = candidates.filter((c) => c.type === 'relay');

  // If we have host candidates and they're public IPs, we're open
  const hasPublicHost = hostCandidates.some((c) => isPublicIP(c.address || ''));
  if (hasPublicHost) {
    const candidate = hostCandidates.find((c) => isPublicIP(c.address || ''));
    return {
      type: 'open',
      externalIP: candidate?.address || undefined,
      externalPort: candidate?.port || undefined,
      requiresTurn: false,
    };
  }

  // Analyze server reflexive candidates
  if (srflxCandidates.length > 0) {
    const uniqueExternalPorts = new Set(srflxCandidates.map((c) => c.port));
    const uniqueRelatedPorts = new Set(
      srflxCandidates.map((c) => c.relatedPort).filter(Boolean)
    );

    // If external ports match related ports, likely full cone
    const srflx = srflxCandidates[0];
    const portPreserved = srflx.port === srflx.relatedPort;

    if (portPreserved) {
      return {
        type: 'full_cone',
        externalIP: srflx.address || undefined,
        externalPort: srflx.port || undefined,
        requiresTurn: false,
      };
    }

    // If we see consistent port mapping, likely restricted cone
    if (uniqueExternalPorts.size === uniqueRelatedPorts.size) {
      return {
        type: 'restricted_cone',
        externalIP: srflx.address || undefined,
        externalPort: srflx.port || undefined,
        requiresTurn: false,
      };
    }

    // Multiple different ports suggest port restricted or symmetric
    if (uniqueExternalPorts.size > 1) {
      // Likely symmetric NAT
      return {
        type: 'symmetric',
        externalIP: srflx.address || undefined,
        requiresTurn: true,
      };
    }

    // Default to port restricted cone
    return {
      type: 'port_restricted_cone',
      externalIP: srflx.address || undefined,
      externalPort: srflx.port || undefined,
      requiresTurn: false,
    };
  }

  // Only relay candidates means very restrictive NAT
  if (relayCandidates.length > 0 && srflxCandidates.length === 0) {
    return {
      type: 'symmetric',
      requiresTurn: true,
    };
  }

  return {
    type: 'unknown',
    requiresTurn: true,
  };
}

/**
 * Check if an IP address is public (not private/reserved)
 */
function isPublicIP(ip: string): boolean {
  if (!ip) return false;

  // IPv4 private ranges
  if (ip.startsWith('10.')) return false;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    if (second >= 16 && second <= 31) return false;
  }
  if (ip.startsWith('192.168.')) return false;
  if (ip.startsWith('127.')) return false;
  if (ip.startsWith('169.254.')) return false;

  // IPv6 private ranges
  if (ip.startsWith('::1')) return false;
  if (ip.startsWith('fe80:')) return false;
  if (ip.startsWith('fc00:')) return false;
  if (ip.startsWith('fd00:')) return false;

  return true;
}

/**
 * Check if P2P connection is likely to work based on NAT types
 */
export function canConnectDirectly(localNAT: NATType, remoteNAT: NATType): boolean {
  // Symmetric NAT on both sides is very difficult
  if (localNAT === 'symmetric' && remoteNAT === 'symmetric') {
    return false;
  }

  // Symmetric NAT paired with port restricted is difficult
  if (
    (localNAT === 'symmetric' && remoteNAT === 'port_restricted_cone') ||
    (localNAT === 'port_restricted_cone' && remoteNAT === 'symmetric')
  ) {
    return false;
  }

  // Unknown means we can't determine - be conservative
  if (localNAT === 'unknown' || remoteNAT === 'unknown') {
    return false;
  }

  // Most other combinations should work
  return true;
}

/**
 * Get recommended ICE configuration based on NAT type
 */
export function getICEConfiguration(
  natResult: NATDetectionResult,
  config: SignalingConfig
): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: config.stunServers },
  ];

  // Add TURN server if NAT requires it
  if (natResult.requiresTurn && config.turnServer) {
    iceServers.push({
      urls: config.turnServer.url,
      username: config.turnServer.username,
      credential: config.turnServer.credential,
    });
  }

  return {
    iceServers,
    // Use relay for symmetric NAT
    iceTransportPolicy: natResult.type === 'symmetric' ? 'relay' : 'all',
  };
}
