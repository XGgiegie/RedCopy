import OpenAI from 'openai'
import {
  DEEPSEEK_BASE_URL,
  type AiSettings,
  isGenerateConfigured,
  loadAiSettings,
} from './ai-settings'

/** 创建 DeepSeek 客户端（仅用于侧栏等扩展页面） */
export async function createDeepSeekClient(settings?: AiSettings) {
  const resolvedSettings = settings ?? (await loadAiSettings())

  if (!isGenerateConfigured(resolvedSettings)) {
    throw new Error('请先在设置页配置 DeepSeek API Key')
  }

  const client = new OpenAI({
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: resolvedSettings.deepseek.apiKey,
    dangerouslyAllowBrowser: true,
  })

  return { client, settings: resolvedSettings }
}
