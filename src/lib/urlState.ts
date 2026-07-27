import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import {
  DEFAULT_COLUMNS,
  RELATIONSHIP_TYPES,
  REQUIREMENT_COLUMNS,
  SOURCE_RELATIONSHIP_TYPES,
  emptyFilters,
  type ColumnId,
  type RelationshipType,
  type RequirementFilters,
  type SavedView,
  type SortSpec,
  type SourceRelationshipType,
  type TagLogic,
} from '../types/project'

const FILTER_PARAMS: {
  field: keyof RequirementFilters
  param: string
  multiple?: boolean
}[] = [
  { field: 'statusIds', param: 'status', multiple: true },
  { field: 'classificationIds', param: 'classification', multiple: true },
  { field: 'typeIds', param: 'type', multiple: true },
  { field: 'priorityIds', param: 'priority', multiple: true },
  { field: 'verificationMethodIds', param: 'verification', multiple: true },
  { field: 'assessmentResultIds', param: 'assessment', multiple: true },
  { field: 'testActivityIds', param: 'activity', multiple: true },
  { field: 'testPhaseIds', param: 'phase', multiple: true },
  { field: 'owners', param: 'owner', multiple: true },
  { field: 'sourceIds', param: 'source', multiple: true },
  { field: 'tagIds', param: 'tag', multiple: true },
  { field: 'createdFrom', param: 'createdFrom' },
  { field: 'createdTo', param: 'createdTo' },
  { field: 'modifiedFrom', param: 'modifiedFrom' },
  { field: 'modifiedTo', param: 'modifiedTo' },
  { field: 'gapKey', param: 'gap' },
]

const REQUIREMENT_PARAMS = [
  'q',
  'tagLogic',
  'view',
  'selected',
  ...FILTER_PARAMS.map(({ param }) => param),
]

function replaceValues(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key)
  values.filter(Boolean).forEach((value) => params.append(key, value))
}

export function replaceUrlList(
  params: URLSearchParams,
  key: string,
  values: string[],
  defaults: readonly string[] = [],
) {
  const isDefault =
    values.length === defaults.length && values.every((value) => defaults.includes(value))
  replaceValues(params, key, isDefault ? [] : values)
  if (defaults.length > 0 && values.length === 0) params.append(key, '')
}

export function clampPageIndex(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0))
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parsePair(value: string): [string, string] {
  const separator = value.indexOf(':')
  return separator < 0
    ? [value, '']
    : [value.slice(0, separator), value.slice(separator + 1)]
}

function tableParam(key: string, name: string): string {
  return key ? `${key}.${name}` : name
}

export function nextSearchParams(
  current: URLSearchParams,
  mutate: (next: URLSearchParams) => void,
): URLSearchParams | null {
  const next = new URLSearchParams(current)
  mutate(next)
  return next.toString() === current.toString() ? null : next
}

function useUrlParams() {
  const [params, setParams] = useSearchParams()
  const latestParams = useRef(params)
  latestParams.current = params
  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = nextSearchParams(latestParams.current, mutate)
      if (!next) return
      latestParams.current = next
      setParams(next, { replace: true })
    },
    [setParams],
  )
  return [params, update] as const
}

export interface TableUrlDefaults {
  sorting?: SortingState
  columnVisibility?: VisibilityState
  pageSize: number
}

export interface TableUrlState {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  columnVisibility: VisibilityState
  pagination: PaginationState
  showColumnFilters: boolean
}

export function readTableUrlState(
  params: URLSearchParams,
  key: string,
  defaults: TableUrlDefaults,
): TableUrlState {
  const sortValues = params.getAll(tableParam(key, 'sort'))
  const sorting = sortValues.length
    ? sortValues
        .map(parsePair)
        .filter(([id, direction]) => id && (direction === 'asc' || direction === 'desc'))
        .map(([id, direction]) => ({ id, desc: direction === 'desc' }))
    : defaults.sorting ?? []

  const columnFilters = params
    .getAll(tableParam(key, 'filter'))
    .map(parsePair)
    .filter(([id, value]) => id && value)
    .map(([id, value]) => ({ id, value }))

  const hidden = params.getAll(tableParam(key, 'hidden'))
  const customVisibility = params.get(tableParam(key, 'visibility')) === 'custom'
  const columnVisibility = customVisibility
    ? Object.fromEntries(hidden.map((id) => [id, false]))
    : defaults.columnVisibility ?? {}

  return {
    sorting,
    columnFilters,
    columnVisibility,
    pagination: {
      pageIndex: positiveInteger(params.get(tableParam(key, 'page')), 1) - 1,
      pageSize: positiveInteger(params.get(tableParam(key, 'rows')), defaults.pageSize),
    },
    showColumnFilters:
      params.get(tableParam(key, 'filters')) === 'open' || columnFilters.length > 0,
  }
}

