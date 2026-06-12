import type { SavedAnalysisRecord } from './ai-types'
import { storageGet, storageSet } from './storage'

const STORAGE_KEY = 'redcopy:lastAnalysis'

export async function loadLastAnalysis(): Promise<SavedAnalysisRecord | null> {
  const record = await storageGet<SavedAnalysisRecord>(STORAGE_KEY)
  return record ?? null
}

export async function saveLastAnalysis(
  record: SavedAnalysisRecord,
): Promise<void> {
  await storageSet(STORAGE_KEY, record)
}
