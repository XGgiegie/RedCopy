import type { AiAnalysisResult } from './ai-types'
import { isProPlan, loadAiSettings, type AiSettings } from './ai-settings'
import {
  
  buildAnalysisUserPrompt,
  parseAnalysisContent,
  type AnalyzeNotePayload,
} from './analysis-core'
import { PRO_TEXT_MODEL, requestProChatCompletion } from './pro-ai-api'

/** Pro 版使用 gemini-3.5-flash 进行图文分析 */
export async function requestProAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const resolved = settings ?? (await loadAiSettings())
  if (!isProPlan(resolved)) {
    throw new Error('Pro 图文分析需先切换到 Pro 版并配置 API Key')
  }

  const userPrompt = buildAnalysisUserPrompt(payload)

  console.info('[RedCopy] 请求 Pro 图文分析', {
    model: PRO_TEXT_MODEL,
    noteId: payload.noteId,
    imageCount: payload.imageUrls?.length ?? 0,
    title: payload.text.title?.slice(0, 40),
  })

  const content = await requestProChatCompletion(
    (await (await import('./prompts')).loadPrompts()).analysis,
    userPrompt,
    {
      settings: resolved,
      model: PRO_TEXT_MODEL,
      imageUrls: payload.imageUrls,
      logLabel: '图文分析',
      timeoutMs: 180_000,
    },
  )

  const analysis = parseAnalysisContent(content)
  console.info('[RedCopy] Pro 图文分析完成', {
    summaryLength: analysis.summary.length,
    score: analysis.score,
  })
  return analysis
}
