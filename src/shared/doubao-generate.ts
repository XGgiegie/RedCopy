import type { AiAnalysisResult, GeneratedNoteDraft } from './ai-types'
import type { AiSettings } from './ai-settings'
import {
  getCreationPurposeLabel,
  type CreationPurposeKey,
} from './creation-intent'
import { requestDoubaoResponses } from './doubao-api'
import { parseGeneratedDraft } from './parse-generated-draft'
import type { NoteTextInfo } from './note-types'
import { buildGenerateSystemPrompt, loadPrompts } from './prompts'

export const GENERATE_SYSTEM_PROMPT = `你是资深小红书图文笔记创作者。
用户会提供一篇参考笔记、可选的分析信息，以及可能要推广/售卖的主题或卖点。
请结合这些信息，写一篇全新的创作草稿。可以借鉴结构和节奏，但必须换角度、换细节、换表达，不要洗稿。

Absolute Rules（铁律，绝对不准违反）：
1. 严禁使用这些词和句式：姐妹们、家人们、谁懂啊、大数据、绝绝子、天花板、闭眼入、不允许有人不知道、今天给大家分享、大公开。
2. 严禁在开头使用没有信息量的敷衍感叹，例如：哇！、太绝了！、真的绝了！
3. Emoji 总数控制在 3-5 个以内，只能自然融入句尾。不要每句话前面都加图标。
4. 正文字数控制在 200-400 个中文字符内。每段不超过两句，多用短句。
5. 不要长篇大论，不要空泛鸡汤，不要像 AI 模板。

Tone & Style：
1. 语气精简，带一点冷幽默、松弛感、一针见血、反套路。
2. 视角像一个嘴毒但心软的现实朋友，在私信里聊天，或者深夜发朋友圈。
3. 开头直接切痛点、反常识观点，或给一个有画面感的场景。
4. 中段给具体细节、具体数据、具体动作。少讲道理，多给可执行判断。
5. 结尾留白，不强行升华。可以用一个有梗互动或戛然而止的冷笑话收住。

Execution Format：
1. 输出 3 个爆款标题备选，必须包含情绪冲突或具体数字，拒绝标题党。每个不超过 20 个字。
2. 正文按上面的风格生成精简内容。
3. 精选标签 3-5 个，不要堆标签。
4. imagePrompts：按笔记发布顺序输出 3-9 条配图，每条 prompt 必须是可直接用于 AI 文生图的完整中文提示词，包含画面主体、构图、色调、风格、氛围等。第一条一般为封面。每条 prompt 末尾必须写明：画面中不得出现任何文字、字母、数字、标语或水印。不要用「建议」口吻，直接写画面描述。

只输出 JSON，不要 markdown 代码块：
{
  "title": "默认使用的标题，必须来自 titleOptions 第 1 个",
  "titleOptions": ["标题1", "标题2", "标题3"],
  "body": "可直接发布的正文",
  "tags": ["标签1", "标签2", "标签3"],
  "imagePrompts": [
    { "label": "封面", "prompt": "清晨阳光下的咖啡拉花特写，暖色调，浅景深，画面中不得出现任何文字、字母、数字、标语或水印" },
    { "label": "内页1", "prompt": "木质桌面上的手账本与钢笔俯拍，清新日系风，画面中不得出现任何文字、字母、数字、标语或水印" }
  ]
}`

export interface GenerateNotePayload {
  noteId: string | null
  url: string
  text: NoteTextInfo
  analysis?: AiAnalysisResult | null
  purpose?: CreationPurposeKey
  /** 用户想推广/售卖的主题或卖点，可为空 */
  topic?: string
}

export interface DirectGenerateNotePayload {
  /** 本次创作目的 */
  purpose: CreationPurposeKey
  /** 用户想创作的主题、产品、场景或卖点 */
  topic: string
}

