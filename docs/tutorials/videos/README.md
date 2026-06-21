# Tutorial videos

| File | Description |
|------|-------------|
| [live-security-score-video-script.md](../live-security-score-video-script.md) | **Wispr Flow** narration script (~90s) |
| [live-security-score-demo-jet.webm](./live-security-score-demo-jet.webm) | Screen recording — [mastyf-ai-cloud-jet.vercel.app/certified](https://mastyf-ai-cloud-jet.vercel.app/certified) |

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
