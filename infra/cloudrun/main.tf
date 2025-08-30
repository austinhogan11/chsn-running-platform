# ---- Enable required APIs ----
resource "google_project_service" "apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com"
  ])
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

# ---- Artifact Registry repo ----
resource "google_artifact_registry_repository" "repo" {
  project       = var.project_id
  location      = var.region
  repository_id = var.repo_id
  description   = "Images for CHSN Running Platform"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# ---- Runtime Service Account (for Cloud Run) ----
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_sa_id
  display_name = "Cloud Run runtime SA"
  depends_on   = [google_project_service.apis]
}

# Runtime SA needs to write logs/metrics
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

# Runtime SA must read images from this repo
resource "google_artifact_registry_repository_iam_member" "repo_read" {
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.repo.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.runtime.email}"
}

# ---- Cloud Run service ----
resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.runtime.email

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

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }
  }

  # Let GitHub Actions update the image outside Terraform without causing drift
  lifecycle {
    ignore_changes = [
      # template[0].containers[0].image
    ]
  }

  depends_on = [
    google_artifact_registry_repository_iam_member.repo_read,
    google_project_iam_member.sa_logging,
    google_project_iam_member.sa_metrics,
    google_project_service.apis
  ]
}

# Invoker IAM: public OR a specific user
resource "google_cloud_run_v2_service_iam_member" "invoker_public" {
  count    = var.public ? 1 : 0
  location = var.region
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "invoker_user" {
  count    = var.public ? 0 : 1
  location = var.region
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = var.invoker_member
}

# ==================== CI/CD (GitHub Workload Identity) ====================

# Deployer SA used by GitHub Actions
resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "github-deployer"
  display_name = "GitHub Actions Deployer"
  depends_on   = [google_project_service.apis]
}

# Allow deployer to deploy Cloud Run, push images, and use the runtime SA
resource "google_project_iam_member" "deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "allow_deployer_use_runtime_sa" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# Workload Identity Pool & Provider for GitHub
resource "google_iam_workload_identity_pool" "gh_pool" {
  project                   = var.project_id
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "gh_provider" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.gh_pool.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "attribute.repository == \"${var.github_repo}\""
}

# Allow that GitHub repo to impersonate the deployer SA via WIF
resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.gh_pool.name}/attribute.repository/${var.github_repo}"
}
