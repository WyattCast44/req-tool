import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { FILE_EXTENSION } from '../types/project'
import { formatDateTime } from '../lib/ids'

export function WelcomePage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [projectName, setProjectName] = useState('New Operational Test Project')
  const [messages, setMessages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const hydrated = useProjectStore((s) => s.hydrated)
  const project = useProjectStore((s) => s.project)
  const recoveryAvailable = useProjectStore((s) => s.recoveryAvailable)
  const hasUnexportedChanges = useProjectStore((s) => s.hasUnexportedChanges)
  const localSavedAt = useProjectStore((s) => s.localSavedAt)
  const createProject = useProjectStore((s) => s.createProject)
  const importProjectFile = useProjectStore((s) => s.importProjectFile)
  const discardLocalAndClear = useProjectStore((s) => s.discardLocalAndClear)
  const loadIssues = useProjectStore((s) => s.loadIssues)

  useEffect(() => {
    if (hydrated && project && !recoveryAvailable && !hasUnexportedChanges) {
      navigate('/', { replace: true })
    }
  }, [hydrated, project, recoveryAvailable, hasUnexportedChanges, navigate])

  if (!hydrated) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-sm text-[var(--color-ink-muted)]">Loading local workspace…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center gap-4 px-3 py-8">
      <header className="space-y-1.5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">
          Offline Standalone Application
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)] md:text-3xl">
          Operational Test Requirements Manager
        </h1>
        <p className="max-w-2xl text-[0.85rem] text-[var(--color-ink-muted)]">
          Create, review, trace, and assess operational test requirements using a portable{' '}
          {FILE_EXTENSION} project file. Works entirely offline in Chrome and Edge — no servers, no
          installation, no network calls.
        </p>
      </header>

      {project && (recoveryAvailable || hasUnexportedChanges || loadIssues.length > 0) && (
        <div className="panel border-[var(--color-warn)] bg-[var(--color-warn-bg)] px-5 py-4">
          <h2 className="font-semibold text-[var(--color-warn)]">Local recovery data available</h2>
          <p className="mt-1 text-sm">
            Browser working storage contains unsaved-export changes
            {localSavedAt ? ` from ${formatDateTime(localSavedAt)}` : ''}. You can continue with the
            recovered project or discard it and load the authoritative save file.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              Continue with Local Changes
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void discardLocalAndClear().then(() => setMessages(['Local working changes discarded.']))
              }}
            >
              Discard Local Changes
            </button>
          </div>
          {loadIssues.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm">
              {loadIssues.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {project && !recoveryAvailable && !hasUnexportedChanges && (
        <div className="panel px-5 py-4">
          <p className="text-sm">A project is already loaded in this browser workspace.</p>
          <button type="button" className="btn btn-primary mt-3" onClick={() => navigate('/')}>
            Open Dashboard
          </button>
        </div>
      )}

      <div className="grid gap-2.5 md:grid-cols-2">
        <section className="panel p-3">
          <h2 className="page-title">Open Project File</h2>
          <p className="mt-1 text-[0.78rem] text-[var(--color-ink-muted)]">
            Select an authoritative {FILE_EXTENSION} save file. The application opens in Review Mode.
            Try <span className="mono">examples/EaglesNest_Requirements_STRESS_v001_2026-07-26.otreq</span> for a
            900-requirement stress dataset.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".otreq,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setBusy(true)
              void importProjectFile(file).then((result) => {
                setBusy(false)
                setMessages(result.messages)
                if (result.ok) navigate('/')
                e.target.value = ''
              })
            }}
          />
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? 'Validating…' : `Import ${FILE_EXTENSION} File`}
          </button>
        </section>

        <section className="panel p-3">
          <h2 className="page-title">Create New Project</h2>
          <p className="mt-1 text-[0.78rem] text-[var(--color-ink-muted)]">
            Start an empty project or load a small in-app demo dataset.
          </p>
          <label className="mt-3 block">
            <span className="field-label">Project name</span>
            <input
              className="field-input"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void createProject(projectName || 'New Operational Test Project').then(() => navigate('/'))
              }}
            >
              Create Empty Project
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void createProject('EaglesNest OT Requirements', true).then(() => navigate('/'))
              }}
            >
              Create Sample Project
            </button>
          </div>
        </section>
      </div>

      {messages.length > 0 && (
        <div className="panel px-5 py-4">
          <h3 className="font-semibold">Import notes</h3>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <footer className="text-xs text-[var(--color-ink-muted)]">
        Local autosave is a convenience only. The portable project save file remains the authoritative
        record. Team SOP governs single-writer control of the network share copy.
      </footer>
    </div>
  )
}
