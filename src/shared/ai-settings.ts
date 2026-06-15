import { storageGet, storageSet } from './storage'

export const AI_SETTINGS_STORAGE_KEY = 'redcopy:aiSettings'

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

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

export const DOUBAO_MODEL_OPTIONS = [
  {
    value: 'doubao-seed-2-0-pro-260215',
    label: '豆包 Seed 2.0 Pro',
    description: '支持图文理解，可分析笔记配图',
  },
] as const

export type DeepSeekModel = (typeof DEEPSEEK_MODEL_OPTIONS)[number]['value']
export type DoubaoModel = (typeof DOUBAO_MODEL_OPTIONS)[number]['value']
export type AnalysisProvider = 'deepseek' | 'doubao'

export const ANALYSIS_PROVIDER_OPTIONS = [
  {
    value: 'deepseek',
    label: 'DeepSeek 文本',
    description: '仅分析文案，不识别配图',
  },
  {
    value: 'doubao',
    label: '豆包图文',
    description: '支持勾选配图识图分析',
  },
] as const

/** 各服务商能力说明（设置页展示、主界面提示复用） */
export const PROVIDER_CAPABILITY_SUMMARY = {
  deepseek: {
    title: 'DeepSeek',
    supports: ['文本分析', '生成类似笔记'],
    notSupports: ['配图识别'],
    modelHint: '分析模型：V4 Flash / V4 Pro（默认 Flash）',
  },
  doubao: {
    title: '豆包（火山方舟）',
    supports: ['文本分析', '配图识别'],
    notSupports: ['生成类似笔记'],
    modelHint: '分析模型：Seed 2.0 Pro',
    note: '生成类似笔记需配置 DeepSeek',
  },
} as const

export interface DeepSeekSettings {
  apiKey: string
  model: DeepSeekModel
}

export interface DoubaoSettings {
  apiKey: string
  model: DoubaoModel
}

export interface AiSettings {
  /** AI 分析使用的模型提供方 */
  analysisProvider: AnalysisProvider
  deepseek: DeepSeekSettings
  doubao: DoubaoSettings
}

/** 旧版存储格式（兼容迁移） */
interface LegacyAiSettings {
  provider?: 'deepseek'
  apiKey?: string
  model?: string
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  analysisProvider: 'deepseek',
  deepseek: {
    apiKey: '',
    model: 'deepseek-v4-flash',
  },
  doubao: {
    apiKey: '',
    model: 'doubao-seed-2-0-pro-260215',
  },
}

function migrateLegacySettings(saved: LegacyAiSettings & Partial<AiSettings>): AiSettings {
  if (saved.deepseek && saved.doubao) {
    return normalizeAiSettings(saved)
  }

  const legacyKey = saved.apiKey ?? ''
  const legacyModel = isDeepSeekModel(saved.model)
    ? saved.model
    : DEFAULT_AI_SETTINGS.deepseek.model

  return {
    analysisProvider: 'deepseek',
    deepseek: {
      apiKey: legacyKey,
      model: legacyModel,
    },
    doubao: { ...DEFAULT_AI_SETTINGS.doubao },
  }
}

function normalizeAiSettings(partial: Partial<AiSettings>): AiSettings {
  return {
    analysisProvider:
      partial.analysisProvider === 'doubao' ? 'doubao' : 'deepseek',
    deepseek: {
      apiKey: partial.deepseek?.apiKey?.trim() ?? '',
      model: isDeepSeekModel(partial.deepseek?.model)
        ? partial.deepseek.model
        : DEFAULT_AI_SETTINGS.deepseek.model,
    },
    doubao: {
      apiKey: partial.doubao?.apiKey?.trim() ?? '',
      model: isDoubaoModel(partial.doubao?.model)
        ? partial.doubao.model
        : DEFAULT_AI_SETTINGS.doubao.model,
    },
  }
}

export async function loadAiSettings(): Promise<AiSettings> {
  const saved = await storageGet<LegacyAiSettings & Partial<AiSettings>>(
    AI_SETTINGS_STORAGE_KEY,
  )
  if (!saved) return { ...DEFAULT_AI_SETTINGS }
  return migrateLegacySettings(saved)
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  const normalized = normalizeAiSettings(settings)
  await storageSet(AI_SETTINGS_STORAGE_KEY, normalized)
}

