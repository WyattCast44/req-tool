import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/projectStore'
import { cheapPlainText, requirementSearchText } from '../lib/filters'
import { lookupLabel } from '../lib/defaults'

type SearchHit =
  | {
      kind: 'requirement'
      id: string
      primary: string
      secondary: string
      meta: string
    }
  | {
      kind: 'watchItem'
      id: string
      primary: string
      secondary: string
      meta: string
    }
  | {
      kind: 'activity'
      id: string
      primary: string
      secondary: string
      meta: string
    }

const MAX_HITS = 12

export function GlobalSearch() {
  const navigate = useNavigate()
  const project = useProjectStore((s) => s.project)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => {
    if (!project || !query.trim()) return [] as SearchHit[]
    const q = query.trim().toLowerCase()
    const reqHits: SearchHit[] = []
    for (const req of project.requirements) {
      const hay = requirementSearchText(project, req)
      if (!hay.includes(q)) continue
      reqHits.push({
        kind: 'requirement',
        id: req.id,
        primary: req.sourceId,
        secondary: req.shortTitle || cheapPlainText(req.requirementText).slice(0, 80) || 'Untitled',
        meta: lookupLabel(project.lookups.statuses, req.statusId),
      })
      if (reqHits.length >= MAX_HITS) break
    }

    const actHits: SearchHit[] = []
    for (const act of project.testActivities) {
      const hay = [act.title, act.owner, cheapPlainText(act.objectives), cheapPlainText(act.notes)]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) continue
      actHits.push({
        kind: 'activity',
        id: act.id,
        primary: act.title,
        secondary: act.owner ? `Owner: ${act.owner}` : 'Test activity',
        meta: lookupLabel(project.lookups.testActivityStatuses, act.statusId),
      })
      if (actHits.length >= 6) break
    }

    const watchHits: SearchHit[] = []
    for (const watchItem of project.watchItems) {
      const hay = [
        watchItem.title,
        cheapPlainText(watchItem.description),
        ...watchItem.observations.map((observation) => cheapPlainText(observation.text)),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) continue
      watchHits.push({
        kind: 'watchItem',
        id: watchItem.id,
        primary: watchItem.title,
        secondary:
          cheapPlainText(watchItem.description).slice(0, 80) ||
          `${watchItem.observations.length} observation${watchItem.observations.length === 1 ? '' : 's'}`,
        meta: watchItem.status,
      })
      if (watchHits.length >= 4) break
    }

    return [...reqHits.slice(0, 6), ...watchHits.slice(0, 3), ...actHits.slice(0, 3)]
  }, [project, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      const typingInField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      if ((event.key === '/' || (event.key === 'k' && (event.ctrlKey || event.metaKey))) && !typingInField) {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (event.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (!project) return null

  const goToHit = (hit: SearchHit) => {
    setOpen(false)
    setQuery('')
    if (hit.kind === 'requirement') {
      navigate(`/requirements/${hit.id}`)
    } else if (hit.kind === 'watchItem') {
      navigate(`/watch-items/${hit.id}`)
    } else {
      navigate('/activities')
    }
  }

  const runFullSearch = () => {
    const q = query.trim()
    setOpen(false)
    navigate(`/requirements${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-[14rem]">
      <label className="sr-only" htmlFor="global-search">
        Global search
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-2.5 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-[var(--color-ink-muted)]"
          aria-hidden="true"
        >
          <svg viewBox="0 0 16 16" className="size-full" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" strokeLinecap="round" />
          </svg>
        </span>
        <input
          id="global-search"
          ref={inputRef}
          className="field-input pl-9 pr-14"
          value={query}
          placeholder="Search requirements, watch items & activities…"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (hits[activeIndex]) goToHit(hits[activeIndex])
              else runFullSearch()
            }
          }}
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[var(--color-line)] bg-[var(--color-panel)] px-1 py-0.5 text-[0.6rem] text-[var(--color-ink-muted)]">
          /
        </kbd>
      </div>

      {open && query.trim() && (
        <div className="global-search-panel" role="listbox" aria-label="Search results">
          {hits.length === 0 ? (
            <div className="px-3 py-3 text-[0.75rem] text-[var(--color-ink-muted)]">No matches</div>
          ) : (
            hits.map((hit, index) => (
              <button
                key={`${hit.kind}-${hit.id}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex}
                className="global-search-item"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => goToHit(hit)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="mono font-semibold text-[var(--color-accent)]">{hit.primary}</span>
                  <span className="badge border-slate-300 bg-slate-50 text-slate-700">
                    {hit.kind === 'requirement' ? 'REQ' : hit.kind === 'watchItem' ? 'WATCH' : 'ACT'} · {hit.meta}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[0.72rem] text-[var(--color-ink-muted)]">{hit.secondary}</div>
              </button>
            ))
          )}
          <button
            type="button"
            className="global-search-item text-[0.72rem] font-semibold text-[var(--color-accent)]"
            onClick={runFullSearch}
          >
            Open Requirements search →
          </button>
        </div>
      )}
    </div>
  )
}
