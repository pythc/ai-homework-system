# Production Parameter Templates (QPS/Concurrency Profiles)

这些模板在 `deploy/k8s` 基线上叠加参数，可直接部署：

```bash
# 例：使用标准版
kubectl apply -k deploy/k8s/profiles/p2-standard
```

## 场景分级（估算）

| 模板 | 典型持续 QPS | 峰值 QPS | 典型并发在线 | 适用场景 |
|---|---:|---:|---:|---|
| `p1-campus` | 100-300 | 600 | 1k-3k | 单校试点、学期初上线 |
| `p2-standard` | 300-1k | 2k | 3k-10k | 单区域正式生产（大多数高校） |
| `p3-large` | 1k-3k | 6k | 10k-30k | 多学院并行高峰、考试周 |
| `p4-enterprise` | 3k-8k | 15k+ | 30k-100k | 多区域或超大校级平台 |

说明：

1. QPS 以 API 总入口估算（含读写，不含静态文件 CDN 命中）。
2. 前提是数据库和 Redis 为托管高可用规格，且对象存储与 CDN 已独立承载文件流量。
3. 如果登录峰值很高（bcrypt CPU 压力明显），优先提高 `server-auth` 配额与上限。

## 参数对比（核心）

| 模板 | HPA server-api (min/max, CPU, MEM) | Auth 并发闸门 (`AUTH_LOGIN_MAX_INFLIGHT`) | PgBouncer (maxClient/defaultPool/minPool/reserve) | Ingress API (`limit-rps`/`limit-connections`) |
|---|---|---|---|---|
| `p1-campus` | 3/10, 60%, 75% | 20 | 1200 / 80 / 20 / 20 | 40 / 100 |
| `p2-standard` | 6/24, 55%, 70% | 35 | 3000 / 180 / 40 / 40 | 80 / 200 |
| `p3-large` | 10/60, 50%, 70% | 60 | 8000 / 350 / 100 / 80 | 150 / 350 |
| `p4-enterprise` | 20/120, 50%, 70% | 110 | 20000 / 700 / 200 / 150 | 300 / 700 |

## 各模板文件

1. `p1-campus/kustomization.yaml` + `patch-all.yaml`
2. `p2-standard/kustomization.yaml` + `patch-all.yaml`
3. `p3-large/kustomization.yaml` + `patch-all.yaml`
4. `p4-enterprise/kustomization.yaml` + `patch-all.yaml`

## 上线建议（务必执行）

1. 先执行迁移：`kubectl apply -f deploy/k8s/migration-job.yaml`
2. 再部署 profile：`kubectl apply -k deploy/k8s/profiles/<profile>`
3. 观察 1-2 个高峰周期后再升级/降级 profile

## 快速回退

```bash
# 回退到基础参数
kubectl apply -k deploy/k8s
```
