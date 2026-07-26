import { Link, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { buildDashboardStats } from '../lib/filters'
import { formatDateTime } from '../lib/ids'
import { EmptyState } from '../components/EmptyState'

export function DashboardPage() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)
  const applyGapFilter = useProjectStore((s) => s.applyGapFilter)
  const setFilters = useProjectStore((s) => s.setFilters)
  const resetFilters = useProjectStore((s) => s.resetFilters)

  if (!project) return null

  const stats = buildDashboardStats(project)

  const goFiltered = (configure: () => void) => {
    resetFilters()
    configure()
    navigate('/requirements')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Project Dashboard</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          {project.requirements.length} requirements · Review Mode is the default experience
        </p>
      </div>

      {project.requirements.length === 0 ? (
        <EmptyState
          title="No requirements yet"
          body="Enter Edit Mode and create requirements, or import an authoritative project save file."
          action={
            <Link className="btn btn-primary" to="/requirements">
              Go to Requirements
            </Link>
          }
        />
      ) : (
        <>
          <section className="panel p-4">
            <h3 className="mb-3 font-semibold">Requirement Status Counts</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {stats.statusCounts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-md border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-3 text-left transition hover:border-[var(--color-accent)]"
                  onClick={() =>
                    goFiltered(() => setFilters({ statusIds: [item.id] }))
                  }
                >
                  <div className="text-2xl font-semibold tabular-nums">{item.count}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-4">
            <h3 className="mb-3 font-semibold">Verification Coverage</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['With verification method', stats.verification.withMethod],
                ['Linked to planned test activity', stats.verification.withActivity],
                ['With evidence references', stats.verification.withEvidence],
                ['Assessed', stats.verification.assessed],
                ['Not yet assessed', stats.verification.notYetAssessed],
                ['Assessed as met', stats.verification.met],
                ['Assessed as partially met', stats.verification.partiallyMet],
                ['Assessed as not met', stats.verification.notMet],
                ['Assessed as inconclusive', stats.verification.inconclusive],
              ].map(([label, count]) => (
                <div
                  key={String(label)}
                  className="rounded-md border border-[var(--color-line)] px-3 py-3"
                >
                  <div className="text-xl font-semibold tabular-nums">{count as number}</div>
                  <div className="text-sm text-[var(--color-ink-muted)]">{label as string}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="panel p-4">
              <h3 className="mb-3 font-semibold">Recent Changes</h3>
              {stats.recentChanges.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-muted)]">No modification history yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-line)]">
                  {stats.recentChanges.map((req) => (
                    <li key={req.id} className="py-2">
                      <Link
                        to={`/requirements/${req.id}`}
                        className="font-semibold text-[var(--color-accent)] hover:underline"
                      >
                        {req.sourceId} — {req.shortTitle || 'Untitled'}
                      </Link>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        {req.editorName || 'Unknown editor'} · {formatDateTime(req.modifiedAt)}
                      </div>
                      <div className="text-sm">{req.changeSummary || '—'}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel p-4">
              <h3 className="mb-3 font-semibold">Relationship Gaps</h3>
              <ul className="space-y-2">
                {stats.gaps.map((gap) => (
                  <li key={gap.key}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-[var(--color-line)] px-3 py-2 text-left hover:bg-[var(--color-panel)]"
                      onClick={() => {
                        applyGapFilter(gap.key)
                        navigate('/requirements')
                      }}
                    >
                      <span className="text-sm">{gap.label}</span>
                      <span className="badge border-slate-300 bg-white">{gap.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
