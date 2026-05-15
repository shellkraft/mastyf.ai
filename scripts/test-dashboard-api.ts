import { startDashboardServer, setDashboardDataSource } from '../src/utils/dashboard-server.js';
import { HistoryDatabase } from '../src/database/history-db.js';

process.env['DASHBOARD_ENABLED'] = 'true';
process.env['DASHBOARD_AUTH_ENABLED'] = 'false';

const db = new HistoryDatabase();

// Seed real data so APIs return actual values
await db.addSecurityScan('echo-test', 85, 2, {
  cves: [{ severity: 'HIGH', id: 'CVE-2024-001' }, { severity: 'MEDIUM', id: 'CVE-2024-002' }],
  authStatus: { hasAuthentication: false },
});
await db.addCostRecord('echo-test', 50000, 0.0125);
await db.addHealthCheck('echo-test', 45, true, 3);
await db.addHealthCheck('echo-test', 52, true, 3);
await db.addHealthCheck('echo-test', 38, true, 3);

setDashboardDataSource(db);
const { server } = await startDashboardServer(4000);
console.log('Dashboard ready on :4000 with seeded data');
console.log('Press Ctrl+C to stop...');

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });