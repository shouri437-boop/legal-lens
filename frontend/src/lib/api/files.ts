// ABOUTME: API client for file operations - upload, list, download, delete.
// ABOUTME: Handles multipart upload and signed URL retrieval.

import { getToken } from "@/lib/auth-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface FileResponse {
  id: string;
  case_id: string;
  name: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  category: "DOCUMENT" | "IMAGE" | "VIDEO" | "AUDIO";
  status:
    | "UPLOADING"
    | "UPLOADED"
    | "QUEUED"
    | "PROCESSING"
    | "ANALYZED"
    | "ERROR";
  content_hash: string;
  description: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  duplicate_of: string | null;
}

export interface FileListResponse {
  files: FileResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface DownloadUrlResponse {
  download_url: string;
  expires_in: number;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  // Authentication is disabled locally: send no header when there is no token.
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listFiles(
  caseId: string,
  page = 1,
  perPage = 50,
): Promise<FileListResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_URL}/api/cases/${caseId}/files?page=${page}&per_page=${perPage}`,
    { headers },
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to list files" }));
    throw new Error(error.detail || "Failed to list files");
  }
  return res.json();
}

export async function uploadFile(
  caseId: string,
  file: File,
  description?: string,
): Promise<FileResponse> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);
  if (description) formData.append("description", description);

  const res = await fetch(`${API_URL}/api/cases/${caseId}/files`, {
    method: "POST",
    headers, // Note: Don't set Content-Type, let browser set it with boundary
    body: formData,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }
  return res.json();
}

export async function getDownloadUrl(
  caseId: string,
  fileId: string,
  inline: boolean = false,
): Promise<DownloadUrlResponse> {
  const headers = await getAuthHeaders();
  const inlineParam = inline ? "?inline=true" : "";
  const res = await fetch(
    `${API_URL}/api/cases/${caseId}/files/${fileId}/download${inlineParam}`,
    { headers },
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to get download URL" }));
    throw new Error(error.detail || "Failed to get download URL");
  }
  const data: DownloadUrlResponse = await res.json();
  return data; // Return full response with expires_in
}

export async function deleteFile(
  caseId: string,
  fileId: string,
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/cases/${caseId}/files/${fileId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to delete file" }));
    throw new Error(error.detail || "Failed to delete file");
  }
}

export async function dismissDuplicate(
  caseId: string,
  fileId: string,
): Promise<FileResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(
    `${API_URL}/api/cases/${caseId}/files/${fileId}/dismiss-duplicate`,
    {
      method: "PATCH",
      headers,
    },
  );
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to dismiss duplicate" }));
    throw new Error(error.detail || "Failed to dismiss duplicate");
  }
  return res.json();
}

export interface BulkDeleteResponse {
  deleted_count: number;
  failed_ids: string[];
}

export async function bulkDeleteFiles(
  caseId: string,
  fileIds: string[],
): Promise<BulkDeleteResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/cases/${caseId}/files/bulk-delete`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_ids: fileIds }),
  });
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ detail: "Failed to delete files" }));
    throw new Error(error.detail || "Failed to delete files");
  }
  return res.json();
}
