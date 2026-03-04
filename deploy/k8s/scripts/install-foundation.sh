#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="ingress-nginx"
METRICS_NS="kube-system"

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null 2>&1 || true
helm repo update

kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace "$NAMESPACE" \
  -f deploy/k8s/foundation/ingress-nginx-values.yaml

helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace "$METRICS_NS" \
  -f deploy/k8s/foundation/metrics-server-values.yaml

kubectl wait --namespace "$NAMESPACE" --for=condition=available --timeout=300s deployment/ingress-nginx-controller
kubectl wait --namespace "$METRICS_NS" --for=condition=available --timeout=300s deployment/metrics-server

echo "foundation components installed"
