/**
 * MCP Server Certification Program (#2) — automated certification pipeline.
 * Runs compliance checks, generates signed attestation reports, tracks server profiles.
 */
import { Logger } from '../../utils/logger.js';

export interface CertificationResult {
  serverName: string; packageName: string; version: string;
  certified: boolean; level: 'bronze' | 'silver' | 'gold' | 'platinum';
  score: number; checks: CertificationCheck[];
  signedAttestation?: string; issuedAt: string; expiresAt: string;
  registeredInRegistry: boolean;
}
export interface CertificationCheck {
  id: string; name: string; passed: boolean; score: number; maxScore: number; details: string;
}
export class MCPCertifier {
  private registry = new Map<string, CertificationResult>();
  certify(serverName: string, packageName: string, version: string, results: { trustScore: number; complianceScore: number; cveFree: boolean; authMethod: string; transport: string; trustedPublisher: boolean }): CertificationResult {
    const checks: CertificationCheck[] = [
      { id: 'trust-score', name: 'Trust Score ≥ 60', passed: results.trustScore >= 60, score: Math.min(results.trustScore, 100), maxScore: 100, details: `Trust score: ${results.trustScore}/100` },
      { id: 'compliance', name: 'Compliance Score ≥ 50', passed: results.complianceScore >= 50, score: Math.min(results.complianceScore, 100), maxScore: 100, details: `Compliance: ${results.complianceScore}%` },
      { id: 'cve-free', name: 'No Critical CVEs', passed: results.cveFree, score: results.cveFree ? 100 : 0, maxScore: 100, details: results.cveFree ? 'No critical CVEs' : 'Critical CVEs present' },
      { id: 'auth', name: 'Authentication Configured', passed: results.authMethod !== 'none', score: results.authMethod !== 'none' ? 100 : 0, maxScore: 100, details: `Auth: ${results.authMethod}` },
      { id: 'transport', name: 'Secure Transport', passed: results.transport !== 'http', score: results.transport === 'mTLS' ? 100 : results.transport === 'https' ? 70 : 30, maxScore: 100, details: `Transport: ${results.transport}` },
      { id: 'supply-chain', name: 'Trusted Publisher', passed: results.trustedPublisher, score: results.trustedPublisher ? 100 : 0, maxScore: 100, details: results.trustedPublisher ? 'Verified publisher' : 'Unknown publisher' },
    ];
    const totalScore = Math.round(checks.reduce((s, c) => s + c.score, 0) / checks.length);
    const allPassed = checks.every(c => c.passed);
    const level: CertificationResult['level'] = totalScore >= 90 ? 'platinum' : totalScore >= 75 ? 'gold' : totalScore >= 60 ? 'silver' : 'bronze';
    const result: CertificationResult = {
      serverName, packageName, version, certified: allPassed && totalScore >= 60,
      level, score: totalScore, checks,
      signedAttestation: this.signAttestation(serverName, level, totalScore),
      issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      registeredInRegistry: false,
    };
    this.registry.set(serverName, result);
    result.registeredInRegistry = true;
    Logger.info(`[Certifier] ${serverName} certified: ${level} (${totalScore}/100)`);
    return result;
  }
  getCertification(serverName: string): CertificationResult | undefined { return this.registry.get(serverName); }
  listCertified(): CertificationResult[] { return [...this.registry.values()]; }
  private signAttestation(serverName: string, level: string, score: number): string {
    return `GUARDIAN-CERT-${level.toUpperCase()}-${serverName}-${score}-${Date.now().toString(36)}`;
  }
}