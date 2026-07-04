import {
  type CollectedSearchNote,
  buildXhsSearchUrl,
  injectClickNoteCardByIndex,
  injectCloseNoteModal,
  injectCollectVisibleSearchNotes,
  injectScrollSearchFeedStep,
  injectScrollSearchToTop,
} from '../../shared/auto-collect'
import { parseEngagementCount, passesEngagementFilter } from '../../shared/engagement-count'
import { logExtractContentJson } from '../../shared/extract-log'
import { injectExtractNote } from '../../shared/extract-note'
import { upsertGrowthRecord } from '../../shared/growth-records'
import type {
  GrowthAcquireConfig,
  GrowthAcquireProgress,
  GrowthAcquireResult,
} from '../../shared/growth-acquire'
import { GROWTH_AI_ACTION_LIMIT } from '../../shared/growth-acquire'
import {
  consumeGrowthAiSlot,
  getGrowthAiUsedCount,
  isGrowthAiQuotaExhausted,
} from '../../shared/growth-ai-quota'
import {
  GROWTH_TIMING,
  randomMs,
  randomSleep,
  sleep,
} from '../../shared/growth-timing'
import {
  injectCollectReplyableComments,
  injectGetLoggedInNickname,
  injectPostNoteComment,
  injectReplyToCommentAtIndex,
  type NoteCommentItem,
} from '../../shared/growth-comment'
import { generateGrowthCommentReply, generateGrowthNoteComment } from '../../shared/growth-reply'
import { hasUnlimitedGrowthAi, isAiConfigured, loadAiSettings } from '../../shared/ai-settings'

export class GrowthAcquireCancelledError extends Error {
  constructor() {
    super('已取消自动获客')
    this.name = 'GrowthAcquireCancelledError'
  }
}

interface ProcessCardResult {
  viewedDetail: boolean
  skippedByFilter: boolean
  replied: number
  commented: number
}

function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('页面加载超时，请确认网络正常后重试'))
    }, timeoutMs)

    const listener: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      updatedTabId,
      changeInfo,
    ) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return
      globalThis.clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function executeInTab<T, A extends unknown[]>(
  tabId: number,
  func: (...args: A) => T,
  args: A,
): Promise<T> {
  if (!chrome.scripting?.executeScript) {
    throw new Error('scripting 权限不可用，请刷新扩展后重试')
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  })

  if (result?.result === undefined) {
    throw new Error('页面脚本未返回数据')
  }

  return result.result as T
}

async function extractNoteDirectlyFromTab(tabId: number) {
  return executeInTab(tabId, injectExtractNote, [{ includeDom: false }])
}

function assertNotCancelled(isCancelled: () => boolean) {
  if (isCancelled()) throw new GrowthAcquireCancelledError()
}

function cardPassesLikePrefilter(
  card: CollectedSearchNote,
  minLikedCount: number,
): boolean {
  if (minLikedCount <= 0) return true
  return parseEngagementCount(card.likedCountText) >= minLikedCount
}

function buildReplyKey(noteId: string, comment: NoteCommentItem): string {
  return `${noteId}:${comment.index}:${comment.author}:${comment.text.slice(0, 40)}`
}

async function resolveReplyText(
  config: GrowthAcquireConfig,
  comment: NoteCommentItem,
  noteContext: { title?: string; desc?: string },
  hooks: ProgressHookBundle,
): Promise<string> {
  if (config.replyMode === 'fixed') {
    return config.fixedReplyText.trim()
  }

  if (!await hooks.tryConsumeAiSlot()) {
    console.info('[RedCopy][获客] 已达今日 AI 次数上限，跳过 AI 回复', {
      limit: GROWTH_AI_ACTION_LIMIT,
      used: hooks.aiUsed(),
    })
    return ''
  }

  return generateGrowthCommentReply({
    commentText: comment.text,
    commentAuthor: comment.author,
    noteTitle: noteContext.title,
    noteDesc: noteContext.desc,
    aiReplyPrompt: config.aiReplyPrompt,
  })
}

