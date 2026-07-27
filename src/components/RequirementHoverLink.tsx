import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { RequirementHoverPreview } from './RequirementHoverPreview'
import type { ProjectData, Requirement } from '../types/project'

const CARD_WIDTH = 320
const CARD_HEIGHT = 280
const OPEN_DELAY_MS = 350
const OPEN_GRACE_MS = 450
const CLOSE_GRACE_MS = 200

export function RequirementHoverLink({
  requirement,
  project,
  className = '',
  children,
}: {
  requirement: Requirement
  project: ProjectData
  className?: string
  children?: ReactNode
}) {
  const anchorRef = useRef<HTMLAnchorElement>(null)
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const cancelClear = () => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current)
      clearTimerRef.current = null
    }
  }

  const cancelOpen = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }

  const scheduleClose = (delayMs: number) => {
    cancelClear()
    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null
      setOpen(false)
      setCoords(null)
    }, delayMs)
  }

  const positionPreview = () => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    let left = rect.left
    let top = rect.bottom + 8
    if (left + CARD_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - CARD_WIDTH - 8)
    }
    if (top + CARD_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - CARD_HEIGHT - 8)
    }
    setCoords({ top, left })
  }

  const showPreview = () => {
    cancelClear()
    cancelOpen()
    positionPreview()
    setOpen(true)
  }

  const scheduleOpen = () => {
    cancelClear()
    cancelOpen()
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null
      positionPreview()
      setOpen(true)
    }, OPEN_DELAY_MS)
  }

  const handleLeave = () => {
    cancelOpen()
    scheduleClose(OPEN_GRACE_MS)
  }

  useEffect(() => {
    return () => {
      cancelClear()
      cancelOpen()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onScroll = () => positionPreview()
    const onResize = () => positionPreview()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <>
      <Link
        ref={anchorRef}
        to={`/requirements/${requirement.id}`}
        className={`mono text-[var(--color-accent)] hover:underline ${className}`.trim()}
        onMouseEnter={scheduleOpen}
        onMouseLeave={handleLeave}
        onFocus={showPreview}
        onBlur={() => {
          cancelOpen()
          scheduleClose(CLOSE_GRACE_MS)
        }}
      >
        {children ?? (requirement.sourceId || 'Missing')}
      </Link>
      {open &&
        coords &&
        createPortal(
          <div
            className="fixed z-[60]"
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={cancelClear}
            onMouseLeave={() => scheduleClose(CLOSE_GRACE_MS)}
          >
            <RequirementHoverPreview requirement={requirement} project={project} />
          </div>,
          document.body,
        )}
    </>
  )
}
