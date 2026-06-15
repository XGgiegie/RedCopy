// 该模块只在侧栏等扩展页面运行（不在 background service worker 中），
// OpenAI SDK 在浏览器环境运行成熟，可直接静态 import。
import type OpenAI from 'openai'
import type { AiAnalysisResult } from './ai-types'
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  parseAnalysisContent,
  type AnalyzeNotePayload,
} from './analysis-core'
import type { AiSettings, DeepSeekModel } from './ai-settings'
import { createDeepSeekClient } from './deepseek-client'

interface DeepSeekCompletionParams {
  model: DeepSeekModel
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  stream: false
  thinking?: { type: 'enabled' }
  reasoning_effort?: 'high'
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

/** 使用 DeepSeek OpenAI 兼容接口分析笔记（纯文本） */
export async function requestDeepSeekAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const { client, settings: resolvedSettings } = await createDeepSeekClient(
    settings,
  )

  const userPrompt = buildAnalysisUserPrompt(payload)
  const params = buildCompletionParams(resolvedSettings.deepseek.model, userPrompt)

  console.info('[RedCopy] 请求 DeepSeek 分析', {
    model: resolvedSettings.deepseek.model,
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
    model: resolvedSettings.deepseek.model,
    summaryLength: analysis.summary.length,
    score: analysis.score,
  })

  return analysis
}
