import type { ReactNode } from 'react'

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-3 px-6 py-10">
      <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold">{title}</h3>
      {body && <p className="max-w-xl text-sm text-[var(--color-ink-muted)]">{body}</p>}
      {action}
    </div>
  )
}
