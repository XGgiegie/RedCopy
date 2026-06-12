import type { AiAnalysisResult } from '../shared/ai-types'
import { requestDeepSeekAnalysis } from '../shared/deepseek-analyze'
import type { NoteTextInfo } from '../shared/note-types'

/** 侧栏直接调用 DeepSeek，不经 background，避免后台依赖重型 SDK */
export async function analyzeNoteText(payload: {
  noteId: string | null
  url: string
  text: NoteTextInfo
}): Promise<AiAnalysisResult> {
  return requestDeepSeekAnalysis(payload)
}
