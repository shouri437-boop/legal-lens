# ABOUTME: Artifact Registry repository for Legal Lens container images.
# ABOUTME: Stores Docker images for backend and frontend services.

resource "google_artifact_registry_repository" "legal-lens" {
  project       = var.project_id
  location      = var.region
  repository_id = "legal-lens"
  description   = "Docker repository for Legal Lens container images"
  format        = "DOCKER"

  # Cleanup policy for old images
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [
    google_project_service.artifactregistry,
  ]
}
