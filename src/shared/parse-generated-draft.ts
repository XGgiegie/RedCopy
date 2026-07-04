import type { DraftImagePrompt, GeneratedNoteDraft } from './ai-types'
import { createImagePromptId, normalizeImagePrompts } from './draft-image'
import { parseLlmJsonObject } from './parse-llm-json'

export const DRAFT_TITLE_MAX_LENGTH = 20

export function limitDraftTitle(title: string): string {
  return Array.from(title.trim()).slice(0, DRAFT_TITLE_MAX_LENGTH).join('')
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value == null) return undefined
  return String(value)
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

function parseTitleOptions(value: unknown, fallbackTitle: string): string[] {
  const rawOptions = Array.isArray(value)
    ? value.map((item) => asString(item) ?? '')
    : typeof value === 'string'
      ? value.split(/\n|\/|；|;/)
      : []

  return uniqueStrings([fallbackTitle, ...rawOptions])
    .map(limitDraftTitle)
    .filter(Boolean)
    .slice(0, 3)
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return uniqueStrings(value.map((item) => asString(item) ?? ''))
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
    .slice(0, 5)
}

function parseImagePrompts(value: unknown): DraftImagePrompt[] {
  if (!Array.isArray(value)) return []

  const items: DraftImagePrompt[] = []
  for (const [index, entry] of value.entries()) {
    if (typeof entry === 'string' && entry.trim()) {
      items.push({
        id: createImagePromptId(),
        label: `配图${index + 1}`,
        prompt: entry.trim(),
      })
      continue
    }

    if (!entry || typeof entry !== 'object') continue

    const record = entry as Record<string, unknown>
    const prompt = asString(record.prompt)?.trim()
    if (!prompt) continue

    items.push({
      id: asString(record.id) || createImagePromptId(),
      label: asString(record.label) || `配图${index + 1}`,
      prompt,
    })
  }

  return items
}

/** 解析模型生成的类似笔记 JSON */
export function parseGeneratedDraft(content: string): GeneratedNoteDraft {
  const trimmed = content.trim()
  const parsed = parseLlmJsonObject(trimmed)

  if (parsed) {
    const parsedTitleOptions = parseTitleOptions(parsed.titleOptions, '')
    const title = limitDraftTitle(
      asString(parsed.title) ?? parsedTitleOptions[0] ?? '',
    )
    const body = asString(parsed.body)?.trim()

    if (title && body) {
      const imagePrompts = parseImagePrompts(parsed.imagePrompts)
      const legacyTips = asString(parsed.imageTips)
      const titleOptions = parseTitleOptions(parsed.titleOptions, title)

      const draft: GeneratedNoteDraft = {
        title,
        titleOptions,
        body,
        tags: parseTags(parsed.tags),
        imagePrompts:
          imagePrompts.length > 0
            ? imagePrompts
            : legacyTips
              ? [{ id: createImagePromptId(), label: '配图1', prompt: legacyTips }]
              : [],
        imageTips: legacyTips,
        raw: trimmed,
      }
      return draft
    }
  }

  return {
    title: '（生成结果）',
    titleOptions: ['（生成结果）'],
    body: trimmed,
    tags: [],
    imagePrompts: [],
    raw: trimmed,
  }
}

/**
 * 规范化已存储草稿；若此前解析失败导致正文仍是 JSON 原文，尝试重新解析。
 */
export function normalizeGeneratedDraft(draft: GeneratedNoteDraft): GeneratedNoteDraft {
  // 仅依据「当前草稿」判断是否解析失败；不能用 draft.raw（原始 JSON 永远像未解析），
  // 否则每次加载都会用 raw 重解析，把用户对标题/正文/配图项的编辑（含删除）全部还原。
  const body = draft.body.trim()
  const looksLikeUnparsedJson =
    draft.title === '（生成结果）' ||
    (body.startsWith('{') && body.includes('"title"') && body.includes('"body"'))

  let base = draft
  if (looksLikeUnparsedJson) {
    const source = draft.raw?.trim() || body
    const reparsed = parseGeneratedDraft(source)
    base = reparsed.title !== '（生成结果）' ? reparsed : draft
  }

  return {
    ...base,
    title: limitDraftTitle(base.title),
    titleOptions: parseTitleOptions(base.titleOptions, base.title),
    tags: base.tags ?? [],
    imagePrompts: normalizeImagePrompts(base),
  }
}
 
