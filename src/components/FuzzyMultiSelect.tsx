import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { fuzzyFilterRanked } from '../lib/fuzzy'
import type { FuzzySelectOption } from './FuzzySelect'

interface FuzzyMultiSelectProps {
  options: FuzzySelectOption[]
  value: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function FuzzyMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  className = '',
  id,
}: FuzzyMultiSelectProps) {
  const reactId = useId()
  const listboxId = `${reactId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const selectedSet = useMemo(() => new Set(value), [value])

  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(option.id)),
    [options, selectedSet],
  )

  const filtered = useMemo(
    () =>
      fuzzyFilterRanked(options, query, (option) => `${option.label} ${option.keywords || ''}`),
    [options, query],
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

  const toggleOption = (optionId: string) => {
    if (selectedSet.has(optionId)) {
      onChange(value.filter((id) => id !== optionId))
    } else {
      onChange([...value, optionId])
    }
  }

  const removeOption = (optionId: string) => {
    onChange(value.filter((id) => id !== optionId))
  }

  return (
    <div ref={rootRef} className={`fuzzy-select fuzzy-multi-select ${className}`.trim()}>
      <div
        className={`fuzzy-multi-select-control ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={() => {
          if (disabled) return
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        <div className="fuzzy-multi-select-chips">
          {selectedOptions.map((option) => (
            <span key={option.id} className="fuzzy-multi-select-chip">
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                className="fuzzy-multi-select-chip-remove"
                aria-label={`Remove ${option.label}`}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  removeOption(option.id)
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id={id}
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-multiselectable="true"
            aria-activedescendant={
              open && filtered[activeIndex] ? `${listboxId}-${activeIndex}` : undefined
            }
            className="fuzzy-multi-select-input"
            disabled={disabled}
            placeholder={selectedOptions.length === 0 ? placeholder : 'Add…'}
            value={query}
            onFocus={() => {
              if (disabled) return
              setOpen(true)
            }}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
                setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                const item = filtered[activeIndex]
                if (item) toggleOption(item.id)
              } else if (event.key === 'Backspace' && !query && value.length > 0) {
                removeOption(value[value.length - 1])
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
                setQuery('')
                inputRef.current?.blur()
              }
            }}
          />
        </div>
        <span className="fuzzy-select-chevron" aria-hidden>
          ▾
        </span>
      </div>

      {open && !disabled && (
        <ul id={listboxId} className="fuzzy-select-panel" role="listbox" aria-multiselectable="true">
          {filtered.length === 0 ? (
            <li className="px-2.5 py-2 text-[0.75rem] text-[var(--color-ink-muted)]">No matches</li>
          ) : (
            filtered.map((item, index) => {
              const isSelected = selectedSet.has(item.id)
              return (
                <li key={item.id} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === activeIndex}
                    className="fuzzy-select-item fuzzy-multi-select-item"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleOption(item.id)}
                  >
                    <span className={`fuzzy-multi-select-check ${isSelected ? 'is-checked' : ''}`}>
                      {isSelected ? '✓' : ''}
                    </span>
                    <span className="truncate">{item.label}</span>
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