export function useTableUrlState(key: string, defaults: TableUrlDefaults) {
  const [params, update] = useUrlParams()
  const state = useMemo(
    () => readTableUrlState(params, key, defaults),
    [defaults, key, params],
  )

  const setSorting = useCallback(
    (sorting: SortingState) => update((next) => {
      const values = sorting.map(({ id, desc }) => `${id}:${desc ? 'desc' : 'asc'}`)
      const defaultValues = (defaults.sorting ?? []).map(
        ({ id, desc }) => `${id}:${desc ? 'desc' : 'asc'}`,
      )
      replaceValues(
        next,
        tableParam(key, 'sort'),
        values.join('|') === defaultValues.join('|') ? [] : values,
      )
      next.delete(tableParam(key, 'page'))
    }),
    [defaults.sorting, key, update],
  )

  const setColumnFilters = useCallback(
    (filters: ColumnFiltersState) => update((next) => {
      replaceValues(
        next,
        tableParam(key, 'filter'),
        filters
          .filter(({ value }) => typeof value === 'string' && value.trim())
          .map(({ id, value }) => `${id}:${String(value)}`),
      )
      next.delete(tableParam(key, 'page'))
    }),
    [key, update],
  )

  const setColumnVisibility = useCallback(
    (visibility: VisibilityState) => update((next) => {
      next.set(tableParam(key, 'visibility'), 'custom')
      replaceValues(
        next,
        tableParam(key, 'hidden'),
        Object.entries(visibility)
          .filter(([, visible]) => visible === false)
          .map(([id]) => id),
      )
    }),
    [key, update],
  )

  const setPagination = useCallback(
    (pagination: PaginationState) => update((next) => {
      const pageKey = tableParam(key, 'page')
      const rowsKey = tableParam(key, 'rows')
      if (pagination.pageIndex > 0) next.set(pageKey, String(pagination.pageIndex + 1))
      else next.delete(pageKey)
      if (pagination.pageSize !== defaults.pageSize) {
        next.set(rowsKey, String(pagination.pageSize))
      } else {
        next.delete(rowsKey)
      }
    }),
    [defaults.pageSize, key, update],
  )

  const setShowColumnFilters = useCallback(
    (show: boolean) => update((next) => {
      const param = tableParam(key, 'filters')
      if (show) next.set(param, 'open')
      else next.delete(param)
    }),
    [key, update],
  )

  return {
    ...state,
    setSorting,
    setColumnFilters,
    setColumnVisibility,
    setPagination,
    setShowColumnFilters,
  }
}

export interface RequirementViewState {
  searchQuery: string
  filters: RequirementFilters
  tagLogic: TagLogic
  sort: SortSpec[]
  visibleColumns: ColumnId[]
  selectedRequirementIds: string[]
  activeSavedViewId: string | null
}

export function readRequirementViewState(params: URLSearchParams): RequirementViewState {
  const filters = emptyFilters()
  for (const { field, param, multiple } of FILTER_PARAMS) {
    if (multiple) {
      ;(filters[field] as string[]) = params.getAll(param)
    } else {
      ;(filters[field] as string | null | undefined) = params.get(param) ?? ''
    }
  }
  filters.gapKey = params.get('gap')

  const table = readTableUrlState(params, '', {
    pageSize: 100,
    sorting: [{ id: 'sourceId', desc: false }],
    columnVisibility: Object.fromEntries(
      REQUIREMENT_COLUMNS.map((id) => [
        id,
        (DEFAULT_COLUMNS as readonly ColumnId[]).includes(id),
      ]),
    ),
  })
  const hidden = new Set(
    Object.entries(table.columnVisibility)
      .filter(([, visible]) => visible === false)
      .map(([id]) => id),
  )

  return {
    searchQuery: params.get('q') ?? '',
    filters,
    tagLogic: params.get('tagLogic') === 'all' || params.get('tagLogic') === 'exclude'
      ? params.get('tagLogic') as TagLogic
      : 'any',
    sort: table.sorting.map(({ id, desc }) => ({
      field: id,
      direction: desc ? 'desc' : 'asc',
    })),
    visibleColumns: params.get('visibility') === 'custom'
      ? REQUIREMENT_COLUMNS.filter((id) => !hidden.has(id))
      : [...DEFAULT_COLUMNS],
    selectedRequirementIds: params.getAll('selected'),
    activeSavedViewId: params.get('view'),
  }
}

