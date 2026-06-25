# Weekly scheduled task prompt

Copy into Base44 Superagent → **Tasks → New scheduled task** (weekly, Monday 9am):

---

Run the **mastyf.ai weekly performance report**.

1. Call the mastyf custom integration: `GET /api/v1/reports/performance?window=7d` using secret `MASTYF_REPORTS_API_KEY`.
2. Call `GET /api/v1/observatory/snapshot` (public).
3. Pull GitHub stats for repository `mastyf-ai/mastyf.ai`: stars, forks, open issues.
4. Read saved fact `productHuntUpvotes` if set; otherwise set `product.productHuntUpvotes` to null.
5. Merge everything into the performance JSON schema (see Files `performance-report-schema.json`).
6. Compare to the most recent file in `reports/` if one exists — add week-over-week deltas to highlights.
7. Write `reports/YYYY-MM-DD-performance.json` with the merged JSON.
8. Reply with a **5-bullet summary**:
   - Biggest win this week
   - Biggest gap or risk
   - Trust API traction (packages scored)
   - Proxy/fleet status (active instances, blocks)
   - Three recommended actions for next week

Do not guess numbers. If an API fails, note the failure in `risks` and continue with available data.

---
