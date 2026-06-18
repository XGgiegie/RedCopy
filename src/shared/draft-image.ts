import type { DraftImagePrompt, GeneratedNoteDraft } from './ai-types'

export const DOUBAO_IMAGE_MODEL = 'doubao-seedream-5-0-260128'

/** 配图生成统一约束：画面中不得出现任何文字（发送给 Seedream 时自动追加） */
export const IMAGE_NO_TEXT_SUFFIX =
  '画面中不得出现任何文字、字母、数字、标语、水印或排版文字，纯视觉画面'

/** 为文生图/图生图提示词追加「无文字」约束（已包含则跳过，避免重复） */
export function appendImageNoTextConstraint(prompt: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed
  if (/不得出现任何文字|无文字|no text/i.test(trimmed)) return trimmed
  return `${trimmed}，${IMAGE_NO_TEXT_SUFFIX}`
}

/** 可选生成尺寸（火山方舟 Seedream 2K 档位） */
export interface ImageSizeOption {
  /** 下拉展示文案 */
  label: string
  /** 宽高比，如 1:1 */
  ratio: string
  /** 实际像素尺寸，作为接口 size 参数，如 2048x2048 */
  value: string
}

export const IMAGE_SIZE_OPTIONS: ImageSizeOption[] = [
  { label: '1:1 · 2048×2048', ratio: '1:1', value: '2048x2048' },
  { label: '4:3 · 2304×1728', ratio: '4:3', value: '2304x1728' },
  { label: '3:4 · 1728×2304', ratio: '3:4', value: '1728x2304' },
  { label: '16:9 · 2848×1600', ratio: '16:9', value: '2848x1600' },
  { label: '9:16 · 1600×2848', ratio: '9:16', value: '1600x2848' },
  { label: '3:2 · 2496×1664', ratio: '3:2', value: '2496x1664' },
  { label: '2:3 · 1664×2496', ratio: '2:3', value: '1664x2496' },
  { label: '21:9 · 3136×1344', ratio: '21:9', value: '3136x1344' },
]

export const DEFAULT_IMAGE_SIZE = IMAGE_SIZE_OPTIONS[0].value

/** 根据像素尺寸反查宽高比 */
export function aspectRatioOfSize(size: string): string | undefined {
  return IMAGE_SIZE_OPTIONS.find((item) => item.value === size)?.ratio
}

export function createImagePromptId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createImageRecordId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createEmptyImagePrompt(label?: string): DraftImagePrompt {
  return {
    id: createImagePromptId(),
    label: label ?? '配图',
    prompt: '',
  }
}

/** 将旧版 imageTips 或残缺数据规范为 imagePrompts 数组（仅保留 id/label/prompt） */
export function normalizeImagePrompts(draft: GeneratedNoteDraft): DraftImagePrompt[] {
  if (draft.imagePrompts?.length) {
    return draft.imagePrompts.map((item, index) => ({
      id: item.id || createImagePromptId(),
      label: item.label || `配图${index + 1}`,
      prompt: item.prompt ?? '',
    }))
  }

  if (draft.imageTips?.trim()) {
    return [
      {
        id: createImagePromptId(),
        label: '配图1',
        prompt: draft.imageTips.trim(),
      },
    ]
  }

  return []
}

/** 常见图片扩展名（用于 file.type 为空时的兜底识别） */
const IMAGE_FILE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|svg)$/i

/** 判断本地文件是否可能为图片（兼容部分系统 file.type 为空的情况） */
export function isLikelyImageFile(file: File): boolean {
  const mime = file.type.trim().toLowerCase()
  if (mime.startsWith('image/')) return true
  return IMAGE_FILE_EXT_RE.test(file.name.trim())
}

/** 校验是否为合法的 data:image/<格式>;base64, 前缀 */
export function isValidImageDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
}

/** 将 data URL 的 MIME 子类型规范为小写，便于存储与 API 使用 */
export function normalizeImageDataUrl(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(data:image\/)([a-z0-9.+-]+)(;base64,.+)$/i)
  if (!match) return trimmed
  return `${match[1]}${match[2].toLowerCase()}${match[3]}`
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读取失败'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = dataUrl
  })
}

/**
 * 压缩本地图片后再转 data URL，避免大图 base64 撑爆侧栏渲染与 chrome.storage。
 */
export async function compressImageFileForStorage(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? 1920
  const quality = options?.quality ?? 0.85
  const rawDataUrl = normalizeImageDataUrl(await readFileAsDataUrl(file))

  if (!isValidImageDataUrl(rawDataUrl)) {
    throw new Error('图片格式不受支持')
  }

  const image = await loadImageElement(rawDataUrl)
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight)
  if (longestEdge <= maxEdge) {
    return rawDataUrl
  }

  const scale = maxEdge / longestEdge
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    return rawDataUrl
  }

  context.drawImage(image, 0, 0, width, height)
  const outputType = file.type.toLowerCase().includes('png') ? 'image/png' : 'image/jpeg'
  const compressed = canvas.toDataURL(outputType, quality)
  console.info('[RedCopy] 上传配图已压缩', {
    name: file.name,
    from: `${image.naturalWidth}x${image.naturalHeight}`,
    to: `${width}x${height}`,
    beforeKb: Math.round(rawDataUrl.length / 1024),
    afterKb: Math.round(compressed.length / 1024),
  })
  return normalizeImageDataUrl(compressed)
}

