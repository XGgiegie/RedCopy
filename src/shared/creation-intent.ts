export const CREATION_PURPOSE_OPTIONS = [
  {
    key: 'technicalShare',
    label: '硬核干货 / 技术分享类',
    description: '底层逻辑拆解、架构思路、环境配置和自动化工作流',
    promptKey: 'purposeTechnicalShare',
  },
  {
    key: 'mythBusting',
    label: '避坑解密 / 信息差类',
    description: '揭露虚假包装、打破信息垄断、做认知纠偏',
    promptKey: 'purposeMythBusting',
  },
  {
    key: 'indieDevDiary',
    label: '独立开发 / 搞钱日记类',
    description: '记录产品从 0 到 1、数据复盘和商业化闭环',
    promptKey: 'purposeIndieDevDiary',
  },
  {
    key: 'painPointSolution',
    label: '场景痛点 / 解决方案类',
    description: '还原抓狂工作场景，并给出高效率替代方案',
    promptKey: 'purposePainPointSolution',
  },
  {
    key: 'resourceRoundup',
    label: '资源合集 / 打包白嫖类',
    description: '汇总高价值开源库、平替工具、配置和脚本',
    promptKey: 'purposeResourceRoundup',
  },
  {
    key: 'interactiveCocreation',
    label: '听劝养成 / 互动共创类',
    description: '公开半成品和踩坑，征集建议，让用户参与迭代',
    promptKey: 'purposeInteractiveCocreation',
  },
  {
    key: 'industryInsight',
    label: '行业观察 / 职场感悟类',
    description: '从个人视角聊职场真相、行业现状和破局点',
    promptKey: 'purposeIndustryInsight',
  },
  {
    key: 'commercialPromotion',
    label: '直接带货 / 商业推广类',
    description: '明确商业合作、软硬广或自有付费服务转化',
    promptKey: 'purposeCommercialPromotion',
  },
] as const

export type CreationPurposeKey = (typeof CREATION_PURPOSE_OPTIONS)[number]['key']

export interface CreationIntentPayload {
  purpose: CreationPurposeKey
  topic: string
}

export function getCreationPurposeOption(
  purpose?: CreationPurposeKey | null,
) {
  if (!purpose) return null
  return CREATION_PURPOSE_OPTIONS.find((item) => item.key === purpose) ?? null
}

export function getCreationPurposeLabel(
  purpose?: CreationPurposeKey | null,
): string {
  return getCreationPurposeOption(purpose)?.label ?? ''
}