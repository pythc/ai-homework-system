# Kubernetes Baseline (Option 1)

这套清单引入了方案 1 的核心能力：

1. Kubernetes 部署（`server-api` / `server-auth` / `server-worker` / `assistant-service` / `web`）
2. HPA（`autoscaling/v2`）
3. PgBouncer 连接池（应用统一接入 `pgbouncer:6432`）
4. 边缘限流 + WAF（NGINX Ingress 注解：`limit-rps` + ModSecurity + OWASP CRS）
5. CDN/WAF 前置接入建议（Cloudflare/Akamai 等）

## 1. 先安装基础组件（成熟 Helm 方案）

```bash
./deploy/k8s/scripts/install-foundation.sh
```

安装内容：

1. `ingress-nginx`（边缘入口）
2. `metrics-server`（HPA 必备）

## 2. 准备应用密钥

```bash
cp deploy/k8s/secret-app.example.yaml deploy/k8s/secret-app.yaml
# 编辑 deploy/k8s/secret-app.yaml 填入真实密钥
kubectl apply -f deploy/k8s/secret-app.yaml
```

## 3. 按需修改配置

重点检查 [configmap-app.yaml](/home/zcy28/workspace/ai-homework-system/deploy/k8s/configmap-app.yaml)：

1. `POSTGRES_PRIMARY_HOST`（真实 PostgreSQL 主库地址）
2. `REDIS_URL`（建议托管 Redis/Valkey）
3. `S3_ENDPOINT/S3_BUCKET/S3_PUBLIC_BASE_URL`（对象存储 + CDN）
4. `ASSISTANT_ASSET_BASE`（公网域名）

## 4. 执行数据库迁移（一次性）

```bash
kubectl apply -f deploy/k8s/migration-job.yaml
kubectl logs -n ai-homework job/server-migrate --follow
```

## 5. 部署应用

```bash
kubectl apply -k deploy/k8s
```

## 5.1 使用生产参数模板（推荐）

```bash
# 4 套模板见 deploy/k8s/profiles/README.md
kubectl apply -k deploy/k8s/profiles/p2-standard
```

模板说明：

1. `p1-campus`：轻量生产（100-300 持续 QPS）
2. `p2-standard`：标准生产（300-1k 持续 QPS）
3. `p3-large`：高并发生产（1k-3k 持续 QPS）
4. `p4-enterprise`：超大规模（3k-8k 持续 QPS）

## 6. 验证 HPA / PgBouncer / Ingress

```bash
kubectl get pods -n ai-homework
kubectl get hpa -n ai-homework
kubectl get svc -n ai-homework
kubectl describe ingress -n ai-homework ai-homework-api
```

## 7. CDN + WAF 前置（生产推荐）

建议在 Ingress LoadBalancer 前再挂一层 CDN/WAF（Cloudflare/Akamai/CloudFront+WAF）：

1. DNS 指向 Ingress 公网地址，并开启代理模式
2. 开启平台托管 WAF 规则（SQLi/XSS/Bot）
3. 对 `/api/*` 启用边缘限流（每 IP/QPS）
4. 在云防火墙或安全组层仅允许 CDN 回源 IP 访问 Ingress

## 8. 镜像约定

当前清单使用占位镜像：

1. `ghcr.io/pythc/ai-homework-system-server:latest`
2. `ghcr.io/pythc/ai-homework-system-assistant:latest`
3. `ghcr.io/pythc/ai-homework-system-web:latest`

请替换为你的真实镜像仓库和 tag（建议 CI 固定版本号，不用 `latest`）。
