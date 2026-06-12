import { storageGet, storageSet } from './storage'

export const AI_SETTINGS_STORAGE_KEY = 'redcopy:aiSettings'

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

export const DEEPSEEK_MODEL_OPTIONS = [
  {
    value: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    description: '响应更快，适合日常快速分析',
  },
  {
    value: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: '启用深度思考，分析更细致',
  },
] as const

export type DeepSeekModel = (typeof DEEPSEEK_MODEL_OPTIONS)[number]['value']

export interface AiSettings {
  provider: 'deepseek'
  apiKey: string
  model: DeepSeekModel
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'deepseek',
  apiKey: '',
  model: 'deepseek-v4-flash',
}

export async function loadAiSettings(): Promise<AiSettings> {
  const saved = await storageGet<Partial<AiSettings>>(AI_SETTINGS_STORAGE_KEY)

  return {
    ...DEFAULT_AI_SETTINGS,
    ...saved,
    provider: 'deepseek',
    model: isDeepSeekModel(saved?.model) ? saved.model : DEFAULT_AI_SETTINGS.model,
    apiKey: saved?.apiKey ?? '',
  }
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await storageSet(AI_SETTINGS_STORAGE_KEY, {
    provider: 'deepseek',
    apiKey: settings.apiKey.trim(),
    model: settings.model,
  } satisfies AiSettings)
}

export function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return DEEPSEEK_MODEL_OPTIONS.some((item) => item.value === value)
}

export function isAiSettingsReady(settings: AiSettings): boolean {
  return settings.apiKey.trim().length > 0
}
