import type { Editor } from '@tiptap/core'
import { redoDepth, undoDepth } from '@tiptap/pm/history'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, type ReactNode } from 'react'
import { ensureLinkSafety, isAllowedLinkHref } from '../lib/sanitize'

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

const editorExtensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: {
      autolink: false,
      enableClickSelection: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
      isAllowedUri: (href) => isAllowedLinkHref(href),
      linkOnPaste: false,
      openOnClick: false,
    },
    strike: false,
    trailingNode: false,
  }),
]

const emptyEditorState = {
  bold: false,
  bulletList: false,
  canRedo: false,
  canUndo: false,
  italic: false,
  link: false,
  orderedList: false,
  underline: false,
}

function safeEditorHtml(editor: Editor): string {
  return editor.isEmpty ? '' : ensureLinkSafety(editor.getHTML())
}

export function RichTextEditor({ value, onChange, disabled, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    content: ensureLinkSafety(value || ''),
    editable: !disabled,
    editorProps: {
      attributes: {
        'aria-label': placeholder || 'Rich text editor',
        'aria-multiline': 'true',
        class: 'rich-content rich-text-editor outline-none',
        'data-placeholder': placeholder || '',
        role: 'textbox',
      },
    },
    extensions: editorExtensions,
    onBlur: ({ editor: currentEditor }) => onChange(safeEditorHtml(currentEditor)),
    onUpdate: ({ editor: currentEditor }) => onChange(safeEditorHtml(currentEditor)),
  })

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive('bold'),
      bulletList: currentEditor.isActive('bulletList'),
      canRedo: redoDepth(currentEditor.state) > 0,
      canUndo: undoDepth(currentEditor.state) > 0,
      italic: currentEditor.isActive('italic'),
      link: currentEditor.isActive('link'),
      orderedList: currentEditor.isActive('orderedList'),
      underline: currentEditor.isActive('underline'),
    }),
  }) || emptyEditorState

  useEffect(() => {
    const next = ensureLinkSafety(value || '')
    if (safeEditorHtml(editor) !== next) {
      editor.chain().setContent(next, { emitUpdate: false }).setMeta('addToHistory', false).run()
    }
  }, [editor, value])

  useEffect(() => {
    editor.setEditable(!disabled, false)
  }, [disabled, editor])

  const editLink = () => {
    const currentHref = editor.getAttributes('link').href as string | undefined
    const href = window.prompt('Enter URL or file path', currentHref || '')
    if (href === null) return
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    if (!isAllowedLinkHref(href)) {
      window.alert('Use an http(s) URL, file URL, absolute path, UNC path, or relative path.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }

  return (
    <div className={`field-chrome rich-text-shell ${disabled ? 'is-disabled' : ''}`}>
      {!disabled && (
        <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
          <ToolbarGroup label="History">
            <ToolbarButton
              disabled={!editorState.canUndo}
              icon="undo"
              title="Undo"
              onClick={() => editor.chain().focus().undo().run()}
            />
            <ToolbarButton
              disabled={!editorState.canRedo}
              icon="redo"
              title="Redo"
              onClick={() => editor.chain().focus().redo().run()}
            />
          </ToolbarGroup>
          <ToolbarGroup label="Text style">
            <ToolbarButton
              active={editorState.bold}
              icon="bold"
              title="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              active={editorState.italic}
              icon="italic"
              title="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              active={editorState.underline}
              icon="underline"
              title="Underline"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            />
          </ToolbarGroup>
          <ToolbarGroup label="Lists">
            <ToolbarButton
              active={editorState.bulletList}
              icon="bulletList"
              title="Bulleted list"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              active={editorState.orderedList}
              icon="orderedList"
              title="Numbered list"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
          </ToolbarGroup>
          <ToolbarGroup label="Insert">
            <ToolbarButton
              active={editorState.link}
              icon="link"
              title="Insert or edit link / path"
              onClick={editLink}
            />
            <ToolbarButton
              icon="paragraphBreak"
              title="Insert paragraph break"
              onClick={() => editor.chain().focus().splitBlock().run()}
            />
          </ToolbarGroup>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rich-text-toolbar-group" role="group" aria-label={label}>
      {children}
    </div>
  )
}

function ToolbarButton({
  active,
  disabled,
  icon,
  title,
  onClick,
}: {
  active?: boolean
  disabled?: boolean
  icon: EditorIconName
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={active}
      className="rich-text-tool"
      disabled={disabled}
      title={title}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return
        event.preventDefault()
        onClick()
      }}
      onClick={(event) => {
        // Pointer activation already ran before toolbar state changed; detail 0 preserves keyboard activation.
        if (event.detail === 0) onClick()
      }}
    >
      <EditorIcon name={icon} />
    </button>
  )
}

type EditorIconName =
  | 'bold'
  | 'bulletList'
  | 'italic'
  | 'link'
  | 'orderedList'
  | 'paragraphBreak'
  | 'redo'
  | 'underline'
  | 'undo'

function EditorIcon({ name }: { name: EditorIconName }) {
  const commonProps = {
    'aria-hidden': true,
    className: 'rich-text-tool-icon',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
    viewBox: '0 0 20 20',
  }

  switch (name) {
    case 'undo':
      return (
        <svg {...commonProps}>
          <path d="M7.25 5.25 3.5 9l3.75 3.75" />
          <path d="M4 9h6.5a5 5 0 0 1 5 5" />
        </svg>
      )
    case 'redo':
      return (
        <svg {...commonProps}>
          <path d="M12.75 5.25 16.5 9l-3.75 3.75" />
          <path d="M16 9H9.5a5 5 0 0 0-5 5" />
        </svg>
      )
    case 'bold':
      return (
        <svg {...commonProps}>
          <path d="M6.5 3.5h4.25a3.1 3.1 0 0 1 0 6.2H6.5z" />
          <path d="M6.5 9.7h4.8a3.4 3.4 0 0 1 0 6.8H6.5z" />
        </svg>
      )
    case 'italic':
      return (
        <svg {...commonProps}>
          <path d="M9 3.5h6M5 16.5h6M12 3.5 8 16.5" />
        </svg>
      )
    case 'underline':
      return (
        <svg {...commonProps}>
          <path d="M5.5 3.5v5a4.5 4.5 0 0 0 9 0v-5M4.5 16.5h11" />
        </svg>
      )
    case 'bulletList':
      return (
        <svg {...commonProps}>
          <circle cx="4" cy="5.25" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="4" cy="10" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="4" cy="14.75" r="0.8" fill="currentColor" stroke="none" />
          <path d="M7 5.25h9M7 10h9M7 14.75h9" />
        </svg>
      )
    case 'orderedList':
      return (
        <svg {...commonProps}>
          <path d="M3.3 4.4 4.5 3.5v3.4M3.25 10.3c.3-.55.8-.8 1.3-.8.65 0 1.1.35 1.1.9 0 .45-.35.8-1.05 1.35l-1.25 1h2.4M3.3 15.1h1.25c.6 0 1 .3 1 .75s-.4.75-1 .75H3.2" />
          <path d="M8 5.25h8M8 10.75h8M8 16h8" />
        </svg>
      )
    case 'link':
      return (
        <svg {...commonProps}>
          <path d="m8.2 12.2-1.1 1.1a3.1 3.1 0 1 1-4.4-4.4l2.2-2.2a3.1 3.1 0 0 1 4.4 0" />
          <path d="m11.8 7.8 1.1-1.1a3.1 3.1 0 1 1 4.4 4.4l-2.2 2.2a3.1 3.1 0 0 1-4.4 0" />
          <path d="m7.5 12.5 5-5" />
        </svg>
      )
    case 'paragraphBreak':
      return (
        <svg {...commonProps}>
          <path d="M14.5 4.5H9.25a3.25 3.25 0 0 0 0 6.5h5.25" />
          <path d="m11.75 8.25 2.75 2.75-2.75 2.75M6 15.5h5" />
        </svg>
      )
  }
}
