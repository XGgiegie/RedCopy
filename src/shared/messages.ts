import type { AiAnalysisResult } from './ai-types'
import type { GeneratedNoteDraft } from './ai-types'
import type { CreationPurposeKey } from './creation-intent'
import type {
  AutoCollectConfig,
  AutoCollectProgress,
  AutoCollectResult,
} from './auto-collect'
import type {
  GrowthAcquireConfig,
  GrowthAcquireProgress,
  GrowthAcquireResult,
} from './growth-acquire'
import type { NoteExtractResult, NoteTextInfo } from './note-types'

export const EXTRACT_NOTE_MESSAGE = 'redcopy:extract-note' as const
export const ANALYZE_NOTE_MESSAGE = 'redcopy:analyze-note' as const
export const EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE =
  'redcopy:export-current-note-markdown' as const
export const DOWNLOAD_NOTE_IMAGE_MESSAGE = 'redcopy:download-note-image' as const
export const DOWNLOAD_NOTE_MEDIA_MESSAGE = 'redcopy:download-note-media' as const
export const INJECT_DETAIL_EXPORT_BUTTON_MESSAGE =
  'redcopy:inject-detail-export-button' as const
export const STORAGE_GET_MESSAGE = 'redcopy:storage-get' as const
export const STORAGE_SET_MESSAGE = 'redcopy:storage-set' as const
export const STORAGE_REMOVE_MESSAGE = 'redcopy:storage-remove' as const
export const IMAGE_TO_DATA_URL_MESSAGE = 'redcopy:image-to-data-url' as const
export const START_AUTO_COLLECT_TASK_MESSAGE =
  'redcopy:auto-collect-task:start' as const
export const STOP_AUTO_COLLECT_TASK_MESSAGE =
  'redcopy:auto-collect-task:stop' as const
export const GET_AUTO_COLLECT_TASK_STATUS_MESSAGE =
  'redcopy:auto-collect-task:status' as const
export const START_GROWTH_ACQUIRE_TASK_MESSAGE =
  'redcopy:growth-acquire-task:start' as const
export const STOP_GROWTH_ACQUIRE_TASK_MESSAGE =
  'redcopy:growth-acquire-task:stop' as const
export const GET_GROWTH_ACQUIRE_TASK_STATUS_MESSAGE =
  'redcopy:growth-acquire-task:status' as const
export const START_ANALYZE_GENERATE_TASK_MESSAGE =
  'redcopy:analyze-generate-task:start' as const
export const GET_ANALYZE_GENERATE_TASK_STATUS_MESSAGE =
  'redcopy:analyze-generate-task:status' as const
export const GET_ANALYZE_GENERATE_TASK_STATUSES_MESSAGE =
  'redcopy:analyze-generate-task:statuses' as const
export const BACKGROUND_KEEPALIVE_MESSAGE =
  'redcopy:background-keepalive' as const

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

export type DownloadNoteMediaType = 'image' | 'video' | 'live'

export interface DownloadNoteMediaRequest {
  type: typeof DOWNLOAD_NOTE_MEDIA_MESSAGE
  tabId?: number
  url: string
  index: number
  mediaType: DownloadNoteMediaType
  context?: {
    title?: string
    noteId?: string | null
  }
}

export interface DownloadNoteMediaResponse {
  ok: boolean
  error?: string
}

export interface InjectDetailExportButtonRequest {
  type: typeof INJECT_DETAIL_EXPORT_BUTTON_MESSAGE
  tabId?: number
}

export interface InjectDetailExportButtonResponse {
  ok: boolean
  error?: string
  result?: unknown
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

export interface ImageToDataUrlRequest {
  type: typeof IMAGE_TO_DATA_URL_MESSAGE
  url: string
}

export interface ImageToDataUrlResponse {
  ok: boolean
  dataUrl?: string
  mimeType?: string
  error?: string
}

export interface BackgroundTaskStatus<TProgress, TResult> {
  running: boolean
  cancelled: boolean
  progress: TProgress | null
  result: TResult | null
  error: string | null
  startedAt: number | null
  finishedAt: number | null
}

export interface BackgroundTaskResponse<TProgress, TResult> {
  ok: boolean
  status?: BackgroundTaskStatus<TProgress, TResult>
  error?: string
}

export interface StartAutoCollectTaskRequest {
  type: typeof START_AUTO_COLLECT_TASK_MESSAGE
  config: AutoCollectConfig
}

export interface StopAutoCollectTaskRequest {
  type: typeof STOP_AUTO_COLLECT_TASK_MESSAGE
}

export interface GetAutoCollectTaskStatusRequest {
  type: typeof GET_AUTO_COLLECT_TASK_STATUS_MESSAGE
}

export type AutoCollectTaskResponse = BackgroundTaskResponse<
  AutoCollectProgress,
  AutoCollectResult
>

export interface StartGrowthAcquireTaskRequest {
  type: typeof START_GROWTH_ACQUIRE_TASK_MESSAGE
  config: GrowthAcquireConfig
}

export interface StopGrowthAcquireTaskRequest {
  type: typeof STOP_GROWTH_ACQUIRE_TASK_MESSAGE
}

export interface GetGrowthAcquireTaskStatusRequest {
  type: typeof GET_GROWTH_ACQUIRE_TASK_STATUS_MESSAGE
}

export type GrowthAcquireTaskResponse = BackgroundTaskResponse<
  GrowthAcquireProgress,
  GrowthAcquireResult
>

export type AnalyzeGeneratePhase =
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'error'

export type AnalyzeGenerateMode = 'direct' | 'note_analysis'

export interface AnalyzeGenerateProgress {
  taskId: string
  phase: AnalyzeGeneratePhase
  message: string
  mode?: AnalyzeGenerateMode
}

export interface AnalyzeGenerateResult {
  taskId: string
  draft: GeneratedNoteDraft
  generatedAt: number
}

export interface StartAnalyzeGenerateTaskRequest {
  type: typeof START_ANALYZE_GENERATE_TASK_MESSAGE
  taskId: string
  mode?: AnalyzeGenerateMode
  purpose?: CreationPurposeKey
  topic?: string
  imageUrls?: string[]
}

export interface GetAnalyzeGenerateTaskStatusRequest {
  type: typeof GET_ANALYZE_GENERATE_TASK_STATUS_MESSAGE
  taskId: string
}

export interface GetAnalyzeGenerateTaskStatusesRequest {
  type: typeof GET_ANALYZE_GENERATE_TASK_STATUSES_MESSAGE
}

export type AnalyzeGenerateTaskStatus = BackgroundTaskStatus<
  AnalyzeGenerateProgress,
  AnalyzeGenerateResult
>

export type AnalyzeGenerateTaskResponse = BackgroundTaskResponse<
  AnalyzeGenerateProgress,
  AnalyzeGenerateResult
>

export interface AnalyzeGenerateTaskStatusesResponse {
  ok: boolean
  statuses?: Record<string, AnalyzeGenerateTaskStatus>
  error?: string
}
