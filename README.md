# The CHSN Running Platform

[![CI](https://github.com/austinhogan11/chsn-running-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/austinhogan11/chsn-running-platform/actions/workflows/ci.yml)


Your next running companion without all of the chaos

---

## CHSN Running Platform – Project Overview

🚀 **Current Status**

We have built the foundation of a FastAPI web application, set up testing, and created CI/CD automation with GitHub Actions. We also containerized the app with Docker for portable deployment.

---

## 🛠️ Tech Stack

- **Backend Framework**: FastAPI (Python 3.11)  
- **App Server**: Uvicorn  
- **Testing**: Pytest  
- **CI/CD**: GitHub Actions (pytest + linting in pipeline)  
- **Containerization**: Docker, Docker Compose  
- **Database (planned)**: SQLite → Postgres (future migration)  
- **Infra (future)**: GCP (GCE or GKE), DNS for public access  

---

## ✅ Completed

### Repo Setup
- GitHub repository created  
- Virtual environment management with `requirements.txt`

### App Foundation
- FastAPI backend (`app/main.py`)  
- Health check endpoint (`/health`)  

### Pace Calculator
- Services (`app/services/pace.py`) for distance–time–pace calculations  
- Utility functions (`app/utils/durations.py`) for formatting/parsing  
- API endpoint (`/pace`) supporting flexible inputs  

### Testing
- Unit tests for utils, services, and API  

---

## 📦 DevOps & Infrastructure
- GitHub Actions CI/CD pipeline  
- Dockerized application for consistent environments  
- Local development with `Dockerfile` (and optional `docker-compose.yml`)  

---

## 🔮 Future Additions
- Run log feature (store and retrieve workouts)  
- Authentication and user accounts  
- Database integration (PostgreSQL or similar)  
- Frontend UI (React or Next.js)  
- Production-grade deployment with Docker Compose / Kubernetes  
- Cloud setup (GCP VM, DNS, HTTPS) for public access  

---

## 📖 Setup & Usage (Local)

### 1. Clone repo & create virtual env
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

### 2. Run App
uvicorn app.main:app --reload
➡️ Visit: http://127.0.0.1:8000/docs

### 3. Run Tests
pytest

### 4. Build & run with Docker
docker build -t chsn-running .
docker run -p 8000:8000 chsn-running