function writeRequirementView(
  params: URLSearchParams,
  state: Omit<RequirementViewState, 'selectedRequirementIds'>,
) {
  REQUIREMENT_PARAMS.forEach((param) => params.delete(param))
  if (state.searchQuery) params.set('q', state.searchQuery)
  for (const { field, param, multiple } of FILTER_PARAMS) {
    const value = state.filters[field]
    if (multiple) replaceValues(params, param, value as string[])
    else if (value) params.set(param, String(value))
  }
  if (state.tagLogic !== 'any') params.set('tagLogic', state.tagLogic)
  if (state.activeSavedViewId) params.set('view', state.activeSavedViewId)

  const defaultSort = state.sort.length === 1
    && state.sort[0].field === 'sourceId'
    && state.sort[0].direction === 'asc'
  replaceValues(
    params,
    'sort',
    defaultSort ? [] : state.sort.map(({ field, direction }) => `${field}:${direction}`),
  )
  const hasDefaultColumns = state.visibleColumns.length === DEFAULT_COLUMNS.length
    && DEFAULT_COLUMNS.every((id) => state.visibleColumns.includes(id))
  if (hasDefaultColumns) {
    params.delete('visibility')
    params.delete('hidden')
  } else {
    params.set('visibility', 'custom')
    replaceValues(
      params,
      'hidden',
      REQUIREMENT_COLUMNS.filter((id) => !state.visibleColumns.includes(id)),
    )
  }
  params.delete('page')
  params.delete('rowPage')
  params.delete('colPage')
}

