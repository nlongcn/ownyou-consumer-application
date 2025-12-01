/**
 * Identity Types - v13 Section 7.x (BBS+ Stubs)
 *
 * Stub types for BBS+ pseudonymous identity system.
 * Full implementation deferred to Phase 2.
 *
 * @see docs/architecture/OwnYou_architecture_v13.md Section 7
 */

/**
 * BBS+ Pseudonym - v13 Section 7.1
 *
 * A pseudonymous identity derived from BBS+ credentials.
 * Allows selective disclosure of IAB categories without revealing identity.
 */
export interface Pseudonym {
  /** Unique identifier */
  id: string;

  // BBS+ credential components (opaque for now)
  /** Hash of the underlying credential */
  credentialHash: string;

  /** Issuer's signature on the credential */
  issuerSignature: string;

  /** Derived payment address for receiving ad revenue */
  paymentAddress: string;

  // Context
  /** When this pseudonym was created */
  createdAt: number;

  /** When this pseudonym was last used for disclosure */
  lastUsedAt?: number;
}

/**
 * Disclosure Proof - v13 Section 7.1.4
 *
 * Zero-knowledge proof of IAB category membership without revealing identity.
 */
export interface DisclosureProof {
  /** Which pseudonym this proof is for */
  pseudonymId: string;

  /** IAB category IDs being disclosed */
  disclosedAttributes: string[];

  // ZKP components (opaque for now)
  /** The zero-knowledge proof */
  proof: string;

  /** Nonce for replay protection */
  nonce: string;

  /** When this proof was generated */
  timestamp: number;

  // Verification
  /** Whether the proof has been verified */
  isValid?: boolean;
}

/**
 * Tracking ID - v13 Section 7.1.4
 *
 * Campaign-specific tracking identifier derived deterministically
 * from campaign ID and pseudonym secret.
 */
export interface TrackingId {
  /** Unique identifier */
  id: string;

  /** Associated ad campaign */
  campaignId: string;

  /** Associated pseudonym */
  pseudonymId: string;

  /** Deterministically derived tracking hash */
  trackingIdHash: string;

  /** When this tracking ID was created */
  createdAt: number;

  /** Number of ad impressions tracked */
  impressionCount: number;
}
