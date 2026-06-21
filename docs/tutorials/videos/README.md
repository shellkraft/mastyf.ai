# Tutorial videos

| File | Description |
|------|-------------|
| [live-security-score-video-script.md](../live-security-score-video-script.md) | **Wispr Flow** narration script (~90s) |
| [live-security-score-demo-jet.webm](./live-security-score-demo-jet.webm) | Screen recording (repo copy) |

**Share on the live site (after deploy):**

- Watch: [mastyf-ai-cloud-jet.vercel.app/tutorials/live-score](https://mastyf-ai-cloud-jet.vercel.app/tutorials/live-score)
- Direct file: […/tutorials/live-security-score-demo.webm](https://mastyf-ai-cloud-jet.vercel.app/tutorials/live-security-score-demo.webm)

**GitHub:**

- [View / download on GitHub](https://github.com/mastyf-ai/mastyf.ai/blob/main/docs/tutorials/videos/live-security-score-demo-jet.webm)

## Add Wispr Flow voiceover

1. Open the [Wispr Flow](https://wisprflow.ai) app.
2. Play `live-security-score-demo-jet.webm` in a video editor (iMovie, DaVinci Resolve).
3. Hold **Fn** and dictate the narration from the script while watching, or record audio separately and sync.

## Re-record

```bash
BASE_URL=https://mastyf-ai-cloud-jet.vercel.app TUTORIAL_PACKAGE=@playwright/mcp pnpm tutorial:record-score
```

## API quick reference (jet deployment)

```bash
curl -s "https://mastyf-ai-cloud-jet.vercel.app/api/v1/badge/@playwright%2Fmcp/json" | jq .
```
