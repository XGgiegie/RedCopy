import type { AiAnalysisResult } from '../../shared/ai-types'
import { requestNoteAnalysis } from '../../shared/analyze-note'
import type { NoteTextInfo } from '../../shared/note-types'

/** 侧栏直接调用 AI 分析，不经 background */
export async function analyzeNoteText(payload: {
  noteId: string | null
  url: string
  text: NoteTextInfo
  imageUrls?: string[]
}): Promise<AiAnalysisResult> {
  return requestNoteAnalysis(payload)
}
