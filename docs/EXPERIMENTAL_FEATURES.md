# Experimental / research features

These modules ship in the main repo but are **opt-in** and not required for production MCP proxy operation.

| Feature | Env gate | Path |
|---------|----------|------|
| Federated learning mesh | `MASTYF_AI_FEDERATED_LEARNING=true` | `src/agentic/federated/` |
| Digital twin replay | Agentic scheduler / roadmap API | `src/agentic/digital-twin/` |
| Cross-chain ONNX inference | Federated learning enabled | `src/agentic/cross-chain/graph-onnx-inference.ts` |
| Experimental Go data plane | Docker `split-plane` profile only | `apps/proxy-core/` |

**Split-plane edge (`apps/proxy-core/`):** optional performance tier. The control plane compiles signed **rules v2** (`tokensPerMinuteCap`, `usdPerMinuteCap`, tool denylist). The Go edge enforcer applies fast deny + coarse budget guard; the TypeScript proxy remains authoritative for semantic, argument, and response layers. Set `PROXY_CORE_REQUIRE_SIGNED_RULES=true` when consuming signed bundles from the control plane.

Production enterprise proxy hardening lives in `src/proxy/http-proxy-server.ts` (OAuth, inbound TLS, DPoP, body limits, rate limits).

Do not enable experimental features in regulated production without a separate security review.
