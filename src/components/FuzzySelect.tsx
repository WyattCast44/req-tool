import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { fuzzyFilterRanked, withClearOption } from '../lib/fuzzy'

export interface FuzzySelectOption {
  id: string
  label: string
  /** Extra text matched by search but not shown in the list. */
  keywords?: string
}

interface FuzzySelectProps {
  options: FuzzySelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  /** Shown when nothing is selected. */
  emptyLabel?: string
  allowClear?: boolean
  /** Allow typing a value that is not in the options list. */
  allowCustom?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export function FuzzySelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  emptyLabel = 'Select…',
  allowClear = false,
  allowCustom = false,
  disabled = false,
  className = '',
  id,
}: FuzzySelectProps) {
  const reactId = useId()
  const listboxId = `${reactId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selected = useMemo(
    () => options.find((option) => option.id === value) || null,
    [options, value],
  )

  const filtered = useMemo(
    () =>
      fuzzyFilterRanked(
        options,
        query,
        (option) => `${option.label} ${option.keywords || ''}`,
      ),
    [options, query],
  )

  const items = useMemo(
    () =>
      allowClear
        ? withClearOption(filtered, { id: '', label: emptyLabel }, query)
        : filtered,
    [allowClear, emptyLabel, filtered, query],
  )

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const selectOption = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const commitCustom = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const displayValue = open ? query : selected?.label || (allowCustom ? value : '')

  return (
    <div ref={rootRef} className={`fuzzy-select ${className}`.trim()}>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          className="field-input fuzzy-select-input"
          disabled={disabled}
          placeholder={selected || (allowCustom && value) ? selected?.label || value : placeholder}
          value={displayValue}
          onFocus={() => {
            if (disabled) return
            setOpen(true)
            setQuery(allowCustom ? value || '' : '')
          }}
          onChange={(event) => {
            const next = event.target.value
            setQuery(next)
            setOpen(true)
            if (allowCustom) onChange(next)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const item = items[activeIndex]
              if (item) selectOption(item.id)
              else if (allowCustom) commitCustom(query.trim())
            } else if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              setQuery('')
              inputRef.current?.blur()
            }
          }}
        />
        <span className="fuzzy-select-chevron" aria-hidden>
          ▾
        </span>
      </div>

      {open && !disabled && (
        <ul id={listboxId} className="fuzzy-select-panel" role="listbox">
          {items.length === 0 ? (
            <li className="px-2.5 py-2 text-[0.75rem] text-[var(--color-ink-muted)]" role="presentation">
              {allowCustom && query.trim() ? (
                <button
                  type="button"
                  className="fuzzy-select-item w-full px-0 py-0"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commitCustom(query.trim())}
                >
                  Use “{query.trim()}”
                </button>
              ) : (
                'No matches'
              )}
            </li>
          ) : (
            items.map((item, index) => {
              const isClear = item.id === ''
              const isSelected = item.id === value || (isClear && !value)
              return (
                <li key={item.id || '__clear'} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === activeIndex}
                    className={`fuzzy-select-item ${isClear ? 'text-[var(--color-ink-muted)]' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
