// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RichTextEditor } from './RichText'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('RichTextEditor', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('loads existing HTML and preserves safe local links', () => {
    act(() => {
      root.render(
        <RichTextEditor
          value='<p><strong>Procedure</strong> <a href="./evidence/report.pdf">report</a></p>'
          onChange={() => undefined}
        />,
      )
    })

    const textbox = container.querySelector<HTMLElement>('[role="textbox"]')
    const link = textbox?.querySelector('a')

    expect(textbox?.innerHTML).toBe(
      '<p><strong>Procedure</strong> <a target="_blank" rel="noopener noreferrer" href="./evidence/report.pdf">report</a></p>',
    )
    expect(link?.getAttribute('href')).toBe('./evidence/report.pdf')
  })

  it('renders a grouped, icon-based formatting toolbar with accessible controls', () => {
    act(() => {
      root.render(<RichTextEditor value="<p>Toolbar</p>" onChange={() => undefined} />)
    })

    const toolbar = container.querySelector('[role="toolbar"]')
    const groups = Array.from(toolbar?.querySelectorAll<HTMLElement>('[role="group"]') || [])
    const buttons = Array.from(toolbar?.querySelectorAll<HTMLButtonElement>('button') || [])

    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'History',
      'Text style',
      'Lists',
      'Insert',
    ])
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Undo',
      'Redo',
      'Bold',
      'Italic',
      'Underline',
      'Bulleted list',
      'Numbered list',
      'Insert or edit link / path',
      'Insert paragraph break',
    ])
    expect(buttons.every((button) => Boolean(button.querySelector('svg[aria-hidden="true"]')))).toBe(true)
  })

  it('does not enable undo when normalized content receives pointer activity', () => {
    act(() => {
      root.render(<RichTextEditor value="<b>Legacy formatting</b>" onChange={() => undefined} />)
    })

    const undoButton = container.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')
    const textbox = container.querySelector<HTMLElement>('[role="textbox"]')

    expect(undoButton?.disabled).toBe(true)

    act(() => {
      textbox?.dispatchEvent(new MouseEvent('mouseenter'))
      textbox?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      textbox?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    })

    expect(undoButton?.disabled).toBe(true)
  })

  it('still records user edits in undo history', () => {
    act(() => {
      root.render(<RichTextEditor value="<p>Editable</p>" onChange={() => undefined} />)
    })

    const undoButton = container.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')
    const paragraphButton = container.querySelector<HTMLButtonElement>('button[aria-label="Insert paragraph break"]')

    expect(undoButton?.disabled).toBe(true)

    act(() => paragraphButton?.click())

    expect(undoButton?.disabled).toBe(false)
  })

  it('applies a pointer toolbar action once across the full click lifecycle', () => {
    function ControlledEditor() {
      const [value, setValue] = useState('<p>Editable</p>')
      return <RichTextEditor value={value} onChange={setValue} />
    }

    act(() => {
      root.render(<ControlledEditor />)
    })

    const textbox = container.querySelector<HTMLElement>('[role="textbox"]')
    const paragraphButton = container.querySelector<HTMLButtonElement>('button[aria-label="Insert paragraph break"]')

    act(() => {
      paragraphButton?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        isPrimary: true,
      }))
    })

    expect(textbox?.querySelectorAll('p')).toHaveLength(2)

    act(() => {
      paragraphButton?.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        isPrimary: true,
      }))
      paragraphButton?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        button: 0,
        detail: 1,
      }))
    })

    expect(textbox?.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')?.disabled).toBe(false)
  })

  it('removes unsafe link targets before content reaches the editor', () => {
    act(() => {
      root.render(
        <RichTextEditor value='<p><a href="javascript:alert(1)">Unsafe</a></p>' onChange={() => undefined} />,
      )
    })

    expect(container.querySelector('[role="textbox"]')?.textContent).toBe('Unsafe')
    expect(container.querySelector('[role="textbox"] [href]')).toBeNull()
  })

  it('applies external value updates without emitting a user change', () => {
    const onChange = vi.fn()
    act(() => {
      root.render(<RichTextEditor value="<p>Original</p>" onChange={onChange} />)
    })
    onChange.mockClear()

    act(() => {
      root.render(<RichTextEditor value="<p>Replacement</p>" onChange={onChange} />)
    })

    expect(container.querySelector('[role="textbox"]')?.innerHTML).toBe('<p>Replacement</p>')
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Undo"]')?.disabled).toBe(true)
  })

  it('uses a read-only editor and hides formatting controls when disabled', () => {
    act(() => {
      root.render(<RichTextEditor value="<p>Read only</p>" onChange={() => undefined} disabled />)
    })

    expect(container.querySelector('[role="textbox"]')?.getAttribute('contenteditable')).toBe('false')
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
  })
})
