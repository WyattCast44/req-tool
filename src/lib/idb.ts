import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { LocalWorkspaceRecord } from '../types/project'

interface OtReqDB extends DBSchema {
  workspace: {
    key: string
    value: LocalWorkspaceRecord
  }
  meta: {
    key: string
    value: { key: string; activeProjectId: string | null }
  }
}

const DB_NAME = 'otreq-manager'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<OtReqDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OtReqDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workspace')) {
          db.createObjectStore('workspace', { keyPath: 'projectId' })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

export async function saveWorkspace(record: LocalWorkspaceRecord): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['workspace', 'meta'], 'readwrite')
  await tx.objectStore('workspace').put(record)
  await tx.objectStore('meta').put({ key: 'active', activeProjectId: record.projectId })
  await tx.done
}

export async function loadWorkspace(projectId: string): Promise<LocalWorkspaceRecord | undefined> {
  const db = await getDb()
  return db.get('workspace', projectId)
}

export async function getActiveWorkspace(): Promise<LocalWorkspaceRecord | undefined> {
  const db = await getDb()
  const meta = await db.get('meta', 'active')
  if (!meta?.activeProjectId) return undefined
  return db.get('workspace', meta.activeProjectId)
}

export async function listWorkspaces(): Promise<LocalWorkspaceRecord[]> {
  const db = await getDb()
  return db.getAll('workspace')
}

export async function deleteWorkspace(projectId: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['workspace', 'meta'], 'readwrite')
  await tx.objectStore('workspace').delete(projectId)
  const meta = await tx.objectStore('meta').get('active')
  if (meta?.activeProjectId === projectId) {
    await tx.objectStore('meta').put({ key: 'active', activeProjectId: null })
  }
  await tx.done
}

export async function clearActivePointer(): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key: 'active', activeProjectId: null })
}
