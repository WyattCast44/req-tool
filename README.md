# Operational Test Requirements Manager

Standalone, offline browser application for creating, reviewing, tracing, and assessing operational test requirements.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Zustand
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
- Requirement detail with relationships, activities, verification, evidence paths, assessments
- Traceability matrix and focused relationship graph
- Test activity records
- Lookup/tag management
- CSV exports, printable requirement reports, `.otreq` import/export
- Deletion confirmations with impact summary
