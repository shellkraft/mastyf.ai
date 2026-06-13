#!/usr/bin/env node
const Database = require('better-sqlite3');

// Claude 3.5 Sonnet pricing (most common Cline model)
// $3.00 per 1M input tokens, $15.00 per 1M output tokens
const INPUT_PRICE = 3.00 / 1000000;
const OUTPUT_PRICE = 15.00 / 1000000;

let grandTotalCalls = 0;
let grandTotalReq = 0;
let grandTotalResp = 0;
let grandTotalTokens = 0;
let grandTotalCost = 0;

console.log('═══════════════════════════════════════════');
console.log('  MCP Mastyff AI — Proxy Cost Audit');
console.log('  Model: Claude 3.5 Sonnet (Anthropic)');
console.log('  Pricing: $3.00/M input, $15.00/M output');
console.log('  ' + new Date().toISOString());
console.log('═══════════════════════════════════════════\n');

for (const name of ['github', 'filesystem']) {
  const path = '/private/tmp/proxy-' + name + '.db';
  try {
    const dbh = new Database(path, {readonly: true});
    const rows = dbh.prepare('SELECT * FROM call_records ORDER BY id').all();
    if (rows.length === 0) {
      console.log('proxy-' + name + ': No calls recorded');
    } else {
      const totalReq = rows.reduce((s, r) => s + (r.request_tokens || 0), 0);
      const totalResp = rows.reduce((s, r) => s + (r.response_tokens || 0), 0);
      const total = totalReq + totalResp;
      const costReq = totalReq * INPUT_PRICE;
      const costResp = totalResp * OUTPUT_PRICE;
      const totalCost = costReq + costResp;

      console.log('=== proxy-' + name + ' (port ' + (name === 'github' ? '9001' : '9002') + ') ===');
      console.log('Calls: ' + rows.length);
      console.log('─'.repeat(60));
      rows.forEach(r => {
        const rCost = (r.request_tokens || 0) * INPUT_PRICE + (r.response_tokens || 0) * OUTPUT_PRICE;
        console.log('  ' + r.tool_name.padEnd(22) + ' | req:' + String(r.request_tokens).padStart(4) + ' resp:' + String(r.response_tokens).padStart(5) + ' total:' + String(r.total_tokens).padStart(6) + ' | cost: $' + rCost.toFixed(4) + ' | ' + r.duration_ms + 'ms');
      });
      console.log('─'.repeat(60));
      console.log('  Token totals:   request=' + totalReq + ' response=' + totalResp + ' combined=' + total);
      console.log('  Cost breakdown: input=$' + costReq.toFixed(6) + ' + output=$' + costResp.toFixed(6));
      console.log('  Subtotal:       $' + totalCost.toFixed(4) + '\n');

      grandTotalCalls += rows.length;
      grandTotalReq += totalReq;
      grandTotalResp += totalResp;
      grandTotalTokens += total;
      grandTotalCost += totalCost;
    }
    dbh.close();
  } catch(e) {
    console.log('proxy-' + name + ': ERROR — ' + e.message);
  }
}

console.log('═══════════════════════════════════════════');
console.log('  GRAND TOTAL');
console.log('  Calls: ' + grandTotalCalls);
console.log('  Input tokens:  ' + grandTotalReq.toLocaleString());
console.log('  Output tokens: ' + grandTotalResp.toLocaleString());
console.log('  Total tokens:  ' + grandTotalTokens.toLocaleString());
console.log('  Estimated cost: $' + grandTotalCost.toFixed(4));
console.log('═══════════════════════════════════════════');