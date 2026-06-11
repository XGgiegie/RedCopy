import type { NoteExtractResult } from './note-types'

export const EXTRACT_NOTE_MESSAGE = 'redcopy:extract-note' as const

export interface ExtractNoteRequest {
  type: typeof EXTRACT_NOTE_MESSAGE
  tabId: number
}

export interface ExtractNoteResponse {
  ok: boolean
  data?: NoteExtractResult
  error?: string
}
