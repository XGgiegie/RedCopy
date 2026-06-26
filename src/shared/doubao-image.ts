import type { AiSettings } from './ai-settings'
import { DOUBAO_BASE_URL } from './ai-settings'
import { DEFAULT_IMAGE_SIZE, DOUBAO_IMAGE_MODEL, appendImageNoTextConstraint } from './draft-image'
import { resolveDoubaoSettings } from './doubao-api'

export interface ImageGenerationOptions {
  prompt: string
  /** 参考图列表（URL 或 data:image/...;base64），有值时走图生图，支持多图融合 */
  referenceImages?: string[]
  /** 生成尺寸（像素，如 2048x2048），默认 1:1 2K */
  size?: string
  settings?: AiSettings
}

interface ImageGenerationResponse {
  data?: Array<{ url?: string; b64_json?: string }>
  error?: { message?: string }
}

function guessBase64MimeType(value: string): string {
  const base64 = value.trim().slice(0, 24)
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('UklGR')) return 'image/webp'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  return 'image/jpeg'
}

function normalizeImageOutput(item?: { url?: string; b64_json?: string }): string {
  const base64 = item?.b64_json?.trim()
  if (base64) {
    return base64.startsWith('data:')
      ? base64
      : `data:${guessBase64MimeType(base64)};base64,${base64}`
  }

  const url = item?.url?.trim()
  if (url) return url

  throw new Error('配图生成未返回图片')
}

/** 调用火山方舟 Seedream 文生图 / 图生图 */
export async function requestDoubaoImageGeneration(
  options: ImageGenerationOptions,
): Promise<string> {
  const prompt = appendImageNoTextConstraint(options.prompt.trim())
  if (!prompt) {
    throw new Error('配图提示词不能为空')
  }

  const { apiKey } = await resolveDoubaoSettings(options.settings)

  const references = (options.referenceImages ?? [])
    .map((item) => item.trim())
    .filter(Boolean)

  const body: Record<string, unknown> = {
    model: DOUBAO_IMAGE_MODEL,
    prompt,
    sequential_image_generation: 'disabled',
    response_format: 'b64_json',
    size: options.size?.trim() || DEFAULT_IMAGE_SIZE,
    stream: false,
    watermark: false,
  }

  // 单图传字符串、多图传数组，匹配官方多图融合用法
  if (references.length === 1) {
    body.image = references[0]
  } else if (references.length > 1) {
    body.image = references
  }

  console.info('[RedCopy] 请求豆包配图生成', {
    model: DOUBAO_IMAGE_MODEL,
    mode: references.length > 0 ? `图生图(${references.length}图)` : '文生图',
    size: body.size,
    promptLength: prompt.length,
  })

  const response = await fetch(`${DOUBAO_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = (await response.json()) as ImageGenerationResponse

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    console.error('[RedCopy] 配图生成 API 错误', { status: response.status, detail })
    throw new Error(`配图生成失败：${detail}`)
  }

  const imageUrl = normalizeImageOutput(data.data?.[0])

  console.info('[RedCopy] 配图生成完成', {
    format: imageUrl.startsWith('data:') ? 'base64' : 'url',
    imageUrl: imageUrl.slice(0, 80),
  })
  return imageUrl
}