async function resolveNoteCommentText(
  config: GrowthAcquireConfig,
  noteContext: { title?: string; desc?: string },
  hooks: ProgressHookBundle,
): Promise<string> {
  if (config.commentMode === 'fixed') {
    return config.fixedCommentText.trim()
  }

  if (!await hooks.tryConsumeAiSlot()) {
    console.info('[RedCopy][获客] 已达今日 AI 次数上限，跳过 AI 评论', {
      limit: GROWTH_AI_ACTION_LIMIT,
      used: hooks.aiUsed(),
    })
    return ''
  }

  return generateGrowthNoteComment({
    noteTitle: noteContext.title,
    noteDesc: noteContext.desc,
    aiCommentPrompt: config.aiCommentPrompt,
  })
}

type ProgressHookBundle = {
  onProgress: (progress: GrowthAcquireProgress) => void
  isCancelled: () => boolean
  remainingSec: () => number
  progressBase: () => Omit<GrowthAcquireProgress, 'phase' | 'message' | 'remainingSec'>
  /** 今日 AI 已用次数（评论 + 回复合计） */
  aiUsed: () => number
  tryConsumeAiSlot: () => Promise<boolean>
}

async function postCommentOnNote(
  tabId: number,
  card: CollectedSearchNote,
  config: GrowthAcquireConfig,
  noteContext: { title?: string; desc?: string },
  commentedNoteIds: Set<string>,
  hooks: ProgressHookBundle,
): Promise<{ count: number; text: string }> {
  if (!config.enableComment) return { count: 0, text: '' }
  if (commentedNoteIds.has(card.noteId)) return { count: 0, text: '' }

  await randomSleep(GROWTH_TIMING.commentSettle)
  assertNotCancelled(hooks.isCancelled)

  hooks.onProgress({
    ...hooks.progressBase(),
    phase: 'commenting',
    remainingSec: hooks.remainingSec(),
    message: `发表评论 [#${card.index}] ${card.title || card.noteId}`,
  })

  let commentText = ''
  try {
    commentText = await resolveNoteCommentText(config, noteContext, hooks)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][获客] 生成评论失败', { detail, error })
    return { count: 0, text: '' }
  }

  if (!commentText) return { count: 0, text: '' }

  const result = await executeInTab(tabId, injectPostNoteComment, [commentText])

  if (result.posted) {
    commentedNoteIds.add(card.noteId)
    console.info('[RedCopy][获客] 发表评论成功', { noteId: card.noteId })
    const waited = await randomSleep(GROWTH_TIMING.actionInterval)
    console.info('[RedCopy][获客] 评论后随机等待', { ms: waited })
    return { count: 1, text: commentText }
  }

  console.warn('[RedCopy][获客] 发表评论失败', {
    noteId: card.noteId,
    reason: result.reason,
  })
  return { count: 0, text: '' }
}

