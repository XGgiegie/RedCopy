import type { AiAnalysisResult, GeneratedNoteDraft } from '../shared/ai-types'
import { requestDeepSeekGenerate } from '../shared/deepseek-generate'
import type { NoteTextInfo } from '../shared/note-types'

/** 侧栏直接调用 DeepSeek 生成爆款笔记草稿 */
export async function generateNoteDraft(payload: {
  noteId: string | null
  url: string
  text: NoteTextInfo
  analysis?: AiAnalysisResult | null
  topic?: string
}): Promise<GeneratedNoteDraft> {
  return requestDeepSeekGenerate(payload)
}
