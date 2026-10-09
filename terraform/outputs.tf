# ABOUTME: Terraform output definitions for Legal Lens infrastructure.
# ABOUTME: Exposes key values needed for CI/CD and application configuration.

output "backend_url" {
  description = "Cloud Run backend service URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Cloud Run frontend service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "database_connection_name" {
  description = "Cloud SQL instance connection name for Cloud Run"
  value       = google_sql_database_instance.main.connection_name
}

output "bucket_name" {
  description = "GCS bucket name for evidence storage"
  value       = google_storage_bucket.evidence.name
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.legal-lens.repository_id}"
}

output "media_bucket_name" {
  description = "GCS bucket name for media storage"
  value       = google_storage_bucket.media.name
}

output "media_bucket_url" {
  description = "Base URL for media bucket"
  value       = "https://storage.googleapis.com/${google_storage_bucket.media.name}"
}
