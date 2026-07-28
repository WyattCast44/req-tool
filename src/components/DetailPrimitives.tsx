import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { plainTextFromHtml } from '../lib/tableFilters'
import { RichTextView } from './RichText'

interface DetailSectionProps {
  id?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function DetailSection({
  id,
  title,
  description,
  action,
  className = '',
  children,
}: DetailSectionProps) {
  return (
    <section id={id} className={`panel detail-section ${className}`}>
      <div className="detail-section-header">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[0.7rem] text-[var(--color-ink-muted)]">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="detail-section-body">{children}</div>
    </section>
  )
}

export function DetailField({
  label,
  required = false,
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

export function SummaryRow({
  label,
  value,
  children,
  valueClassName = 'break-words',
}: {
  label: string
  value?: string
  children?: ReactNode
  valueClassName?: string
}) {
  return (
    <div className="summary-row">
      <dt>{label}</dt>
      <dd className={valueClassName}>{children ?? value ?? '—'}</dd>
    </div>
  )
}

export function RichTextOrEmpty({
  html,
  empty = 'Not provided.',
  className,
}: {
  html: string
  empty?: string
  className?: string
}) {
  if (!plainTextFromHtml(html)) {
    return <p className="empty-copy">{empty}</p>
  }

  return <RichTextView html={html} className={className} />
}

export function DetailNotFound({
  message,
  backTo,
  backLabel,
}: {
  message: string
  backTo: string
  backLabel: string
}) {
  return (
    <div className="panel p-6">
      <p>{message}</p>
      <Link className="btn btn-secondary mt-3" to={backTo}>
        {backLabel}
      </Link>
    </div>
  )
}
