#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// ── 1. Auto-detect model from Cline global state ──────────────────────
const clineStatePath = path.join(require('os').homedir(), '.cline', 'data', 'globalState.json');
let modelName = 'Unknown';
let inputPricePerM = 3.00;
let outputPricePerM = 15.00;

try {
  const state = JSON.parse(fs.readFileSync(clineStatePath, 'utf-8'));
  const provider = state.actModeApiProvider || 'cline';
  const modelId = state.actModeClineModelId || '';
  
  if (provider === 'cline' && state.actModeClineModelInfo) {
    modelName = state.actModeClineModelInfo.name || modelId;
    inputPricePerM = state.actModeClineModelInfo.inputPrice || 0;
    outputPricePerM = state.actModeClineModelInfo.outputPrice || 0;
  } else if (state.actModeGroqModelInfo) {
    modelName = state.actModeGroqModelInfo.description?.split('.')[0] || state.actModeGroqModelId || 'Groq Model';
    inputPricePerM = state.actModeGroqModelInfo.inputPrice || 0;
    outputPricePerM = state.actModeGroqModelInfo.outputPrice || 0;
  }
} catch (e) {
  console.error('Warning: Could not detect model from Cline state:', e.message);
}

const INPUT_PRICE = inputPricePerM / 1000000;
const OUTPUT_PRICE = outputPricePerM / 1000000;

// ── 2. MCP Tool Call Costs (from proxy DBs) ──────────────────────────
let mcpCalls = 0;
let mcpInputTokens = 0;
let mcpOutputTokens = 0;
let mcpTotalTokens = 0;
let mcpCost = 0;

for (const name of ['github', 'filesystem']) {
  const dbPath = '/private/tmp/proxy-' + name + '.db';
  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare('SELECT * FROM call_records ORDER BY id').all();
    for (const r of rows) {
      const req = r.request_tokens || 0;
      const resp = r.response_tokens || 0;
      mcpCalls++;
      mcpInputTokens += req;
      mcpOutputTokens += resp;
      mcpTotalTokens += (req + resp);
    }
    db.close();
  } catch (e) { /* DB may not exist yet */ }
}
mcpCost = mcpInputTokens * INPUT_PRICE + mcpOutputTokens * OUTPUT_PRICE;

// ── 3. LLM Conversation Estimate ──────────────────────────────────────
// Context window snapshots from this chat session (observed in environment_details):
// Start: 0 tokens, End: ~190,000 tokens cumulative usage reported
// These are approximate context-window snapshots, not cumulative billing.
// We estimate cumulative chat tokens conservatively at 2x the peak context window.
const peakContextTokens = 190000;  // peak context window usage observed
const cumulativeInputEstimate = peakContextTokens * 2;
const cumulativeOutputEstimate = peakContextTokens * 0.4;
const llmInputTokens = cumulativeInputEstimate;
const llmOutputTokens = cumulativeOutputEstimate;
const llmCost = llmInputTokens * INPUT_PRICE + llmOutputTokens * OUTPUT_PRICE;

// ── 4. Grand Totals ───────────────────────────────────────────────────
const totalInput = mcpInputTokens + llmInputTokens;
const totalOutput = mcpOutputTokens + llmOutputTokens;
const totalTokens = totalInput + totalOutput;
const totalCost = mcpCost + llmCost;

// ── 5. Output ─────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════');
console.log('  MCP Mastyff AI — Full Cost Report');
console.log('  Model: ' + modelName + ' (Auto-detected from .cline/globalState.json)');
console.log('  Pricing: $' + inputPricePerM.toFixed(4) + '/M input, $' + outputPricePerM.toFixed(4) + '/M output');
console.log('  ' + new Date().toISOString());
console.log('═══════════════════════════════════════════════════════════\n');

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│  MCP Tool Calls (proxy captured)                       │');
console.log('├─────────────────────────────────────────────────────────┤');
console.log('│  Calls:        ' + String(mcpCalls).padStart(8) + '                                     │');
console.log('│  Input tokens: ' + mcpInputTokens.toLocaleString().padStart(12) + '                             │');
console.log('│  Output tokens:' + mcpOutputTokens.toLocaleString().padStart(13) + '                             │');
console.log('│  Total tokens: ' + mcpTotalTokens.toLocaleString().padStart(13) + '                             │');
console.log('│  Cost:          $' + mcpCost.toFixed(6).padStart(9) + '                            │');
console.log('└─────────────────────────────────────────────────────────┘\n');

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│  LLM Chat Conversation (estimated from context window)  │');
console.log('├─────────────────────────────────────────────────────────┤');
console.log('│  Input tokens: ' + llmInputTokens.toLocaleString().padStart(12) + ' (est.)                    │');
console.log('│  Output tokens:' + llmOutputTokens.toLocaleString().padStart(13) + ' (est.)                    │');
console.log('│  Total tokens: ' + totalTokens.toLocaleString().padStart(13) + '                             │');
console.log('│  Cost:          $' + llmCost.toFixed(4).padStart(9) + ' (est.)                   │');
console.log('└─────────────────────────────────────────────────────────┘\n');

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│  GRAND TOTAL                                           │');
console.log('├─────────────────────────────────────────────────────────┤');
console.log('│  Total input:  ' + totalInput.toLocaleString().padStart(12) + '                             │');
console.log('│  Total output: ' + totalOutput.toLocaleString().padStart(13) + '                             │');
console.log('│  Total tokens: ' + totalTokens.toLocaleString().padStart(13) + '                             │');
console.log('│  TOTAL COST:    $' + totalCost.toFixed(4).padStart(9) + '                            │');
console.log('└─────────────────────────────────────────────────────────┘');

console.log('\n  Note: LLM conversation tokens are estimated from context');
console.log('  window snapshots. MCP tool calls are precise from proxy DBs.');
console.log('  For accurate LLM billing, use Cline\'s built-in cost tracking.');