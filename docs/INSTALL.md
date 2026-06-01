# MCP Guardian — Installation & troubleshooting

This guide is the detailed companion to the [README](../README.md). Use it when install or first run fails.

---

## Recommended install (npm)

```bash
npm install -g @mcp-guardian/server@latest
mcp-guardian onboard --apply
mcp-guardian start
```

Open **http://localhost:4000**.

**Verify:**

```bash
mcp-guardian --version
mcp-guardian doctor
```

**One command after onboard:**

```bash
mcp-guardian onboard --apply --start
```

### What each step does

| Step | Result |
|------|--------|
| `npm install -g` | Installs CLI, server `dist/`, policies, and **prebuilt** dashboard (`deploy/dashboard-spa/out/`) |
| `onboard --apply` | Wraps IDE MCP servers; writes `~/.mcp-guardian/onboard.json` and `guardian-configs/*.json` |
| `start` | Sets local dev env, picks a single-server config, runs proxy + API + UI on port 4000 |

---

## Developer install (git clone)

```bash
git clone https://github.com/rudraneel93/mcp-guardian.git
cd mcp-guardian
pnpm install && pnpm build && pnpm setup
mcp-guardian start
```

Without a global CLI (from repo root after `pnpm build`):

```bash
pnpm setup
pnpm start
# same as: node dist/cli.js start
```

**`mcp-guardian setup`** runs:

1. `pnpm install`
2. `pnpm build` (server + workspace packages)
3. `scripts/build-dashboard-spa.sh` (Next.js static export to `deploy/dashboard-spa/out/`)

Alternative shell wrapper: `./scripts/setup.sh`

---

## Commands reference

| Command | Purpose |
|---------|---------|
| `mcp-guardian start` | Proxy + dashboard (default for most users) |
| `mcp-guardian onboard --apply` | Wrap IDE MCP configs |
| `mcp-guardian onboard --apply --start` | Onboard then start |
| `mcp-guardian setup` | Monorepo one-shot install (git clone only) |
| `mcp-guardian doctor` | Diagnose install, DB, SPA, config, port |
| `mcp-guardian proxy -c … --policy …` | Manual proxy (set env vars yourself) |
| `pnpm dashboard:proxy` | Repo dev script (same stack, extra dev defaults) |

---

## Troubleshooting

### `pnpm dashboard:proxy` — command not found

**Cause:** You are not in the git repo, or `package.json` scripts are missing.

**Fix:**

- From anywhere: **`mcp-guardian start`**
- From clone: `cd mcp-guardian` then `pnpm dashboard:proxy` or `mcp-guardian start`

---

### `next: command not found` (dashboard build)

**Cause:** Dashboard SPA dependencies were never installed, or you are on an old clone without `deploy/dashboard-spa` in the pnpm workspace.

**Fix — npm users:**

```bash
npm install -g @mcp-guardian/server@latest
```

The published tarball includes a prebuilt `deploy/dashboard-spa/out/`. You should not need to run `next build`.

**Fix — git clone:**

```bash
cd mcp-guardian
mcp-guardian setup
```

**Manual fallback** (any clone):

```bash
cd deploy/dashboard-spa
npm install
npm run build
cd ../..
mcp-guardian start
```

---

### `benchmark-report.json` missing (TypeScript build error)

**Cause:** Older clones had this file gitignored. The dashboard imports it from `app/data/`.

**Fix:**

```bash
git pull origin main
```

Or create the file (minimal seed):

```bash
cat > deploy/dashboard-spa/app/data/benchmark-report.json << 'EOF'
{
  "timestamp": "2026-05-18T19:21:41.589Z",
  "iterations": 100,
  "warmup": 10,
  "p95ThresholdMs": 150,
  "scenarios": {
    "baseline": { "p50": 1, "p95": 1, "p99": 1, "avg": 0.82 },
    "passthrough": { "p50": 2628, "p95": 3391, "p99": 3459, "avg": 2619.68 },
    "blocking": { "p50": 2385, "p95": 3563, "p99": 4342, "avg": 2638.7 }
  },
  "overheadMs": { "noPolicy": 2618.86, "withPolicy": 2637.88 },
  "passed": false,
  "strict": true
}
EOF
```

Then run `mcp-guardian setup` or `npm run build` inside `deploy/dashboard-spa`.

---

### No MCP config found

**Cause:** `mcp-guardian start` needs one JSON config with exactly **one stdio MCP server**.

**Fix:**

```bash
mcp-guardian onboard --apply
mcp-guardian start
```

Or pass a config explicitly:

```bash
mcp-guardian start --config guardian-configs/filesystem.json
```

Configs are usually under `guardian-configs/` in the directory where you ran `onboard`. Check `~/.mcp-guardian/onboard.json` for `configsDir`.

**Multi-server configs:** One proxy = one stdio server. Split configs or run multiple proxies — [REAL_WORLD_INTEGRATION.md](REAL_WORLD_INTEGRATION.md).

