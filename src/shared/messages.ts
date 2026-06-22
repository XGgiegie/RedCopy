import type { AiAnalysisResult } from './ai-types'
import type { NoteExtractResult, NoteTextInfo } from './note-types'

export const EXTRACT_NOTE_MESSAGE = 'redcopy:extract-note' as const
export const ANALYZE_NOTE_MESSAGE = 'redcopy:analyze-note' as const
export const EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE =
  'redcopy:export-current-note-markdown' as const
export const DOWNLOAD_NOTE_IMAGE_MESSAGE = 'redcopy:download-note-image' as const
export const STORAGE_GET_MESSAGE = 'redcopy:storage-get' as const
export const STORAGE_SET_MESSAGE = 'redcopy:storage-set' as const
export const STORAGE_REMOVE_MESSAGE = 'redcopy:storage-remove' as const

export interface ExtractNoteRequest {
  type: typeof EXTRACT_NOTE_MESSAGE
  tabId?: number
  /** 为 false 时跳过 DOM 树与 outerHTML，减轻首屏注入开销 */
  includeDom?: boolean
}

export interface ExtractNoteResponse {
  ok: boolean
  data?: NoteExtractResult
  error?: string
}

export interface AnalyzeNoteRequest {
  type: typeof ANALYZE_NOTE_MESSAGE
  noteId: string | null
  url: string
  text: NoteTextInfo
}

export interface AnalyzeNoteResponse {
  ok: boolean
  data?: AiAnalysisResult
  error?: string
}

export interface ExportCurrentNoteMarkdownRequest {
  type: typeof EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE
  tabId?: number
}

export interface ExportCurrentNoteMarkdownResponse {
  ok: boolean
  error?: string
}

export interface DownloadNoteImageRequest {
  type: typeof DOWNLOAD_NOTE_IMAGE_MESSAGE
  url: string
  index: number
  context?: {
    title?: string
    noteId?: string | null
  }
}

export interface DownloadNoteImageResponse {
  ok: boolean
  error?: string
}

export interface StorageGetRequest {
  type: typeof STORAGE_GET_MESSAGE
  key: string
}

export interface StorageGetResponse {
  ok: boolean
  value?: unknown
  error?: string
}

export interface StorageSetRequest {
  type: typeof STORAGE_SET_MESSAGE
  key: string
  value: unknown
}

export interface StorageSetResponse {
  ok: boolean
  error?: string
}

export interface StorageRemoveRequest {
  type: typeof STORAGE_REMOVE_MESSAGE
  key: string
}

export interface StorageRemoveResponse {
  ok: boolean
  error?: string
}
