import { Packer } from 'docx'
import RequirementsDocxWorker from './requirementsDocx.worker?worker&inline'
import type { ProjectData } from '../types/project'
import { createRequirementsDocx } from './requirementsDocx'
import type {
  RequirementsDocxRequest,
  RequirementsDocxWorkerResponse,
} from './requirementsDocx'
import { downloadBlobFile } from './export'
import { slugifyFilename } from './ids'

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

class RequirementsDocxWorkerUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RequirementsDocxWorkerUnavailableError'
  }
}

export function requirementsDocxFilename(
  project: ProjectData,
  scope: 'all' | 'selected',
): string {
  return `${slugifyFilename(project.metadata.name)}_requirements_${scope}.docx`
}

async function generateRequirementsDocxOnMainThread(
  request: RequirementsDocxRequest,
  onProgress?: (message: string) => void,
): Promise<Blob> {
  onProgress?.('Building Word document…')
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  const document = createRequirementsDocx(request)

  onProgress?.('Packaging Word document…')
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  const buffer = await Packer.toArrayBuffer(document)
  return new Blob([buffer], { type: DOCX_MIME })
}

function generateRequirementsDocxInWorker(
  worker: Worker,
  request: RequirementsDocxRequest,
  onProgress?: (message: string) => void,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      if (settled) return
      settled = true
      worker.terminate()
    }

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

    worker.onerror = (event) => {
      event.preventDefault()
      cleanup()
      const detail = event.message?.trim()
      reject(
        new RequirementsDocxWorkerUnavailableError(
          detail
            ? `The background Word export worker stopped unexpectedly: ${detail}`
            : 'The background Word export worker stopped unexpectedly.',
        ),
      )
    }

    worker.onmessageerror = () => {
      cleanup()
      reject(
        new RequirementsDocxWorkerUnavailableError(
          'The browser could not read the background Word export result.',
        ),
      )
    }

    try {
      worker.postMessage(request)
    } catch (error) {
      cleanup()
      reject(
        new RequirementsDocxWorkerUnavailableError(
          'The browser could not send the project to the background Word export worker.',
          { cause: error },
        ),
      )
    }
  })
}

export async function generateRequirementsDocx(
  project: ProjectData,
  requirementIds: string[],
  onProgress?: (message: string) => void,
): Promise<Blob> {
  const request: RequirementsDocxRequest = {
    project,
    requirementIds,
    generatedAt: new Date().toISOString(),
  }

  if (typeof Worker === 'undefined') {
    return generateRequirementsDocxOnMainThread(request, onProgress)
  }

  let worker: Worker
  try {
    worker = new RequirementsDocxWorker()
  } catch (error) {
    onProgress?.('Background export unavailable; continuing in this window…')
    return generateRequirementsDocxOnMainThread(request, onProgress).catch(
      (fallbackError: unknown) => {
        throw fallbackError instanceof Error
          ? fallbackError
          : new RequirementsDocxWorkerUnavailableError(
              'The browser could not start the background Word export worker.',
              { cause: error },
            )
      },
    )
  }

  try {
    return await generateRequirementsDocxInWorker(worker, request, onProgress)
  } catch (error) {
    if (!(error instanceof RequirementsDocxWorkerUnavailableError)) throw error
    onProgress?.('Background export stopped; continuing in this window…')
    return generateRequirementsDocxOnMainThread(request, onProgress)
  }
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
