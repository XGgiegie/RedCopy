import type { AiAnalysisResult, GeneratedNoteDraft } from './ai-types'
import type { AiSettings } from './ai-settings'
import { requestDoubaoResponses } from './doubao-api'
import { parseGeneratedDraft } from './parse-generated-draft'
import type { NoteTextInfo } from './note-types'

const GENERATE_SYSTEM_PROMPT = `你是资深小红书爆款内容创作者。
用户会提供一篇参考笔记（可能附带 AI 分析结论），并可能提供自己想推广/售卖的主题或卖点。
请结合两者，创作一篇全新的爆款图文笔记。

要求：
1. 学习参考笔记的爆款结构、节奏、情绪钩子，但不是洗稿——换角度、换案例、换表达
2. 若用户提供了想卖的产品/主题/卖点，正文要自然地围绕它展开，软性种草、不生硬
3. 若用户未提供主题，则贴合参考笔记的领域自由发挥
4. 标题要有小红书爆款感：具体、有情绪、有信息差或收藏价值
5. 正文保留口语感与自然换行，适合手机阅读，结尾可有轻互动引导
6. 标签 5-8 个，贴合内容且利于搜索分发
7. imagePrompts：按笔记发布顺序输出 3-9 条配图，每条 prompt 必须是可直接用于 AI 文生图的完整中文提示词（含画面主体、构图、色调、风格、文字排版、氛围等），第一条一般为封面，不要用「建议」口吻，直接写可生成的画面描述

只输出 JSON，不要 markdown 代码块：
{
  "title": "可直接发布的标题",
  "body": "可直接发布的正文",
  "tags": ["标签1", "标签2"],
  "imagePrompts": [
    { "label": "封面", "prompt": "完整文生图提示词，可直接生成封面图" },
    { "label": "内页1", "prompt": "完整文生图提示词" }
  ]
}`

export interface GenerateNotePayload {
  noteId: string | null
  url: string
  text: NoteTextInfo
  analysis?: AiAnalysisResult | null
  /** 用户想推广/售卖的主题或卖点，可为空 */
  topic?: string
}

function buildGenerateUserPrompt(payload: GenerateNotePayload): string {
  const { text, url, noteId, analysis, topic } = payload
  const lines = [
    `参考笔记链接：${url}`,
    `笔记 ID：${noteId ?? '未知'}`,
    `原标题：${text.title || '（无）'}`,
    `作者：${text.author || '（无）'}`,
    `原标签：${text.tags.length ? text.tags.join('、') : '（无）'}`,
    `点赞：${text.likedCount || '0'}`,
    `收藏：${text.collectedCount || '0'}`,
    `评论：${text.commentCount || '0'}`,
    `原正文：\n${text.desc || text.allText || '（无正文）'}`,
  ]

  const trimmedTopic = topic?.trim()
  if (trimmedTopic) {
    lines.push('', `我想推广/售卖的主题或卖点：${trimmedTopic}`)
  }

  if (analysis) {
    lines.push('', '--- AI 分析参考 ---', `总结：${analysis.summary}`)
    if (analysis.titleAnalysis) {
      lines.push(`标题分析：${analysis.titleAnalysis}`)
    }
    if (analysis.contentStructure?.length) {
      lines.push(`结构要点：${analysis.contentStructure.join('；')}`)
    }
    if (analysis.rewriteSuggestions?.length) {
      lines.push(`创作建议：${analysis.rewriteSuggestions.join('；')}`)
    }
  }

  lines.push(
    '',
    trimmedTopic
      ? '请基于以上参考与我的主题/卖点，生成一篇风格类似、围绕该主题种草的小红书图文笔记。'
      : '请基于以上参考，生成一篇风格类似、可借鉴的小红书图文笔记。',
  )
  return lines.join('\n')
}

/** 使用火山方舟 Responses API 生成类似笔记草稿 */
export async function requestDoubaoGenerate(
  payload: GenerateNotePayload,
  settings?: AiSettings,
): Promise<GeneratedNoteDraft> {
  const userPrompt = buildGenerateUserPrompt(payload)

  console.info('[RedCopy] 请求豆包生成类似笔记', {
    noteId: payload.noteId,
    hasAnalysis: Boolean(payload.analysis),
  })

  const content = await requestDoubaoResponses(
    GENERATE_SYSTEM_PROMPT,
    userPrompt,
    { settings, logLabel: '生成类似笔记' },
  )

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] 类似笔记生成完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })

  return draft
}
