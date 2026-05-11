import { CveChecker } from './scanners/cve-checker.js';
import { AuthProber } from './scanners/auth-prober.js';
import { TypoSquatDetector } from './scanners/typo-squat-detector.js';
import { SecretScanner } from './scanners/secret-scanner.js';
import { SecurityScanner } from './services/security-scanner.js';
import { CostAuditor } from './services/cost-auditor.js';
import { HealthMonitor } from './services/health-monitor.js';
import { HistoryDatabase } from './database/history-db.js';
import { PricingClient } from './clients/pricing-client.js';
import { Logger } from './utils/logger.js';

export interface Container {
  db: HistoryDatabase;
  securityScanner: SecurityScanner;
  costAuditor: CostAuditor;
  healthMonitor: HealthMonitor;
}

let startupWarningEmitted = false;

export function createContainer(dbPath?: string): Container {
  const db = new HistoryDatabase(dbPath);
  const cveChecker = new CveChecker();
  const authProber = new AuthProber();
  const typoDetector = new TypoSquatDetector();
  const secretScanner = new SecretScanner();
  const securityScanner = new SecurityScanner(cveChecker, authProber, typoDetector, secretScanner);
  const pricingClient = new PricingClient();
  const costAuditor = new CostAuditor(pricingClient, db);
  const healthMonitor = new HealthMonitor(db);

  // ── Redis-not-configured warning (once per startup) ──────
  if (!startupWarningEmitted) {
    startupWarningEmitted = true;
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      const replicaCount = parseInt(process.env['REPLICA_COUNT'] ?? '1', 10);
      const inK8s = !!process.env['KUBERNETES_SERVICE_HOST'];
      if (replicaCount > 1 || inK8s) {
        Logger.error(
          `[Container] ⛔ CRITICAL: Redis is NOT configured but running in a multi-replica or K8s environment.\n` +
            `  • Rate limits are per-pod (not enforced globally)\n` +
            `  • Session tokens issued by pod A are invalid on pod B\n` +
            `  • Replay protection is ineffective\n` +
            `  Set REDIS_URL to fix this. See docs/PRODUCTION.md#redis-ha.`
        );
        if (process.env['GUARDIAN_STRICT_MODE'] === 'true') {
          process.exit(1);
        }
      } else {
        Logger.warn(
          `[Container] Redis not configured: using in-memory rate limiting and session store. ` +
            `This is NOT suitable for multi-replica deployment.`
        );
      }
    }
  }

  return { db, securityScanner, costAuditor, healthMonitor };
}
