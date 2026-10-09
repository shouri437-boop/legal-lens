# ABOUTME: Secret Manager resources for authentication secrets.
# ABOUTME: Stores Better Auth secret and Google OAuth credentials.

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  project            = var.project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Secret Definitions
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret" "better_auth_secret" {
  project   = var.project_id
  secret_id = "better-auth-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret" "google_client_id" {
  project   = var.project_id
  secret_id = "google-client-id"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret" "google_client_secret" {
  project   = var.project_id
  secret_id = "google-client-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Groq API key for the ADK agent pipeline (value added manually via GCP Console)
resource "google_secret_manager_secret" "groq_api_key" {
  project   = var.project_id
  secret_id = "groq-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Google Maps API key for geospatial geocoding (value added manually via GCP Console)
resource "google_secret_manager_secret" "google_maps_api_key" {
  project   = var.project_id
  secret_id = "google-maps-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Database password for the Cloud SQL "backend" user (used by CI migrations and Cloud Run)
resource "google_secret_manager_secret" "db_password" {
  project   = var.project_id
  secret_id = "db-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# -----------------------------------------------------------------------------
# IAM: Allow frontend service account to access secrets
# -----------------------------------------------------------------------------

resource "google_secret_manager_secret_iam_member" "frontend_better_auth" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.better_auth_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.frontend.email}"
}

resource "google_secret_manager_secret_iam_member" "frontend_google_client_id" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.google_client_id.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.frontend.email}"
}

resource "google_secret_manager_secret_iam_member" "frontend_google_client_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.google_client_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.frontend.email}"
}

# IAM: Allow backend service account to access Groq API key
resource "google_secret_manager_secret_iam_member" "backend_groq_api_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.groq_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

# IAM: Allow backend service account to access Google Maps API key
resource "google_secret_manager_secret_iam_member" "backend_google_maps_api_key" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.google_maps_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}
