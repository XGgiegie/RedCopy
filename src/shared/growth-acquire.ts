/** 评论/回复文案生成方式 */
export type GrowthTextMode = 'ai' | 'fixed'

/** @deprecated 使用 GrowthTextMode */
export type GrowthReplyMode = GrowthTextMode

/** 获客豆包 AI 发评论 / 回复每日上限（评论 + 回复合计，本地日零点起算） */
export const GROWTH_AI_ACTION_LIMIT = 10

export interface GrowthAcquireConfig {
  keyword: string
  minLikedCount: number
  minCollectedCount: number
  minCommentCount: number
  /** 持续运行时长（分钟），到时自动停止 */
  durationMinutes: number
  /** 是否在笔记下发表评论 */
  enableComment: boolean
  /** 是否回复他人评论 */
  enableReply: boolean
  /** 每篇笔记最多回复几条他人评论 */
  maxRepliesPerNote: number
  /** 发评论方式 */
  commentMode: GrowthTextMode
  /** AI 发评论：固定提示词 */
  aiCommentPrompt: string
  /** 固定发评论内容 */
  fixedCommentText: string
  /** 回复评论方式 */
  replyMode: GrowthTextMode
  /** AI 回复：固定提示词 */
  aiReplyPrompt: string
  /** 固定回复内容 */
  fixedReplyText: string
}

export type GrowthAcquirePhase =
  | 'idle'
  | 'navigating'
  | 'scanning'
  | 'extracting'
  | 'replying'
  | 'commenting'
  | 'done'
  | 'error'
  | 'cancelled'

export interface GrowthAcquireProgress {
  phase: GrowthAcquirePhase
  message: string
  scanned: number
  skipped: number
  /** 回复他人评论数 */
  replied: number
  /** 在笔记下发表评论数 */
  commented: number
  /** 今日已调用豆包生成评论/回复的次数（合计） */
  aiUsed: number
  /** Pro 版获客 AI 是否不限次数 */
  aiUnlimited?: boolean
  /** 剩余秒数 */
  remainingSec: number
}

export interface GrowthAcquireResult {
  skipped: number
  scanned: number
  replied: number
  commented: number
  ranMs: number
}

/** @deprecated 使用 growth-timing.ts 中的 GROWTH_TIMING 随机区间 */
export const GROWTH_COMMENT_SETTLE_MS = 2_000
/** @deprecated */
export const GROWTH_ACTION_INTERVAL_MS = 3_000
/** @deprecated */
export const GROWTH_NEXT_OPEN_DELAY_MS = 2_000
/** @deprecated */
export const GROWTH_VIEW_DETAIL_MS = 5_000
