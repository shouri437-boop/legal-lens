# Legal Lens's Diary Feature Specification

## Overview
A mobile-first note-taking extension for on-the-go investigators, accessible via a pencil icon in the sidebar.

## Feature Components

### 1. Sidebar Integration
- Add pencil icon (`PenLine` from lucide-react) to the navigation
- Route: `/cases/[id]/notebook` or a global `/notebook`

### 2. Legal Lens's Diary UI
A mobile-optimized interface with three main sections:

#### A. Note Entry
- **Text Notes**: Simple textarea with save functionality
- **Audio Notes**: 
  - Record button using Web Audio API / MediaRecorder
  - Upload existing audio files
  - Auto-save recordings as MP3/WebM

#### B. Notes Directory
- List view showing all notes for the current case
- Each note displays:
  - AI-generated title (via Gemini)
  - AI-generated subtitle/summary
  - Date created
  - Type indicator (text/audio)
- Sorted by date (newest first)

#### C. Chat Integration
- Floating chatbot button (reuse existing Chatbot component)
- Future: Notes will be integrated into chatbot memory

### 3. Export to Evidence
Each note in the directory has an "Export as Evidence" button:
- **Audio notes**: Upload MP3 directly to GCS evidence bucket
- **Text notes**: Convert to PDF, then upload to GCS evidence bucket
- Uses existing file upload infrastructure

### 4. Mobile-First UX
- Optimized for small screens
- Bottom navigation for main actions
- Swipe gestures for note navigation
- Responsive but mobile-first design

### 5. Device Detection
- In middleware, detect mobile devices via User-Agent
- On mobile login, redirect to `/cases/[id]/notebook` by default
- Add toggle to switch to full desktop view

## Technical Implementation

### Backend API Endpoints
```
POST /api/cases/{case_id}/notes           - Create note
GET  /api/cases/{case_id}/notes           - List notes
GET  /api/cases/{case_id}/notes/{id}      - Get single note
PUT  /api/cases/{case_id}/notes/{id}      - Update note
DELETE /api/cases/{case_id}/notes/{id}    - Delete note
POST /api/cases/{case_id}/notes/{id}/export - Export to evidence
POST /api/cases/{case_id}/notes/generate-metadata - AI generate title/subtitle
```

### Database Schema
```sql
CREATE TABLE case_notes (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES cases(id),
  user_id TEXT NOT NULL,
  type VARCHAR(10) NOT NULL, -- 'text' or 'audio'
  content TEXT, -- For text notes
  audio_storage_path VARCHAR(500), -- For audio notes
  audio_duration_seconds INTEGER,
  title VARCHAR(255), -- AI-generated
  subtitle TEXT, -- AI-generated
  is_exported BOOLEAN DEFAULT FALSE,
  exported_file_id UUID REFERENCES case_files(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX idx_case_notes_user_id ON case_notes(user_id);
```

### Frontend Pages/Components
- `/app/(app)/cases/[id]/notebook/page.tsx` - Main notebook page
- `/components/notebook/` - All notebook components
  - `NoteEditor.tsx` - Text/audio note editor
  - `AudioRecorder.tsx` - Audio recording component
  - `NotesList.tsx` - Directory list view
  - `NoteCard.tsx` - Individual note display
  - `ExportButton.tsx` - Export to evidence button

### Gemini Integration
Use existing Gemini configuration for title/subtitle generation:
- Small context window call
- Input: Note content (text or audio transcript)
- Output: { title: string, subtitle: string }

## Implementation Phases

### Phase 1: Core Infrastructure ✅
1. Database migration for case_notes table
2. Backend API endpoints
3. Basic frontend page structure

### Phase 2: Text Notes ✅
1. Note editor component
2. Create/edit/delete text notes
3. Notes list view

### Phase 3: Audio Notes ✅
1. Audio recorder component
2. Audio upload to GCS
3. Audio playback

### Phase 4: AI Metadata ✅
1. Gemini integration for title/subtitle
2. Auto-generate on save
3. Manual regenerate option

### Phase 5: Export to Evidence ✅
1. Text to PDF conversion (via reportlab)
2. Audio export
3. Evidence library integration

### Phase 6: Mobile Detection ✅
1. Middleware device detection
2. Mobile routing
3. Full/mobile view toggle

---

## Implementation Status

### Backend Files Created/Modified:
- `backend/alembic/versions/add_case_notes_table.py` - Database migration
- `backend/app/models/note.py` - CaseNote SQLAlchemy model
- `backend/app/models/__init__.py` - Added note model export
- `backend/app/models/case.py` - Added notes relationship
- `backend/app/schemas/notes.py` - Pydantic schemas for notes API
- `backend/app/schemas/__init__.py` - Added notes schema exports
- `backend/app/api/notes.py` - Full CRUD + export API endpoints
- `backend/app/main.py` - Registered notes router

### Frontend Files Created/Modified:
- `frontend/src/lib/api/notes.ts` - Notes API client
- `frontend/src/hooks/useNotes.ts` - React hook for notes management
- `frontend/src/hooks/index.ts` - Added useNotes export
- `frontend/src/components/notebook/AudioRecorder.tsx` - Audio recording component
- `frontend/src/components/notebook/NoteCard.tsx` - Note display card
- `frontend/src/components/notebook/Notebook.tsx` - Main notebook interface
- `frontend/src/components/notebook/ViewToggle.tsx` - Mobile/desktop view toggle
- `frontend/src/components/notebook/index.ts` - Barrel exports
- `frontend/src/components/app/case-nav-section.tsx` - Added Legal Lens's Diary tab
- `frontend/src/middleware.ts` - Mobile detection and routing
- `frontend/src/app/(app)/cases/[id]/notebook/page.tsx` - Notebook page route

### Required Backend Dependencies:
- `reportlab` - For PDF generation (text notes export)

### To Complete Setup:
1. Run database migrations: `make migrate`
2. Install reportlab: `cd backend && uv add reportlab`
3. Restart backend: `make dev-backend`
4. Test the notebook at: `/cases/{caseId}/notebook`

