import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import { requestDoubaoGenerate } from '../../shared/doubao-generate'
import type { NoteTextInfo } from '../../shared/note-types'

/** 侧栏调用火山方舟豆包生成类似笔记草稿 */
export async function generateNoteDraft(payload: {
  noteId: string | null
  url: string
  text: NoteTextInfo
  analysis?: AiAnalysisResult | null
  topic?: string
}): Promise<GeneratedNoteDraft> {
  return requestDoubaoGenerate(payload)
}
