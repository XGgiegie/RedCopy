// 该模块只在侧栏等扩展页面运行（不在 background service worker 中），
// OpenAI SDK 在浏览器环境运行成熟，可直接静态 import。
import type OpenAI from 'openai'
import type { AiAnalysisResult } from './ai-types'
import type { AiSettings, DeepSeekModel } from './ai-settings'
import { createDeepSeekClient } from './deepseek-client'
import type { NoteTextInfo } from './note-types'

const ANALYSIS_SYSTEM_PROMPT = `你是资深小红书爆款内容教练，擅长拆解爆款笔记，并教会用户「借鉴它，做出自己的爆款」。

用户会提供一篇小红书图文笔记。请从「如何仿写/创作爆款」的角度深度拆解，而不是只做泛泛点评。

重点分析：
1. 爆款基因：标题钩子、首屏抓力、情绪共鸣、人设场景、信息差、收藏价值
2. 结构节奏：开头—展开—升华—结尾/互动引导，段落与换行策略
3. 互动密码：点赞/收藏/评论数据背后，哪些设计在驱动传播与互动
4. 可复制公式：提炼能迁移到自己选题的「爆款模板」，给出具体动作

输出要求：
- 只输出 JSON，不要 markdown 代码块
- 用中文，语气像教练带学员：务实、可执行、少空话
- rewriteSuggestions 至少 3 条，每条都是用户能立刻动手改标题/正文/标签/配图的具体建议

JSON 字段：
{
  "summary": "一句话说清这篇为什么能火 + 最值得学习的 1 个核心",
  "titleAnalysis": "标题用了什么钩子/公式，并给出 1-2 个同赛道可仿写标题示例",
  "contentStructure": ["可复用的结构步骤1", "步骤2", "..."],
  "engagementInsight": "互动数据解读 + 促进收藏/评论/转发的设计点",
  "rewriteSuggestions": ["具体创作建议1", "建议2", "建议3"],
  "score": 0
}
score 为 0-100 的爆款指数（越高越有学习参考价值）。`

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
    '',
    '请拆解这篇笔记的爆款逻辑，并告诉我如何借鉴它创作自己的小红书爆款内容。',
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
  const { client, settings: resolvedSettings } = await createDeepSeekClient(
    settings,
  )

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
