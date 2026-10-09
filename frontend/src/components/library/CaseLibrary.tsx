"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  Download,
  Trash2,
  AlertTriangle,
  Search,
  Filter,
  Loader2,
  Check,
  Minus,
  Sparkles,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FileUpload } from "@/components/ui/file-upload";
import {
  listFiles,
  getDownloadUrl,
  deleteFile,
  dismissDuplicate,
  bulkDeleteFiles,
  FileResponse,
} from "@/lib/api/files";
import { useFileUpload, FileUploadProgress } from "@/hooks/useFileUpload";
import { useFileUrlCache } from "@/hooks/useFileUrlCache";
import { emitCaseDataChanged } from "@/lib/case-events";
import {
  EvidencePreviewModal,
  type EvidenceFileType,
} from "@/components/ui/evidence-viewer";

// Types for UI display
type SupportedFileType = "pdf" | "video" | "audio" | "image";
type FileCategory = "all" | "evidence" | "legal" | "strategy" | "reference";
type FileStatus = "ready" | "processing" | "conflict" | "error";

interface ConflictInfo {
  type: "duplicate" | "contradiction" | "version";
  message: string;
  existingFile?: string;
  suggestions: string[];
}

interface LibraryFile {
  id: string;
  name: string;
  type: SupportedFileType;
  size: number;
  url: string;
  category: FileCategory;
  status: FileStatus;
  processingProgress?: number;
  conflictInfo?: ConflictInfo;
  uploadedAt: Date;
}

interface CaseLibraryProps {
  caseId: string;
  caseName?: string;
}

/**
 * Map backend file category to frontend category.
 * Backend uses: DOCUMENT, IMAGE, VIDEO, AUDIO
 * Frontend uses: evidence (default), legal, strategy, reference
 */
function mapCategory(backendCategory: string): FileCategory {
  // For now, map all backend categories to "evidence"
  // In the future, category could be stored as file metadata
  void backendCategory;
  return "evidence";
}

/**
 * Map backend file status to frontend status.
 */
function mapStatus(backendStatus: string): FileStatus {
  switch (backendStatus) {
    case "UPLOADING":
    case "QUEUED":
    case "PROCESSING":
      return "processing";
    case "UPLOADED":
    case "ANALYZED":
      return "ready";
    case "ERROR":
      return "error";
    default:
      return "ready";
  }
}

/**
 * Map backend MIME type to frontend file type.
 */
function mapFileType(mimeType: string): SupportedFileType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "pdf"; // Default to pdf for documents
}

/**
 * Convert backend FileResponse to frontend LibraryFile format.
 */
function mapToLibraryFile(file: FileResponse): LibraryFile {
  const libraryFile: LibraryFile = {
    id: file.id,
    name: file.original_filename,
    type: mapFileType(file.mime_type),
    size: file.size_bytes,
    url: "", // URL will be fetched on demand via signed URL
    category: mapCategory(file.category),
    status: mapStatus(file.status),
    uploadedAt: new Date(file.created_at),
  };

  // Add conflict info if this is a duplicate
  if (file.duplicate_of) {
    libraryFile.status = "conflict";
    libraryFile.conflictInfo = {
      type: "duplicate",
      message: `This file is a duplicate of an existing file`,
      existingFile: file.duplicate_of,
      suggestions: ["View Original", "Keep Both", "Remove Duplicate"],
    };
  }

  return libraryFile;
}

