import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { filterRequirements } from '../lib/filters'
import { RELATIONSHIP_TYPES, type RelationshipType } from '../types/project'
import { downloadTextFile, matrixToCsv } from '../lib/export'
import { FilterPanel } from '../components/FilterPanel'

export function MatrixPage() {
  const project = useProjectStore((s) => s.project)!
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const filters = useProjectStore((s) => s.filters)
  const tagLogic = useProjectStore((s) => s.tagLogic)
  const sort = useProjectStore((s) => s.sort)
  const matrixTypes = useProjectStore((s) => s.matrixTypes)
  const setMatrixTypes = useProjectStore((s) => s.setMatrixTypes)

  const [rowPage, setRowPage] = useState(1)
  const [colPage, setColPage] = useState(1)
  const pageSize = 25

  const filtered = useMemo(
    () => filterRequirements(project, searchQuery, filters, tagLogic, sort),
    [project, searchQuery, filters, tagLogic, sort],
  )

  const rowCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const colCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rows = filtered.slice((rowPage - 1) * pageSize, rowPage * pageSize)
  const cols = filtered.slice((colPage - 1) * pageSize, colPage * pageSize)

  const relMap = useMemo(() => {
    const map = new Map<string, { type: RelationshipType; id: string; rationale: string }>()
    for (const rel of project.relationships) {
      if (!matrixTypes.includes(rel.type)) continue
      map.set(`${rel.sourceRequirementId}|${rel.targetRequirementId}`, {
        type: rel.type,
        id: rel.id,
        rationale: rel.rationale,
      })
    }
    return map
  }, [project.relationships, matrixTypes])

  const exportRows = project.relationships.filter((r) => {
    if (!matrixTypes.includes(r.type)) return false
    const ids = new Set(filtered.map((x) => x.id))
    return ids.has(r.sourceRequirementId) && ids.has(r.targetRequirementId)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Traceability Matrix</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Filtered set: {filtered.length} requirements. Paginated for usability up to 1,000 records.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            downloadTextFile(
              `${project.metadata.name.replace(/\s+/g, '_')}_traceability_matrix.csv`,
              matrixToCsv(project, exportRows),
              'text/csv',
            )
          }
        >
          Export Matrix CSV
        </button>
      </div>

      <FilterPanel />

      <div className="panel p-4">
        <div className="mb-3 text-sm font-semibold">Relationship types</div>
        <div className="flex flex-wrap gap-3">
          {RELATIONSHIP_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={matrixTypes.includes(type)}
                onChange={(e) => {
                  if (e.target.checked) setMatrixTypes([...matrixTypes, type])
                  else setMatrixTypes(matrixTypes.filter((t) => t !== type))
                }}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <div>
          Rows page{' '}
          <button className="btn btn-secondary px-2 py-1" disabled={rowPage <= 1} onClick={() => setRowPage((p) => p - 1)}>
            Prev
          </button>{' '}
          {rowPage}/{rowCount}{' '}
          <button className="btn btn-secondary px-2 py-1" disabled={rowPage >= rowCount} onClick={() => setRowPage((p) => p + 1)}>
            Next
          </button>
        </div>
        <div>
          Columns page{' '}
          <button className="btn btn-secondary px-2 py-1" disabled={colPage <= 1} onClick={() => setColPage((p) => p - 1)}>
            Prev
          </button>{' '}
          {colPage}/{colCount}{' '}
          <button className="btn btn-secondary px-2 py-1" disabled={colPage >= colCount} onClick={() => setColPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>

      <div className="table-wrap max-h-[70vh]">
        <table className="data-table">
          <thead>
            <tr>
              <th>Row \\ Col</th>
              {cols.map((c) => (
                <th key={c.id} title={c.shortTitle}>
                  <Link to={`/requirements/${c.id}`} className="text-[var(--color-accent)] hover:underline">
                    {c.sourceId}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="sticky left-0 z-[1] bg-white font-semibold">
                  <Link to={`/requirements/${r.id}`} className="text-[var(--color-accent)] hover:underline">
                    {r.sourceId}
                  </Link>
                </td>
                {cols.map((c) => {
                  if (r.id === c.id) {
                    return (
                      <td key={c.id} className="bg-slate-100 text-center text-slate-400">
                        —
                      </td>
                    )
                  }
                  const hit = relMap.get(`${r.id}|${c.id}`)
                  return (
                    <td key={c.id} className="text-center" title={hit?.rationale || ''}>
                      {hit ? (
                        <span className="badge border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                          {abbreviate(hit.type)}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-ink-muted)]">
        Abbreviations: P=Parent of, C=Child of, D=Derived from, S=Supports, Dep=Depends on, X=Conflicts with, Dup=Duplicates.
        Hover a cell for rationale.
      </p>
    </div>
  )
}

function abbreviate(type: RelationshipType): string {
  switch (type) {
    case 'Parent of':
      return 'P'
    case 'Child of':
      return 'C'
    case 'Derived from':
      return 'D'
    case 'Supports':
      return 'S'
    case 'Depends on':
      return 'Dep'
    case 'Conflicts with':
      return 'X'
    case 'Duplicates':
      return 'Dup'
  }
}
