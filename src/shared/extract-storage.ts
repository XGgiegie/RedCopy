import type { NoteTextInfo } from './note-types'
import { storageGet, storageSet } from './storage'

const STORAGE_KEY = 'redcopy:lastExtract'

export interface SavedExtractRecord {
  noteId: string | null
  url: string
  note: NoteTextInfo
}

export async function loadLastExtract(): Promise<SavedExtractRecord | null> {
  const record = await storageGet<SavedExtractRecord>(STORAGE_KEY)
  return record ?? null
}

export async function saveLastExtract(
  record: SavedExtractRecord,
): Promise<void> {
  await storageSet(STORAGE_KEY, record)
}
