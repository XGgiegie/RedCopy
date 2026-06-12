import type { AiAnalysisResult, GeneratedNoteDraft } from './ai-types'
import type { NoteTextInfo } from './note-types'

export interface NoteMarkdownMeta {
  url?: string
  noteId?: string | null
}

/** 将笔记内容格式化为 Markdown */
export function formatNoteAsMarkdown(
  note: NoteTextInfo,
  meta: NoteMarkdownMeta = {},
): string {
  const lines: string[] = []
  const title = note.title?.trim() || '（无标题）'

  lines.push(`# ${title}`)
  lines.push('')

  const metaParts = [
    note.author ? `作者：${note.author}` : '',
    note.publishTime ? `发布：${note.publishTime}` : '',
    `点赞：${note.likedCount || '0'}`,
    `收藏：${note.collectedCount || '0'}`,
    `评论：${note.commentCount || '0'}`,
  ].filter(Boolean)

  if (metaParts.length > 0) {
    lines.push(`> ${metaParts.join(' | ')}`)
    lines.push('')
  }

  if (meta.url) {
    lines.push(`链接：${meta.url}`)
    lines.push('')
  }

  const body = note.desc?.trim() || note.allText?.trim()
  if (body) {
    lines.push(body)
    lines.push('')
  }

  if (note.tags.length > 0) {
    lines.push(note.tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' '))
    lines.push('')
  }

  if (note.images.length > 0) {
    lines.push('## 图片')
    lines.push('')
    for (const [index, url] of note.images.entries()) {
      lines.push(`![笔记图片 ${index + 1}](${url})`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/** 将 AI 分析结果格式化为 Markdown */
export function formatAnalysisAsMarkdown(analysis: AiAnalysisResult): string {
  const lines: string[] = ['## 爆款拆解', '']

  if (analysis.score != null) {
    lines.push(`**评分**：${analysis.score}`)
    lines.push('')
  }

  lines.push('### 总结')
  lines.push('')
  lines.push(analysis.summary)
  lines.push('')

  if (analysis.titleAnalysis) {
    lines.push('### 标题分析')
    lines.push('')
    lines.push(analysis.titleAnalysis)
    lines.push('')
  }

  if (analysis.contentStructure?.length) {
    lines.push('### 内容结构')
    lines.push('')
    for (const item of analysis.contentStructure) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  if (analysis.engagementInsight) {
    lines.push('### 互动洞察')
    lines.push('')
    lines.push(analysis.engagementInsight)
    lines.push('')
  }

  if (analysis.rewriteSuggestions?.length) {
    lines.push('### 爆款创作建议')
    lines.push('')
    for (const item of analysis.rewriteSuggestions) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/** 将 AI 分析结果格式化为纯文本（便于直接粘贴） */
export function formatAnalysisAsPlainText(analysis: AiAnalysisResult): string {
  const lines: string[] = ['爆款拆解', '']

  if (analysis.score != null) {
    lines.push(`评分：${analysis.score}`)
    lines.push('')
  }

  lines.push('【总结】')
  lines.push(analysis.summary)
  lines.push('')

  if (analysis.titleAnalysis) {
    lines.push('【标题分析】')
    lines.push(analysis.titleAnalysis)
    lines.push('')
  }

  if (analysis.contentStructure?.length) {
    lines.push('【内容结构】')
    for (const item of analysis.contentStructure) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  if (analysis.engagementInsight) {
    lines.push('【互动洞察】')
    lines.push(analysis.engagementInsight)
    lines.push('')
  }

  if (analysis.rewriteSuggestions?.length) {
    lines.push('【爆款创作建议】')
    for (const item of analysis.rewriteSuggestions) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}

/** 将生成稿格式化为 Markdown */
export function formatDraftAsMarkdown(draft: GeneratedNoteDraft): string {
  const lines: string[] = [`# ${draft.title}`, '', draft.body, '']

  if (draft.tags.length > 0) {
    lines.push(draft.tags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' '))
    lines.push('')
  }

  if (draft.imageTips) {
    lines.push('## 配图建议')
    lines.push('')
    lines.push(draft.imageTips)
    lines.push('')
  }

  return lines.join('\n').trim()
}

/** 将生成稿格式化为纯文本 */
export function formatDraftAsPlainText(draft: GeneratedNoteDraft): string {
  const lines: string[] = [
    `标题：${draft.title}`,
    '',
    draft.body,
    '',
  ]

  if (draft.tags.length > 0) {
    lines.push(`标签：${draft.tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')}`)
    lines.push('')
  }

  if (draft.imageTips) {
    lines.push('【配图建议】')
    lines.push(draft.imageTips)
    lines.push('')
  }

  return lines.join('\n').trim()
}

/** 复制文本到剪贴板 */
export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