export function CaseLibrary({ caseId, caseName }: CaseLibraryProps) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
    new Set(),
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewModalFile, setPreviewModalFile] = useState<LibraryFile | null>(
    null,
  );
  const [preloadedUrls, setPreloadedUrls] = useState<Map<string, string>>(
    new Map(),
  );

  // File upload hook
  const {
    isUploading,
    files: uploadingFiles,
    error: uploadError,
    upload,
    clearError,
    clearCompleted,
  } = useFileUpload(caseId);

  // URL cache hook
  const { getCachedUrl, setCachedUrl, clearCacheForFile } = useFileUrlCache();

  // Fetch files on mount
  useEffect(() => {
    async function fetchFiles() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await listFiles(caseId);
        setFiles(response.files.map(mapToLibraryFile));
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load files",
        );
        // Keep empty array on error - graceful degradation
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFiles();
  }, [caseId]);

  // Refresh file list
  const refreshFiles = useCallback(async () => {
    try {
      const response = await listFiles(caseId);
      setFiles(response.files.map(mapToLibraryFile));
    } catch (err) {
      console.error("Failed to refresh files:", err);
    }
  }, [caseId]);

  // File type icon mapping
  const getFileIcon = useCallback((type: SupportedFileType) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "audio":
        return <Music className="w-4 h-4" />;
      case "image":
        return <ImageIcon className="w-4 h-4" />;
    }
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  // Get status indicator
  const getStatusIndicator = useCallback((file: LibraryFile) => {
    switch (file.status) {
      case "ready":
        return (
          <div className="flex items-center space-x-1 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm">Ready</span>
          </div>
        );
      case "processing":
        return (
          <div className="flex items-center space-x-2">
            <div className="w-16 bg-stone/20 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${file.processingProgress || 0}%` }}
              />
            </div>
            <span className="text-sm text-blue-600">
              {file.processingProgress || 0}%
            </span>
          </div>
        );
      case "conflict":
        return (
          <div className="flex items-center space-x-1 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Conflict</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center space-x-1 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Error</span>
          </div>
        );
    }
  }, []);

  // Filter files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesCategory =
        selectedCategory === "all" || file.category === selectedCategory;
      const matchesSearch = file.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [files, selectedCategory, searchQuery]);

  // File upload handler
  const handleFileUpload = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length > 0) {
        clearError();
        await upload(selectedFiles);
        // Refresh file list after upload
        await refreshFiles();
      }
    },
    [upload, refreshFiles, clearError],
  );

  const handlePreviewFile = useCallback(
    async (file: LibraryFile) => {
      // Check cache or preloaded URLs — if hit, open immediately
      const cachedUrl =
        getCachedUrl(caseId, file.id) || preloadedUrls.get(file.id) || null;
      if (cachedUrl) {
        setPreviewModalFile({ ...file, url: cachedUrl });
        return;
      }

      // Open modal immediately with empty URL (modal shows loading state)
      setPreviewModalFile({ ...file, url: "" });

      try {
        const response = await getDownloadUrl(caseId, file.id, true);
        setCachedUrl(
          caseId,
          file.id,
          response.download_url,
          response.expires_in,
        );
        setPreviewModalFile({ ...file, url: response.download_url });
      } catch (err) {
        console.error("Failed to get file URL:", err);
        setPreviewModalFile(null);
        alert("Failed to load file preview. Please try again.");
      }
    },
    [caseId, getCachedUrl, setCachedUrl, preloadedUrls],
  );

  // Preload URL on hover
  const handlePreloadFile = useCallback(
    async (file: LibraryFile) => {
      // Don't preload if already cached or preloaded
      if (getCachedUrl(caseId, file.id) || preloadedUrls.has(file.id)) {
        return;
      }

      try {
        const response = await getDownloadUrl(caseId, file.id, true);
        setCachedUrl(
          caseId,
          file.id,
          response.download_url,
          response.expires_in,
        );
        setPreloadedUrls((prev) =>
          new Map(prev).set(file.id, response.download_url),
        );
      } catch (err) {
        // Silent fail for preloading
        console.debug("Preload failed:", err);
      }
    },
    [caseId, getCachedUrl, setCachedUrl, preloadedUrls],
  );

  const handleDownloadFile = useCallback(
    async (file: LibraryFile) => {
      try {
        // Fetch download URL with inline=false to force download
        const response = await getDownloadUrl(caseId, file.id, false);
        window.open(response.download_url, "_blank");
      } catch (err) {
        console.error("Failed to get download URL:", err);
        alert("Failed to download file. Please try again.");
      }
    },
    [caseId],
  );

  const handleDeleteFile = useCallback(
    async (file: LibraryFile) => {
      if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) {
        return;
      }

      try {
        await deleteFile(caseId, file.id);
        // Remove from local state
        setFiles((prev) => prev.filter((f) => f.id !== file.id));
        emitCaseDataChanged();
        // Clear from cache
        clearCacheForFile(caseId, file.id);
      } catch (err) {
        console.error("Failed to delete file:", err);
        alert("Failed to delete file. Please try again.");
      }
    },
    [caseId, clearCacheForFile],
  );

  // Conflict resolution handlers
  const handleConflictAction = useCallback(
    async (file: LibraryFile, action: string) => {
      switch (action) {
        case "View Original": {
          // Get the original file ID from conflict info
          const originalId = file.conflictInfo?.existingFile;
          if (!originalId) {
            console.warn("No original file ID found in conflict info");
            break;
          }

          // Scroll to the original file row
          const row = document.querySelector(`[data-file-id="${originalId}"]`);
          if (row) {
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            row.classList.add("ring-2", "ring-blue-500");
            setTimeout(() => {
              row.classList.remove("ring-2", "ring-blue-500");
            }, 2000);
          } else {
            // Original file might not be visible (filtered out or on different page)
            const originalFile = files.find((f) => f.id === originalId);
            if (originalFile) {
              alert(
                `Original file: "${originalFile.name}"\n\nIt may be filtered out or on a different page.`,
              );
            } else {
              alert("Original file not found. It may have been deleted.");
            }
          }
          break;
        }

        case "Keep Both":
          // Dismiss the duplicate status in backend and update local state
          try {
            await dismissDuplicate(caseId, file.id);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id
                  ? {
                      ...f,
                      status: "ready" as FileStatus,
                      conflictInfo: undefined,
                    }
                  : f,
              ),
            );
          } catch (err) {
            console.error("Failed to dismiss duplicate:", err);
            alert("Failed to dismiss duplicate status. Please try again.");
          }
          break;

        case "Remove Duplicate":
          // Delete the duplicate file
          if (
            !confirm(
              `Remove duplicate "${file.name}"? This will permanently delete this file.`,
            )
          ) {
            return;
          }
          try {
            await deleteFile(caseId, file.id);
            setFiles((prev) => prev.filter((f) => f.id !== file.id));
            emitCaseDataChanged();
          } catch (err) {
            console.error("Failed to remove duplicate:", err);
            alert("Failed to remove duplicate. Please try again.");
          }
          break;
      }
    },
    [caseId, files],
  );

  // Selection handlers
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedFileIds((prev) => {
      // If all filtered files are selected, deselect all
      const allSelected = filteredFiles.every((f) => prev.has(f.id));
      if (allSelected) {
        return new Set();
      }
      // Otherwise, select all filtered files
      return new Set(filteredFiles.map((f) => f.id));
    });
  }, [filteredFiles]);

  const clearSelection = useCallback(() => {
    setSelectedFileIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (selectedFileIds.size === 0) return;

    const count = selectedFileIds.size;
    if (
      !confirm(
        `Delete ${count} file${count > 1 ? "s" : ""}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await bulkDeleteFiles(caseId, Array.from(selectedFileIds));

      // Remove deleted files from local state
      setFiles((prev) =>
        prev.filter(
          (f) => !selectedFileIds.has(f.id) || result.failed_ids.includes(f.id),
        ),
      );

      // Clear selection
      setSelectedFileIds(new Set());

      if (result.failed_ids.length > 0) {
        alert(
          `Deleted ${result.deleted_count} files. ${result.failed_ids.length} files failed to delete.`,
        );
      }

      if (result.deleted_count > 0) {
        emitCaseDataChanged();
      }
    } catch (err) {
      console.error("Bulk delete failed:", err);
      alert("Failed to delete files. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [caseId, selectedFileIds]);

  // Compute selection state for "select all" checkbox
  const selectionState = useMemo(() => {
    if (filteredFiles.length === 0) return "none";
    const selectedCount = filteredFiles.filter((f) =>
      selectedFileIds.has(f.id),
    ).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === filteredFiles.length) return "all";
    return "partial";
  }, [filteredFiles, selectedFileIds]);

  // Category badge color
  const getCategoryColor = (category: FileCategory) => {
    switch (category) {
      case "evidence":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "legal":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "strategy":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "reference":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      default:
        return "bg-stone/20 text-stone";
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-warm-gray/15 dark:border-stone/15">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-medium text-foreground">
              Evidence Library
            </h1>
            {caseName && (
              <p className="text-xs mt-0.5 text-stone">{caseName}</p>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {filteredFiles.length}{" "}
                {filteredFiles.length === 1 ? "file" : "files"}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Status - Multi-file progress */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-6 mt-4"
          >
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {isUploading && (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  )}
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    {isUploading
                      ? `Uploading ${uploadingFiles.length} file${uploadingFiles.length > 1 ? "s" : ""}...`
                      : "Upload complete"}
                  </span>
                </div>
                {!isUploading && (
                  <button
                    onClick={() => {
                      clearCompleted();
                      refreshFiles();
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Dismiss
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {uploadingFiles.map((fileProgress: FileUploadProgress) => (
                  <div
                    key={fileProgress.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span
                      className="truncate max-w-50"
                      style={{ color: "var(--foreground)" }}
                    >
                      {fileProgress.file.name}
                    </span>
                    <div className="flex items-center space-x-2">
                      {fileProgress.status === "pending" && (
                        <span className="text-xs text-stone-500">Pending</span>
                      )}
                      {fileProgress.status === "uploading" && (
                        <div className="flex items-center space-x-1">
                          <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
                          <span className="text-xs text-blue-600">
                            Uploading
                          </span>
                        </div>
                      )}
                      {fileProgress.status === "completed" && (
                        <span className="text-xs text-green-600">Done</span>
                      )}
                      {fileProgress.status === "error" && (
                        <span
                          className="text-xs text-red-600"
                          title={fileProgress.error}
                        >
                          Failed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Error */}
      <AnimatePresence>
        {uploadError && !isUploading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-6 mt-4"
          >
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm text-red-800 dark:text-red-300">
                    {uploadError}
                  </span>
                </div>
                <button
                  onClick={clearError}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Load Error */}
      <AnimatePresence>
        {loadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-6 mt-4"
          >
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-red-800 dark:text-red-300">
                  {loadError}
                </span>
                <button
                  onClick={refreshFiles}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  Retry
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Upload Zone */}
      <div className="mx-6 mt-6">
        <div className="border border-dashed border-warm-gray/25 dark:border-stone/30 rounded-lg overflow-hidden">
          <FileUpload
            onChange={handleFileUpload}
            hideSelectedFiles={true}
            multiple={true}
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Filters and Search */}
      <div className="px-6 py-4 space-y-4">
        {/* Category Filters with Quick Analysis Tip */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Filter:</span>
            {(
              [
                "all",
                "evidence",
                "legal",
                "strategy",
                "reference",
              ] as FileCategory[]
            ).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2.5 py-0.5 text-xs rounded-lg transition-colors ${
                  selectedCategory === category
                    ? "bg-accent-light dark:bg-[#f5f4ef] text-cream dark:text-charcoal"
                    : "bg-warm-gray/8 dark:bg-stone/10 text-muted-foreground hover:bg-warm-gray/12 dark:hover:bg-stone/15"
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>

        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 text-sm rounded-lg border border-warm-gray/15 dark:border-stone/15 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent-light/30 dark:focus:ring-[#f5f4ef]/30 transition-colors"
          />
        </div>
      </div>

      {/* Conflict Alert */}
      <AnimatePresence>
        {filteredFiles.some((f) => f.status === "conflict") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-6 mb-4"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-900 dark:text-amber-300 mb-2">
                    Attention Required (
                    {
                      filteredFiles.filter((f) => f.status === "conflict")
                        .length
                    }
                    )
                  </h3>
                  {filteredFiles
                    .filter((f) => f.status === "conflict")
                    .map((file) => (
                      <div key={file.id} className="mb-3 last:mb-0">
                        <div className="font-medium text-sm text-amber-900 dark:text-amber-300">
                          {file.name} - CONFLICT DETECTED
                        </div>
                        <div className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                          {file.conflictInfo?.message}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          {file.conflictInfo?.suggestions.map(
                            (suggestion, index) => (
                              <button
                                key={index}
                                onClick={() =>
                                  handleConflictAction(file, suggestion)
                                }
                                className="px-3 py-1 text-xs rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedFileIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-6 mb-4"
          >
            <div className="flex items-center justify-between rounded-lg px-4 py-3 bg-blue-500/15 dark:bg-blue-500/15 border border-blue-500/30 dark:border-blue-500/30">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  {selectedFileIds.size} file
                  {selectedFileIds.size > 1 ? "s" : ""} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline hover:no-underline"
                >
                  Clear selection
                </button>
              </div>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="flex items-center space-x-2 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Delete Selected</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List */}
      <div className="px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {files.length === 0
                ? "No files uploaded yet. Drag & drop files above to get started."
                : "No files match your search criteria."}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-warm-gray/15 dark:border-stone/15 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-warm-gray/15 dark:border-stone/15 text-xs uppercase tracking-wide bg-warm-white dark:bg-jet text-muted-foreground">
                  <th className="w-12 px-4 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
                        selectionState === "none"
                          ? "border-warm-gray/40 dark:border-stone/50 hover:border-warm-gray/60 dark:hover:border-stone/70"
                          : "border-blue-500 bg-blue-500"
                      }`}
                      title={
                        selectionState === "all" ? "Deselect all" : "Select all"
                      }
                    >
                      {selectionState === "all" && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                      {selectionState === "partial" && (
                        <Minus className="w-3 h-3 text-white" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-left">File Name</th>
                  <th className="px-4 py-3 font-medium text-center">Type</th>
                  <th className="px-4 py-3 font-medium text-left">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, index) => (
                  <motion.tr
                    key={file.id}
                    data-file-id={file.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-warm-gray/15 dark:border-stone/15 hover:bg-warm-gray/8 dark:hover:bg-stone/10 transition-colors ${
                      selectedFileIds.has(file.id) ? "bg-blue-500/10" : ""
                    }`}
                  >
                    <td className="w-12 px-4 py-4">
                      <button
                        onClick={() => toggleFileSelection(file.id)}
                        className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
                          selectedFileIds.has(file.id)
                            ? "border-blue-500 bg-blue-500"
                            : "border-warm-gray/40 dark:border-stone/60 hover:border-warm-gray/60 dark:hover:border-stone/80"
                        }`}
                      >
                        {selectedFileIds.has(file.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="shrink-0 text-muted-foreground">
                          {getFileIcon(file.type)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {file.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(file.category)}`}
                      >
                        {file.category.charAt(0).toUpperCase() +
                          file.category.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-4">{getStatusIndicator(file)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handlePreviewFile(file)}
                          onMouseEnter={() => handlePreloadFile(file)}
                          className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                          title="Preview file"
                        >
                          <Eye className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file)}
                          className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                          title="Download file"
                        >
                          <Download className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="p-1.5 rounded hover:bg-warm-gray/12 dark:hover:bg-stone/15 transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evidence Preview Modal */}
      {previewModalFile && (
        <EvidencePreviewModal
          isOpen={!!previewModalFile}
          onClose={() => setPreviewModalFile(null)}
          url={previewModalFile.url}
          type={previewModalFile.type as EvidenceFileType}
          fileName={previewModalFile.name}
          onDownload={() => handleDownloadFile(previewModalFile)}
        />
      )}
    </div>
  );
}
