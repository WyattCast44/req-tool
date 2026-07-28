# Operational Test Requirements Manager

Standalone, offline browser application for creating, reviewing, tracing, and assessing operational test requirements.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Zustand
- TanStack Table (sortable / filterable / resizable / hideable data tables)
- IndexedDB (`idb`) for local working autosave
- DOMPurify for rich-text sanitization

## Offline / standalone use

1. Build the application:

```bash
npm install
npm run build
```

2. Open the generated single-file app:

```text
dist/index.html
```

The production build inlines JS/CSS into one HTML file (no CDN, no remote fonts, no network requests). Use Microsoft Edge or Google Chrome. Hash-based routing supports `file://` opens.

## Project save files

Authoritative data is stored in portable `.otreq` JSON files.

- Import an existing `.otreq` file to review
- Enter **Edit Mode** to make changes
- Changes autosave to IndexedDB as a local working copy
- Export a replacement `.otreq` file and replace the network-share copy per team SOP

Local browser storage is never the authoritative record.

## Example project files

Import from the welcome screen:

```text
examples/Requirements_SIMPLE_v001_2026-07-26.otreq
examples/Requirements_STRESS_v001_2026-07-26.otreq
```

- **Small demo** (`SIMPLE_v001`): 12 requirements plus standalone and linked watch items, sources, relationships, activities, assessments, tags, and intentional dashboard gaps.
- **Stress dataset** (`STRESS_v001`): ~900 requirements, 64 watch items, linked sources, ~770 requirement relationships, 48 activities, and hundreds of verifications/assessments for UX performance testing.

Regenerate with:

```bash
npm run generate:example
npm run generate:stress
```

## Development

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## MVP capabilities

- Review Mode (default) and explicit Edit Mode
- Project dashboard with status, verification, gaps, and recent changes
- Requirements table with search, filters, tags, saved views, pagination
- Reusable source records with rich notes and typed, pinpoint requirement relationships
- Requirement detail with source traceability, requirement relationships, activities, verification, evidence paths, assessments
- Traceability matrix and focused relationship graph
- Test activity records
- Lookup/tag management
- CSV and Word exports, printable requirement reports, `.otreq` import/export
- Deletion confirmations with impact summary
