# ABOUTME: IAM configuration for Legal Lens.
# ABOUTME: Defines service accounts and their IAM bindings for Cloud Run services.

# -----------------------------------------------------------------------------
# Service Accounts
# -----------------------------------------------------------------------------

# Service account for Cloud Run backend
resource "google_service_account" "backend" {
  project      = var.project_id
  account_id   = "legal-lens-backend"
  display_name = "Legal Lens Backend Service Account"
  description  = "Service account for Cloud Run backend service"

  depends_on = [
    google_project_service.iam,
  ]
}

# Service account for Cloud Run frontend
resource "google_service_account" "frontend" {
  project      = var.project_id
  account_id   = "legal-lens-frontend"
  display_name = "Legal Lens Frontend Service Account"
  description  = "Service account for Cloud Run frontend service"

  depends_on = [
    google_project_service.iam,
  ]
}

# -----------------------------------------------------------------------------
# Backend Service Account IAM Bindings
# -----------------------------------------------------------------------------

resource "google_project_iam_member" "backend_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_storage_bucket_iam_member" "backend_storage_access" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}

# Allow backend SA to sign blobs as itself via IAM Credentials API.
# Required for generating V4 signed download URLs on Cloud Run.
resource "google_service_account_iam_member" "backend_self_sign" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.backend.email}"
}

# -----------------------------------------------------------------------------
# Frontend Service Account IAM Bindings
# -----------------------------------------------------------------------------

resource "google_project_iam_member" "frontend_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.frontend.email}"
}
