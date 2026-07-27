/// <reference lib="webworker" />

import { Packer } from 'docx'
import {
  createRequirementsDocx,
  type RequirementsDocxRequest,
  type RequirementsDocxWorkerResponse,
} from './requirementsDocx'

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = async (event: MessageEvent<RequirementsDocxRequest>) => {
  try {
    workerScope.postMessage({
      type: 'progress',
      message: 'Building Word document…',
    } satisfies RequirementsDocxWorkerResponse)
    const document = createRequirementsDocx(event.data)

    workerScope.postMessage({
      type: 'progress',
      message: 'Packaging Word document…',
    } satisfies RequirementsDocxWorkerResponse)
    const buffer = await Packer.toArrayBuffer(document)
    workerScope.postMessage(
      { type: 'complete', buffer } satisfies RequirementsDocxWorkerResponse,
      [buffer],
    )
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Word document generation failed.',
    } satisfies RequirementsDocxWorkerResponse)
  }
}

export {}
