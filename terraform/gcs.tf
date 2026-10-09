# ABOUTME: Google Cloud Storage bucket configuration for Legal Lens evidence storage.
# ABOUTME: Defines bucket with CORS, lifecycle rules, and IAM bindings.

# Evidence storage bucket
resource "google_storage_bucket" "evidence" {
  name          = "${var.project_id}-evidence"
  location      = var.region
  project       = var.project_id
  force_destroy = true # Allow deletion with objects for hackathon

  uniform_bucket_level_access = true

  # CORS configuration for frontend direct uploads
  cors {
    origin          = ["*"] # Restrict in production
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  # Lifecycle rule for cleanup after 30 days
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [
    google_project_service.storage,
  ]
}

# Media storage bucket for static assets (videos, images)
resource "google_storage_bucket" "media" {
  name          = "${var.project_id}-media"
  location      = var.region
  project       = var.project_id
  force_destroy = true

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length", "Content-Range"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.storage]
}

# Public read access for media bucket
resource "google_storage_bucket_iam_member" "media_public" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
