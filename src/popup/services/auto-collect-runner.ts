import {
  type AutoCollectConfig,
  type AutoCollectProgress,
  type AutoCollectResult,
  type CollectedSearchNote,
  AUTO_COLLECT_NEXT_OPEN_DELAY_MS,
  AUTO_COLLECT_VIEW_DETAIL_MS,
  buildXhsSearchUrl,
  injectClickNoteCardByIndex,
  injectCloseNoteModal,
  injectCollectVisibleSearchNotes,
  injectScrollSearchFeedStep,
  injectScrollSearchToTop,
} from '../../shared/auto-collect'
import { parseEngagementCount, passesEngagementFilter } from '../../shared/engagement-count'
import { logExtractContentJson } from '../../shared/extract-log'
import { createTask, listTasks } from '../../shared/task-db'
import { extractNoteFromTab } from './extract-note'

export class AutoCollectCancelledError extends Error {
  constructor() {
    super('已取消自动采集')
    this.name = 'AutoCollectCancelledError'
  }
}

type CardOutcome = 'saved' | 'skipped-extract' | 'skipped-filter' | 'skipped-open'

interface ProcessCardResult {
  outcome: CardOutcome
  /** 是否曾打开并关闭过详情弹窗（用于决定关闭后是否等待 2s） */
  viewedDetail: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('页面加载超时，请确认网络正常后重试'))
    }, timeoutMs)

    const listener: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      updatedTabId,
      changeInfo,
    ) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return
      window.clearTimeout(timer)
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

function assertNotCancelled(isCancelled: () => boolean) {
  if (isCancelled()) throw new AutoCollectCancelledError()
}

function cardPassesLikePrefilter(
  card: CollectedSearchNote,
  minLikedCount: number,
): boolean {
  if (minLikedCount <= 0) return true
  return parseEngagementCount(card.likedCountText) >= minLikedCount
}

/** 可取消的倒计时等待，并更新进度文案 */
async function waitWithCountdown(
  totalMs: number,
  messagePrefix: string,
  card: CollectedSearchNote,
  hooks: {
    onProgress: (progress: AutoCollectProgress) => void
    isCancelled: () => boolean
  },
  progressBase: Omit<AutoCollectProgress, 'phase' | 'message'>,
): Promise<void> {
  const stepMs = 1000
  const label = card.title || card.noteId

  for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
    assertNotCancelled(hooks.isCancelled)
    const remainSec = Math.ceil((totalMs - elapsed) / 1000)
    hooks.onProgress({
      ...progressBase,
      phase: 'extracting',
      message: `${messagePrefix} [#${card.index}] ${label}（${remainSec}s）`,
    })
    await sleep(Math.min(stepMs, totalMs - elapsed))
  }
}

/**
 * 点开笔记 → 停留 8s → 提取并立即入库 → 关闭详情。
 * 提取成功后先入库再关弹窗，避免取消时丢失已提取数据。
 */
async function processOneCard(
  tabId: number,
  card: CollectedSearchNote,
  engagementFilter: {
    minLikedCount: number
    minCollectedCount: number
    minCommentCount: number
  },
  hooks: {
    onProgress: (progress: AutoCollectProgress) => void
    isCancelled: () => boolean
  },
  progressBase: Omit<AutoCollectProgress, 'phase' | 'message'>,
): Promise<ProcessCardResult> {
  const clickResult = await executeInTab(tabId, injectClickNoteCardByIndex, [
    card.index,
    { openTimeoutMs: 6000, afterOpenMs: 800 },
  ])

  if (!clickResult.opened) {
    console.warn('[RedCopy] 打开弹窗失败', {
      index: card.index,
      noteId: card.noteId,
      reason: clickResult.reason,
    })
    await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 1500 }])
    return { outcome: 'skipped-open', viewedDetail: false }
  }

  await waitWithCountdown(
    AUTO_COLLECT_VIEW_DETAIL_MS,
    '浏览笔记详情',
    card,
    hooks,
    progressBase,
  )

  const extract = await extractNoteFromTab(tabId, { includeDom: false })
  logExtractContentJson(extract, '[RedCopy][自动采集]')

  let outcome: CardOutcome = 'skipped-extract'

  if (extract.ok && extract.noteId) {
    if (passesEngagementFilter(extract.text, engagementFilter)) {
      await createTask({
        noteId: extract.noteId,
        url: extract.url,
        note: extract.text,
        noteType: extract.noteType,
      })
      outcome = 'saved'
      console.info('[RedCopy] 自动采集已入库', { noteId: extract.noteId, index: card.index })
    } else {
      outcome = 'skipped-filter'
      console.info('[RedCopy] 未达筛选条件', {
        noteId: extract.noteId,
        liked: extract.text.likedCount,
        collected: extract.text.collectedCount,
        comment: extract.text.commentCount,
      })
    }
  }

  await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 3000 }])
  await sleep(300)

  return { outcome, viewedDetail: true }
}

