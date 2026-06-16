import type { AiAnalysisResult } from './ai-types'
import type { AiSettings } from './ai-settings'
import type { AnalyzeNotePayload } from './analysis-core'
import { requestDoubaoAnalysis } from './doubao-analyze'

/** 使用火山方舟豆包进行图文分析 */
export async function requestNoteAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  return requestDoubaoAnalysis(payload, settings)
}