---

### Database disk I/O error (dashboard Setup tab)

**Cause:** Corrupt or locked SQLite WAL files, or proxy and dashboard using different DB paths.

**Fix:**

```bash
# Stop mcp-guardian start (Ctrl+C)
DB="$HOME/.mcp-guardian/history.db"
rm -f "${DB}-wal" "${DB}-shm" "${DB}.pid"
export MCP_GUARDIAN_DB_PATH="$DB"
mcp-guardian start
```

For repo-local DB:

```bash
export MCP_GUARDIAN_DB_PATH="$PWD/reports/local-history.db"
mkdir -p "$(dirname "$MCP_GUARDIAN_DB_PATH")"
mcp-guardian start
```

---

### Port 4000 already in use

```bash
lsof -ti :4000 | xargs kill
mcp-guardian start
```

Or use another port:

```bash
DASHBOARD_PORT=4001 mcp-guardian start
```

Open **http://localhost:4001**.

---

### `better-sqlite3` / native module errors (pnpm 10)

**Cause:** pnpm blocked install scripts for native addons.

**Fix:**

```bash
cd mcp-guardian
pnpm approve-builds   # select better-sqlite3 when prompted
pnpm install
pnpm build
```

---

### Empty dashboard charts

**Cause:** No traffic logged yet, wrong DB path, or time window too narrow.

**Fix:**

1. Use the same DB as the proxy (default `~/.mcp-guardian/history.db`).
2. In the UI, set time window to **Last 7 days**.
3. Use your IDE so tool calls flow through Guardian.
4. Dev: generate smoke traffic (proxy running):

```bash
export MCP_GUARDIAN_DB_PATH="${MCP_GUARDIAN_DB_PATH:-$HOME/.mcp-guardian/history.db}"
pnpm real-life:filesystem
```

---

### npm `InstallError` / `EUNSUPPORTEDPROTOCOL` / `workspace:`

**Cause:** Broken publishes of `@mcp-guardian/server@4.1.1`–`4.1.4` on the registry.

**Fix:**

```bash
npm cache clean --force
npm install -g @mcp-guardian/server@4.1.6
```

Use **4.1.5+** minimum. See [SECURITY.md](../SECURITY.md).

---

### `ETARGET` / No matching version for `@mcp-guardian/core`

**Cause:** Server was published before `core` / `plugin-sdk` at the same version.

**Fix (maintainers):** Run `./scripts/publish-npm-all.sh` from the repo. Wait ~1 minute for npm replication.

**Fix (users):** Install a version where all packages exist:

```bash
npm view @mcp-guardian/core@4.1.6 version
npm view @mcp-guardian/server@4.1.6 version
```

---

### Pro features locked in dashboard

**Cause:** Production license gate.

**Local dev:** `mcp-guardian start` sets `GUARDIAN_CI_BYPASS_LICENSE=true` automatically.

**Production:** [PRO_SETUP.md](PRO_SETUP.md)

---

### Ollama warning on start

**Cause:** Optional — semantic detection and Threat Lab expect a local LLM.

**Fix (optional):**

```bash
ollama serve
```

Default URL: `http://127.0.0.1:11434`. Override with `OLLAMA_BASE_URL`.

---

### `mcp-guardian doctor` reports issues

Run:

```bash
mcp-guardian doctor
```

Fix each red/yellow line, then:

```bash
mcp-guardian start
```

| Doctor message | Typical fix |
|----------------|-------------|
| `dist/cli.js missing` | `mcp-guardian setup` or reinstall npm package |
| Dashboard SPA not built | `mcp-guardian setup` or reinstall npm package |
| No MCP config | `mcp-guardian onboard --apply` |
| DB not writable | Fix permissions or remove stale WAL files |
| Port in use | Kill process on 4000 or change `DASHBOARD_PORT` |

---

### BundlePhobia / browser bundle size fails on `@mcp-guardian/server`

**Expected.** This is a Node server package, not a browser bundle. Use [@mcp-guardian/core](https://bundlephobia.com/package/@mcp-guardian/core) for size analysis.

---

## Environment variables (install-related)

| Variable | Default (with `mcp-guardian start`) |
|----------|--------------------------------------|
| `MCP_GUARDIAN_DB_PATH` | `~/.mcp-guardian/history.db` |
| `DASHBOARD_ENABLED` | `true` |
| `DASHBOARD_AUTH_DISABLED` | `true` (localhost) |
| `GUARDIAN_CI_BYPASS_LICENSE` | `true` (localhost dev) |
| `DASHBOARD_PORT` | `4000` |
| `GUARDIAN_WS_ENABLED` | `true` |

Full reference: [`.env.example`](../.env.example).

---

## Still stuck?

1. `mcp-guardian doctor`
2. [GitHub issues](https://github.com/rudraneel93/mcp-guardian/issues)
3. [README](../README.md) — feature overview and documentation map