export async function runAutoCollect(
  config: AutoCollectConfig,
  hooks: {
    onProgress: (progress: AutoCollectProgress) => void
    isCancelled: () => boolean
  },
): Promise<AutoCollectResult> {
  const keyword = config.keyword.trim()
  if (!keyword) {
    throw new Error('请填写搜索关键词')
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error('未找到当前标签页，请先打开小红书页面')
  }
  if (!tab.url?.includes('xiaohongshu.com')) {
    throw new Error('请先在浏览器中打开小红书网站')
  }

  const tabId = tab.id
  const existingTasks = await listTasks()
  const existingNoteIds = new Set(
    existingTasks.map((task) => task.noteId).filter(Boolean) as string[],
  )

  let scanned = 0
  let extracted = 0
  let skipped = 0

  const processedNoteIds = new Set<string>()

  const report = (
    partial: Partial<AutoCollectProgress> & Pick<AutoCollectProgress, 'phase' | 'message'>,
  ) => {
    hooks.onProgress({
      phase: partial.phase,
      message: partial.message,
      scanned,
      extracted,
      skipped,
    })
  }

  const progressBase = (): Omit<AutoCollectProgress, 'phase' | 'message'> => ({
    scanned,
    extracted,
    skipped,
  })

  const engagementFilter = {
    minLikedCount: config.minLikedCount,
    minCollectedCount: config.minCollectedCount,
    minCommentCount: config.minCommentCount,
  }

  try {
    report({ phase: 'navigating', message: `正在搜索「${keyword}」…` })
    assertNotCancelled(hooks.isCancelled)

    await chrome.tabs.update(tabId, { url: buildXhsSearchUrl(keyword) })
    await waitForTabComplete(tabId)
    await sleep(1200)
    assertNotCancelled(hooks.isCancelled)

    report({ phase: 'scanning', message: '等待首屏结果加载…' })
    await executeInTab(tabId, injectScrollSearchToTop, [{ initialSettleMs: 1000 }])
    await sleep(500)
    assertNotCancelled(hooks.isCancelled)

    let scrollRound = 0
    let emptyRounds = 0
    /** 上一篇已关闭详情，下一篇打开前需等待 2s */
    let waitBeforeNextOpen = false

    while (extracted < config.maxExtract) {
      assertNotCancelled(hooks.isCancelled)

      const visible = await executeInTab(tabId, injectCollectVisibleSearchNotes, [])
      const pending = visible
        .filter((card) => !processedNoteIds.has(card.noteId))
        .sort((a, b) => a.index - b.index)

      if (pending.length === 0 && scrollRound > 0) {
        emptyRounds += 1
        if (emptyRounds >= 2) break
      } else {
        emptyRounds = 0
      }

      report({
        phase: 'extracting',
        message:
          scrollRound === 0
            ? `从首屏第 ${pending[0]?.index ?? 0} 篇开始处理…`
            : `处理第 ${scrollRound + 1} 屏，待处理 ${pending.length} 篇…`,
      })

      for (const card of pending) {
        assertNotCancelled(hooks.isCancelled)
        if (extracted >= config.maxExtract) break

        processedNoteIds.add(card.noteId)
        scanned += 1

        if (existingNoteIds.has(card.noteId)) {
          skipped += 1
          report({
            phase: 'extracting',
            message: `跳过已存在 [#${card.index}] ${card.title || card.noteId}`,
          })
          continue
        }

        if (!cardPassesLikePrefilter(card, config.minLikedCount)) {
          skipped += 1
          report({
            phase: 'extracting',
            message: `跳过点赞不足 [#${card.index}] ${card.title || card.noteId}`,
          })
          continue
        }

        if (waitBeforeNextOpen) {
          await waitWithCountdown(
            AUTO_COLLECT_NEXT_OPEN_DELAY_MS,
            '准备打开下一篇',
            card,
            hooks,
            progressBase(),
          )
        }
        assertNotCancelled(hooks.isCancelled)

        report({
          phase: 'extracting',
          message: `正在打开 [#${card.index}] ${card.title || card.noteId}`,
        })

        try {
          const { outcome, viewedDetail } = await processOneCard(
            tabId,
            card,
            engagementFilter,
            hooks,
            progressBase(),
          )

          if (outcome === 'saved') {
            existingNoteIds.add(card.noteId)
            extracted += 1
            report({
              phase: 'extracting',
              message: `已入库 [#${card.index}] ${card.title || card.noteId}`,
            })
          } else if (viewedDetail) {
            skipped += 1
          } else {
            skipped += 1
          }

          waitBeforeNextOpen = viewedDetail
        } catch (error) {
          if (error instanceof AutoCollectCancelledError) throw error
          skipped += 1
          const detail = error instanceof Error ? error.message : String(error)
          console.error('[RedCopy] 单条处理失败', { index: card.index, detail, error })
          try {
            await executeInTab(tabId, injectCloseNoteModal, [{ timeoutMs: 1500 }])
          } catch {
            /* 忽略 */
          }
        }
      }

      if (extracted >= config.maxExtract) break
      if (scrollRound >= config.scrollRounds) break

      report({ phase: 'scanning', message: '本屏处理完毕，滚动加载下一页…' })

      const step = await executeInTab(tabId, injectScrollSearchFeedStep, [
        { scrollDelayMs: 1000 },
      ])
      scrollRound += 1
      waitBeforeNextOpen = false

      if (!step.hasNew) {
        emptyRounds += 1
        if (emptyRounds >= 2) break
      } else {
        emptyRounds = 0
      }
    }

    const cancelled = hooks.isCancelled()
    report({
      phase: cancelled ? 'cancelled' : 'done',
      message: cancelled
        ? `已取消：入库 ${extracted} 篇，跳过 ${skipped} 篇`
        : `完成：入库 ${extracted} 篇，跳过 ${skipped} 篇`,
    })

    return { extracted, skipped, scanned }
  } catch (error) {
    if (error instanceof AutoCollectCancelledError) {
      report({
        phase: 'cancelled',
        message: `已取消：入库 ${extracted} 篇，跳过 ${skipped} 篇`,
      })
      return { extracted, skipped, scanned }
    }
    throw error
  }
}
