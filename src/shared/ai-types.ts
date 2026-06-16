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

/** 单条配图生成项（可直接文生图的提示词） */
export interface DraftImagePrompt {
  id: string
  /** 用途说明，如「封面」「内页1」 */
  label?: string
  /** 可直接用于 Seedream 文生图的完整提示词 */
  prompt: string
}

/**
 * 一条已生成配图的历史记录（任务级持久化，生成即落库）。
 * 注意：参考图（base64）属于临时输入，不在此持久化，避免存储膨胀。
 */
export interface GeneratedImageRecord {
  id: string
  /** 关联的配图提示词 id，便于在对应卡片内回显 */
  promptId?: string
  label?: string
  /** 生成时使用的提示词 */
  prompt: string
  /** 实际请求尺寸，如 2048x2048 */
  size: string
  /** 宽高比，如 1:1 */
  aspectRatio?: string
  /** 是否为图生图（携带参考图） */
  fromReference: boolean
  /** 来源：AI 生成 / 用户上传 */
  source?: 'generated' | 'upload'
  /** 生成结果图片 URL（AI 生成为远程 URL，用户上传为 base64 data URL） */
  url: string
  createdAt: number
}

/** AI 生成的爆款笔记草稿 */
export interface GeneratedNoteDraft {
  title: string
  body: string
  tags: string[]
  /** 配图生成提示词列表（替代旧版 imageTips 纯文本） */
  imagePrompts: DraftImagePrompt[]
  /** @deprecated 旧版单段配图建议，加载时自动迁移到 imagePrompts */
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
