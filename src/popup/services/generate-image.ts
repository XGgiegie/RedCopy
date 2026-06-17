import { requestDoubaoImageGeneration } from '../../shared/doubao-image'
import { isProPlan, loadAiSettings } from '../../shared/ai-settings'
import {
  requestProImageGeneration,
  type ProGeminiImageSize,
  type ProGptImageBackground,
  type ProGptImageModeration,
  type ProGptImageQuality,
  type ProGptImageSize,
  type ProImageAspectRatio,
} from '../../shared/pro-image'
import type { ProImageModel } from '../../shared/pro-ai-api'

export interface GenerateDraftImagePayload {
  prompt: string
  referenceImages?: string[]
  size?: string
  proModel?: ProImageModel
  proGemini?: {
    aspectRatio?: ProImageAspectRatio
    imageSize?: ProGeminiImageSize
  }
  proGpt?: {
    size?: ProGptImageSize
    quality?: ProGptImageQuality
    moderation?: ProGptImageModeration
    background?: ProGptImageBackground
  }
}

/** 侧栏生成配图：免费版走豆包，Pro 版走 Aihubmix 生图模型 */
export async function generateDraftImage(payload: GenerateDraftImagePayload): Promise<string> {
  const settings = await loadAiSettings()
  if (isProPlan(settings)) {
    const proPayload = payload as GenerateDraftImagePayload
    return requestProImageGeneration({
      prompt: proPayload.prompt,
      referenceImages: proPayload.referenceImages,
      settings,
      model: proPayload.proModel ?? 'gemini-3.1-flash-image',
      gemini: proPayload.proGemini,
      gpt: proPayload.proGpt,
    })
  }

  return requestDoubaoImageGeneration({ ...payload, settings })
}
