import { useEffect, useRef } from 'react'
import { ensureLinkSafety, sanitizeHtml } from '../lib/sanitize'

interface RichTextViewProps {
  html: string
  className?: string
}

export function RichTextView({ html, className = '' }: RichTextViewProps) {
  return (
    <div
      className={`rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: ensureLinkSafety(html || '') }}
    />
  )
}

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  placeholder?: string
}

export function RichTextEditor({ value, onChange, disabled, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const current = ref.current.innerHTML
    const next = sanitizeHtml(value || '')
    if (current !== next) {
      ref.current.innerHTML = next || ''
    }
  }, [value])

  const exec = (command: string, commandValue?: string) => {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(command, false, commandValue)
    if (ref.current) onChange(ensureLinkSafety(ref.current.innerHTML))
  }

  const addLink = () => {
    if (disabled) return
    const href = window.prompt('Enter URL or file path')
    if (!href) return
    exec('createLink', href)
  }

  return (
    <div className={`field-chrome ${disabled ? 'opacity-90' : ''}`}>
      {!disabled && (
        <div className="flex flex-wrap gap-0.5 border-b border-[var(--color-line)] bg-[var(--color-panel)] p-1">
          <ToolbarButton label="B" title="Bold" onClick={() => exec('bold')} className="font-bold" />
          <ToolbarButton label="I" title="Italic" onClick={() => exec('italic')} className="italic" />
          <ToolbarButton label="U" title="Underline" onClick={() => exec('underline')} className="underline" />
          <ToolbarButton label="• List" title="Bulleted list" onClick={() => exec('insertUnorderedList')} />
          <ToolbarButton label="1. List" title="Numbered list" onClick={() => exec('insertOrderedList')} />
          <ToolbarButton label="Link" title="Insert link / path" onClick={addLink} />
          <ToolbarButton label="¶" title="Paragraph break" onClick={() => exec('insertParagraph')} />
        </div>
      )}
      <div
        ref={ref}
        className="rich-content min-h-[5rem] px-2 py-1.5 text-[0.8rem] outline-none"
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={() => {
          if (ref.current) onChange(ensureLinkSafety(ref.current.innerHTML))
        }}
        onBlur={() => {
          if (ref.current) onChange(ensureLinkSafety(ref.current.innerHTML))
        }}
        suppressContentEditableWarning
      />
    </div>
  )
}

function ToolbarButton({
  label,
  title,
  onClick,
  className = '',
}: {
  label: string
  title: string
  onClick: () => void
  className?: string
}) {
  return (
    <button type="button" className={`btn btn-ghost px-2 py-1 text-xs ${className}`} title={title} onClick={onClick}>
      {label}
    </button>
  )
}
