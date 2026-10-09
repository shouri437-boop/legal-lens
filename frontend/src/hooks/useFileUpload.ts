// ABOUTME: React hook for file upload with multi-file status tracking.
// ABOUTME: Tracks each file's progress individually for proper UI feedback.

"use client";

import { useState, useCallback, useRef } from "react";
import { uploadFile, FileResponse } from "@/lib/api/files";
import { emitCaseDataChanged } from "@/lib/case-events";

export type FileUploadStatus = "pending" | "uploading" | "completed" | "error";

export interface FileUploadProgress {
  id: string;
  file: File;
  status: FileUploadStatus;
  error?: string;
  response?: FileResponse;
}

interface UploadState {
  isUploading: boolean;
  files: FileUploadProgress[];
  error: string | null;
}

interface UseFileUploadReturn extends UploadState {
  upload: (files: File[]) => Promise<FileResponse[]>;
  clearError: () => void;
  clearCompleted: () => void;
  /** For backwards compatibility */
  currentFile: string | null;
  progress: number;
}

let uploadIdCounter = 0;

export function useFileUpload(caseId: string): UseFileUploadReturn {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    files: [],
    error: null,
  });

  // Track if upload is in progress to handle concurrent calls
  const uploadInProgress = useRef(false);

  const upload = useCallback(
    async (filesToUpload: File[]): Promise<FileResponse[]> => {
      if (filesToUpload.length === 0) return [];

      // Prevent concurrent uploads
      if (uploadInProgress.current) {
        console.warn("Upload already in progress");
        return [];
      }
      uploadInProgress.current = true;

      const results: FileResponse[] = [];

      // Initialize all files as pending
      const newFiles: FileUploadProgress[] = filesToUpload.map((file) => ({
        id: `upload-${++uploadIdCounter}`,
        file,
        status: "pending" as const,
      }));

      setState({
        isUploading: true,
        files: newFiles,
        error: null,
      });

      // Upload files sequentially
      for (let i = 0; i < newFiles.length; i++) {
        const fileProgress = newFiles[i];

        // Update status to uploading
        setState((s) => ({
          ...s,
          files: s.files.map((f) =>
            f.id === fileProgress.id
              ? { ...f, status: "uploading" as const }
              : f,
          ),
        }));

        try {
          const result = await uploadFile(caseId, fileProgress.file);
          results.push(result);

          // Update status to completed
          setState((s) => ({
            ...s,
            files: s.files.map((f) =>
              f.id === fileProgress.id
                ? { ...f, status: "completed" as const, response: result }
                : f,
            ),
          }));
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Upload failed";

          // Update status to error
          setState((s) => ({
            ...s,
            files: s.files.map((f) =>
              f.id === fileProgress.id
                ? { ...f, status: "error" as const, error: errorMsg }
                : f,
            ),
            error: errorMsg,
          }));
        }
      }

      // Mark upload complete
      setState((s) => ({
        ...s,
        isUploading: false,
      }));

      uploadInProgress.current = false;

      // Notify parent layout that case data changed (file_count updated)
      if (results.length > 0) {
        emitCaseDataChanged();
      }

      return results;
    },
    [caseId],
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const clearCompleted = useCallback(() => {
    setState((s) => ({
      ...s,
      files: s.files.filter(
        (f) => f.status !== "completed" && f.status !== "error",
      ),
    }));
  }, []);

  // Backwards compatibility: derive currentFile and progress
  const currentFile =
    state.files.find((f) => f.status === "uploading")?.file.name ?? null;
  const completedCount = state.files.filter(
    (f) => f.status === "completed" || f.status === "error",
  ).length;
  const progress =
    state.files.length > 0
      ? Math.round((completedCount / state.files.length) * 100)
      : 0;

  return {
    ...state,
    upload,
    clearError,
    clearCompleted,
    currentFile,
    progress,
  };
}
