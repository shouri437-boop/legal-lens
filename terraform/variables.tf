# ABOUTME: Terraform variable definitions for Legal Lens infrastructure.
# ABOUTME: Defines all configurable parameters for GCP resources.

variable "project_id" {
  description = "GCP project ID for Legal Lens deployment"
  type        = string
}

variable "region" {
  description = "GCP region for resource deployment"
  type        = string
  default     = "europe-west3"
}

variable "environment" {
  description = "Deployment environment (prod, dev)"
  type        = string
  default     = "prod"
}