export function buildGenerateUserPrompt(payload: GenerateNotePayload): string {
  const { text, url, noteId, purpose, topic, analysis } = payload
  const lines = [
    `参考笔记链接：${url}`,
    `笔记 ID：${noteId ?? '未知'}`,
    `原标题：${text.title || '（无）'}`,
    `作者：${text.author || '（无）'}`,
    `原标签：${text.tags.length ? text.tags.join('、') : '（无）'}`,
    `点赞：${text.likedCount || '0'}`,
    `收藏：${text.collectedCount || '0'}`,
    `评论：${text.commentCount || '0'}`,
    `原正文：\n${text.desc || text.allText || '（无正文）'}`,
  ]

  if (purpose) {
    lines.push('', `本次创作主题：${getCreationPurposeLabel(purpose)}`)
  }

  const trimmedTopic = topic?.trim()
  if (trimmedTopic) {
    lines.push('', `本次明确主题/卖点：${trimmedTopic}`)
  }

  if (analysis) {
    lines.push('', '--- AI 分析参考 ---', `总结：${analysis.summary}`)
    if (analysis.titleAnalysis) {
      lines.push(`标题分析：${analysis.titleAnalysis}`)
    }
    if (analysis.contentStructure?.length) {
      lines.push(`结构要点：${analysis.contentStructure.join('；')}`)
    }
    if (analysis.rewriteSuggestions?.length) {
      lines.push(`创作建议：${analysis.rewriteSuggestions.join('；')}`)
    }
  }

  lines.push(
    '',
    purpose && trimmedTopic
      ? '请基于以上参考、创作目的与明确主题，生成一篇风格类似但表达全新的小红书图文笔记。'
      : trimmedTopic
        ? '请基于以上参考与我的主题/卖点，生成一篇风格类似、围绕该主题种草的小红书图文笔记。'
        : '请基于以上参考，生成一篇风格类似、可借鉴的小红书图文笔记。',
  )
  return lines.join('\n')
}

export function buildDirectGenerateUserPrompt(
  payload: DirectGenerateNotePayload,
): string {
  const purposeLabel = getCreationPurposeLabel(payload.purpose)
  const topic = payload.topic.trim()
  const lines = [
    '创作模式：直接创作，不参考具体笔记。',
    `本次创作主题：${purposeLabel}`,
    `本次明确主题/卖点：${topic || '（未填写）'}`,
    '',
    `请先满足「${purposeLabel}」这个创作目的，再基于主题生成一篇可发布的小红书图文笔记。`,
    '要求内容具体、有生活场景、有真实动作，不要写成泛泛的营销文案。',
    '如果主题信息较少，请合理补足常见使用场景，但不要编造夸张功效、医学承诺或虚假数据。',
  ]
  return lines.join('\n')
}

/** 使用火山方舟 Responses API 生成创作草稿 */
export async function requestDoubaoGenerate(
  payload: GenerateNotePayload,
  settings?: AiSettings,
): Promise<GeneratedNoteDraft> {
  const userPrompt = buildGenerateUserPrompt(payload)
  const prompts = await loadPrompts()
  const systemPrompt = buildGenerateSystemPrompt(prompts, payload.purpose)

  console.info('[RedCopy] 请求豆包生成创作草稿', {
    noteId: payload.noteId,
    hasAnalysis: Boolean(payload.analysis),
    purpose: payload.purpose,
  })

  const content = await requestDoubaoResponses(
    systemPrompt,
    userPrompt,
    { settings, logLabel: '生成创作草稿' },
  )

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] 创作草稿生成完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })

  return draft
}

/** 使用火山方舟 Responses API 直接生成创作草稿 */
export async function requestDoubaoDirectGenerate(
  payload: DirectGenerateNotePayload,
  settings?: AiSettings,
): Promise<GeneratedNoteDraft> {
  const userPrompt = buildDirectGenerateUserPrompt(payload)
  const prompts = await loadPrompts()
  const systemPrompt = buildGenerateSystemPrompt(prompts, payload.purpose)

  console.info('[RedCopy] 请求豆包直接创作', {
    purpose: payload.purpose,
    topicLength: payload.topic.trim().length,
  })

  const content = await requestDoubaoResponses(
    systemPrompt,
    userPrompt,
    { settings, logLabel: '直接创作' },
  )

  const draft = parseGeneratedDraft(content)
  console.info('[RedCopy] 直接创作完成', {
    titleLength: draft.title.length,
    bodyLength: draft.body.length,
    tags: draft.tags.length,
  })

  return draft
}
