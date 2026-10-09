# ABOUTME: Cloud SQL PostgreSQL instance configuration for Legal Lens.
# ABOUTME: Defines database instance, database, and user resources.

# Random password for database user
resource "random_password" "db_password" {
  length  = 32
  special = false
}

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "main" {
  name             = "legal-lens-db-${var.environment}"
  database_version = "POSTGRES_17"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = "db-g1-small" # 1 shared vCPU, 1.7GB RAM (Cost/Performance sweet spot)
    edition           = "ENTERPRISE"  # Required for db-g1-small tier
    availability_type = "ZONAL"       # Single zone for cost savings
    disk_size         = 10            # Minimum disk size in GB
    disk_type         = "PD_SSD"

    ip_configuration {
      ipv4_enabled    = true # Enable public IP for simplicity in hackathon
      private_network = null
    }

    backup_configuration {
      enabled = false # No backups per CONTEXT.md (hackathon)
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = false # Hackathon mode

  depends_on = [
    google_project_service.sqladmin,
  ]
}

# Database within the instance
resource "google_sql_database" "legal-lens" {
  name     = "legal-lens"
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# Database user for backend
resource "google_sql_user" "backend" {
  name     = "backend"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}
