# The CHSN Running Platform

[![CI](https://github.com/austinhogan11/chsn-running-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/austinhogan11/chsn-running-platform/actions/workflows/ci.yml)


Your next running companion without all of the chaos

---

## CHSN Running Platform – Project Overview

🚀 **Current Status**

We have built the foundation of a FastAPI web application, set up testing, and created CI/CD automation with GitHub Actions. We also containerized the app with Docker for portable deployment. Core features like the Pace Calculator and Training Log have been implemented with both backend services and frontend UI components, including interactive charts and CRUD operations for managing runs.

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
- User interface for Pace Calculator accessible via web UI for easy interaction

### Training Log
- UI components for logging and viewing runs  
- Interactive charts for visualizing run data and progress  
- CRUD operations to create, read, update, and delete run records  

### Testing
- Unit tests for utils, services, and API  
- Integration tests covering UI and backend interactions  

---

## 📦 DevOps & Infrastructure
- GitHub Actions CI/CD pipeline  
- Dockerized application for consistent environments  
- Local development with `Dockerfile` (and optional `docker-compose.yml`)  

---

## 🚧 Upcoming Features

- User authentication and account management system  
- Garmin and GPX data integration for importing runs  
- Richer run details including weather, route maps, and notes  
- Enhanced analytics and personalized training recommendations  
- Frontend improvements with React or Next.js for better UX  
- Production-grade deployment with Docker Compose / Kubernetes  

---

## 🌐 Deployment Approaches

We plan to deploy the CHSN Running Platform on Google Cloud Platform (GCP) using several strategies:

1. **Simple GCE VM Deployment**  
   Run the Dockerized app on a Google Compute Engine virtual machine with a static IP and DNS setup for public access.

2. **Cloud Run with Artifact Registry and Terraform**  
   Containerize the app and deploy it serverlessly on Cloud Run, using Artifact Registry for container storage and Terraform for infrastructure as code.

3. **GKE Autopilot (Learning Phase)**  
   Explore deploying on Google Kubernetes Engine Autopilot mode for managed Kubernetes with autoscaling and simplified cluster management.

---

## 🚀 Deployment (Current)

The deployment process we used involved several key steps:

- Created a Google Cloud Platform (GCP) project with billing enabled (using the free trial).
- Enabled the Artifact Registry and Cloud Run APIs within the project.
- Built the Docker image locally and pushed it to the Artifact Registry repository.
- Used Terraform located in `infra/quickstart-cloudrun` to provision the Cloud Run service, set up necessary IAM bindings, and connect the container image.
- Verified that the service was successfully deployed and accessible via the Cloud Run URL.

**Note:** The service was torn down after verification to avoid ongoing billing charges, but the entire infrastructure is fully reproducible using the provided Terraform configuration.

---

### GKE Deployment (Experimental)

As an experiment, we also deployed the platform to Google Kubernetes Engine (GKE) Autopilot mode:

- Provisioned a GKE Autopilot cluster using Terraform under `infra/gke`.
- Built and pushed the Docker image to Artifact Registry.
- Applied Kubernetes manifests (`deployment.yaml`, `service.yaml`) to deploy the FastAPI app.
- Verified pod rollout and service accessibility.
- Teardown of cluster performed after validation to avoid ongoing costs.

---

## 📖 Setup & Usage (Local)

### 1. Clone repo & create virtual env
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Run App
```bash
uvicorn app.main:app --reload
```
➡️ Visit: http://127.0.0.1:8000/docs

### 3. Run Tests
```bash
pytest
```

### 4. Build & run with Docker
```bash
docker build -t chsn-running .
docker run -p 8000:8000 chsn-running
```