async function replyToCommentsOnNote(
  tabId: number,
  card: CollectedSearchNote,
  config: GrowthAcquireConfig,
  noteContext: { title?: string; desc?: string },
  repliedCommentKeys: Set<string>,
  ownPostedTexts: string[],
  selfNickname: string | null,
  hooks: ProgressHookBundle,
): Promise<number> {
  if (!config.enableReply) return 0

  let replied = 0

  await randomSleep(GROWTH_TIMING.commentSettle)
  assertNotCancelled(hooks.isCancelled)

  const skipAuthors = selfNickname ? [selfNickname] : []
  const collected = await executeInTab(tabId, injectCollectReplyableComments, [
    {
      maxCount: config.maxRepliesPerNote,
      skipAuthors,
      skipTexts: ownPostedTexts,
    },
  ])

  if (collected.items.length === 0) {
    console.info('[RedCopy][获客] 本篇无可回复评论', {
      noteId: card.noteId,
      reason: collected.reason,
    })
    return 0
  }

  for (const comment of collected.items) {
    assertNotCancelled(hooks.isCancelled)
    if (replied >= config.maxRepliesPerNote) break

    const replyKey = buildReplyKey(card.noteId, comment)
    if (repliedCommentKeys.has(replyKey)) continue

    hooks.onProgress({
      ...hooks.progressBase(),
      phase: 'replying',
      remainingSec: hooks.remainingSec(),
      message: `回复评论 [#${card.index}] ${comment.author || '用户'}：${comment.text.slice(0, 20)}…`,
    })

    let replyText = ''
    try {
      replyText = await resolveReplyText(config, comment, noteContext, hooks)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy][获客] 生成回复失败', { detail, error })
      continue
    }

    if (!replyText) continue

    const result = await executeInTab(tabId, injectReplyToCommentAtIndex, [
      comment.index,
      replyText,
    ])

    if (result.replied) {
      repliedCommentKeys.add(replyKey)
      replied += 1
      console.info('[RedCopy][获客] 评论回复成功', {
        noteId: card.noteId,
        author: comment.author,
      })
      const waited = await randomSleep(GROWTH_TIMING.actionInterval)
      console.info('[RedCopy][获客] 回复后随机等待', { ms: waited })
    } else {
      console.warn('[RedCopy][获客] 评论回复失败', {
        noteId: card.noteId,
        reason: result.reason,
      })
    }
  }

  return replied
}

async function waitWithCountdown(
  totalMs: number,
  messagePrefix: string,
  card: CollectedSearchNote,
  hooks: ProgressHookBundle,
): Promise<void> {
  const stepMs = 1000
  const label = card.title || card.noteId

  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    assertNotCancelled(hooks.isCancelled)
    const remainSec = Math.ceil((totalMs - elapsed) / 1000)
    hooks.onProgress({
      ...hooks.progressBase(),
      phase: 'extracting',
      remainingSec: hooks.remainingSec(),
      message: `${messagePrefix} [#${card.index}] ${label}（${remainSec}s）`,
    })
    await sleep(Math.min(stepMs, totalMs - elapsed))
  }
}

async function processOneCard(
  tabId: number,
  card: CollectedSearchNote,
  config: GrowthAcquireConfig,
  repliedCommentKeys: Set<string>,
  commentedNoteIds: Set<string>,
  selfNickname: string | null,
  hooks: ProgressHookBundle,
): Promise<ProcessCardResult> {
  const clickResult = await executeInTab(tabId, injectClickNoteCardByIndex, [
    card.index,
    { openTimeoutMs: 6000, afterOpenMs: 800 },
  ])

  if (!clickResult.opened) {
    console.warn('[RedCopy][获客] 打开弹窗失败', {
      index: card.index,
      noteId: card.noteId,
      reason: clickResult.reason,
    })
    await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 1500 }])
    return { viewedDetail: false, skippedByFilter: false, replied: 0, commented: 0 }
  }

  await waitWithCountdown(
    randomMs(GROWTH_TIMING.viewDetail),
    '浏览笔记',
    card,
    hooks,
  )

  const extract = await extractNoteDirectlyFromTab(tabId)
  logExtractContentJson(extract, '[RedCopy][获客]')

  const hasEngagementFilter =
    config.minLikedCount > 0
    || config.minCollectedCount > 0
    || config.minCommentCount > 0

  if (hasEngagementFilter) {
    if (!extract.ok) {
      console.info('[RedCopy][获客] 无法提取互动数据，跳过筛选目标', {
        noteId: card.noteId,
        title: card.title,
      })
      await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 3000 }])
      await randomSleep({ min: 200, max: 600 })
      return { viewedDetail: true, skippedByFilter: true, replied: 0, commented: 0 }
    }

    if (!passesEngagementFilter(extract.text, config)) {
      console.info('[RedCopy][获客] 未达筛选条件，跳过互动', {
        noteId: extract.noteId || card.noteId,
        liked: extract.text.likedCount,
        collected: extract.text.collectedCount,
        comment: extract.text.commentCount,
        minLikedCount: config.minLikedCount,
        minCollectedCount: config.minCollectedCount,
        minCommentCount: config.minCommentCount,
      })
      await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 3000 }])
      await randomSleep({ min: 200, max: 600 })
      return { viewedDetail: true, skippedByFilter: true, replied: 0, commented: 0 }
    }
  }

  const noteContext = {
    title: extract.ok ? extract.text.title : card.title,
    desc: extract.ok ? extract.text.desc : '',
  }

  const postResult = await postCommentOnNote(
    tabId,
    card,
    config,
    noteContext,
    commentedNoteIds,
    hooks,
  )
  const commented = postResult.count
  const ownPostedTexts = postResult.text ? [postResult.text] : []

  const replied = await replyToCommentsOnNote(
    tabId,
    card,
    config,
    noteContext,
    repliedCommentKeys,
    ownPostedTexts,
    selfNickname,
    hooks,
  )

  if ((commented > 0 || replied > 0) && card.noteId) {
    const noteUrl =
      extract.ok && extract.url
        ? extract.url
        : `https://www.xiaohongshu.com/explore/${card.noteId}`
    await upsertGrowthRecord({
      noteId: card.noteId,
      url: noteUrl,
      title: noteContext.title || card.title || card.noteId,
      postedComment: commented > 0,
      repliedCount: replied,
    })
  }

  await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 3000 }])
  await randomSleep({ min: 200, max: 600 })

  return { viewedDetail: true, skippedByFilter: false, replied, commented }
}

