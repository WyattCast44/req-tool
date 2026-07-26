const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-300',
  Active: 'bg-[var(--color-ok-bg)] text-[var(--color-ok)] border-green-300',
  'Needs Review': 'bg-[var(--color-warn-bg)] text-[var(--color-warn)] border-amber-300',
  Superseded: 'bg-slate-100 text-slate-600 border-slate-300',
  Retired: 'bg-slate-200 text-slate-600 border-slate-400',
  Rejected: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-red-300',
  'Out of Scope': 'bg-stone-100 text-stone-600 border-stone-300',
}

const ASSESSMENT_STYLES: Record<string, string> = {
  'Not Yet Assessed': 'bg-slate-100 text-slate-700 border-slate-300',
  Met: 'bg-[var(--color-ok-bg)] text-[var(--color-ok)] border-green-300',
  'Partially Met': 'bg-[var(--color-warn-bg)] text-[var(--color-warn)] border-amber-300',
  'Not Met': 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-red-300',
  Inconclusive: 'bg-indigo-50 text-indigo-800 border-indigo-200',
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge ${STATUS_STYLES[value] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>{value || '—'}</span>
}

export function AssessmentBadge({ value }: { value: string }) {
  return (
    <span className={`badge ${ASSESSMENT_STYLES[value] || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
      {value || '—'}
    </span>
  )
}

export function ClassificationBadge({ value }: { value: string }) {
  return (
    <span className="badge border-slate-400 bg-white text-slate-800 tracking-wide">{value || '—'}</span>
  )
}
