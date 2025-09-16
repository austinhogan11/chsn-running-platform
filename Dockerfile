# Multi-stage build: build React UI, then package FastAPI app

ARG PYTHON_VERSION=3.11
ARG NODE_VERSION=20

# ----- Frontend build stage -----
FROM node:${NODE_VERSION}-alpine AS frontend
WORKDIR /src
COPY frontend/package*.json ./frontend/
RUN --mount=type=cache,target=/root/.npm \
    cd frontend && npm ci
COPY frontend ./frontend
COPY app ./app
# Build React app into app/web/dist (Vite config already points there)
RUN --mount=type=cache,target=/root/.npm \
    cd frontend && npm run build

# ----- Backend stage -----
FROM python:${PYTHON_VERSION}-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps (sqlite + build essentials)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    sqlite3 \
 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Copy backend code
COPY app ./app

# Copy built frontend assets from the previous stage
COPY --from=frontend /src/app/web/dist ./app/web/dist

# Create data dir (volume mount will override for persistence)
RUN mkdir -p /app/app/data
VOLUME ["/app/app/data"]

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

