// 该模块只在侧栏等扩展页面运行（不在 background service worker 中），
// OpenAI SDK 在浏览器环境运行成熟，可直接静态 import。
import OpenAI from 'openai'
import type { AiAnalysisResult } from './ai-types'
import {
  DEEPSEEK_BASE_URL,
  type AiSettings,
  type DeepSeekModel,
  loadAiSettings,
  isAiSettingsReady,
} from './ai-settings'
import type { NoteTextInfo } from './note-types'

const ANALYSIS_SYSTEM_PROMPT = `你是一位资深的小红书爆款内容分析专家。
请根据用户提供的图文笔记内容，输出 JSON 格式分析结果，不要包含 markdown 代码块。
JSON 字段如下：
{
  "summary": "整体总结",
  "titleAnalysis": "标题亮点与可优化点",
  "contentStructure": ["内容结构要点1", "内容结构要点2"],
  "engagementInsight": "互动数据与传播潜力分析",
  "rewriteSuggestions": ["改写建议1", "改写建议2"],
  "score": 0
}
score 为 0-100 的整数。`

interface AnalyzeNotePayload {
  noteId: string | null
  url: string
  text: NoteTextInfo
}

interface DeepSeekCompletionParams {
  model: DeepSeekModel
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  stream: false
  thinking?: { type: 'enabled' }
  reasoning_effort?: 'high'
}

function buildUserPrompt(payload: AnalyzeNotePayload): string {
  const { text, url, noteId } = payload
  return [
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
  ].join('\n')
}

function parseAnalysisContent(content: string): AiAnalysisResult {
  const trimmed = content.trim()

  try {
    const jsonText = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
    const parsed = JSON.parse(jsonText) as Record<string, unknown>

    if (typeof parsed.summary === 'string' && parsed.summary) {
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
  } catch {
    // 非 JSON 时走纯文本兜底
  }

  return {
    summary: trimmed,
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
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  }

  if (model === 'deepseek-v4-pro') {
    base.thinking = { type: 'enabled' }
    base.reasoning_effort = 'high'
  }

  return base
}

/** 使用 DeepSeek OpenAI 兼容接口分析笔记 */
export async function requestDeepSeekAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const resolvedSettings = settings ?? (await loadAiSettings())

  if (!isAiSettingsReady(resolvedSettings)) {
    throw new Error('请先在设置页配置 DeepSeek API Key')
  }

  // 扩展页面会被 OpenAI SDK 识别为浏览器环境；Key 仅存于扩展本地、
  // 请求由扩展页面直接发出（host_permissions 已含 api.deepseek.com），
  // 不暴露给任何网页，故允许浏览器环境运行。
  const client = new OpenAI({
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: resolvedSettings.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const userPrompt = buildUserPrompt(payload)
  const params = buildCompletionParams(resolvedSettings.model, userPrompt)

  console.info('[RedCopy] 请求 DeepSeek 分析', {
    model: resolvedSettings.model,
    noteId: payload.noteId,
    title: payload.text.title?.slice(0, 40),
  })

  const completion = await client.chat.completions.create(
    params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  )

  const content = completion.choices[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('DeepSeek 未返回分析内容')
  }

  const analysis = parseAnalysisContent(content)
  console.info('[RedCopy] DeepSeek 分析完成', {
    model: resolvedSettings.model,
    summaryLength: analysis.summary.length,
    score: analysis.score,
  })

  return analysis
}
