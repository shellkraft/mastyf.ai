# Packaging Guide

| Package | Purpose |
|---------|---------|
| `@mastyff-ai/server` (root) | **Primary** — CLI, proxy, scanners |
| `@mastyff-ai/core` | Detection engine library |
| `@mastyff-ai/cli` | Thin CLI shim |

Enterprise deployments: use Docker/Helm with `@mastyff-ai/server` image or `npm install -g @mastyff-ai/server`.
