/**
 * H13 — Webhook alert when security swarm fails overall gates.
 */
export async function sendSwarmFailureAlert({ outDir, latest, steps }) {
  const url = process.env.SWARM_ALERT_WEBHOOK_URL || process.env.ALERT_WEBHOOK_URL;
  if (!url?.trim()) return { sent: false, reason: 'no_webhook' };
  if (latest?.overall) return { sent: false, reason: 'pass' };

  const failed = (steps || []).filter((s) => !s.ok).map((s) => s.label);
  const body = {
    text: `MCP Mastyff AI Security Swarm FAILED`,
    attachments: [
      {
        color: 'danger',
        fields: [
          { title: 'Mode', value: latest?.mode || 'unknown', short: true },
          { title: 'Bypasses', value: String(latest?.gates?.bypassCount ?? '?'), short: true },
          { title: 'Failed steps', value: failed.slice(0, 8).join(', ') || 'unknown' },
          { title: 'Report', value: outDir },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { sent: res.ok, status: res.status };
}
