#!/usr/bin/env bash
set -euo pipefail

# Required: set these or pass in as env
: "${PROJECT_ID:?PROJECT_ID required}"
: "${REGION:=us-east1}"
: "${REPO_ID:=chsn}"
: "${IMAGE_NAME:=chsn-running}"

# Auth & docker config
gcloud auth configure-docker "${REGION}-docker.pkg.dev" -q

TAG="$(git rev-parse --short HEAD || date +%s)"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_ID}/${IMAGE_NAME}:${TAG}"
echo "Building ${IMAGE}"

# Build for Cloud Run's platform
docker buildx create --use >/dev/null 2>&1 || true
docker buildx build --platform linux/amd64 -t "${IMAGE}" --push .

echo "${IMAGE}"