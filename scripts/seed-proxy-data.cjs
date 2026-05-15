#!/usr/bin/env node
const Database = require('better-sqlite3');
const now = new Date();

for (const name of ['github', 'filesystem']) {
  const path = '/private/tmp/proxy-' + name + '.db';
  try {
    const db = new Database(path);
    
    const records = name === 'github' ? [
      { srv: 'github-proxy', tool: 'search_repositories', req: 41, resp: 1974, dur: 913, ago: 120 },
      { srv: 'github-proxy', tool: 'search_repositories', req: 42, resp: 4012, dur: 1494, ago: 100 },
      { srv: 'github-proxy', tool: 'search_repositories', req: 41, resp: 4027, dur: 1094, ago: 80 },
      { srv: 'github-proxy', tool: 'search_code', req: 42, resp: 128, dur: 402, ago: 60 },
      { srv: 'github-proxy', tool: 'search_repositories', req: 41, resp: 2498, dur: 756, ago: 40 },
      { srv: 'github-proxy', tool: 'search_repositories', req: 43, resp: 4081, dur: 944, ago: 20 },
      { srv: 'github-proxy', tool: 'search_repositories', req: 42, resp: 2081, dur: 756, ago: 10 },
    ] : [
      { srv: 'filesystem-proxy', tool: 'list_directory', req: 34, resp: 1592, dur: 82, ago: 110 },
      { srv: 'filesystem-proxy', tool: 'read_text_file', req: 40, resp: 104, dur: 12, ago: 90 },
      { srv: 'filesystem-proxy', tool: 'read_text_file', req: 40, resp: 110, dur: 8, ago: 70 },
      { srv: 'filesystem-proxy', tool: 'list_directory', req: 34, resp: 1572, dur: 2, ago: 50 },
      { srv: 'filesystem-proxy', tool: 'write_to_file', req: 148, resp: 358, dur: 156, ago: 30 },
      { srv: 'filesystem-proxy', tool: 'read_text_file', req: 39, resp: 50, dur: 9, ago: 20 },
      { srv: 'filesystem-proxy', tool: 'read_text_file', req: 48, resp: 59, dur: 86, ago: 10 },
    ];

    const stmt = db.prepare('INSERT INTO call_records (server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const r of records) {
      const ts = new Date(now.getTime() - r.ago * 1000).toISOString();
      stmt.run(r.srv, r.tool, r.req, r.resp, r.req + r.resp, r.dur, ts);
    }
    console.log(name + ': inserted ' + records.length + ' records');
    db.close();
  } catch (e) {
    console.log(name + ': ' + e.message);
  }
}
console.log('Done seeding proxy data');