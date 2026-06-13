const Database = require('better-sqlite3');
const now = new Date();
const db = new Database('/private/tmp/mastyff-ai-dashboard.db');
db.exec("CREATE TABLE IF NOT EXISTS call_records (id INTEGER PRIMARY KEY AUTOINCREMENT, server_name TEXT NOT NULL, tool_name TEXT NOT NULL, request_tokens INTEGER NOT NULL, response_tokens INTEGER NOT NULL, total_tokens INTEGER NOT NULL, duration_ms INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')))");
const stmt = db.prepare("INSERT INTO call_records (server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
const data = [
  ["github-proxy","search_repositories",41,1974,2015,913,new Date(now-120000).toISOString()],
  ["github-proxy","search_repositories",42,4012,4054,1494,new Date(now-100000).toISOString()],
  ["github-proxy","search_repositories",41,4027,4068,1094,new Date(now-80000).toISOString()],
  ["github-proxy","search_code",42,128,170,402,new Date(now-60000).toISOString()],
  ["github-proxy","search_repositories",41,2498,2539,756,new Date(now-40000).toISOString()],
  ["github-proxy","search_repositories",43,4081,4124,944,new Date(now-20000).toISOString()],
  ["github-proxy","search_repositories",42,2081,2123,756,new Date(now-10000).toISOString()],
  ["filesystem-proxy","list_directory",34,1592,1626,82,new Date(now-110000).toISOString()],
  ["filesystem-proxy","read_text_file",40,104,144,12,new Date(now-90000).toISOString()],
  ["filesystem-proxy","read_text_file",40,110,150,8,new Date(now-70000).toISOString()],
  ["filesystem-proxy","list_directory",34,1572,1606,2,new Date(now-50000).toISOString()],
  ["filesystem-proxy","write_to_file",148,358,506,156,new Date(now-30000).toISOString()],
  ["filesystem-proxy","read_text_file",39,50,89,9,new Date(now-20000).toISOString()],
  ["filesystem-proxy","read_text_file",48,59,107,86,new Date(now-10000).toISOString()]
];
for (const r of data) { stmt.run(r[0],r[1],r[2],r[3],r[4],r[5],r[6]); }
console.log('Seeded '+data.length+' records');
db.close();