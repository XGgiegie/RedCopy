import type { NoteTextInfo } from './note-types'

/** AI 分析结果 */
export interface AiAnalysisResult {
  summary: string
  titleAnalysis?: string
  contentStructure?: string[]
  hashtags?: string[]
  engagementInsight?: string
  rewriteSuggestions?: string[]
  score?: number
  /** 接口返回的原始文本（兜底展示） */
  raw?: string
}

/** AI 生成的爆款笔记草稿 */
export interface GeneratedNoteDraft {
  title: string
  body: string
  tags: string[]
  imageTips?: string
  /** 接口返回的原始文本（兜底展示） */
  raw?: string
}

/** 持久化：上一次生成记录 */
export interface SavedDraftRecord {
  noteId: string | null
  url: string
  generatedAt: number
  note: NoteTextInfo
  draft: GeneratedNoteDraft
}

/** 持久化：上一次分析记录 */
export interface SavedAnalysisRecord {
  noteId: string | null
  url: string
  analyzedAt: number
  note: NoteTextInfo
  analysis: AiAnalysisResult
}
