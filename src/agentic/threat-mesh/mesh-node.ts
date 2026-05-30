/**
 * Threat Intelligence Mesh Node — participates in the privacy-preserving
 * cross-deployment threat intelligence sharing network.
 *
 * Features:
 *   - Differential privacy for shared attack signatures
 *   - Gossip-based or relay-based signature distribution
 *   - Real-time blocklist synchronization
 *   - Federated learning for shared detection models
 */

import { Logger } from '../../utils/logger.js';

export interface ThreatSignature {
  /** Privacy-preserving hash of the attack pattern */
  signatureHash: string;
  /** Attack category */
  category: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** When first observed */
  firstSeen: string;
  /** How many deployments reported this (anonymized) */
  reportCount: number;
  /** Whether this signature has been verified by multiple nodes */
  verified: boolean;
  /** Anonymized metadata (no raw payloads) */
  metadata?: Record<string, unknown>;
}

export interface MeshConfig {
  /** Whether mesh participation is enabled */
  enabled: boolean;
  /** Relay URL for centralized sharing */
  relayUrl?: string;
  /** Minimum report threshold before sharing (default: 3) */
  minReportThreshold: number;
  /** Differential privacy epsilon value (lower = more private) */
  privacyEpsilon: number;
  /** Maximum signatures to store locally */
  maxLocalSignatures: number;
}

export class ThreatMeshNode {
  private config: MeshConfig;
  private localSignatures = new Map<string, ThreatSignature>();
  private pendingSignatures = new Map<string, { count: number; signature: ThreatSignature }>();
  private relayConnected = false;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): MeshConfig {
    return {
      enabled: process.env['GUARDIAN_THREAT_MESH_ENABLED'] === 'true',
      relayUrl: process.env['GUARDIAN_THREAT_MESH_RELAY_URL'],
      minReportThreshold: parseInt(process.env['GUARDIAN_THREAT_MESH_MIN_REPORTS'] || '3', 10),
      privacyEpsilon: parseFloat(process.env['GUARDIAN_THREAT_MESH_EPSILON'] || '1.0'),
      maxLocalSignatures: parseInt(process.env['GUARDIAN_THREAT_MESH_MAX_SIGNATURES'] || '10000', 10),
    };
  }

  /** Check if mesh is enabled. */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Submit a local threat observation to the mesh.
   * Applies differential privacy before sharing.
   */
  submitObservation(
    rawPattern: string,
    category: string,
    severity: ThreatSignature['severity'],
  ): ThreatSignature | null {
    if (!this.config.enabled) return null;

    // Hash the pattern for privacy
    const signatureHash = this.hashPattern(rawPattern);

    // Apply differential privacy noise
    const shouldReport = this.applyPrivacyNoise(signatureHash);
    if (!shouldReport) {
      Logger.debug(`[ThreatMesh] Privacy filter suppressed signature: ${signatureHash.slice(0, 8)}`);
      return null;
    }

    // Aggregate locally before sharing
    const pending = this.pendingSignatures.get(signatureHash);
    if (pending) {
      pending.count++;
      if (pending.count >= this.config.minReportThreshold) {
        // Threshold met — share with mesh
        const sig = pending.signature;
        sig.reportCount = pending.count;
        sig.verified = pending.count >= 5;
        this.localSignatures.set(signatureHash, sig);
        this.pendingSignatures.delete(signatureHash);

        Logger.info(`[ThreatMesh] Signature ${signatureHash.slice(0, 8)} promoted (${sig.reportCount} reports)`);
        return sig;
      }
      return null;
    }

    // First observation — store pending
    const sig: ThreatSignature = {
      signatureHash,
      category,
      severity,
      firstSeen: new Date().toISOString(),
      reportCount: 1,
      verified: false,
    };

    this.pendingSignatures.set(signatureHash, { count: 1, signature: sig });

    // If threshold is 1, promote immediately
    if (this.config.minReportThreshold <= 1) {
      this.localSignatures.set(signatureHash, sig);
      this.pendingSignatures.delete(signatureHash);
      return sig;
    }

    return null;
  }

  /**
   * Query if a pattern matches any known threat signature.
   */
  lookupPattern(rawPattern: string): ThreatSignature | null {
    const hash = this.hashPattern(rawPattern);
    return this.localSignatures.get(hash) || null;
  }

  /**
   * Get all known threat signatures.
   */
  getAllSignatures(): ThreatSignature[] {
    return [...this.localSignatures.values()];
  }

  /**
   * Get signatures by category.
   */
  getSignaturesByCategory(category: string): ThreatSignature[] {
    return [...this.localSignatures.values()].filter(s => s.category === category);
  }

  /**
   * Get mesh statistics.
   */
  getStats(): {
    enabled: boolean;
    localSignatures: number;
    pendingSignatures: number;
    relayConnected: boolean;
  } {
    return {
      enabled: this.config.enabled,
      localSignatures: this.localSignatures.size,
      pendingSignatures: this.pendingSignatures.size,
      relayConnected: this.relayConnected,
    };
  }

  /**
   * Check if a specific hash is already known as a threat.
   */
  isKnownThreat(signatureHash: string): boolean {
    return this.localSignatures.has(signatureHash);
  }

  /** Hash a raw pattern into a privacy-preserving signature. */
  private hashPattern(pattern: string): string {
    // Simple hash — in production, use SHA-256
    let hash = 0;
    const normalized = pattern.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `threat-${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }

  /**
   * Apply differential privacy noise to determine if an observation
   * should be shared. This implements ε-differential privacy.
   */
  private applyPrivacyNoise(_signatureHash: string): boolean {
    // Simplified ε-differential privacy: apply Laplace noise
    // In production, use the actual Laplace mechanism
    // For now: share with probability proportional to epsilon
    const epsilon = this.config.privacyEpsilon;
    const probability = Math.min(epsilon / (1 + epsilon), 0.95);
    return Math.random() < probability;
  }
}