import type { ReactNode } from 'react'

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel empty-state">
      <h3 className="empty-state-title">{title}</h3>
      {body && <p className="muted-copy empty-state-body">{body}</p>}
      {action}
    </div>
  )
}
