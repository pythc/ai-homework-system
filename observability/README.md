# Observability (Prometheus + Grafana Cloud)

This project exposes `/metrics` on both services and ships metrics to Grafana Cloud via a local Prometheus.

## 1) Start Prometheus

```bash
cd observability/prometheus
export GRAFANA_CLOUD_REMOTE_WRITE_URL=<your_remote_write_url>
export GRAFANA_CLOUD_USERNAME=<your_username>
export GRAFANA_CLOUD_API_KEY=<your_api_key>
docker compose up -d
```

Prometheus UI: http://localhost:9090

## 2) Ensure services expose /metrics

- `server` (NestJS): http://localhost:3000/metrics
- `assistant_service` (Express): http://localhost:4100/metrics

You can disable metrics with `ENABLE_METRICS=false`.

## 3) Grafana Cloud

After Prometheus starts, metrics will be remote-written to Grafana Cloud.
Use Grafana dashboards or add the Prometheus data source in grafana.com.
