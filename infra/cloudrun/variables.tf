variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (e.g., us-east1)"
  type        = string
  default     = "us-east1"
}

variable "repo_id" {
  description = "Artifact Registry repo ID"
  type        = string
  default     = "chsn"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "chsn-running"
}

variable "runtime_sa_id" {
  description = "Service account id (no domain) for Cloud Run runtime"
  type        = string
  default     = "chsn-running-sa"
}

variable "image" {
  description = "Full image URL (e.g. us-east1-docker.pkg.dev/PROJECT/REPO/chsn-running:TAG)"
  type        = string
}

variable "public" {
  description = "If true, make service publicly invokable"
  type        = bool
  default     = false
}

variable "invoker_member" {
  description = "IAM member for invoker when public=false (e.g., user:you@gmail.com)"
  type        = string
  default     = "user:you@example.com"
}

# GitHub WIF (for CI/CD)
variable "github_repo" {
  description = "owner/repo for GitHub Actions Workload Identity"
  type        = string
  default     = "owner/repo"
}