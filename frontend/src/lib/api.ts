// ABOUTME: API client configuration for Legal Lens backend
// ABOUTME: Provides type-safe fetch wrapper and health check function

import type { HealthResponse } from "@legal-lens/types";

/**
 * Base URL for API requests.
 * Uses NEXT_PUBLIC_API_URL from environment, defaults to localhost:8080.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Type-safe fetch wrapper for API requests.
 * Handles JSON parsing and error responses.
 */
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Check the health status of the backend API.
 * @returns Health status response
 */
export async function checkHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>("/health");
}

/**
 * Check the health status of the backend API including database.
 * @returns Health status response with database status
 */
export async function checkHealthDB(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>("/health/db");
}

export { API_BASE_URL, fetchAPI };