export function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return DEEPSEEK_MODEL_OPTIONS.some((item) => item.value === value)
}

export function isDoubaoModel(value: unknown): value is DoubaoModel {
  return DOUBAO_MODEL_OPTIONS.some((item) => item.value === value)
}

/** 指定提供方是否已配置 Key */
export function isProviderConfigured(
  settings: AiSettings,
  provider: AnalysisProvider,
): boolean {
  if (provider === 'doubao') {
    return settings.doubao.apiKey.trim().length > 0
  }
  return settings.deepseek.apiKey.trim().length > 0
}

/** 当前分析提供方是否已配置 Key */
export function isAnalysisConfigured(settings: AiSettings): boolean {
  return isProviderConfigured(settings, settings.analysisProvider)
}

/** 生成类似笔记依赖 DeepSeek */
export function isGenerateConfigured(settings: AiSettings): boolean {
  return settings.deepseek.apiKey.trim().length > 0
}

/** @deprecated 使用 isAnalysisConfigured */
export function isAiSettingsReady(settings: AiSettings): boolean {
  return isAnalysisConfigured(settings)
}

export function supportsVisionAnalysis(settings: AiSettings): boolean {
  return settings.analysisProvider === 'doubao'
}

export function getAnalysisProviderLabel(provider: AnalysisProvider): string {
  const option = ANALYSIS_PROVIDER_OPTIONS.find((item) => item.value === provider)
  return option?.label ?? provider
}

export function getAnalysisProviderDescription(provider: AnalysisProvider): string {
  const option = ANALYSIS_PROVIDER_OPTIONS.find((item) => item.value === provider)
  return option?.description ?? ''
}

/** 仅更新分析服务商（主界面切换时调用） */
export async function saveAnalysisProvider(
  provider: AnalysisProvider,
): Promise<AiSettings> {
  const settings = await loadAiSettings()
  const next = { ...settings, analysisProvider: provider }
  await saveAiSettings(next)
  return next
}

export function getAnalysisModelOptions(provider: AnalysisProvider) {
  return provider === 'doubao' ? DOUBAO_MODEL_OPTIONS : DEEPSEEK_MODEL_OPTIONS
}

export function getCurrentAnalysisModel(settings: AiSettings): DeepSeekModel | DoubaoModel {
  return settings.analysisProvider === 'doubao'
    ? settings.doubao.model
    : settings.deepseek.model
}

/** 更新当前服务商下的分析模型 */
export async function saveAnalysisModel(
  provider: AnalysisProvider,
  model: DeepSeekModel | DoubaoModel,
): Promise<AiSettings> {
  const settings = await loadAiSettings()

  if (provider === 'doubao') {
    if (!isDoubaoModel(model)) return settings
    const next: AiSettings = {
      ...settings,
      doubao: { ...settings.doubao, model },
    }
    await saveAiSettings(next)
    return next
  }

  if (!isDeepSeekModel(model)) return settings
  const next: AiSettings = {
    ...settings,
    deepseek: { ...settings.deepseek, model },
  }
  await saveAiSettings(next)
  return next
}

export type ApiKeyProvider = 'deepseek' | 'doubao'

/** 清空指定服务商的 API Key */
export async function clearProviderApiKey(provider: ApiKeyProvider): Promise<AiSettings> {
  const settings = await loadAiSettings()
  const next: AiSettings =
    provider === 'deepseek'
      ? { ...settings, deepseek: { ...settings.deepseek, apiKey: '' } }
      : { ...settings, doubao: { ...settings.doubao, apiKey: '' } }
  await saveAiSettings(next)
  console.info('[RedCopy] 已清空 API Key', { provider })
  return next
}

/** 清空全部 API Key（保留模型与服务商选择） */
export async function clearAllApiKeys(): Promise<AiSettings> {
  const settings = await loadAiSettings()
  const next: AiSettings = {
    ...settings,
    deepseek: { ...settings.deepseek, apiKey: '' },
    doubao: { ...settings.doubao, apiKey: '' },
  }
  await saveAiSettings(next)
  console.info('[RedCopy] 已清空全部 API Key')
  return next
}
