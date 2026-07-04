import { storageGet, storageSet } from './storage'

export const AI_SETTINGS_STORAGE_KEY = 'redcopy:aiSettings'
export const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
export const DOUBAO_TEXT_MODEL = 'doubao-seed-2-1-pro'

/** AI 配置方案：免费版（豆包）与 Pro 版二选一 */
export type AiPlan = 'free' | 'pro'

/** 火山方舟豆包大模型（固定使用 Doubao-Seed-2.1 Pro） */
export const DOUBAO_MODEL_OPTIONS = [
  {
    value: DOUBAO_TEXT_MODEL,
    label: 'Doubao-Seed-2.1 Pro',
    description: '固定使用 Doubao-Seed-2.1 Pro，不再使用豆包 2.0 系列模型',
  },
] as const

export type DoubaoModel = (typeof DOUBAO_MODEL_OPTIONS)[number]['value']

/** 设置页展示的能力说明 */
export const DOUBAO_CAPABILITY_SUMMARY = {
  title: '免费版 · 豆包（火山方舟）',
  supports: ['文本分析', '配图识别', '生成创作草稿', 'AI 配图生成'],
  modelHint: '固定模型',
  note: '分析与生成功能均使用同一 ARK API Key，固定调用 Doubao-Seed-2.1 Pro。',
} as const

export interface AiSettings {
  /** 当前选用的方案 */
  plan: AiPlan
  /** 免费版：火山方舟 ARK API Key */
  apiKey: string
  model: DoubaoModel
  /** Pro 版 API Key */
  proApiKey: string
}

/** 旧版存储格式（兼容迁移） */
interface LegacyNestedSettings {
  analysisProvider?: string
  deepseek?: { apiKey?: string; model?: string }
  doubao?: { apiKey?: string; model?: string }
  provider?: string
  apiKey?: string
  model?: string
  plan?: AiPlan
  proApiKey?: string
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  plan: 'free',
  apiKey: '',
  model: DOUBAO_TEXT_MODEL,
  proApiKey: '',
}

function isAiPlan(value: unknown): value is AiPlan {
  return value === 'free' || value === 'pro'
}

function isFlatSettings(value: unknown): value is Partial<AiSettings> {
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

  const proApiKey = typeof saved.proApiKey === 'string' ? saved.proApiKey.trim() : ''
  const plan = isAiPlan(saved.plan)
    ? saved.plan
    : proApiKey
      ? 'pro'
      : 'free'

  return { plan, apiKey, model, proApiKey }
}

function normalizeAiSettings(partial: Partial<AiSettings>): AiSettings {
  const plan = isAiPlan(partial.plan) ? partial.plan : DEFAULT_AI_SETTINGS.plan
  return {
    plan,
    apiKey: partial.apiKey?.trim() ?? '',
    model: isDoubaoModel(partial.model)
      ? partial.model
      : DEFAULT_AI_SETTINGS.model,
    proApiKey: partial.proApiKey?.trim() ?? '',
  }
}

function enforcePlanExclusivity(settings: AiSettings): AiSettings {
  if (settings.plan === 'pro') {
    return { ...settings, apiKey: '' }
  }
  return { ...settings, proApiKey: '' }
}

export async function loadAiSettings(): Promise<AiSettings> {
  const saved = await storageGet<LegacyNestedSettings & Partial<AiSettings>>(
    AI_SETTINGS_STORAGE_KEY,
  )
  if (!saved) return { ...DEFAULT_AI_SETTINGS }
  return migrateLegacySettings(saved)
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  const normalized = enforcePlanExclusivity(normalizeAiSettings(settings))
  await storageSet(AI_SETTINGS_STORAGE_KEY, normalized)
}

export function isDoubaoModel(value: unknown): value is DoubaoModel {
  return DOUBAO_MODEL_OPTIONS.some((item) => item.value === value)
}

export function isProPlan(settings: AiSettings): boolean {
  return settings.plan === 'pro'
}

/** 是否已配置当前方案所需的 API Key */
export function isAiConfigured(settings: AiSettings): boolean {
  if (settings.plan === 'pro') return settings.proApiKey.trim().length > 0
  return settings.apiKey.trim().length > 0
}

/** Pro 版是否享有无限养号 AI 评论/回复 */
export function hasUnlimitedGrowthAi(settings: AiSettings): boolean {
  return settings.plan === 'pro' && settings.proApiKey.trim().length > 0
}

/** 当前方案下的有效 API Key */
export function resolveActiveApiKey(settings: AiSettings): string {
  if (settings.plan === 'pro') return settings.proApiKey.trim()
  return settings.apiKey.trim()
}

/** @deprecated 与 isAiConfigured 相同 */
export function isAnalysisConfigured(settings: AiSettings): boolean {
  return isAiConfigured(settings)
}

/** 生成创作草稿与生成前分析共用同一 Key */
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

/** 清空当前方案的 API Key（保留另一方案字段与模型选择） */
export async function clearApiKey(): Promise<AiSettings> {
  const settings = await loadAiSettings()
  const next: AiSettings =
    settings.plan === 'pro'
      ? { ...settings, proApiKey: '' }
      : { ...settings, apiKey: '' }
  await saveAiSettings(next)
  console.info('[RedCopy] 已清空 API Key', { plan: settings.plan })
  return next
}

/** @deprecated 使用 clearApiKey */
export async function clearAllApiKeys(): Promise<AiSettings> {
  return clearApiKey()
}
