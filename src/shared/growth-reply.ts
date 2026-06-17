import type { AiSettings } from './ai-settings'
import { loadAiSettings } from './ai-settings'
import { requestDoubaoResponses } from './doubao-api'

const DEFAULT_AI_SYSTEM = `你是小红书账号运营助手，负责在评论区回复用户以提升互动与涨粉。
根据用户提供的「固定话术要求」生成回复，语气自然、口语化，适合手机阅读。
只输出可直接发送的回复正文，不要引号、不要 markdown、不要解释。`

export interface GenerateGrowthReplyInput {
  commentText: string
  commentAuthor?: string
  noteTitle?: string
  noteDesc?: string
  /** 用户配置的固定提示词，约束回复风格与内容 */
  aiReplyPrompt: string
  settings?: AiSettings
}

/** 使用豆包根据固定提示词生成评论回复 */
export async function generateGrowthCommentReply(
  input: GenerateGrowthReplyInput,
): Promise<string> {
  const settings = input.settings ?? (await loadAiSettings())
  const promptRules = input.aiReplyPrompt.trim() || '友好、简短地回复，并自然引导关注或私信交流。'

  const userPrompt = [
    `固定话术要求：${promptRules}`,
    input.noteTitle ? `笔记标题：${input.noteTitle}` : '',
    input.noteDesc ? `笔记摘要：${input.noteDesc.slice(0, 200)}` : '',
    input.commentAuthor ? `评论用户：${input.commentAuthor}` : '',
    `评论内容：${input.commentText}`,
    '请生成一条评论回复：',
  ]
    .filter(Boolean)
    .join('\n')

  const content = await requestDoubaoResponses(DEFAULT_AI_SYSTEM, userPrompt, {
    settings,
    logLabel: '获客评论回复',
  })

  return content.replace(/^["'「『]|["'」』]$/g, '').trim()
}

const NOTE_COMMENT_AI_SYSTEM = `你是小红书账号运营助手，负责在爆款笔记下发表评论以提升曝光与涨粉。
根据用户提供的「固定话术要求」生成评论，语气自然、口语化，与笔记内容相关，适合手机阅读。
只输出可直接发送的评论正文，不要引号、不要 markdown、不要解释。`

export interface GenerateGrowthNoteCommentInput {
  noteTitle?: string
  noteDesc?: string
  /** 用户配置的固定提示词 */
  aiCommentPrompt: string
  settings?: AiSettings
}

/** 使用豆包根据固定提示词生成笔记评论 */
export async function generateGrowthNoteComment(
  input: GenerateGrowthNoteCommentInput,
): Promise<string> {
  const settings = input.settings ?? (await loadAiSettings())
  const promptRules =
    input.aiCommentPrompt.trim() || '简短夸赞并表达共鸣，自然引导关注或私信交流。'

  const userPrompt = [
    `固定话术要求：${promptRules}`,
    input.noteTitle ? `笔记标题：${input.noteTitle}` : '',
    input.noteDesc ? `笔记正文摘要：${input.noteDesc.slice(0, 300)}` : '',
    '请生成一条在该笔记下的评论：',
  ]
    .filter(Boolean)
    .join('\n')

  const content = await requestDoubaoResponses(NOTE_COMMENT_AI_SYSTEM, userPrompt, {
    settings,
    logLabel: '获客发评论',
  })

  return content.replace(/^["'「『]|["'」』]$/g, '').trim()
}
