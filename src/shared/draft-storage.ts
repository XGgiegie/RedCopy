import type { SavedDraftRecord } from './ai-types'
import { storageGet, storageRemove, storageSet } from './storage'

const STORAGE_KEY = 'redcopy:lastDraft'

export async function loadLastDraft(): Promise<SavedDraftRecord | null> {
  const record = await storageGet<SavedDraftRecord>(STORAGE_KEY)
  return record ?? null
}

export async function saveLastDraft(record: SavedDraftRecord): Promise<void> {
  await storageSet(STORAGE_KEY, record)
}

export async function clearLastDraft(): Promise<void> {
  await storageRemove(STORAGE_KEY)
}
