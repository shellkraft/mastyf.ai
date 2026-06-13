const { McpProxyServer } = require('../dist/proxy/proxy-server.js');
const { HistoryDatabase } = require('../dist/database/history-db.js');
const { PolicyEngine } = require('../dist/policy/policy-engine.js');
const { CostAuditor } = require('../dist/services/cost-auditor.js');
const { PricingClient } = require('../dist/clients/pricing-client.js');
const { readFileSync } = require('fs');
const { load } = require('js-yaml');

(async function() {
  const models = ['gpt-4o', 'gemini-2.0-flash', 'deepseek-chat', 'claude-3-5-sonnet', 'gpt-4.5-preview'];

  var echoCode = [
    'var rl=require("readline").createInterface({input:process.stdin});',
    'rl.on("line",function(l){',
    '  try{var m=JSON.parse(l);',
    '  process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,',
    '    result:{content:[{type:"text",text:JSON.stringify(m.params&&m.params.arguments||{})}]}',
    '  })+"\\n")}catch(e){}',
    '});',
  ].join('');

  for (var mi = 0; mi < models.length; mi++) {
    var model = models[mi];
    var db = new HistoryDatabase(':memory:');
    var policyConfig = load(readFileSync(__dirname + '/../default-policy.yaml', 'utf-8'));
    var engine = new PolicyEngine(policyConfig);
    var pricing = new PricingClient();
    await pricing.refreshLivePricing();
    var auditor = new CostAuditor(pricing, db, model);

    var proxy = new McpProxyServer(
      'node', ['-e', echoCode],
      { PATH: process.env.PATH, HOME: process.env.HOME },
      db, 'echo-' + model, engine
    );

    await new Promise(function(r) { setTimeout(r, 600); });

    var calls = [
      { id: 'a1', method: 'tools/call', params: { name: 'search', arguments: { query: 'mcp mastyff-ai security' } } },
      { id: 'a2', method: 'tools/call', params: { name: 'read_file', arguments: { path: 'README.md' } } },
      { id: 'a3', method: 'tools/call', params: { name: 'execute_command', arguments: { command: 'ls' } } },
    ];
    for (var i = 0; i < calls.length; i++) {
      await proxy.handleClientInput(JSON.stringify(calls[i]));
      await new Promise(function(r) { setTimeout(r, 30); });
    }
    await new Promise(function(r) { setTimeout(r, 1000); });

    var report = await auditor.auditServer({ name: 'echo-' + model, transport: 'stdio' });
    var pricingData = pricing.getPricingForModel(model);

    var inpRate = pricingData ? ('$' + pricingData.input + '/M') : '?';
    var outRate = pricingData ? ('$' + pricingData.output + '/M') : '?';
    console.log('=== ' + model + ' (live: in=' + inpRate + ', out=' + outRate + ') ===');
    console.log('  Tokens: ' + report.tokensUsed + ' | Cost: $' + report.estimatedCostUSD.toFixed(6) + ' | Reported Model: ' + report.pricingModel);
    if (report.toolBreakdown && report.toolBreakdown.length) {
      report.toolBreakdown.forEach(function(t) {
        console.log('    ' + t.toolName + ': ' + t.calls + ' calls, ' + t.tokens + ' tokens, $' + t.cost.toFixed(6));
      });
    }

    proxy.kill();
    db.close();
  }
})();