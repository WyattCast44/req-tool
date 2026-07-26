import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { formatDateTime } from '../lib/ids'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requirements', label: 'Requirements' },
  { to: '/matrix', label: 'Traceability Matrix' },
  { to: '/graph', label: 'Relationship Graph' },
  { to: '/activities', label: 'Test Activities' },
  { to: '/views', label: 'Saved Views' },
  { to: '/reports', label: 'Reports & Exports' },
  { to: '/lookups', label: 'Lookups & Tags' },
  { to: '/settings', label: 'Project Settings' },
]

export function AppShell() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)
  const mode = useProjectStore((s) => s.mode)
  const hasUnexportedChanges = useProjectStore((s) => s.hasUnexportedChanges)
  const localSavedAt = useProjectStore((s) => s.localSavedAt)
  const stateLabel = useProjectStore((s) => s.stateLabel)
  const enterEditMode = useProjectStore((s) => s.enterEditMode)
  const exitEditMode = useProjectStore((s) => s.exitEditMode)
  const exportProject = useProjectStore((s) => s.exportProject)
  const toast = useProjectStore((s) => s.toast)
  const setToast = useProjectStore((s) => s.setToast)
  const loadIssues = useProjectStore((s) => s.loadIssues)
  const discardLocalAndClear = useProjectStore((s) => s.discardLocalAndClear)

  if (!project) return <Outlet />

  const label = stateLabel()
  const editing = mode === 'edit'

  return (
    <div className={`app-shell ${editing ? 'edit-active' : ''}`}>
      {project.metadata.classificationBanner && (
        <div className="no-print bg-[var(--color-banner)] px-4 py-1.5 text-center text-xs font-bold tracking-[0.14em] text-white">
          {project.metadata.classificationBanner}
        </div>
      )}

      <header
        className={`no-print border-b px-4 py-3 ${
          editing
            ? 'border-[var(--color-edit)] bg-[var(--color-edit-bg)]'
            : 'border-[var(--color-line)] bg-white/90'
        }`}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              Operational Test Requirements Manager
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold leading-tight">
              {project.metadata.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`badge ${
                  hasUnexportedChanges
                    ? 'border-amber-400 bg-[var(--color-warn-bg)] text-[var(--color-warn)]'
                    : editing
                      ? 'border-amber-500 bg-white text-[var(--color-edit)]'
                      : 'border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                {label}
              </span>
              {localSavedAt && (
                <span className="text-[var(--color-ink-muted)]">Local save {formatDateTime(localSavedAt)}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <button type="button" className="btn btn-secondary" onClick={exitEditMode}>
                Exit Edit Mode
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={enterEditMode}>
                Enter Edit Mode
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void exportProject()}
              disabled={!project}
            >
              Export Project File
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (
                  hasUnexportedChanges &&
                  !window.confirm('Discard local working copy and return to the welcome screen?')
                ) {
                  return
                }
                void discardLocalAndClear().then(() => navigate('/'))
              }}
            >
              Close Project
            </button>
          </div>
        </div>
      </header>

      {loadIssues.length > 0 && (
        <div className="no-print border-b border-amber-300 bg-[var(--color-warn-bg)] px-4 py-2 text-sm text-[var(--color-warn)]">
          <div className="mx-auto max-w-[1600px]">
            {loadIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 px-4 py-4">
        <nav className="no-print hidden w-56 shrink-0 md:block">
          <div className="panel sticky top-4 overflow-hidden">
            <ul className="flex flex-col p-2">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'text-[var(--color-ink)] hover:bg-[var(--color-panel-deep)]'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <div className="no-print mb-3 flex gap-2 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'bg-[var(--color-accent)] text-white' : 'bg-white border border-[var(--color-line)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <Outlet />
        </main>
      </div>

      {toast && (
        <div className="no-print fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-[var(--color-line)] bg-white px-4 py-3 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">{toast}</p>
            <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
