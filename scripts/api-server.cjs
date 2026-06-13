// MCP Mastyff AI Live Test API Server
// Serves the interactive HTML and provides a REST API to run attacks through the real PolicyEngine
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PolicyEngine } = require('../dist/policy/policy-engine.js');
const { load } = require('js-yaml');
const { McpProxyServer } = require('../dist/proxy/proxy-server.js');
const { HistoryDatabase } = require('../dist/database/history-db.js');
const { PricingClient } = require('../dist/clients/pricing-client.js');
const { CostAuditor } = require('../dist/services/cost-auditor.js');

const PORT = 3456;
const PROJECT = path.resolve(__dirname, '..');

// Load policy
const policyYaml = fs.readFileSync(path.join(PROJECT, 'default-policy.yaml'), 'utf-8');
const policyConfig = load(policyYaml);
let currentMode = 'block';

function getEngine(mode) {
  policyConfig.policy.mode = mode || currentMode;
  return new PolicyEngine(policyConfig);
}

let currentPricing = 'gpt-4o';

// MIME types
const MIME = {
  '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.svg':'image/svg+xml'
};

// HTTP Server
const server = http.createServer(async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost:' + PORT);

  // ── Serve HTML page ──
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = fs.readFileSync(path.join(PROJECT, 'test-report-interactive.html'), 'utf-8');
    res.writeHead(200, {'Content-Type':'text/html'});
    res.end(html);
    return;
  }

  // ── API: Policy Modes ──
  if (url.pathname === '/api/modes' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({
      current: currentMode,
      available: ['audit','warn','block'],
      rules: policyConfig.policy.rules.map(r => ({name:r.name,action:r.action,tools:r.tools,patterns:r.patterns}))
    }));
    return;
  }

  // ── API: Set Mode ──
  if (url.pathname === '/api/mode' && req.method === 'POST') {
    let body = ''; req.on('data',c=>body+=c);
    req.on('end',function(){
      try {
        var data = JSON.parse(body);
        if (data.mode && ['audit','warn','block'].includes(data.mode)) {
          currentMode = data.mode;
          res.writeHead(200,{'Content-Type':'application/json'});
          res.end(JSON.stringify({success:true,mode:currentMode}));
        } else {
          res.writeHead(400,{'Content-Type':'application/json'});
          res.end(JSON.stringify({error:'Invalid mode'}));
        }
      } catch(e) { res.end(JSON.stringify({error:e.message})); }
    });
    return;
  }

  // ── API: Evaluate single tool call ──
  if (url.pathname === '/api/evaluate' && req.method === 'POST') {
    let body = ''; req.on('data',c=>body+=c);
    req.on('end',function(){
      try {
        var data = JSON.parse(body);
        var engine = getEngine(currentMode);
        var start = Date.now();
        var decision = engine.evaluate({
          serverName: data.serverName || 'test-server',
          toolName: data.toolName || 'unknown',
          arguments: data.arguments || {},
          requestId: data.requestId || 'api-' + Date.now(),
          requestTokens: data.requestTokens || (typeof data.arguments === 'object' ? JSON.stringify(data.arguments).length : 50),
          timestamp: new Date().toISOString()
        });
        var latency = Date.now() - start;
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({
          action: decision.action,
          rule: decision.rule,
          reason: decision.reason,
          mode: currentMode,
          latencyMs: latency,
          timestamp: new Date().toISOString()
        }));
      } catch(e) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  // ── API: Evaluate batch ──
  if (url.pathname === '/api/evaluate-batch' && req.method === 'POST') {
    let body = ''; req.on('data',c=>body+=c);
    req.on('end',function(){
      try {
        var data = JSON.parse(body);
        var mode = data.mode || currentMode;
        var engine = getEngine(mode);
        var results = (data.calls || []).map(function(call) {
          var start = Date.now();
          var decision = engine.evaluate({
            serverName: call.serverName || 'test-server',
            toolName: call.toolName,
            arguments: call.arguments || {},
            requestId: call.requestId || 'api-' + Date.now(),
            requestTokens: call.requestTokens || 50,
            timestamp: new Date().toISOString()
          });
          return {
            serverName: call.serverName || 'test-server',
            toolName: call.toolName,
            arguments: call.arguments,
            action: decision.action,
            rule: decision.rule,
            reason: decision.reason,
            latencyMs: Date.now() - start
          };
        });
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({mode:mode,results:results,count:results.length,
          blocked:results.filter(r=>r.action==='block').length,
          flagged:results.filter(r=>r.action==='flag').length,
          passed:results.filter(r=>r.action==='pass').length
        }));
      } catch(e) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  // ── API: Response Inspection ──
  if (url.pathname === '/api/inspect-response' && req.method === 'POST') {
    let body = ''; req.on('data',c=>body+=c);
    req.on('end',function(){
      try {
        var data = JSON.parse(body);
        var engine = getEngine(currentMode);
        var result = engine.evaluateResponse(
          data.toolName || 'unknown',
          data.serverName || 'test-server',
          data.responseText || ''
        );
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({
          clean: result.clean,
          detections: result.detections,
          count: result.detections.length
        }));
      } catch(e) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  // ── API: Run live proxy test ──
  if (url.pathname === '/api/proxy-test' && req.method === 'POST') {
    let body = ''; req.on('data',c=>body+=c);
    req.on('end',async function(){
      try {
        var data = JSON.parse(body);
        var mode = data.mode || 'block';
        var db = new HistoryDatabase(':memory:');
        var engine = getEngine(mode);
        var pricing = new PricingClient();
        var model = data.pricingModel || 'gpt-4o';

        var echoCode = 'var rl=require("readline").createInterface({input:process.stdin});rl.on("line",function(l){try{var m=JSON.parse(l);process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:{content:[{type:"text",text:JSON.stringify(m.params&&m.params.arguments||{})}]}})+"\\n")}catch(e){}})';
        var proxy = new McpProxyServer('node',['-e',echoCode],{PATH:process.env.PATH,HOME:process.env.HOME},db,'live-test',engine);

        await new Promise(r=>setTimeout(r,500));

        var results = [];
        var calls = data.calls || [];
        for(var i=0;i<calls.length;i++) {
          var call = calls[i];
          var rpc = JSON.stringify({jsonrpc:'2.0',id:'req-'+i,method:'tools/call',params:{name:call.toolName,arguments:call.arguments||{}}});
          await proxy.handleClientInput(rpc);
          await new Promise(r=>setTimeout(r,30));
        }

        await new Promise(r=>setTimeout(r,1000));

        var records = await db.getCallRecordsForServer('live-test');
        await pricing.refreshLivePricing();
        var auditor = new CostAuditor(pricing, db, model);
        var report = await auditor.auditServer({name:'live-test',transport:'stdio'});

        proxy.kill(); db.close();

        var policyResults = calls.map(function(call,idx) {
          var engine2 = getEngine(mode);
          var d = engine2.evaluate({serverName:'live-test',toolName:call.toolName,arguments:call.arguments||{},requestId:'eval-'+idx,requestTokens:50,timestamp:new Date().toISOString()});
          return {toolName:call.toolName,arguments:call.arguments,action:d.action,rule:d.rule,reason:d.reason};
        });

        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({
          mode:mode,
          callsSent:calls.length,
          callsIntercepted:records.length,
          policyResults:policyResults,
          blocked:policyResults.filter(r=>r.action==='block').length,
          flagged:policyResults.filter(r=>r.action==='flag').length,
          passed:policyResults.filter(r=>r.action==='pass').length,
          cost: {
            tokensUsed:report.tokensUsed,
            inputTokens:report.inputTokens,
            outputTokens:report.outputTokens,
            estimatedCostUSD:report.estimatedCostUSD,
            pricingModel:report.pricingModel
          },
          tokenBreakdown:report.toolBreakdown||[]
        }));
      } catch(e) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  // ── API: Cross-model cost ──
  if (url.pathname === '/api/cross-model-cost' && req.method === 'POST') {
    let body = ''; req.on('data',c=>body+=c);
    req.on('end',async function(){
      try {
        var data = JSON.parse(body);
        var tokens = data.tokens || 0;
        var inputTokens = data.inputTokens || Math.round(tokens/2);
        var outputTokens = data.outputTokens || Math.round(tokens/2);
        var pricing = new PricingClient();
        await pricing.refreshLivePricing();
        var models = data.models || ['gpt-4o','claude-3-5-sonnet','gemini-2.0-flash','deepseek-chat','gpt-4.5-preview'];
        var results = models.map(function(model) {
          var price = pricing.getPricingForModel(model);
          var inpCost = pricing.calculateCost(inputTokens, model, false)||0;
          var outCost = pricing.calculateCost(outputTokens, model, true)||0;
          return {
            model:model,
            inputRate:price?price.input:null,
            outputRate:price?price.output:null,
            inputCostUSD:Math.round(inpCost*1000000)/1000000,
            outputCostUSD:Math.round(outCost*1000000)/1000000,
            totalCostUSD:Math.round((inpCost+outCost)*1000000)/1000000,
            live:price!==null
          };
        });
        results.sort(function(a,b){return a.totalCostUSD-b.totalCostUSD});
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({inputTokens,outputTokens,totalTokens:tokens,results}));
      } catch(e) {
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:e.message}));
      }
    });
    return;
  }

  // 404
  res.writeHead(404,{'Content-Type':'application/json'});
  res.end(JSON.stringify({error:'Not found'}));
});

server.listen(PORT, function() {
  console.log('MCP Mastyff AI API Server running at http://localhost:' + PORT);
  console.log('Open http://localhost:' + PORT + ' in your browser');
  console.log('');
  console.log('API Endpoints:');
  console.log('  POST /api/evaluate         — Evaluate single tool call');
  console.log('  POST /api/evaluate-batch   — Evaluate batch of calls');
  console.log('  POST /api/inspect-response — Inspect response for prompt injection');
  console.log('  POST /api/proxy-test       — Run full proxy test with live server');
  console.log('  POST /api/cross-model-cost — Get cost across models');
  console.log('  GET  /api/modes            — Get available policy modes');
  console.log('  POST /api/mode             — Set policy mode');
});