export async function runGrowthAcquire(
  config: GrowthAcquireConfig,
  hooks: {
    onProgress: (progress: GrowthAcquireProgress) => void
    isCancelled: () => boolean
  },
): Promise<GrowthAcquireResult> {
  const keyword = config.keyword.trim()
  if (!keyword) {
    throw new Error('请填写搜索关键词')
  }

  if (config.durationMinutes < 1) {
    throw new Error('运行时长至少为 1 分钟')
  }

  if (!config.enableComment && !config.enableReply) {
    throw new Error('请至少开启「发表评论」或「回复评论」')
  }

  if (config.enableComment) {
    if (config.commentMode === 'fixed' && !config.fixedCommentText.trim()) {
      throw new Error('请填写固定评论内容')
    }
    if (config.commentMode === 'ai') {
      const settings = await loadAiSettings()
      if (!isAiConfigured(settings)) {
        throw new Error('AI 发评论需先配置 API Key（右上角设置）')
      }
      if (!config.aiCommentPrompt.trim()) {
        throw new Error('请填写 AI 评论提示词')
      }
    }
  }

  if (config.enableReply) {
    if (config.replyMode === 'fixed' && !config.fixedReplyText.trim()) {
      throw new Error('请填写固定回复内容')
    }

    if (config.replyMode === 'ai') {
      const settings = await loadAiSettings()
      if (!isAiConfigured(settings)) {
        throw new Error('AI 回复需先配置 API Key（右上角设置）')
      }
      if (!config.aiReplyPrompt.trim()) {
        throw new Error('请填写 AI 回复提示词')
      }
    }
  }

  const needsAi =
    (config.enableComment && config.commentMode === 'ai')
    || (config.enableReply && config.replyMode === 'ai')
  const settings = await loadAiSettings()
  const aiUnlimited = hasUnlimitedGrowthAi(settings)

  if (needsAi) {
    const usedBeforeRun = aiUnlimited ? 0 : await getGrowthAiUsedCount()
    if (!aiUnlimited && isGrowthAiQuotaExhausted(usedBeforeRun)) {
      throw new Error(
        `AI 评论/回复今日额度已用完（每日共 ${GROWTH_AI_ACTION_LIMIT} 次），请明日再试或改用固定文案`,
      )
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error('未找到当前标签页，请先打开小红书页面')
  }
  if (!tab.url?.includes('xiaohongshu.com')) {
    throw new Error('请先在浏览器中打开小红书网站')
  }

  const tabId = tab.id
  const startedAt = Date.now()
  const endAt = startedAt + config.durationMinutes * 60 * 1000

  const isTimeUp = () => Date.now() >= endAt
  const remainingSec = () => Math.max(0, Math.ceil((endAt - Date.now()) / 1000))

  let scanned = 0
  let skipped = 0
  let replied = 0
  let commented = 0
  let aiUsed = aiUnlimited ? 0 : await getGrowthAiUsedCount()
  let aiLimitNotified = false

  const processedNoteIds = new Set<string>()
  const repliedCommentKeys = new Set<string>()
  const commentedNoteIds = new Set<string>()
  let cachedSelfNickname: string | null = null

  const progressBase = (): Omit<GrowthAcquireProgress, 'phase' | 'message' | 'remainingSec'> => ({
    scanned,
    skipped,
    replied,
    commented,
    aiUsed,
    aiUnlimited,
  })

  const tryConsumeAiSlot = async (): Promise<boolean> => {
    if (aiUnlimited) {
      return true
    }

    if (isGrowthAiQuotaExhausted(aiUsed)) {
      if (!aiLimitNotified) {
        aiLimitNotified = true
        report({
          phase: 'scanning',
          message: `今日 AI 额度已用完（每日共 ${GROWTH_AI_ACTION_LIMIT} 次），后续将跳过 AI 生成`,
        })
      }
      return false
    }

    const consumed = await consumeGrowthAiSlot()
    if (!consumed) {
      aiUsed = await getGrowthAiUsedCount()
      if (!aiLimitNotified) {
        aiLimitNotified = true
        report({
          phase: 'scanning',
          message: `今日 AI 额度已用完（每日共 ${GROWTH_AI_ACTION_LIMIT} 次），后续将跳过 AI 生成`,
        })
      }
      return false
    }

    aiUsed += 1
    return true
  }

  const report = (
    partial: Partial<GrowthAcquireProgress>
      & Pick<GrowthAcquireProgress, 'phase' | 'message'>,
  ) => {
    hooks.onProgress({
      phase: partial.phase,
      message: partial.message,
      scanned,
      skipped,
      replied,
      commented,
      aiUsed,
      aiUnlimited,
      remainingSec: remainingSec(),
    })
  }

  const hookBundle = {
    onProgress: hooks.onProgress,
    isCancelled: hooks.isCancelled,
    remainingSec,
    progressBase,
    aiUsed: () => aiUsed,
    tryConsumeAiSlot,
  }

  try {
    report({
      phase: 'navigating',
      message: `正在搜索「${keyword}」，将运行 ${config.durationMinutes} 分钟…`,
    })
    assertNotCancelled(hooks.isCancelled)

    await chrome.tabs.update(tabId, { url: buildXhsSearchUrl(keyword) })
    await waitForTabComplete(tabId)
    await randomSleep(GROWTH_TIMING.afterSearchLoad)
    assertNotCancelled(hooks.isCancelled)

    report({ phase: 'scanning', message: '等待首屏结果加载…' })
    await executeInTab(tabId, injectScrollSearchToTop, [{ initialSettleMs: 1000 }])
    await randomSleep({ min: 400, max: 900 })

    let scrollRound = 0
    let emptyRounds = 0
    let waitBeforeNextOpen = false
    let notesSinceRest = 0

    while (!isTimeUp()) {
      assertNotCancelled(hooks.isCancelled)

      const visible = await executeInTab(tabId, injectCollectVisibleSearchNotes, [])
      const pending = visible
        .filter((card) => !processedNoteIds.has(card.noteId))
        .sort((a, b) => a.index - b.index)

      if (pending.length === 0) {
        emptyRounds += 1
        if (emptyRounds >= 3) {
          report({ phase: 'scanning', message: '暂无可处理笔记，继续滚动…' })
          emptyRounds = 0
        }
      } else {
        emptyRounds = 0
      }

      report({
        phase: 'extracting',
        message:
          scrollRound === 0
            ? `从首屏第 ${pending[0]?.index ?? 0} 篇开始（剩余 ${Math.ceil(remainingSec() / 60)} 分钟）`
            : `处理第 ${scrollRound + 1} 屏，待处理 ${pending.length} 篇…`,
      })

      for (const card of pending) {
        assertNotCancelled(hooks.isCancelled)
        if (isTimeUp()) break

        processedNoteIds.add(card.noteId)
        scanned += 1

        if (!cardPassesLikePrefilter(card, config.minLikedCount)) {
          skipped += 1
          continue
        }

        if (waitBeforeNextOpen) {
          await waitWithCountdown(
            randomMs(GROWTH_TIMING.nextOpenDelay),
            '准备打开下一篇',
            card,
            hookBundle,
          )
        }
        assertNotCancelled(hooks.isCancelled)
        if (isTimeUp()) break

        report({
          phase: 'extracting',
          message: `正在打开 [#${card.index}] ${card.title || card.noteId}`,
        })

        try {
          if (!cachedSelfNickname) {
            cachedSelfNickname = await executeInTab(tabId, injectGetLoggedInNickname, [])
            if (cachedSelfNickname) {
              console.info('[RedCopy][获客] 当前账号昵称', { nickname: cachedSelfNickname })
            }
          }

          const {
            viewedDetail,
            skippedByFilter,
            replied: cardReplied,
            commented: cardCommented,
          } =
            await processOneCard(
              tabId,
              card,
              config,
              repliedCommentKeys,
              commentedNoteIds,
              cachedSelfNickname,
              hookBundle,
            )

          replied += cardReplied
          commented += cardCommented

          if (!viewedDetail) {
            skipped += 1
          } else if (skippedByFilter) {
            skipped += 1
          }

          waitBeforeNextOpen = viewedDetail

          if (viewedDetail && (cardReplied > 0 || cardCommented > 0)) {
            notesSinceRest += 1
            if (notesSinceRest >= GROWTH_TIMING.restEveryNotes) {
              notesSinceRest = 0
              const restMs = await randomSleep(GROWTH_TIMING.restBurst)
              report({
                phase: 'scanning',
                message: `随机休息 ${Math.ceil(restMs / 1000)} 秒，降低操作风险…`,
              })
            }
          }
        } catch (error) {
          if (error instanceof GrowthAcquireCancelledError) throw error
          skipped += 1
          const detail = error instanceof Error ? error.message : String(error)
          console.error('[RedCopy][获客] 单条处理失败', { index: card.index, detail, error })
          try {
            await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 1500 }])
          } catch {
            /* 忽略 */
          }
        }
      }

      if (isTimeUp()) break

      report({ phase: 'scanning', message: '本屏处理完毕，滚动加载下一页…' })

      const step = await executeInTab(tabId, injectScrollSearchFeedStep, [
        { scrollDelayMs: randomMs(GROWTH_TIMING.afterScrollStep) },
      ])
      scrollRound += 1
      waitBeforeNextOpen = false

      if (!step.hasNew) {
        emptyRounds += 1
      } else {
        emptyRounds = 0
      }
    }

    const cancelled = hooks.isCancelled()
    const timeUp = isTimeUp()
    report({
      phase: cancelled ? 'cancelled' : 'done',
      message: cancelled
        ? `已停止：评论 ${commented} 条，回复 ${replied} 条`
        : timeUp
          ? `时间到：评论 ${commented} 条，回复 ${replied} 条`
          : `完成：评论 ${commented} 条，回复 ${replied} 条`,
    })

    return {
      skipped,
      scanned,
      replied,
      commented,
      ranMs: Date.now() - startedAt,
    }
  } catch (error) {
    if (error instanceof GrowthAcquireCancelledError) {
      report({
        phase: 'cancelled',
        message: `已停止：评论 ${commented} 条，回复 ${replied} 条`,
      })
      return {
        skipped,
        scanned,
        replied,
        commented,
        ranMs: Date.now() - startedAt,
      }
    }
    throw error
  }
}
