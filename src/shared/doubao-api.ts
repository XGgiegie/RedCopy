import type { AiSettings, DoubaoModel } from './ai-settings'
import { DOUBAO_BASE_URL, loadAiSettings } from './ai-settings'
import { isValidImageDataUrl } from './draft-image'

export interface DoubaoInputImage {
  type: 'input_image'
  image_url: string
}

export interface DoubaoInputText {
  type: 'input_text'
  text: string
}

export type DoubaoContentPart = DoubaoInputImage | DoubaoInputText

export interface DoubaoMessage {
  role: 'system' | 'user'
  content: DoubaoContentPart[]
}

interface DoubaoResponsesRequest {
  model: DoubaoModel
  input: DoubaoMessage[]
}

interface DoubaoOutputText {
  type: 'output_text'
  text?: string
}

interface DoubaoOutputMessage {
  type: 'message'
  role?: string
  content?: DoubaoOutputText[]
}

interface DoubaoResponsesResponse {
  output?: DoubaoOutputMessage[]
  error?: { message?: string }
}

export async function resolveDoubaoSettings(settings?: AiSettings) {
  const resolved = settings ?? (await loadAiSettings())
  const apiKey = resolved.apiKey.trim()
  if (!apiKey) {
    throw new Error('请先在设置页配置火山方舟 ARK API Key')
  }
  return { apiKey, model: resolved.model }
}

export function buildDoubaoMessages(
  systemPrompt: string,
  userPrompt: string,
  imageUrls?: string[],
): DoubaoMessage[] {
  const userContent: DoubaoContentPart[] = []

  for (const imageUrl of imageUrls ?? []) {
    if (!isValidImageDataUrl(imageUrl)) {
      throw new Error('图文分析图片必须先转换为 Base64 data URL')
    }
    userContent.push({ type: 'input_image', image_url: imageUrl })
  }
  userContent.push({ type: 'input_text', text: userPrompt })

  return [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    { role: 'user', content: userContent },
  ]
}

function extractDoubaoText(data: DoubaoResponsesResponse): string {
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text.trim()
      }
    }
  }
  throw new Error('豆包未返回内容')
}

/** 调用火山方舟 Responses API */
export async function requestDoubaoResponses(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    settings?: AiSettings
    imageUrls?: string[]
    logLabel?: string
  },
): Promise<string> {
  const { apiKey, model } = await resolveDoubaoSettings(options?.settings)
  const body: DoubaoResponsesRequest = {
    model,
    input: buildDoubaoMessages(systemPrompt, userPrompt, options?.imageUrls),
  }

  console.info(`[RedCopy] 请求豆包 ${options?.logLabel ?? 'Responses'}`, {
    model,
    imageCount: options?.imageUrls?.length ?? 0,
  })

  const response = await fetch(`${DOUBAO_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as DoubaoResponsesResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    console.error('[RedCopy] 豆包 API 错误', { status: response.status, detail })
    throw new Error(`豆包请求失败：${detail}`)
  }

  return extractDoubaoText(data)
}
