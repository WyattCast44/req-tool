import type { ReactNode } from 'react'

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-2 px-3 py-6">
      <h3 className="page-title">{title}</h3>
      {body && <p className="max-w-xl text-[0.78rem] text-[var(--color-ink-muted)]">{body}</p>}
      {action}
    </div>
  )
}
