import type {
  AiAnalysisResult,
  GeneratedImageRecord,
  GeneratedNoteDraft,
} from './ai-types'
import type { NoteTextInfo } from './note-types'
import type { Task } from './task-db'

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

  if (draft.imagePrompts.length > 0) {
    lines.push('## 配图提示词')
    lines.push('')
    for (const [index, item] of draft.imagePrompts.entries()) {
      const heading = item.label?.trim() || `配图 ${index + 1}`
      lines.push(`### ${heading}`)
      lines.push('')
      lines.push(item.prompt)
      lines.push('')
    }
  } else if (draft.imageTips) {
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

  if (draft.imagePrompts.length > 0) {
    lines.push('【配图提示词】')
    for (const [index, item] of draft.imagePrompts.entries()) {
      const heading = item.label?.trim() || `配图${index + 1}`
      lines.push(`--- ${heading} ---`)
      lines.push(item.prompt)
      lines.push('')
    }
  } else if (draft.imageTips) {
    lines.push('【配图建议】')
    lines.push(draft.imageTips)
    lines.push('')
  }

  return lines.join('\n').trim()
}

/** 将单条已生成配图格式化为 Markdown 图片语法 */
export function formatImageRecordAsMarkdown(record: GeneratedImageRecord): string {
  const alt = record.label?.trim() || '配图'
  return `![${alt}](${record.url})`
}

/** 将整个配图历史格式化为 Markdown（一键复制） */
export function formatImageHistoryAsMarkdown(
  records: GeneratedImageRecord[],
): string {
  return records
    .map((record) => {
      const alt = record.label?.trim() || '配图'
      return `![${alt}](${record.url})`
    })
    .join('\n\n')
}

/** 将单条任务（笔记 + 创作草稿 + 配图历史）格式化为 Markdown */
export function formatTaskAsMarkdown(task: Task): string {
  const isDirectCreation = task.creationMode === 'direct'
  const blocks: string[] = isDirectCreation
    ? []
    : [formatNoteAsMarkdown(task.note, { url: task.url, noteId: task.noteId })]

  if (task.draft) {
    blocks.push(
      '',
      isDirectCreation ? '## 创作草稿' : '## 仿照创作',
      '',
      formatDraftAsMarkdown(task.draft),
    )
  } else if (isDirectCreation && task.generateTopic) {
    blocks.push(`# ${task.note.title?.trim() || '直接创作'}`, '')
    blocks.push(`创作主题：${task.generateTopic}`)
  }
  if (task.imageHistory?.length) {
    blocks.push('', '## 配图历史', '', formatImageHistoryAsMarkdown(task.imageHistory))
  }

  return blocks.join('\n').trim()
}

/** 将全部任务汇总为单个 Markdown 文档（一键导出） */
export function formatAllTasksAsMarkdown(tasks: Task[]): string {
  const header = [
    '# 薯薯小抄 · 全部创作任务导出',
    '',
    `> 共 ${tasks.length} 条 · 导出时间 ${new Date().toLocaleString('zh-CN')}`,
    '',
  ]

  if (tasks.length === 0) {
    return [...header, '（暂无任务）', ''].join('\n')
  }

  const body = tasks.map(
    (task, index) => {
      const title =
        task.draft?.title?.trim() ||
        task.note.title?.trim() ||
        task.generateTopic?.trim() ||
        '（无标题）'
      return `---\n\n## ${index + 1}. ${title}\n\n${formatTaskAsMarkdown(
        task,
      )}`
    },
  )

  return [...header, ...body, ''].join('\n\n').trim() + '\n'
}

/** 复制文本到剪贴板 */
export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}
