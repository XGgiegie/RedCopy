import type { AiAnalysisResult } from './ai-types'
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
  parseAnalysisContent,
  type AnalyzeNotePayload,
} from './analysis-core'
import type { AiSettings } from './ai-settings'
import { requestDoubaoResponses } from './doubao-api'

/** 使用火山方舟 Responses API 进行图文分析 */
export async function requestDoubaoAnalysis(
  payload: AnalyzeNotePayload,
  settings?: AiSettings,
): Promise<AiAnalysisResult> {
  const userPrompt = buildAnalysisUserPrompt(payload)

  console.info('[RedCopy] 请求豆包图文分析', {
    noteId: payload.noteId,
    imageCount: payload.imageUrls?.length ?? 0,
    title: payload.text.title?.slice(0, 40),
  })

  const content = await requestDoubaoResponses(
    ANALYSIS_SYSTEM_PROMPT,
    userPrompt,
    {
      settings,
      imageUrls: payload.imageUrls,
      logLabel: '图文分析',
    },
  )

  const analysis = parseAnalysisContent(content)
  console.info('[RedCopy] 豆包分析完成', {
    summaryLength: analysis.summary.length,
    score: analysis.score,
  })

  return analysis
}
