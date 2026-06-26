#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';

const requiredFiles = [
  'docs/COMPLIANCE.md',
  'docs/ENTERPRISE_DEPLOYMENT.md',
  'README.md',
];

const requiredPhrases = [
  { file: 'docs/COMPLIANCE.md', phrase: 'Policy integrity and provenance' },
  { file: 'docs/COMPLIANCE.md', phrase: 'Dual-control policy governance' },
  { file: 'docs/ENTERPRISE_DEPLOYMENT.md', phrase: 'Signed policy governance' },
  { file: 'docs/ENTERPRISE_DEPLOYMENT.md', phrase: 'Four-eyes policy updates' },
];

const missing = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) missing.push(`missing file: ${file}`);
}

for (const check of requiredPhrases) {
  if (!existsSync(check.file)) continue;
  const text = readFileSync(check.file, 'utf-8');
  if (!text.includes(check.phrase)) {
    missing.push(`missing phrase '${check.phrase}' in ${check.file}`);
  }
}

const proxyTraceImport = readFileSync('src/proxy/trace-context.ts', 'utf-8');
if (!proxyTraceImport.includes('injectTraceHeaders')) {
  missing.push('trace-context.ts must wire injectTraceHeaders');
}

const httpProxy = readFileSync('src/proxy/http-proxy-server.ts', 'utf-8');
if (!httpProxy.includes("from './trace-context.js'")) {
  missing.push('http-proxy-server.ts must import trace-context helpers');
}

const promRule = readFileSync('deploy/helm/mastyf-ai/templates/prometheusrule.yaml', 'utf-8');
if (promRule.includes('mastyf_ai_proxy_requests_total')) {
  missing.push('PrometheusRule must use mastyf_ai_requests_total (not proxy_requests_total)');
}
if (!promRule.includes('mastyf_ai_requests_total')) {
  missing.push('PrometheusRule must reference mastyf_ai_requests_total');
}

const metricsTs = readFileSync('src/utils/metrics.ts', 'utf-8');
for (const gauge of ['mastyf_ai_redis_available', 'mastyf_ai_semantic_llm_online', 'mastyf_ai_audit_queue_depth', 'mastyf_ai_alerting_configured', 'mastyf_ai_tracing_configured']) {
  if (!metricsTs.includes(gauge)) {
    missing.push(`metrics.ts must export gauge ${gauge}`);
  }
}

if (!existsSync('src/alerting/alert-env.ts')) {
  missing.push('missing file: src/alerting/alert-env.ts');
} else {
  const incidentResponder = readFileSync('src/alerting/incident-responder.ts', 'utf-8');
  if (!incidentResponder.includes("from './alert-env.js'")) {
    missing.push('incident-responder must import alert-env');
  }
}

const enterpriseValues = readFileSync('deploy/helm/mastyf-ai/values-enterprise.yaml', 'utf-8');
if (!enterpriseValues.includes('MASTYF_AI_ALERTING_REQUIRED')) {
  missing.push('values-enterprise.yaml must set MASTYF_AI_ALERTING_REQUIRED');
}
if (!/externalSecrets:[\s\S]*enabled:\s*true/.test(enterpriseValues)) {
  missing.push('values-enterprise.yaml must enable externalSecrets');
}

const alertmanagerConfig = readFileSync('deploy/helm/mastyf-ai/templates/alertmanagerconfig.yaml', 'utf-8');
if (!alertmanagerConfig.includes('else if $slack')) {
  missing.push('alertmanagerconfig must fallback critical alerts to Slack when PagerDuty disabled');
}

for (const proxyFile of [
  'src/proxy/http-proxy-server.ts',
  'src/proxy/sse-proxy-server.ts',
  'src/proxy/streamable-http-proxy-server.ts',
  'src/proxy/websocket-proxy-server.ts',
  'src/proxy/proxy-server.ts',
]) {
  const proxySrc = readFileSync(proxyFile, 'utf-8');
  const usesDefenseFabric =
    proxySrc.includes('evaluateToolCallDefense') ||
    proxySrc.includes('runPostPolicyAllowGates');
  if (!usesDefenseFabric) {
    missing.push(`${proxyFile} must call evaluateToolCallDefense or runPostPolicyAllowGates after policy allow`);
  }
}

if (!existsSync('docs/DEFENSE_FABRIC.md')) {
  missing.push('missing file: docs/DEFENSE_FABRIC.md');
}

