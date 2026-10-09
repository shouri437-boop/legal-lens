# Phase 3: File Ingestion - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable evidence file upload, storage, and management for legal investigation cases. Backend APIs designed to serve **both web and future mobile clients** — the upload service is client-agnostic. Files stored in GCS with metadata in PostgreSQL. This phase covers upload, view, download, delete — agent analysis is triggered separately (Phase 4+).

**In scope:** Backend APIs, GCS storage, database schema, SSE events, mobile-ready auth tokens
**Out of scope:** Mobile frontend UI (future phase), agent processing (Phase 4+)

</domain>

<decisions>
## Implementation Decisions

### Upload Flow
- Simple state feedback only (Uploading → Processing → Ready), no percentage progress bars
- Maximum file size: 500MB
- Sequential uploads (one file at a time) — simpler error handling
- Auto-retry 3 times on failure, show error only after all retries exhausted
- Whitelist file types: PDF, images (jpg/png/gif/webp), video (mp4/mov/webm), audio (mp3/wav/m4a), Office docs (docx/xlsx/pptx) — reject others
- Warn on duplicate content (hash match) but allow user to proceed
- Optional description field during upload
- Batch analysis on demand — user uploads multiple files, then triggers "Analyze" for all queued files

### File Organization
- GCS path structure: `cases/{case_id}/files/{file_uuid}.{ext}`
- Filenames stored as UUID in GCS, original filename preserved in database metadata for display
- Database metadata: name, original_filename, mime_type, size, upload_date, case_id, uploader_id, content_hash, page_count (docs), duration (media)
- Categories auto-detected from MIME type: document, image, video, audio

### Status & Processing
- 5-state lifecycle: UPLOADING → UPLOADED → QUEUED → PROCESSING → ANALYZED (or ERROR)
- Specific error messages shown to user (e.g., "Unable to extract text from PDF") with retry option
- Re-processing only available for files in ERROR or CONFLICT state
- Real-time status updates via SSE push

### Access & Security
- Signed URLs for file download (GCS signed URLs)
- URL expiration: 24 hours
- Hard delete — immediately remove from GCS and database
- Access limited to case owner only (no collaboration in this phase)
- No upload rate limits

### Mobile-Ready Backend
- API designed to serve both web frontend and future mobile field report app
- All file types supported on mobile (same as web)
- Geolocation metadata captured if provided by client (optional, stored in file metadata)
- Device-linked authentication tokens — one-time login generates long-lived refresh token for mobile devices
- Online uploads only (no offline queue/sync — simplifies initial implementation)
- Same upload endpoints work for both clients — mobile just sends simpler requests

### Claude's Discretion
- Specific MIME type whitelist details
- Content hash algorithm (SHA-256 recommended)
- SSE event schema for file status updates
- Database migration structure
- Upload chunk size for large files
- Error message wording
- Device token format and expiration policy
- Geolocation metadata schema (lat/lng/accuracy/timestamp)

</decisions>

<specifics>
## Specific Ideas

- Frontend already built by Yatharth — handlers are stubbed (`handleDrop`, `handleViewFile`, `handleDownloadFile`, `handleDeleteFile`)
- Must integrate with existing `CaseLibrary.tsx` component
- Conflict detection UI already exists in frontend — backend needs to supply conflict data

</specifics>

<deferred>
## Deferred Ideas

- **Mobile field report UI** — The mobile webapp frontend for field investigators. Backend is ready in this phase; mobile UI is a separate phase.
- **Offline upload queue** — Store uploads locally on mobile, sync when connected. Online-only for now.
- **Case collaboration** — Multiple users accessing same case files. Owner-only for now.
- **Soft delete / trash** — Keeping deleted files recoverable. Hard delete chosen for simplicity.

</deferred>

---

*Phase: 03-file-ingestion*
*Context gathered: 2026-02-02*
