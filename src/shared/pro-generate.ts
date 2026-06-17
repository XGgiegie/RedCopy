import type { AiSettings } from './ai-settings'
import { isProPlan, loadAiSettings } from './ai-settings'
import type { GeneratedNoteDraft } from './ai-types'
import {
  GENERATE_SYSTEM_PROMPT,
  buildGenerateUserPrompt,
  type GenerateNotePayload,
} from './doubao-generate'
import { parseGeneratedDraft } from './parse-generated-draft'
import { PRO_TEXT_MODEL, requestProChatCompletion } from './pro-ai-api'

/** Pro 版使用 gemini-3.5-flash 生成类似笔记草稿 */
export async function requestProGenerate(
  payload: GenerateNotePayload,
  settings?: AiSettings,
): Promise<GeneratedNoteDraft> {
  const resolved = settings ?? (await loadAiSettings())
  if (!isProPlan(resolved)) {
    throw new Error('Pro 生成类似笔记需先切换到 Pro 版并配置 API Key')
  }

  const userPrompt = buildGenerateUserPrompt(payload)

  console.info('[RedCopy] 请求 Pro 生成类似笔记', {
    model: PRO_TEXT_MODEL,
    noteId: payload.noteId,
    hasAnalysis: Boolean(payload.analysis),
  })

  const content = await requestProChatCompletion(
    GENERATE_SYSTEM_PROMPT,
    userPrompt,
    {
      settings: resolved,
      model: PRO_TEXT_MODEL,
      logLabel: '生成类似笔记',
      timeoutMs: 180_000,
    },
  )

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] Pro 类似笔记生成完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })
  return draft
}
