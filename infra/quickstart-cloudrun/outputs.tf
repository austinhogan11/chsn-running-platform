output "service_url" {
  value       = google_cloud_run_v2_service.service.uri
  description = "Public URL of the Cloud Run service"
}