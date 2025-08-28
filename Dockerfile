# syntax=docker/dockerfile:1
FROM python:3.11-slim

# ---- Runtime env & security ----
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Create app dir and non-root user
WORKDIR /app
RUN useradd -m appuser

# ---- Install Python deps (layer-cached) ----
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Copy project ----
# Includes FastAPI app, templates, static assets, tests, etc.
COPY . .

# ---- Permissions ----
RUN chown -R appuser:appuser /app
USER appuser

# Expose for local clarity (Cloud Run ignores but fine to keep)
EXPOSE 8000

# ---- Start server ----
# --proxy-headers helps when running behind Cloud Run's proxy
# PORT is auto-read from env (Cloud Run sets it); defaults to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers"]