if (!existsSync('src/proxy/tool-call-defense-orchestrator.ts')) {
  missing.push('missing file: src/proxy/tool-call-defense-orchestrator.ts');
}

if (!existsSync('src/services/unified-spend-pool.ts')) {
  missing.push('missing file: src/services/unified-spend-pool.ts');
}

if (!enterpriseValues.includes('MASTYF_AI_SEMANTIC_STRICT')) {
  missing.push('values-enterprise.yaml must set MASTYF_AI_SEMANTIC_STRICT');
}

const externalsecret = readFileSync('deploy/helm/mastyf-ai/templates/externalsecret.yaml', 'utf-8');
if (!externalsecret.includes('MASTYF_AI_DB_ENCRYPTION_KEY')) {
  missing.push('externalsecret must wire MASTYF_AI_DB_ENCRYPTION_KEY');
}

const readiness = readFileSync('docs/ENTERPRISE_READINESS.md', 'utf-8');
if (!readiness.includes('| Encryption at rest | PRESENT |')) {
  missing.push('ENTERPRISE_READINESS.md must mark Encryption at rest as PRESENT');
}

if (!metricsTs.includes('mastyf_ai_tracing_configured')) {
  missing.push('metrics.ts must export mastyf_ai_tracing_configured gauge');
}

if (!metricsTs.includes('mastyf_ai_semantic_scan_duration_seconds')) {
  missing.push('metrics.ts must export mastyf_ai_semantic_scan_duration_seconds histogram');
}

const wsProxy = readFileSync('src/proxy/websocket-proxy-server.ts', 'utf-8');
if (!wsProxy.includes('withMcpToolCallSpan') || !wsProxy.includes("transport: 'websocket'")) {
  missing.push('websocket-proxy-server must use withMcpToolCallSpan for tools/call');
}

const enterpriseBootstrap = readFileSync('src/utils/enterprise-bootstrap.ts', 'utf-8');
if (!enterpriseBootstrap.includes('initTracing')) {
  missing.push('enterprise-bootstrap must call initTracing during compliance bootstrap');
}

if (!readiness.includes('| Alerting | PRESENT |')) {
  missing.push('ENTERPRISE_READINESS.md must mark Alerting as PRESENT');
}

if (!existsSync('src/validation/mcp-jsonrpc.ts')) {
  missing.push('missing file: src/validation/mcp-jsonrpc.ts');
} else {
  const pipeline = readFileSync('src/proxy/mcp-request-pipeline.ts', 'utf-8');
  if (!pipeline.includes('validateMcpJsonRpcMessage')) {
    missing.push('mcp-request-pipeline must validate JSON-RPC via validateMcpJsonRpcMessage');
  }
}

const semanticStrict = readFileSync('packages/core/src/semantic-strict.ts', 'utf-8');
if (!semanticStrict.includes('isCoreSemanticStrictMode')) {
  missing.push('packages/core must export isCoreSemanticStrictMode');
}

const engineTs = readFileSync('packages/core/src/engine.ts', 'utf-8');
if (!engineTs.includes('MASTYF_AI_SCAN_TOOL_TIMEOUT_MAX_MS') && !readFileSync('packages/core/src/scan-timeouts.ts', 'utf-8').includes('MASTYF_AI_SCAN_TOOL_TIMEOUT_MAX_MS')) {
  missing.push('scan timeout max env must be referenced in packages/core');
}

if (!existsSync('docs/COMPREHENSIVE_CODE_REVIEW_RESPONSE.md')) {
  missing.push('missing file: docs/COMPREHENSIVE_CODE_REVIEW_RESPONSE.md');
} else {
  const reviewResponse = readFileSync('docs/COMPREHENSIVE_CODE_REVIEW_RESPONSE.md', 'utf-8');
  if (reviewResponse.includes('| PARTIAL |')) {
    missing.push('COMPREHENSIVE_CODE_REVIEW_RESPONSE.md must not contain PARTIAL status rows');
  }
}

if (!existsSync('src/security/ephemeral-credential-vault.ts')) {
  missing.push('missing file: src/security/ephemeral-credential-vault.ts');
}

if (missing.length) {
  console.error('[compliance-evidence-check] FAILED');
  for (const issue of missing) console.error(` - ${issue}`);
  process.exit(1);
}

console.log('[compliance-evidence-check] OK');