export function savedViewSearch(view: SavedView): string {
  const params = new URLSearchParams()
  writeRequirementView(params, {
    searchQuery: view.searchQuery,
    filters: { ...emptyFilters(), ...view.filters },
    tagLogic: view.tagLogic,
    sort: view.sort.length ? view.sort : [{ field: 'sourceId', direction: 'asc' }],
    visibleColumns: view.visibleColumns as ColumnId[],
    activeSavedViewId: view.id,
  })
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function requirementFilterSearch(filters: Partial<RequirementFilters>): string {
  const params = new URLSearchParams()
  writeRequirementView(params, {
    searchQuery: '',
    filters: { ...emptyFilters(), ...filters },
    tagLogic: 'any',
    sort: [{ field: 'sourceId', direction: 'asc' }],
    visibleColumns: [...DEFAULT_COLUMNS],
    activeSavedViewId: null,
  })
  const search = params.toString()
  return search ? `?${search}` : ''
}

export function useRequirementViewState() {
  const [params, update] = useUrlParams()
  const state = useMemo(() => readRequirementViewState(params), [params])

  const clearSavedView = (next: URLSearchParams) => {
    next.delete('view')
    next.delete('page')
    next.delete('rowPage')
    next.delete('colPage')
  }

  const setSearchQuery = useCallback(
    (searchQuery: string) => update((next) => {
      if (searchQuery) next.set('q', searchQuery)
      else next.delete('q')
      clearSavedView(next)
    }),
    [update],
  )
  const setFilters = useCallback(
    (patch: Partial<RequirementFilters>) => update((next) => {
      for (const [field, value] of Object.entries(patch)) {
        const config = FILTER_PARAMS.find((entry) => entry.field === field)
        if (!config) continue
        if (config.multiple) replaceValues(next, config.param, value as string[])
        else if (value) next.set(config.param, String(value))
        else next.delete(config.param)
      }
      clearSavedView(next)
    }),
    [update],
  )
  const setTagLogic = useCallback(
    (tagLogic: TagLogic) => update((next) => {
      if (tagLogic === 'any') next.delete('tagLogic')
      else next.set('tagLogic', tagLogic)
      clearSavedView(next)
    }),
    [update],
  )
  const resetFilters = useCallback(
    () => update((next) => {
      next.delete('q')
      next.delete('tagLogic')
      next.delete('view')
      FILTER_PARAMS.forEach(({ param }) => next.delete(param))
      next.delete('page')
      next.delete('rowPage')
      next.delete('colPage')
    }),
    [update],
  )
  const applySavedView = useCallback(
    (view: SavedView) => update((next) => {
      writeRequirementView(next, {
        searchQuery: view.searchQuery,
        filters: { ...emptyFilters(), ...view.filters },
        tagLogic: view.tagLogic,
        sort: view.sort.length ? view.sort : [{ field: 'sourceId', direction: 'asc' }],
        visibleColumns: view.visibleColumns as ColumnId[],
        activeSavedViewId: view.id,
      })
    }),
    [update],
  )
  const clearActiveSavedView = useCallback(
    () => update((next) => next.delete('view')),
    [update],
  )
  const setActiveSavedViewId = useCallback(
    (id: string | null) => update((next) => {
      if (id) next.set('view', id)
      else next.delete('view')
    }),
    [update],
  )
  const setSelectedRequirementIds = useCallback(
    (ids: string[]) => update((next) => replaceValues(next, 'selected', ids)),
    [update],
  )

  return {
    ...state,
    setSearchQuery,
    setFilters,
    setTagLogic,
    resetFilters,
    applySavedView,
    clearSavedView: clearActiveSavedView,
    setActiveSavedViewId,
    setSelectedRequirementIds,
  }
}

export interface GraphUrlState {
  focusId: string | null
  focusKind: 'requirement' | 'source'
  depth: number
  relationshipTypes: RelationshipType[]
  sourceLinkTypes: SourceRelationshipType[]
  statusIds: string[]
  tagIds: string[]
  selectedEdgeId: string | null
}

export function useGraphUrlState() {
  const [params, update] = useUrlParams()
  const state = useMemo<GraphUrlState>(() => {
    const relationshipTypes = params.getAll('relationshipType')
      .filter((type): type is RelationshipType =>
        RELATIONSHIP_TYPES.includes(type as RelationshipType))
    const sourceLinkTypes = params.getAll('sourceLinkType')
      .filter((type): type is SourceRelationshipType =>
        SOURCE_RELATIONSHIP_TYPES.includes(type as SourceRelationshipType))

    return {
      focusId: params.get('focus'),
      focusKind: params.get('focusKind') === 'source' ? 'source' : 'requirement',
      depth: Math.min(3, positiveInteger(params.get('depth'), 1)),
      relationshipTypes: params.has('relationshipType')
        ? relationshipTypes
        : [...RELATIONSHIP_TYPES],
      sourceLinkTypes: params.has('sourceLinkType')
        ? sourceLinkTypes
        : [...SOURCE_RELATIONSHIP_TYPES],
      statusIds: params.getAll('status').filter(Boolean),
      tagIds: params.getAll('tag').filter(Boolean),
      selectedEdgeId: params.get('edge'),
    }
  }, [params])
  const setFocus = useCallback(
    (kind: 'requirement' | 'source', id: string | null) => update((next) => {
      if (kind === 'source') next.set('focusKind', 'source')
      else next.delete('focusKind')
      if (id) next.set('focus', id)
      else next.delete('focus')
      next.delete('edge')
    }),
    [update],
  )
  const setDepth = useCallback(
    (depth: number) => update((next) => {
      if (depth === 1) next.delete('depth')
      else next.set('depth', String(depth))
    }),
    [update],
  )
  const setList = useCallback(
    (key: string, values: string[], defaults: readonly string[] = []) => update((next) => {
      replaceUrlList(next, key, values, defaults)
    }),
    [update],
  )
  const setSelectedEdge = useCallback(
    (id: string | null) => update((next) => {
      if (id) next.set('edge', id)
      else next.delete('edge')
    }),
    [update],
  )

  return {
    ...state,
    setFocus,
    setDepth,
    setRelationshipTypes: (types: RelationshipType[]) =>
      setList('relationshipType', types, RELATIONSHIP_TYPES),
    setSourceLinkTypes: (types: SourceRelationshipType[]) =>
      setList('sourceLinkType', types, SOURCE_RELATIONSHIP_TYPES),
    setStatusIds: (ids: string[]) => setList('status', ids),
    setTagIds: (ids: string[]) => setList('tag', ids),
    setSelectedEdge,
  }
}

export function useMatrixUrlState() {
  const [params, update] = useUrlParams()
  const relationshipTypes = params.getAll('relationshipType')
    .filter((type): type is RelationshipType => RELATIONSHIP_TYPES.includes(type as RelationshipType))
  const types = params.has('relationshipType') ? relationshipTypes : [...RELATIONSHIP_TYPES]
  return {
    types,
    colPage: positiveInteger(params.get('colPage'), 1),
    setTypes: (values: RelationshipType[]) => update((next) => {
      replaceUrlList(next, 'relationshipType', values, RELATIONSHIP_TYPES)
    }),
    setColPage: (page: number) => update((next) => {
      if (page > 1) next.set('colPage', String(page))
      else next.delete('colPage')
    }),
  }
}
