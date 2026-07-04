import type { AiAnalysisResult } from './ai-types'
import type { NoteTextInfo } from './note-types'
import { parseLlmJsonObject } from './parse-llm-json'

export interface AnalyzeNotePayload {
  noteId: string | null
  url: string
  text: NoteTextInfo
  /** 参与分析的配图 URL（豆包图文模型） */
  imageUrls?: string[]
}

export function buildAnalysisUserPrompt(payload: AnalyzeNotePayload): string {
  const { text, url, noteId, imageUrls } = payload
  const lines = [
    `笔记链接：${url}`,
    `笔记 ID：${noteId ?? '未知'}`,
    `标题：${text.title || '（无）'}`,
    `作者：${text.author || '（无）'}`,
    `发布时间：${text.publishTime || '（无）'}`,
    `标签：${text.tags.length ? text.tags.join('、') : '（无）'}`,
    `点赞：${text.likedCount || '0'}`,
    `收藏：${text.collectedCount || '0'}`,
    `评论：${text.commentCount || '0'}`,
    `正文：\n${text.desc || text.allText || '（无正文）'}`,
  ]

  if (imageUrls?.length) {
    lines.push(
      '',
      `用户已选择 ${imageUrls.length} 张配图参与分析，请结合画面内容（构图、色调、排版、信息点）与文案一起拆解。`,
    )
  }

  lines.push(
    '',
    '请拆解这篇笔记的爆款逻辑，并告诉我如何借鉴它创作自己的小红书爆款内容。',
  )

  return lines.join('\n')
}

export function parseAnalysisContent(content: string): AiAnalysisResult {
  const trimmed = content.trim()
  const parsed = parseLlmJsonObject(trimmed)

  if (parsed && typeof parsed.summary === 'string' && parsed.summary) {
    return {
      summary: parsed.summary,
      titleAnalysis:
        typeof parsed.titleAnalysis === 'string'
          ? parsed.titleAnalysis
          : undefined,
      contentStructure: Array.isArray(parsed.contentStructure)
        ? parsed.contentStructure.map(String)
        : undefined,
      engagementInsight:
        typeof parsed.engagementInsight === 'string'
          ? parsed.engagementInsight
          : undefined,
      rewriteSuggestions: Array.isArray(parsed.rewriteSuggestions)
        ? parsed.rewriteSuggestions.map(String)
        : undefined,
      score:
        typeof parsed.score === 'number'
          ? Math.round(parsed.score)
          : undefined,
      raw: trimmed,
    }
  }

  return {
    summary: trimmed,
    raw: trimmed,
  }
}
