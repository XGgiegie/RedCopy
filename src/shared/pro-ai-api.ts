import type { AiSettings } from './ai-settings'
import { loadAiSettings } from './ai-settings'
import { isValidImageDataUrl } from './draft-image'

/** Pro 版 OpenAI 兼容接口（内部使用，不在 UI 暴露服务商名称） */
export const PRO_AI_BASE_URL = 'https://aihubmix.com/v1'

/** Aihubmix 成本优化 AppCode：所有 Pro 模型调用都需要携带 */
export const PRO_APP_CODE = 'DZZL3825'

/** 保存 Pro Key 时用于探活的轻量模型（非业务主力模型） */
export const PRO_VALIDATE_MODEL = 'deepseek-v4-flash'

/** Pro 版自动垂直养号中 AI 评论 / AI 回复使用的轻量模型 */
export const PRO_GROWTH_COMMENT_MODEL = 'deepseek-v4-flash'

/** Pro 版文本主力模型 */
export const PRO_TEXT_MODEL = 'gemini-3.5-flash'

/** Pro 版图片模型 */
export const PRO_IMAGE_MODELS = ['gemini-3.1-flash-image', 'gpt-image-2'] as const

export type ProImageModel = (typeof PRO_IMAGE_MODELS)[number]

/** 设置页展示的 Pro 能力说明（不暴露上游服务商） */
export const PRO_CAPABILITY_SUMMARY = {
  title: 'Pro 版',
  description: '使用高级大模型，文本与识图能力更强',
  textModel: PRO_TEXT_MODEL,
  growthCommentModel: PRO_GROWTH_COMMENT_MODEL,
  imageModels: [...PRO_IMAGE_MODELS],
  supports: ['文本分析', '配图识别', '生成创作草稿', 'AI 配图生成', '无限 AI 评论', '无限 AI 回复'],
  growthBenefit: '自动垂直养号中的 AI 评论与 AI 回复不限次数',
  note: '免费版与 Pro 版只能二选一；保存 Pro Key 时会自动验证有效性。',
} as const

interface ProChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

interface ProTextContentPart {
  type: 'text'
  text: string
}

interface ProImageContentPart {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

type ProChatMessageContent = string | Array<ProTextContentPart | ProImageContentPart>

interface ProChatMessage {
  role: 'system' | 'user'
  content: ProChatMessageContent
}

export function buildProOpenAiHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'APP-Code': PRO_APP_CODE,
  }
}

export function buildProGeminiHeaders(apiKey: string): Record<string, string> {
  return {
    'x-goog-api-key': apiKey,
    'Content-Type': 'application/json',
    'APP-Code': PRO_APP_CODE,
  }
}

function normalizeProText(data: ProChatCompletionResponse): string {
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Pro 版模型未返回内容')
  }
  return content.trim()
}

export async function resolveProSettings(settings?: AiSettings) {
  const resolved = settings ?? (await loadAiSettings())
  const apiKey = resolved.proApiKey.trim()
  if (!apiKey) {
    throw new Error('请先在设置页配置 Pro 版 API Key')
  }
  return { apiKey }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Pro 版模型请求超时，请稍后重试（已等待 ${Math.round(timeoutMs / 1000)} 秒）`)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timer)
  }
}

function buildProUserContent(
  userPrompt: string,
  imageUrls?: string[],
): ProChatMessageContent {
  const urls = (imageUrls ?? []).map((url) => url.trim()).filter(Boolean)
  if (urls.length === 0) return userPrompt

  return [
    { type: 'text', text: userPrompt },
    ...urls.map((url): ProImageContentPart => {
      if (!isValidImageDataUrl(url)) {
        throw new Error('Pro 图文分析图片必须先转换为 Base64 data URL')
      }
      return {
        type: 'image_url',
        image_url: { url, detail: 'auto' },
      }
    }),
  ]
}

/** 调用 Pro 版 OpenAI 兼容 Chat Completions */
export async function requestProChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    settings?: AiSettings
    model?: string
    logLabel?: string
    maxTokens?: number
    temperature?: number
    imageUrls?: string[]
    timeoutMs?: number
  },
): Promise<string> {
  const { apiKey } = await resolveProSettings(options?.settings)
  const model = options?.model ?? PRO_TEXT_MODEL
  const messages: ProChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildProUserContent(userPrompt, options?.imageUrls) },
  ]

  console.info(`[RedCopy] 请求 Pro 版 ${options?.logLabel ?? 'Chat Completions'}`, {
    model,
    imageCount: options?.imageUrls?.length ?? 0,
  })

  const response = await fetchWithTimeout(`${PRO_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildProOpenAiHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      ...(options?.maxTokens === undefined ? {} : { max_tokens: options.maxTokens }),
      ...(options?.temperature === undefined ? {} : { temperature: options.temperature }),
    }),
  }, options?.timeoutMs ?? 120_000)

  const data = (await response.json()) as ProChatCompletionResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    console.error('[RedCopy] Pro 版 API 请求失败', { status: response.status, detail, model })
    throw new Error(`Pro 版模型请求失败：${detail}`)
  }

  return normalizeProText(data)
}

/** 保存前验证 Pro 版 API Key 是否可用 */
export async function validateProApiKey(apiKey: string): Promise<void> {
  const key = apiKey.trim()
  if (!key) {
    throw new Error('请输入 Pro 版 API Key')
  }

  console.info('[RedCopy] 开始验证 Pro 版 API Key', {
    model: PRO_VALIDATE_MODEL,
  })

  const response = await fetchWithTimeout(`${PRO_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildProOpenAiHeaders(key),
    body: JSON.stringify({
      model: PRO_VALIDATE_MODEL,
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
    }),
  }, 60_000)

  const data = (await response.json()) as ProChatCompletionResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    console.error('[RedCopy] Pro 版 API Key 验证失败', { status: response.status, detail })
    throw new Error(`Pro 版 API Key 无效：${detail}`)
  }

  try {
    normalizeProText(data)
  } catch {
    console.error('[RedCopy] Pro 版 API Key 验证响应异常', data)
    throw new Error('Pro 版 API Key 验证未通过，请检查 Key 是否正确')
  }

  console.info('[RedCopy] Pro 版 API Key 验证通过')
}
