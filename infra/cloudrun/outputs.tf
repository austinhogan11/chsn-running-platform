output "service_url" {
  description = "Public URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.service.uri
}

output "runtime_sa_email" {
  value = google_service_account.runtime.email
}

output "deployer_sa_email" {
  value = google_service_account.deployer.email
}

output "wif_provider_name" {
  description = "Workload Identity Provider resource path"
  value       = google_iam_workload_identity_pool_provider.gh_provider.name
}