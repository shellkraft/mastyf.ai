# Redis High Availability

Redis backs distributed rate limits, DPoP jti store, session flow guards, and policy eval cache in multi-replica deployments.

## Connection modes

| Env | Use case |
|-----|----------|
| `REDIS_URL` | Single instance or managed Redis |
| `REDIS_SENTINELS` + `REDIS_SENTINEL_MASTER_NAME` | Sentinel HA (enterprise overlay) |
| `REDIS_CLUSTER_NODES` | Cluster mode |
| `MASTYF_AI_GLOBAL_RATE_LIMIT_REDIS_URL` | Active-active global cap |

## Sentinel example (Helm)

```yaml
redis:
  enabled: false
  sentinel:
    external: true
    sentinels: "sentinel-0:26379,sentinel-1:26379,sentinel-2:26379"
    masterName: mymaster
```

## Enterprise requirement

With `MASTYF_AI_GLOBAL_RATE_LIMIT_REQUIRED=true` or `replicaCount > 1`, startup fails if Redis is unreachable (`enterprise-bootstrap.ts`).

## Failover

- ioredis Sentinel auto-reconnects on promotion
- Rate-limit counters may reset during failover (acceptable — limits are soft safety)
- DPoP jti replay window: 5 minutes — brief Redis loss may allow replay; use Sentinel for production

## Monitoring

Alert `MastyfAiRedisDown` (PrometheusRule) when `mastyf_ai_redis_available == 0`.
