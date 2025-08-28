# ---------- Enable required APIs ----------
resource "google_project_service" "run" {
  project            = var.project_id
  service            = "run.googleapis.com"
  disable_on_destroy = false
}
resource "google_project_service" "artifact" {
  project            = var.project_id
  service            = "artifactregistry.googleapis.com"
  disable_on_destroy = false
}
resource "google_project_service" "cloudbuild" {
  project            = var.project_id
  service            = "cloudbuild.googleapis.com"
  disable_on_destroy = false
}
resource "google_project_service" "iam" {
  project            = var.project_id
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

# ---------- Artifact Registry (Docker) ----------
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repo_id
  description   = "Images for CHSN Running Platform"
  format        = "DOCKER"

  depends_on = [
    google_project_service.artifact
  ]
}

# ---------- Runtime Service Account (least privilege) ----------
resource "google_service_account" "runtime" {
  account_id   = "${var.service_name}-sa"
  display_name = "CHSN Cloud Run runtime SA"
}

# Minimal logging/metrics for runtime (best practice)
resource "google_project_iam_member" "sa_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_project_iam_member" "sa_metrics" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# ---------- Cloud Run (v2) ----------
resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = var.image

      ports {
        name           = "http1"
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [
    google_project_service.run
  ]
}

# Public access (Invoker for allUsers)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = google_cloud_run_v2_service.service.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
