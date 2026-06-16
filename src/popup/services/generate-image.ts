import { requestDoubaoImageGeneration } from '../../shared/doubao-image'

/** 侧栏调用豆包 Seedream 生成配图（支持多参考图与尺寸选择） */
export async function generateDraftImage(payload: {
  prompt: string
  referenceImages?: string[]
  size?: string
}): Promise<string> {
  return requestDoubaoImageGeneration(payload)
}
