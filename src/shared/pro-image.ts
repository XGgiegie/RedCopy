import type { AiSettings } from './ai-settings'
import { isProPlan, loadAiSettings } from './ai-settings'
import { appendImageNoTextConstraint } from './draft-image'
import {
  PRO_AI_BASE_URL,
  buildProGeminiHeaders,
  buildProOpenAiHeaders,
  fetchWithTimeout,
  resolveProSettings,
  type ProImageModel,
} from './pro-ai-api'

export type ProImageAspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
export type ProGeminiImageSize = '1k' | '2k'
export type ProGptImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto'
export type ProGptImageQuality = 'auto' | 'high' | 'medium' | 'low'
export type ProGptImageModeration = 'auto' | 'low'
export type ProGptImageBackground = 'auto' | 'transparent' | 'opaque'

export interface ProImageGenerationOptions {
  prompt: string
  referenceImages?: string[]
  settings?: AiSettings
  model: ProImageModel
  gemini?: {
    aspectRatio?: ProImageAspectRatio
    imageSize?: ProGeminiImageSize
  }
  gpt?: {
    size?: ProGptImageSize
    quality?: ProGptImageQuality
    moderation?: ProGptImageModeration
    background?: ProGptImageBackground
  }
}

interface GeminiPart {
  text?: string
  inlineData?: {
    mimeType?: string
    data?: string
  }
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[]
    }
  }>
  error?: {
    message?: string
  }
}

interface GptImageBase64Item {
  bytesBase64?: string
  mimeType?: string
}

interface GptImageOutputObject {
  b64_json?: Array<GptImageBase64Item> | string
  urls?: string[]
  url?: string
}

interface GptImagePredictionResponse {
  output?: string | string[] | Array<{ url?: string; b64_json?: string }> | GptImageOutputObject
  data?: Array<{ url?: string; b64_json?: string }>
  error?: { message?: string }
}

function assertProSettings(settings: AiSettings): void {
  if (!isProPlan(settings)) {
    throw new Error('Pro 生图需先切换到 Pro 版并配置 API Key')
  }
}

function extractDataUrlFromGemini(data: GeminiStreamChunk[] | GeminiStreamChunk): string {
  const chunks = Array.isArray(data) ? data : [data]

  for (const chunk of chunks) {
    if (chunk.error?.message) {
      throw new Error(`Gemini 生图失败：${chunk.error.message}`)
    }

    for (const candidate of chunk.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        const imageData = part.inlineData?.data?.trim()
        if (imageData) {
          const mime = part.inlineData?.mimeType || 'image/png'
          return `data:${mime};base64,${imageData}`
        }
      }
    }
  }

  throw new Error('Gemini 生图未返回图片')
}

function normalizeGptImageOutput(data: GptImagePredictionResponse): string {
  const fromData = data.data?.[0]?.url?.trim() || data.data?.[0]?.b64_json?.trim()
  if (fromData) {
    return fromData.startsWith('http') || fromData.startsWith('data:')
      ? fromData
      : `data:image/png;base64,${fromData}`
  }

  if (typeof data.output === 'object' && data.output && !Array.isArray(data.output)) {
    const output = data.output
    const url = output.url?.trim() || output.urls?.find((item) => item.trim())?.trim()
    if (url) return url

    if (typeof output.b64_json === 'string' && output.b64_json.trim()) {
      return `data:image/png;base64,${output.b64_json.trim()}`
    }

    const firstBase64 = Array.isArray(output.b64_json)
      ? output.b64_json.find((item) => item.bytesBase64?.trim())
      : undefined
    if (firstBase64?.bytesBase64?.trim()) {
      const mime = firstBase64.mimeType?.includes('/')
        ? firstBase64.mimeType
        : `image/${firstBase64.mimeType || 'png'}`
      return `data:${mime};base64,${firstBase64.bytesBase64.trim()}`
    }
  }

  if (typeof data.output === 'string' && data.output.trim()) {
    const output = data.output.trim()
    return output.startsWith('http') || output.startsWith('data:')
      ? output
      : `data:image/png;base64,${output}`
  }

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (typeof item === 'string' && item.trim()) {
        const output = item.trim()
        return output.startsWith('http') || output.startsWith('data:')
          ? output
          : `data:image/png;base64,${output}`
      }
      if (typeof item === 'object' && item) {
        const output = item.url?.trim() || item.b64_json?.trim()
        if (output) {
          return output.startsWith('http') || output.startsWith('data:')
            ? output
            : `data:image/png;base64,${output}`
        }
      }
    }
  }

  throw new Error('GPT 图片模型未返回图片')
}

