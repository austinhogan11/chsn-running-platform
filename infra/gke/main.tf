terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "container.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "artifactregistry.googleapis.com"
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# Autopilot GKE cluster
resource "google_container_cluster" "chsn" {
  name     = "chsn-autopilot"
  location = var.region
  project  = var.project_id

  enable_autopilot = true

  release_channel {
    channel = "REGULAR"
  }

  # Workload Identity (GKE → GCP)
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  depends_on = [google_project_service.apis]
}

data "google_project" "this" {}

resource "google_project_iam_member" "gke_nodes_artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${data.google_project.this.number}-compute@developer.gserviceaccount.com"
}

output "gke_name"     { value = google_container_cluster.chsn.name }
output "gke_location" { value = google_container_cluster.chsn.location }