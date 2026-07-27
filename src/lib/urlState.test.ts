import { describe, expect, it } from 'vitest'
import { emptyFilters, type SavedView } from '../types/project'
import {
  clampPageIndex,
  readRequirementViewState,
  readTableUrlState,
  nextSearchParams,
  replaceUrlList,
  requirementFilterSearch,
  savedViewSearch,
} from './urlState'

describe('URL-backed view state', () => {
  it('does not navigate for a URL mutation that changes nothing', () => {
    const current = new URLSearchParams('page=2&rows=100')

    expect(nextSearchParams(current, (next) => next.set('page', '2'))).toBeNull()
    expect(nextSearchParams(current, (next) => next.set('page', '3'))?.get('page')).toBe('3')
  })

  it('round-trips requirement filters without putting them in project state', () => {
    const search = requirementFilterSearch({
      statusIds: ['status-1', 'status-2'],
      owners: ['Smith, Jane', 'Operations: West'],
      gapKey: 'missing-verification',
    })
    const state = readRequirementViewState(new URLSearchParams(search))

    expect(state.filters.statusIds).toEqual(['status-1', 'status-2'])
    expect(state.filters.owners).toEqual(['Smith, Jane', 'Operations: West'])
    expect(state.filters.gapKey).toBe('missing-verification')
    expect(state.searchQuery).toBe('')
  })

  it('round-trips a saved view including non-default visible columns', () => {
    const view: SavedView = {
      id: 'view-1',
      name: 'Verification work',
      searchQuery: 'radar',
      filters: {
        ...emptyFilters(),
        verificationMethodIds: ['method-1'],
      },
      tagLogic: 'all',
      sort: [{ field: 'modifiedAt', direction: 'desc' }],
      visibleColumns: ['sourceId', 'shortTitle', 'verification', 'editorName'],
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-01T00:00:00.000Z',
    }

    const state = readRequirementViewState(
      new URLSearchParams(savedViewSearch(view)),
    )

    expect(state.activeSavedViewId).toBe('view-1')
    expect(state.searchQuery).toBe('radar')
    expect(state.filters.verificationMethodIds).toEqual(['method-1'])
    expect(state.sort).toEqual([{ field: 'modifiedAt', direction: 'desc' }])
    expect(state.visibleColumns).toEqual(view.visibleColumns)
  })

  it('reads table sorting, column filters, pagination, and custom visibility', () => {
    const params = new URLSearchParams()
    params.append('sort', 'modifiedAt:desc')
    params.append('filter', 'status:In Review: blocked')
    params.set('page', '3')
    params.set('rows', '50')
    params.set('visibility', 'custom')
    params.append('hidden', 'editorName')

    const state = readTableUrlState(params, '', { pageSize: 100 })

    expect(state.sorting).toEqual([{ id: 'modifiedAt', desc: true }])
    expect(state.columnFilters).toEqual([
      { id: 'status', value: 'In Review: blocked' },
    ])
    expect(state.pagination).toEqual({ pageIndex: 2, pageSize: 50 })
    expect(state.columnVisibility).toEqual({ editorName: false })
    expect(state.showColumnFilters).toBe(true)
  })

  it('removes empty graph status and tag filters without blank sentinels', () => {
    const params = new URLSearchParams('status=status-1&tag=tag-1')

    replaceUrlList(params, 'status', [])
    replaceUrlList(params, 'tag', [])

    expect(params.has('status')).toBe(false)
    expect(params.has('tag')).toBe(false)
  })

  it('preserves an explicit empty relationship-type selection', () => {
    const params = new URLSearchParams()

    replaceUrlList(params, 'relationshipType', [], ['Supports', 'Depends on'])

    expect(params.has('relationshipType')).toBe(true)
    expect(params.getAll('relationshipType')).toEqual([''])
  })

  it('clamps bookmarked and stale table pages to the available range', () => {
    expect(clampPageIndex(4, 2)).toBe(1)
    expect(clampPageIndex(1, 1)).toBe(0)
    expect(clampPageIndex(3, 0)).toBe(0)
    expect(clampPageIndex(0, 5)).toBe(0)
  })
})
