import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { formatDateTime } from '../lib/ids'
import { GlobalSearch } from './GlobalSearch'
import { ErrorBoundary } from './ErrorBoundary'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requirements', label: 'Requirements' },
  { to: '/watch-items', label: 'Watch Items' },
  { to: '/sources', label: 'Sources' },
  { to: '/matrix', label: 'Matrix' },
  { to: '/graph', label: 'Graph' },
  { to: '/activities', label: 'Activities' },
  { to: '/views', label: 'Saved Views' },
  { to: '/reports', label: 'Reports' },
  { to: '/lookups', label: 'Lookups' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [confirmClose, setConfirmClose] = useState(false)
  const [topNavbarHeight, setTopNavbarHeight] = useState(0)
  const topNavbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirmClose) return
    const timer = window.setTimeout(() => setConfirmClose(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmClose])

  useEffect(() => {
    const navbar = topNavbarRef.current
    if (!navbar) return

    const updateHeight = () => setTopNavbarHeight(navbar.offsetHeight)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(navbar)
    return () => observer.disconnect()
  }, [project?.metadata.classificationBanner])

  if (!project) return <Outlet />

  if (!Array.isArray(project.watchItems)) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="panel max-w-xl p-5">
          <h1 className="text-lg font-semibold">Cached workspace is from an incompatible development schema</h1>
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            This browser workspace predates standalone Watch Items and cannot be loaded safely.
            The cached record has not been deleted.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-4"
            onClick={() => {
              void discardLocalAndClear().then(() => navigate('/welcome'))
            }}
          >
            Ignore Cached Workspace
          </button>
        </div>
      </div>
    )
  }

  const label = stateLabel()
  const editing = mode === 'edit'
  const watchItemCount = (project.watchItems ?? []).filter(
    (watchItem) => watchItem.status === 'Open' || watchItem.status === 'Monitoring',
  ).length
  const scopedViewRoutes = new Set(['/requirements', '/matrix', '/reports'])
  const navTarget = (to: string) =>
    scopedViewRoutes.has(location.pathname) && scopedViewRoutes.has(to)
      ? `${to}${location.search}`
      : to

  const closeProject = () => {
    void discardLocalAndClear().then(() => navigate('/welcome'))
  }

  return (
    <div
      className={`app-shell ${editing ? 'edit-active' : ''}`}
      style={{ '--top-navbar-height': `${topNavbarHeight}px` } as CSSProperties}
    >
      <div ref={topNavbarRef} className="top-navbar no-print sticky top-0 z-40">
        {project.metadata.classificationBanner && (
          <div className="bg-[var(--color-banner)] px-3 py-1 text-center text-[0.65rem] font-bold tracking-[0.12em] text-white">
            {project.metadata.classificationBanner}
          </div>
        )}

        <header
          className={`border-b ${
            editing
              ? 'border-[var(--color-edit)] bg-[var(--color-edit-bg)]'
              : 'border-[var(--color-line)] bg-white'
          }`}
        >
          <div className="mx-auto flex max-w-[1700px] items-center gap-3 px-3 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
                OT Management Tool
              </div>
              <div className="truncate text-[0.92rem] font-semibold leading-tight">{project.metadata.name}</div>
            </div>

            <div className="w-full max-w-xl shrink">
              <GlobalSearch />
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
              <span
                className={`badge ${
                  hasUnexportedChanges
                    ? 'border-amber-400 bg-[var(--color-warn-bg)] text-[var(--color-warn)]'
                    : editing
                      ? 'border-amber-500 bg-white text-[var(--color-edit)]'
                      : 'border-slate-300 bg-slate-50 text-slate-700'
                }`}
                title={localSavedAt ? `Local save ${formatDateTime(localSavedAt)}` : undefined}
              >
                {editing ? 'EDIT' : 'REVIEW'}
                {hasUnexportedChanges ? ' · EXPORT REQ' : ''}
              </span>
              {editing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={exitEditMode}
                  title="Leave Edit Mode and keep your local working changes"
                >
                  Exit Edit Mode & Save
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={enterEditMode}>
                  Edit Mode
                </button>
              )}
              {!editing && (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => void exportProject()}>
                    Export
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger shrink-0"
                    title={
                      confirmClose
                        ? hasUnexportedChanges
                          ? 'Click again to discard local changes and close'
                          : 'Click again to close the project'
                        : label
                    }
                    onClick={() => {
                      if (!confirmClose) {
                        setConfirmClose(true)
                        return
                      }
                      setConfirmClose(false)
                      closeProject()
                    }}
                    onBlur={() => setConfirmClose(false)}
                  >
                    {confirmClose
                      ? hasUnexportedChanges
                        ? 'Confirm Discard & Close'
                        : 'Confirm Close'
                      : 'Close'}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      </div>

      {loadIssues.length > 0 && (
        <div className="no-print border-b border-amber-300 bg-[var(--color-warn-bg)] px-3 py-1.5 text-[0.72rem] text-[var(--color-warn)]">
          <div className="mx-auto max-w-[1700px]">
            {loadIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[1700px] flex-1 gap-0 md:gap-3 px-0 md:px-3 pt-0 pb-36 md:pt-4">
        <nav className="no-print hidden w-[11.5rem] shrink-0 md:block">
          <div className="panel app-side-nav sticky overflow-hidden">
            <div className="panel-header">Navigate</div>
            <ul className="flex flex-col p-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={navTarget(item.to)}
                    end={item.end}
                    className={({ isActive }) =>
                      `block rounded-[2px] px-2 py-1 text-[0.78rem] font-medium ${
                        isActive
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'text-[var(--color-ink)] hover:bg-[var(--color-panel-deep)]'
                      }`
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      {item.label}
                      {item.to === '/watch-items' && watchItemCount > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[0.58rem] tabular-nums ${
                            location.pathname === item.to
                              ? 'bg-white/20 text-white'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {watchItemCount}
                        </span>
                      )}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <main className="min-w-0 flex-1 px-2 py-2 md:px-0 md:py-0">
          <div className="no-print mb-2 flex gap-1 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={navTarget(item.to)}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-[2px] px-2 py-1 text-[0.68rem] font-semibold ${
                    isActive ? 'bg-[var(--color-accent)] text-white' : 'bg-white border border-[var(--color-line)]'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <ErrorBoundary title="This view failed to render">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {toast && (
        <div className="no-print fixed bottom-3 right-3 z-50 max-w-sm border border-[var(--color-line-strong)] bg-white px-3 py-2 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.75rem]">{toast}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
