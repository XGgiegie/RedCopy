import type { DraftImagePrompt, GeneratedNoteDraft } from './ai-types'

export const DOUBAO_IMAGE_MODEL = 'doubao-seedream-5-0-260128'

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

/** 校验是否为合法的 data:image/<格式>;base64, 前缀（格式需小写） */
export function isValidImageDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/.test(value.trim())
}
