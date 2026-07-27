import RequirementsDocxWorker from './requirementsDocx.worker?worker&inline'
import type { ProjectData } from '../types/project'
import type {
  RequirementsDocxRequest,
  RequirementsDocxWorkerResponse,
} from './requirementsDocx'
import { downloadBlobFile } from './export'
import { slugifyFilename } from './ids'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function requirementsDocxFilename(
  project: ProjectData,
  scope: 'all' | 'selected',
): string {
  return `${slugifyFilename(project.metadata.name)}_requirements_${scope}.docx`
}

export async function generateRequirementsDocx(
  project: ProjectData,
  requirementIds: string[],
  onProgress?: (message: string) => void,
): Promise<Blob> {
  if (typeof Worker === 'undefined') {
    throw new Error('Word export requires Web Worker support in this browser.')
  }

  let worker: Worker
  try {
    worker = new RequirementsDocxWorker()
  } catch {
    throw new Error('The browser could not start the background Word export worker.')
  }

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => worker.terminate()

    worker.onmessage = (event: MessageEvent<RequirementsDocxWorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        onProgress?.(message.message)
        return
      }

      cleanup()
      if (message.type === 'error') {
        reject(new Error(message.message))
        return
      }

      resolve(new Blob([message.buffer], { type: DOCX_MIME }))
    }

    worker.onerror = () => {
      cleanup()
      reject(new Error('The background Word export worker stopped unexpectedly.'))
    }

    const request: RequirementsDocxRequest = {
      project,
      requirementIds,
      generatedAt: new Date().toISOString(),
    }
    worker.postMessage(request)
  })
}

export async function downloadRequirementsDocx(
  project: ProjectData,
  requirementIds: string[],
  scope: 'all' | 'selected',
  onProgress?: (message: string) => void,
): Promise<void> {
  const blob = await generateRequirementsDocx(project, requirementIds, onProgress)
  downloadBlobFile(requirementsDocxFilename(project, scope), blob)
}

export async function downloadRequirementDocx(
  project: ProjectData,
  requirementId: string,
  sourceId: string,
  onProgress?: (message: string) => void,
): Promise<void> {
  const blob = await generateRequirementsDocx(project, [requirementId], onProgress)
  downloadBlobFile(
    `${slugifyFilename(project.metadata.name)}_${slugifyFilename(sourceId)}.docx`,
    blob,
  )
}
