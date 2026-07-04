import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import { isProPlan, loadAiSettings } from '../../shared/ai-settings'
import type { CreationPurposeKey } from '../../shared/creation-intent'
import { requestDoubaoGenerate } from '../../shared/doubao-generate'
import { requestProGenerate } from '../../shared/pro-generate'
import type { NoteTextInfo } from '../../shared/note-types'

/** 侧栏生成创作草稿：免费版走豆包，Pro 版走 gemini-3.5-flash */
export async function generateNoteDraft(payload: {
  noteId: string | null
  url: string
  text: NoteTextInfo
  analysis?: AiAnalysisResult | null
  purpose?: CreationPurposeKey
  topic?: string
}): Promise<GeneratedNoteDraft> {
  const settings = await loadAiSettings()
  if (isProPlan(settings)) {
    return requestProGenerate(payload, settings)
  }
  return requestDoubaoGenerate(payload, settings)
}
