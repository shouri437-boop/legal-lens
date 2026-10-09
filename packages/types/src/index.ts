// ABOUTME: Re-exports generated TypeScript types for frontend consumption.
// ABOUTME: Generated types are derived from the backend OpenAPI schema.

export type { paths, components, operations } from "./generated/api";

// Stable named exports used across the frontend.
export type HealthResponse =
  import("./generated/api").components["schemas"]["HealthResponse"];

export type ErrorResponse =
  import("./generated/api").components["schemas"]["ErrorResponse"];

export type CaseCreate =
  import("./generated/api").components["schemas"]["CaseCreate"];
export type CaseUpdate =
  import("./generated/api").components["schemas"]["CaseUpdate"];
export type CaseResponse =
  import("./generated/api").components["schemas"]["CaseResponse"];
export type CaseListResponse =
  import("./generated/api").components["schemas"]["CaseListResponse"];

export type CaseType =
  import("./generated/api").components["schemas"]["CaseType"];
export type CaseStatus =
  import("./generated/api").components["schemas"]["CaseStatus"];
