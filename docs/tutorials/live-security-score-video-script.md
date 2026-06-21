# Tutorial video: Live MCP security scores on mastyf.ai

**Length:** ~90 seconds  
**Live site:** [mastyf-ai-cloud-jet.vercel.app/certified](https://mastyf-ai-cloud-jet.vercel.app/certified)  
**Voiceover:** [Wispr Flow](https://wisprflow.ai) — hold **Fn** (Mac) and speak the lines below  

**Pre-recorded screen capture:** `docs/tutorials/videos/live-security-score-demo-jet.webm`

---

## Before you record (manual + Wispr Flow)

1. Open [https://mastyf-ai-cloud-jet.vercel.app/certified](https://mastyf-ai-cloud-jet.vercel.app/certified) full screen.
2. Launch Wispr Flow — default hotkey **Fn** on Mac.
3. Demo package: `@playwright/mcp` (or `@modelcontextprotocol/server-filesystem`).

---

## Scene 1 — Intro (0:00–0:12)

**Screen:** `/certified` hero — “mastyf.ai security score”

**Wispr Flow narration:**

> This is mastyf.ai. You can look up any npm MCP server package and get a trust score from zero to one hundred in real time. Here’s how.

---

## Scene 2 — Look up & live badge (0:12–0:40)

**Actions:**
1. Click **Look up an MCP server package**
2. Type `@playwright/mcp`
3. Pause on the **badge preview** appearing under the search bar
4. Click **View score**

**Narration:**

> Type a package name — for example Playwright’s MCP server. The badge preview updates instantly from our API — that’s your live SVG score. Click View score for the full report.

---

## Scene 3 — Score breakdown (0:40–1:05)

**Screen:** Package page with score ring, grade, summary

**Actions:** Scroll slowly through summary and **Embed badge** section

**Narration:**

> You get the numeric score, letter grade, and plain-English guidance. Copy markdown here to embed the badge in your README. Static analysis runs on every lookup — CVE posture, supply chain signals, and more.

---

## Scene 4 — Fetch via API (1:05–1:25)

**Screen:** New tab or terminal

```bash
curl -s "https://mastyf-ai-cloud-jet.vercel.app/api/v1/badge/@playwright%2Fmcp/json" | jq .
```

**Narration:**

> For automation, call the REST API. This JSON endpoint returns score, grade, scan tier, and timestamps — perfect for CI badges or internal dashboards.

---

## Scene 5 — Outro (1:25–1:30)

**Narration:**

> That’s it — look up any MCP package on mastyf.ai, embed the badge, or poll the API for real-time scores.

---

## Re-record screen capture automatically

```bash
BASE_URL=https://mastyf-ai-cloud-jet.vercel.app \
TUTORIAL_PACKAGE=@playwright/mcp \
pnpm tutorial:record-score
```

Output: `docs/tutorials/videos/live-security-score-demo.webm`

---

## Wispr Flow tips

- Dictate each scene into Flow Notes first, then replay while screen recording.
- Say *“make this more concise”* in Command Mode to tighten narration.
- Lay Wispr audio over the WebM in iMovie or DaVinci Resolve.
