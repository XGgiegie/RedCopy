import type { AiAnalysisResult } from './ai-types'
import type { AiSettings } from './ai-settings'
import { loadAiSettings } from './ai-settings'
import type { AnalyzeNotePayload } from './analysis-core'
import { requestDeepSeekAnalysis } from './deepseek-analyze'
import { requestDoubaoAnalysis } from './doubao-analyze'

/** 按当前配置的分析提供方路由到 DeepSeek 或豆包 */
export async function requestNoteAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const resolved = settings ?? (await loadAiSettings())

  if (resolved.analysisProvider === 'doubao') {
    return requestDoubaoAnalysis(payload, resolved)
  }

  return requestDeepSeekAnalysis(payload, resolved)
}