async function requestGeminiImage(
  apiKey: string,
  prompt: string,
  options: ProImageGenerationOptions,
): Promise<string> {
  if ((options.referenceImages?.length ?? 0) > 0) {
    console.info('[RedCopy] Pro Gemini 生图暂不上传参考图，已按文生图处理', {
      referenceCount: options.referenceImages?.length ?? 0,
    })
  }

  const aspectRatio = options.gemini?.aspectRatio ?? '1:1'
  const imageSize = options.gemini?.imageSize ?? '1k'

  console.info('[RedCopy] 请求 Pro Gemini 生图', {
    model: 'gemini-3.1-flash-image',
    aspectRatio,
    imageSize,
    promptLength: prompt.length,
  })

  const response = await fetchWithTimeout(
    'https://aihubmix.com/gemini/v1beta/models/gemini-3.1-flash-image:streamGenerateContent',
    {
      method: 'POST',
      headers: buildProGeminiHeaders(apiKey),
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      }),
    },
    600_000,
  )

  const data = (await response.json()) as GeminiStreamChunk[] | GeminiStreamChunk

  if (!response.ok) {
    const detail = Array.isArray(data)
      ? data.find((item) => item.error?.message)?.error?.message
      : data.error?.message
    throw new Error(`Gemini 生图失败：${detail ?? `HTTP ${response.status}`}`)
  }

  return extractDataUrlFromGemini(data)
}

async function requestGptImage(
  apiKey: string,
  prompt: string,
  options: ProImageGenerationOptions,
): Promise<string> {
  if ((options.referenceImages?.length ?? 0) > 0) {
    console.info('[RedCopy] GPT 图片统一接口暂按文生图处理参考图', {
      referenceCount: options.referenceImages?.length ?? 0,
    })
  }

  const size = options.gpt?.size ?? '1024x1024'
  const quality = options.gpt?.quality ?? 'high'
  const moderation = options.gpt?.moderation ?? 'low'
  const background = options.gpt?.background ?? 'auto'

  console.info('[RedCopy] 请求 Pro GPT 生图', {
    model: 'gpt-image-2',
    size,
    quality,
    moderation,
    background,
    promptLength: prompt.length,
  })

  const response = await fetchWithTimeout(
    `${PRO_AI_BASE_URL}/models/openai/gpt-image-2/predictions`,
    {
      method: 'POST',
      headers: buildProOpenAiHeaders(apiKey),
      body: JSON.stringify({
        input: {
          prompt,
          size,
          n: 1,
          quality,
          moderation,
          background,
        },
      }),
    },
    600_000,
  )

  const data = (await response.json()) as GptImagePredictionResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    throw new Error(`GPT 图片模型请求失败：${detail}`)
  }

  return normalizeGptImageOutput(data)
}

export async function requestProImageGeneration(
  options: ProImageGenerationOptions,
): Promise<string> {
  const settings = options.settings ?? (await loadAiSettings())
  assertProSettings(settings)

  const prompt = appendImageNoTextConstraint(options.prompt.trim())
  if (!prompt) {
    throw new Error('配图提示词不能为空')
  }

  const { apiKey } = await resolveProSettings(settings)

  if (options.model === 'gpt-image-2') {
    return requestGptImage(apiKey, prompt, options)
  }

  return requestGeminiImage(apiKey, prompt, options)
}
