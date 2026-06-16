import { storageGet, storageSet } from './storage'

export const AI_SETTINGS_STORAGE_KEY = 'redcopy:aiSettings'
export const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

/** 火山方舟豆包大模型（均支持图文理解） */
export const DOUBAO_MODEL_OPTIONS = [
  {
    value: 'doubao-seed-2-0-lite-260428',
    label: '豆包 Seed 2.0 Lite',
    description: '默认推荐，速度与效果均衡',
  },
  {
    value: 'doubao-seed-2-0-mini-260428',
    label: '豆包 Seed 2.0 Mini',
    description: '更轻量，响应更快',
  },
  {
    value: 'doubao-seed-2-0-pro-260215',
    label: '豆包 Seed 2.0 Pro',
    description: '能力更强，适合复杂分析',
  },
] as const

export type DoubaoModel = (typeof DOUBAO_MODEL_OPTIONS)[number]['value']

/** 设置页展示的能力说明 */
export const DOUBAO_CAPABILITY_SUMMARY = {
  title: '豆包（火山方舟）',
  supports: ['文本分析', '配图识别', '生成类似笔记', 'AI 配图生成'],
  modelHint: '可选模型：Lite（默认）/ Mini / Pro',
  note: '分析与生成功能均使用同一 ARK API Key，在任务详情页切换模型。',
} as const

export interface AiSettings {
  /** 火山方舟 ARK API Key */
  apiKey: string
  model: DoubaoModel
}

/** 旧版存储格式（兼容迁移） */
interface LegacyNestedSettings {
  analysisProvider?: string
  deepseek?: { apiKey?: string; model?: string }
  doubao?: { apiKey?: string; model?: string }
  provider?: string
  apiKey?: string
  model?: string
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiKey: '',
  model: 'doubao-seed-2-0-lite-260428',
}

function isFlatSettings(value: unknown): value is AiSettings {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.apiKey === 'string' && typeof record.model === 'string'
}

function migrateLegacySettings(saved: LegacyNestedSettings): AiSettings {
  if (isFlatSettings(saved)) {
    return normalizeAiSettings(saved)
  }

  const apiKey =
    saved.doubao?.apiKey?.trim() ||
    saved.deepseek?.apiKey?.trim() ||
    saved.apiKey?.trim() ||
    ''

  const legacyModel = saved.doubao?.model ?? saved.model
  const model = isDoubaoModel(legacyModel)
    ? legacyModel
    : DEFAULT_AI_SETTINGS.model

  return { apiKey, model }
}

function normalizeAiSettings(partial: Partial<AiSettings>): AiSettings {
  return {
    apiKey: partial.apiKey?.trim() ?? '',
    model: isDoubaoModel(partial.model)
      ? partial.model
      : DEFAULT_AI_SETTINGS.model,
  }
}

export async function loadAiSettings(): Promise<AiSettings> {
  const saved = await storageGet<LegacyNestedSettings & Partial<AiSettings>>(
    AI_SETTINGS_STORAGE_KEY,
  )
  if (!saved) return { ...DEFAULT_AI_SETTINGS }
  return migrateLegacySettings(saved)
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  const normalized = normalizeAiSettings(settings)
  await storageSet(AI_SETTINGS_STORAGE_KEY, normalized)
}

export function isDoubaoModel(value: unknown): value is DoubaoModel {
  return DOUBAO_MODEL_OPTIONS.some((item) => item.value === value)
}

/** 是否已配置 ARK API Key */
export function isAiConfigured(settings: AiSettings): boolean {
  return settings.apiKey.trim().length > 0
}

/** @deprecated 与 isAiConfigured 相同 */
export function isAnalysisConfigured(settings: AiSettings): boolean {
  return isAiConfigured(settings)
}

/** 生成类似笔记与 AI 分析共用同一 Key */
export function isGenerateConfigured(settings: AiSettings): boolean {
  return isAiConfigured(settings)
}

/** @deprecated 豆包模型均支持识图 */
export function supportsVisionAnalysis(_settings: AiSettings): boolean {
  return true
}

/** 更新当前分析/生成模型 */
export async function saveAnalysisModel(model: DoubaoModel): Promise<AiSettings> {
  const settings = await loadAiSettings()
  if (!isDoubaoModel(model)) return settings

  const next: AiSettings = { ...settings, model }
  await saveAiSettings(next)
  return next
}

/** 清空 API Key（保留模型选择） */
export async function clearApiKey(): Promise<AiSettings> {
  const settings = await loadAiSettings()
  const next: AiSettings = { ...settings, apiKey: '' }
  await saveAiSettings(next)
  console.info('[RedCopy] 已清空 ARK API Key')
  return next
}

/** @deprecated 使用 clearApiKey */
export async function clearAllApiKeys(): Promise<AiSettings> {
  return clearApiKey()
}
