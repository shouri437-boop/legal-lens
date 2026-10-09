# ABOUTME: Cloud Run service definitions for Legal Lens backend and frontend.
# ABOUTME: Configures scaling, environment, Cloud SQL connection, and public access.

# -----------------------------------------------------------------------------
# Backend Service
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "backend" {
  name                = "legal-lens-backend"
  location            = var.region
  project             = var.project_id
  deletion_protection = false # Hackathon mode

  template {
    service_account = google_service_account.backend.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.legal-lens.repository_id}/backend:latest"

      ports {
        container_port = 8080
      }

      env {
        name  = "PYTHONUNBUFFERED"
        value = "1"
      }

      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.evidence.name
      }

      env {
        name  = "DATABASE_URL"
        value = "postgresql+asyncpg://${google_sql_user.backend.name}:${random_password.db_password.result}@/${google_sql_database.legal-lens.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      # Groq API key for the ADK agent pipeline (from Secret Manager)
      env {
        name = "GROQ_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.groq_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Google Maps API key for geospatial geocoding (from Secret Manager)
      env {
        name = "GOOGLE_MAPS_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_maps_api_key.secret_id
            version = "latest"
          }
        }
      }

      # Frontend URL for JWKS endpoint and CORS origin
      env {
        name  = "FRONTEND_URL"
        value = google_cloud_run_v2_service.frontend.uri
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    # Enable response streaming for SSE (300s = 5 min timeout)
    timeout = "300s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_project_service.sqladmin,
    google_artifact_registry_repository.legal-lens,
  ]
}

# -----------------------------------------------------------------------------
# Frontend Service
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "frontend" {
  name                = "legal-lens-frontend"
  location            = var.region
  project             = var.project_id
  deletion_protection = false # Hackathon mode

  template {
    service_account = google_service_account.frontend.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.legal-lens.repository_id}/frontend:latest"

      ports {
        container_port = 3000
      }

      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "" # Will be updated after backend deploys
      }

      env {
        name  = "NEXT_PUBLIC_VIDEO_URL"
        value = "https://storage.googleapis.com/${google_storage_bucket.media.name}/video.mp4"
      }

      # Database URL for Better Auth (socket-based for Cloud Run)
      env {
        name  = "DATABASE_URL"
        value = "postgresql://${google_sql_user.backend.name}:${random_password.db_password.result}@/${google_sql_database.legal-lens.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
      }

      # Better Auth URL (set via CI/CD after frontend URL known)
      env {
        name  = "BETTER_AUTH_URL"
        value = "" # Updated by CI/CD
      }

      # Better Auth Secret from Secret Manager
      env {
        name = "BETTER_AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.better_auth_secret.secret_id
            version = "latest"
          }
        }
      }

      # Google OAuth from Secret Manager
      env {
        name = "GOOGLE_CLIENT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_client_id.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GOOGLE_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_client_secret.secret_id
            version = "latest"
          }
        }
      }

      # Cloud SQL volume mount
      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    # Cloud SQL volume
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    timeout = "60s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_artifact_registry_repository.legal-lens,
    google_secret_manager_secret.better_auth_secret,
    google_secret_manager_secret.google_client_id,
    google_secret_manager_secret.google_client_secret,
  ]
}

# -----------------------------------------------------------------------------
# Public Access (allUsers invoker)
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
