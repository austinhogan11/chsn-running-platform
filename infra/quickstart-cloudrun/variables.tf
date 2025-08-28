variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region (e.g. us-central1)"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "chsn-running"
}

variable "repo_id" {
  description = "Artifact Registry repo name"
  type        = string
  default     = "chsn"
}

variable "image" {
  description = "Fully-qualified container image (e.g. us-central1-docker.pkg.dev/PROJECT/chsn/chsn-running:TAG)"
  type        = string
}