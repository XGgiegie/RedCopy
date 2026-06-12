import type OpenAI from 'openai'
import type { AiAnalysisResult, GeneratedNoteDraft } from './ai-types'
import type { DeepSeekModel } from './ai-settings'
import { createDeepSeekClient } from './deepseek-client'
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
7. 配图建议要具体可执行

只输出 JSON，不要 markdown 代码块：
{
  "title": "可直接发布的标题",
  "body": "可直接发布的正文",
  "tags": ["标签1", "标签2"],
  "imageTips": "配图张数、封面与内页风格建议"
}`

export interface GenerateNotePayload {
  noteId: string | null
  url: string
  text: NoteTextInfo
  analysis?: AiAnalysisResult | null
  /** 用户想推广/售卖的主题或卖点，可为空 */
  topic?: string
}

interface DeepSeekCompletionParams {
  model: DeepSeekModel
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  stream: false
  thinking?: { type: 'enabled' }
  reasoning_effort?: 'high'
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
    lines.push(
      '',
      '--- AI 分析参考 ---',
      `总结：${analysis.summary}`,
    )
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

function parseGeneratedDraft(content: string): GeneratedNoteDraft {
  const trimmed = content.trim()

  try {
    const jsonText = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
    const parsed = JSON.parse(jsonText) as Record<string, unknown>

    if (typeof parsed.title === 'string' && typeof parsed.body === 'string') {
      return {
        title: parsed.title.trim(),
        body: parsed.body.trim(),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        imageTips:
          typeof parsed.imageTips === 'string' ? parsed.imageTips : undefined,
        raw: trimmed,
      }
    }
  } catch {
    // 非 JSON 时走纯文本兜底
  }

  return {
    title: '（生成结果）',
    body: trimmed,
    tags: [],
    raw: trimmed,
  }
}

function buildCompletionParams(
  model: DeepSeekModel,
  userPrompt: string,
): DeepSeekCompletionParams {
  const base: DeepSeekCompletionParams = {
    model,
    stream: false,
    messages: [
      { role: 'system', content: GENERATE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  }

  if (model === 'deepseek-v4-pro') {
    base.thinking = { type: 'enabled' }
    base.reasoning_effort = 'high'
  }

  return base
}

/** 生成类似笔记草稿 */
export async function requestDeepSeekGenerate(
  payload: GenerateNotePayload,
): Promise<GeneratedNoteDraft> {
  const { client, settings } = await createDeepSeekClient()
  const userPrompt = buildGenerateUserPrompt(payload)
  const params = buildCompletionParams(settings.model, userPrompt)

  console.info('[RedCopy] 请求 DeepSeek 生成爆款笔记', {
    model: settings.model,
    noteId: payload.noteId,
    hasAnalysis: Boolean(payload.analysis),
  })

  const completion = await client.chat.completions.create(
    params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  )

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('DeepSeek 未返回生成内容')
  }

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] 爆款笔记生成完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })

  return draft
}
