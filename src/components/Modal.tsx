import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, open, onClose, children, footer, wide }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-3 pt-12">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} overflow-hidden`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-3 py-2">
          <h2 className="text-[0.95rem] font-semibold">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-3 py-3">{children}</div>
        {footer && (
          <div className="flex justify-end gap-1.5 border-t border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-[var(--color-ink)]">{message}</div>
    </Modal>
  )
}
