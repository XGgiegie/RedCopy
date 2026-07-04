import { storageGet, storageSet, storageRemove } from '../storage'
import {
  getCreationPurposeOption,
  type CreationPurposeKey,
} from '../creation-intent'
import { ANALYSIS_DEFAULT_SYSTEM_PROMPT } from './analysis'
import { GENERATE_DEFAULT_SYSTEM_PROMPT } from './generate'
import { GROWTH_REPLY_DEFAULT_SYSTEM_PROMPT } from './growth-reply'
import { GROWTH_NOTE_COMMENT_DEFAULT_SYSTEM_PROMPT } from './growth-comment'
import { PURPOSE_COMMERCIAL_PROMOTION_DEFAULT_PROMPT } from './purpose-commercial-promotion'
import { PURPOSE_INDIE_DEV_DIARY_DEFAULT_PROMPT } from './purpose-indie-dev-diary'
import { PURPOSE_INDUSTRY_INSIGHT_DEFAULT_PROMPT } from './purpose-industry-insight'
import { PURPOSE_INTERACTIVE_COCREATION_DEFAULT_PROMPT } from './purpose-interactive-cocreation'
import { PURPOSE_MYTH_BUSTING_DEFAULT_PROMPT } from './purpose-myth-busting'
import { PURPOSE_PAIN_POINT_SOLUTION_DEFAULT_PROMPT } from './purpose-pain-point-solution'
import { PURPOSE_RESOURCE_ROUNDUP_DEFAULT_PROMPT } from './purpose-resource-roundup'
import { PURPOSE_TECHNICAL_SHARE_DEFAULT_PROMPT } from './purpose-technical-share'

export interface AppPrompts {
  analysis: string
  generate: string
  growthReply: string
  growthNoteComment: string
  purposeTechnicalShare: string
  purposeMythBusting: string
  purposeIndieDevDiary: string
  purposePainPointSolution: string
  purposeResourceRoundup: string
  purposeInteractiveCocreation: string
  purposeIndustryInsight: string
  purposeCommercialPromotion: string
}

export const defaultPrompts: AppPrompts = {
  analysis: ANALYSIS_DEFAULT_SYSTEM_PROMPT,
  generate: GENERATE_DEFAULT_SYSTEM_PROMPT,
  growthReply: GROWTH_REPLY_DEFAULT_SYSTEM_PROMPT,
  growthNoteComment: GROWTH_NOTE_COMMENT_DEFAULT_SYSTEM_PROMPT,
  purposeTechnicalShare: PURPOSE_TECHNICAL_SHARE_DEFAULT_PROMPT,
  purposeMythBusting: PURPOSE_MYTH_BUSTING_DEFAULT_PROMPT,
  purposeIndieDevDiary: PURPOSE_INDIE_DEV_DIARY_DEFAULT_PROMPT,
  purposePainPointSolution: PURPOSE_PAIN_POINT_SOLUTION_DEFAULT_PROMPT,
  purposeResourceRoundup: PURPOSE_RESOURCE_ROUNDUP_DEFAULT_PROMPT,
  purposeInteractiveCocreation: PURPOSE_INTERACTIVE_COCREATION_DEFAULT_PROMPT,
  purposeIndustryInsight: PURPOSE_INDUSTRY_INSIGHT_DEFAULT_PROMPT,
  purposeCommercialPromotion: PURPOSE_COMMERCIAL_PROMOTION_DEFAULT_PROMPT,
}

export type PurposePromptKey = Extract<
  keyof AppPrompts,
  | 'purposeTechnicalShare'
  | 'purposeMythBusting'
  | 'purposeIndieDevDiary'
  | 'purposePainPointSolution'
  | 'purposeResourceRoundup'
  | 'purposeInteractiveCocreation'
  | 'purposeIndustryInsight'
  | 'purposeCommercialPromotion'
>

export function getPurposePromptKey(
  purpose?: CreationPurposeKey | null,
): PurposePromptKey | null {
  const option = getCreationPurposeOption(purpose)
  return (option?.promptKey as PurposePromptKey | undefined) ?? null
}

export function buildGenerateSystemPrompt(
  prompts: AppPrompts,
  purpose?: CreationPurposeKey | null,
): string {
  const base = prompts.generate.trim()
  const promptKey = getPurposePromptKey(purpose)
  const purposeSnippet = promptKey ? prompts[promptKey]?.trim() : ''
  if (!purposeSnippet) return base

  return [
    base,
    '',
    '--- 当前创作主题附加要求 ---',
    purposeSnippet,
  ].join('\n')
}

export async function loadPrompts(): Promise<AppPrompts> {
  const custom = await storageGet<Partial<AppPrompts>>('app_prompts_v1')
  return { ...defaultPrompts, ...custom }
}

export async function savePrompts(prompts: Partial<AppPrompts>): Promise<void> {
  const current = await loadPrompts()
  await storageSet('app_prompts_v1', { ...current, ...prompts })
}

export async function resetPrompts(): Promise<void> {
  await storageRemove('app_prompts_v1')
}

export * from './analysis'
export * from './generate'
export * from './growth-reply'
export * from './growth-comment'
export * from './purpose-technical-share'
export * from './purpose-myth-busting'
export * from './purpose-indie-dev-diary'
export * from './purpose-pain-point-solution'
export * from './purpose-resource-roundup'
export * from './purpose-interactive-cocreation'
export * from './purpose-industry-insight'
export * from './purpose-commercial-promotion'
