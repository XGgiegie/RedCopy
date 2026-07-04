import type { AiSettings } from './ai-settings'
import { isProPlan, loadAiSettings } from './ai-settings'
import type { GeneratedNoteDraft } from './ai-types'
import {
  buildDirectGenerateUserPrompt,
  buildGenerateUserPrompt,
  type DirectGenerateNotePayload,
  type GenerateNotePayload,
} from './doubao-generate'
import { parseGeneratedDraft } from './parse-generated-draft'
import { buildGenerateSystemPrompt, loadPrompts } from './prompts'
import { PRO_TEXT_MODEL, requestProChatCompletion } from './pro-ai-api'

/** Pro 版使用 gemini-3.5-flash 生成创作草稿 */
export async function requestProGenerate(
  payload: GenerateNotePayload,
  settings?: AiSettings,
): Promise<GeneratedNoteDraft> {
  const resolved = settings ?? (await loadAiSettings())
  if (!isProPlan(resolved)) {
    throw new Error('Pro 生成创作草稿需先切换到 Pro 版并配置 API Key')
  }

  const userPrompt = buildGenerateUserPrompt(payload)
  const prompts = await loadPrompts()
  const systemPrompt = buildGenerateSystemPrompt(prompts, payload.purpose)

  console.info('[RedCopy] 请求 Pro 生成创作草稿', {
    model: PRO_TEXT_MODEL,
    noteId: payload.noteId,
    hasAnalysis: Boolean(payload.analysis),
    purpose: payload.purpose,
  })

  const content = await requestProChatCompletion(
    systemPrompt,
    userPrompt,
    {
      settings: resolved,
      model: PRO_TEXT_MODEL,
      logLabel: '生成创作草稿',
      timeoutMs: 180_000,
    },
  )

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] Pro 创作草稿生成完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })
  return draft
}

/** Pro 版直接创作小红书笔记草稿 */
export async function requestProDirectGenerate(
  payload: DirectGenerateNotePayload,
  settings?: AiSettings,
): Promise<GeneratedNoteDraft> {
  const resolved = settings ?? (await loadAiSettings())
  if (!isProPlan(resolved)) {
    throw new Error('Pro 直接创作需先切换到 Pro 版并配置 API Key')
  }

  const userPrompt = buildDirectGenerateUserPrompt(payload)
  const prompts = await loadPrompts()
  const systemPrompt = buildGenerateSystemPrompt(prompts, payload.purpose)

  console.info('[RedCopy] 请求 Pro 直接创作', {
    model: PRO_TEXT_MODEL,
    purpose: payload.purpose,
    topicLength: payload.topic.trim().length,
  })

  const content = await requestProChatCompletion(
    systemPrompt,
    userPrompt,
    {
      settings: resolved,
      model: PRO_TEXT_MODEL,
      logLabel: '直接创作',
      timeoutMs: 180_000,
    },
  )

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] Pro 直接创作完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })
  return draft
}
