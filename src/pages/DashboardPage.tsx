import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { buildDashboardStats } from '../lib/filters'
import { formatDateTime } from '../lib/ids'
import { EmptyState } from '../components/EmptyState'
import { requirementFilterSearch } from '../lib/urlState'

export function DashboardPage() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)

  const stats = useMemo(() => (project ? buildDashboardStats(project) : null), [project])

  if (!project || !stats) return null

  return (
    <div className="space-y-2.5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">
            {project.requirements.length} requirements · {(project.sources ?? []).length} sources ·{' '}
            {project.testActivities.length} activities · {project.relationships.length} requirement relationships
          </p>
        </div>
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
          <section className="panel p-2.5">
            <h3 className="section-title">Requirement status</h3>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">
              {stats.statusCounts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="stat-tile"
                  onClick={() =>
                    navigate(`/requirements${requirementFilterSearch({ statusIds: [item.id] })}`)
                  }
                >
                  <div className="stat-value">{item.count}</div>
                  <div className="stat-label">{item.label}</div>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-2.5 xl:grid-cols-2">
            <section className="panel overflow-hidden">
              <div className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-1.5">
                <h3 className="section-title mb-0">Recent changes</h3>
              </div>
              {stats.recentChanges.length === 0 ? (
                <p className="px-2.5 py-3 text-[0.75rem] text-[var(--color-ink-muted)]">No modification history yet.</p>
              ) : (
                <div className="table-wrap border-0">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Editor</th>
                        <th>Modified</th>
                        <th>Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentChanges.map((req) => (
                        <tr key={req.id}>
                          <td>
                            <Link className="mono font-semibold hover:underline" to={`/requirements/${req.id}`}>
                              {req.sourceId}
                            </Link>
                          </td>
                          <td className="max-w-[12rem] truncate">{req.shortTitle || '—'}</td>
                          <td>{req.editorName || '—'}</td>
                          <td className="whitespace-nowrap">{formatDateTime(req.modifiedAt)}</td>
                          <td className="max-w-[16rem] truncate text-[var(--color-ink-muted)]">
                            {req.changeSummary || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel overflow-hidden">
              <div className="border-b border-[var(--color-line)] bg-[var(--color-panel)] px-2.5 py-1.5">
                <h3 className="section-title mb-0">Relationship gaps</h3>
              </div>
              <div className="table-wrap border-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Gap</th>
                      <th className="w-16 text-right">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.gaps.map((gap) => (
                      <tr key={gap.key}>
                        <td>
                          <button
                            type="button"
                            className="text-left text-[var(--color-accent)] hover:underline"
                            onClick={() => {
                              navigate(`/requirements${requirementFilterSearch({ gapKey: gap.key })}`)
                            }}
                          >
                            {gap.label}
                          </button>
                        </td>
                        <td className="text-right font-semibold tabular-nums">{gap.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
