import { useProjectStore } from '../store/projectStore'
import { APP_VERSION, FILE_EXTENSION, SCHEMA_VERSION } from '../types/project'
import { formatDateTime } from '../lib/ids'

export function SettingsPage() {
  const project = useProjectStore((s) => s.project)!
  const mode = useProjectStore((s) => s.mode)
  const editing = mode === 'edit'
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta)
  const setEditorNameDefault = useProjectStore((s) => s.setEditorNameDefault)
  const exportProject = useProjectStore((s) => s.exportProject)
  const discardLocalAndClear = useProjectStore((s) => s.discardLocalAndClear)
  const hasUnexportedChanges = useProjectStore((s) => s.hasUnexportedChanges)
  const localSavedAt = useProjectStore((s) => s.localSavedAt)
  const sourceFileName = useProjectStore((s) => s.sourceFileName)
  const stateLabel = useProjectStore((s) => s.stateLabel)

  return (
    <div className="space-y-2.5">
      <div>
        <h2 className="page-title">Project Settings</h2>
        <p className="page-subtitle">
          Project metadata and workspace status. The portable {FILE_EXTENSION} file remains authoritative.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="panel space-y-3 p-4">
          <h3 className="font-semibold">Project metadata</h3>
          <label className="block">
            <span className="field-label">Project name</span>
            <input
              className="field-input"
              disabled={!editing}
              value={project.metadata.name}
              onChange={(e) => updateProjectMeta({ name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="field-label">Default editor name</span>
            <input
              className="field-input"
              disabled={!editing}
              value={project.metadata.editorNameDefault}
              onChange={(e) => setEditorNameDefault(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Classification banner (optional)</span>
            <input
              className="field-input"
              disabled={!editing}
              value={project.metadata.classificationBanner}
              onChange={(e) => updateProjectMeta({ classificationBanner: e.target.value })}
              placeholder="e.g., UNCLASSIFIED // FOR OFFICIAL USE ONLY"
            />
          </label>
          <label className="block">
            <span className="field-label">Description</span>
            <textarea
              className="field-input"
              rows={6}
              disabled={!editing}
              value={project.metadata.description}
              onChange={(e) => updateProjectMeta({ description: e.target.value })}
            />
          </label>
        </section>

        <section className="panel p-4 text-sm">
          <h3 className="mb-3 font-semibold">Workspace status</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">State</dt>
              <dd>{stateLabel()}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Mode</dt>
              <dd>{mode === 'edit' ? 'Edit Mode' : 'Review Mode'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Local autosave</dt>
              <dd>{localSavedAt ? formatDateTime(localSavedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Unexported changes</dt>
              <dd>{hasUnexportedChanges ? 'Yes — export required' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Source file</dt>
              <dd>{sourceFileName || 'Created in-app (not yet imported)'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Export sequence</dt>
              <dd>v{String(project.metadata.exportSequence).padStart(3, '0')}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Last exported</dt>
              <dd>{formatDateTime(project.metadata.lastExportedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Schema / app version</dt>
              <dd>
                schema v{SCHEMA_VERSION} · app {APP_VERSION}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Project UUID</dt>
              <dd className="break-all">{project.metadata.id}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-bold uppercase text-[var(--color-ink-muted)]">Record counts</dt>
              <dd>
                {project.requirements.length} requirements · {(project.sources ?? []).length} sources ·{' '}
                {project.relationships.length} requirement relationships · {project.testActivities.length}{' '}
                activities
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void exportProject()}>
              Export Project File
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (
                  window.confirm(
                    'Discard local working changes and close the project? This does not delete any exported file.',
                  )
                ) {
                  void discardLocalAndClear()
                }
              }}
            >
              Discard Local Changes & Close
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
