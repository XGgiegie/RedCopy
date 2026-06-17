import type { AiAnalysisResult } from './ai-types'
import { isProPlan, loadAiSettings, type AiSettings } from './ai-settings'
import type { AnalyzeNotePayload } from './analysis-core'
import { requestDoubaoAnalysis } from './doubao-analyze'
import { requestProAnalysis } from './pro-analyze'

/** 根据当前方案进行图文分析：免费版走豆包，Pro 版走 gemini-3.5-flash */
export async function requestNoteAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const resolved = settings ?? (await loadAiSettings())
  if (isProPlan(resolved)) {
    return requestProAnalysis(payload, resolved)
  }
  return requestDoubaoAnalysis(payload, resolved)
}
