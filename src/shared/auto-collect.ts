/** 搜索结果页采集到的笔记条目 */
export interface CollectedSearchNote {
  noteId: string
  /** 已拼好可直接打开详情页的 URL（保留 xsec_token） */
  url: string
  title: string
  likedCountText: string
  /** 搜索卡片上的排序序号（data-index） */
  index: number
}

export interface InjectCollectSearchNotesOptions {
  /** 首屏直出内容的静置等待时间（ms） */
  initialSettleMs?: number
}

export interface InjectScrollFeedStepOptions {
  scrollDelayMs?: number
}

export interface ScrollFeedStepResult {
  /** 滚动后是否出现新的笔记卡片 */
  hasNew: boolean
  /** 当前视口内可见卡片数 */
  visibleCount: number
}

export interface InjectClickNoteOptions {
  /** 等待弹窗打开的超时时间（ms） */
  openTimeoutMs?: number
  /** 弹窗打开后额外等待详情渲染的时间（ms） */
  afterOpenMs?: number
}

export interface InjectCloseModalOptions {
  /** 等待弹窗关闭的超时时间（ms） */
  timeoutMs?: number
}

export interface ClickNoteResult {
  opened: boolean
  reason?: string
}

export interface CloseModalResult {
  closed: boolean
}

export interface AutoCollectConfig {
  keyword: string
  minLikedCount: number
  minCollectedCount: number
  minCommentCount: number
  /** 最多提取并入库的笔记数 */
  maxExtract: number
  /** 搜索结果页下拉滚动次数，用于加载更多卡片 */
  scrollRounds: number
}

/** 打开笔记详情后停留多久再关闭（模拟真人阅读） */
export const AUTO_COLLECT_VIEW_DETAIL_MS = 8_000

/** 关闭详情后多久再点开下一篇 */
export const AUTO_COLLECT_NEXT_OPEN_DELAY_MS = 2_000

export type AutoCollectPhase =
  | 'idle'
  | 'navigating'
  | 'scanning'
  | 'extracting'
  | 'done'
  | 'error'
  | 'cancelled'

export interface AutoCollectProgress {
  phase: AutoCollectPhase
  message: string
  scanned: number
  extracted: number
  skipped: number
}

export interface AutoCollectResult {
  extracted: number
  skipped: number
  scanned: number
}

export function buildXhsSearchUrl(keyword: string): string {
  const params = new URLSearchParams({
    keyword: keyword.trim(),
    source: 'web_search_result_notes',
  })
  return `https://www.xiaohongshu.com/search_result?${params.toString()}`
}

/**
 * 页面注入：滚回搜索列表顶部，等待 SSR 首屏卡片重新挂载。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectScrollSearchToTop(
  options: InjectCollectSearchNotesOptions = {},
): Promise<void> {
  const initialSettleMs = options.initialSettleMs ?? 800
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0

  const scrollers = document.querySelectorAll<HTMLElement>(
    '[class*="scroll"], [class*="feed"], main',
  )
  scrollers.forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 20) {
      el.scrollTop = 0
    }
  })

  await sleep(initialSettleMs)
  console.info('[RedCopy] 已回到搜索列表顶部')
}

/**
 * 页面注入：仅采集当前视口内可见的搜索卡片（不滚动）。
 * 按 data-index 升序，保证从第一个笔记开始。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export function injectCollectVisibleSearchNotes(): CollectedSearchNote[] {
  function parseNoteId(href: string): string | null {
    const match = href.match(
      /\/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9]+)/,
    )
    return match?.[1] ?? null
  }

  function buildDetailUrl(href: string, noteId: string): string {
    try {
      const parsed = new URL(href, location.origin)
      const token = parsed.searchParams.get('xsec_token')
      const detail = new URL(`https://www.xiaohongshu.com/explore/${noteId}`)
      if (token) {
        detail.searchParams.set('xsec_token', token)
        detail.searchParams.set('xsec_source', 'pc_search')
      }
      return detail.href
    } catch {
      return `https://www.xiaohongshu.com/explore/${noteId}`
    }
  }

  function parseCard(card: HTMLElement): CollectedSearchNote | null {
    const selectors = ['a.cover', 'a.title', 'a[href*="/search_result/"]', 'a[href*="xsec_token"]']
    let href = ''
    for (const selector of selectors) {
      const anchor = card.querySelector<HTMLAnchorElement>(selector)
      const candidate = anchor?.getAttribute('href') ?? ''
      if (candidate && parseNoteId(candidate)) {
        href = candidate
        break
      }
    }
    if (!href) return null

    const noteId = parseNoteId(href)
    if (!noteId) return null

    const likeNode =
      card.querySelector('.like-wrapper .count')
      || card.querySelector('[class*="like"] .count')
      || card.querySelector('span.count')
    const likedCountText = likeNode?.textContent?.trim() ?? ''

    const titleNode = card.querySelector('.title span') || card.querySelector('a.title')
    const title = (titleNode?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)

    const index = Number.parseInt(card.dataset.index ?? '', 10)

    return {
      noteId,
      url: buildDetailUrl(href, noteId),
      title,
      likedCountText,
      index: Number.isNaN(index) ? Number.MAX_SAFE_INTEGER : index,
    }
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>('section.note-item'))
  const notes: CollectedSearchNote[] = []

  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue
    const parsed = parseCard(card)
    if (parsed) notes.push(parsed)
  }

  notes.sort((a, b) => a.index - b.index)
  console.info('[RedCopy] 当前视口可见卡片', {
    count: notes.length,
    indexes: notes.map((n) => n.index),
  })
  return notes
}

/**
 * 页面注入：向下滚动一屏以触发分页加载。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectScrollSearchFeedStep(
  options: InjectScrollFeedStepOptions = {},
): Promise<ScrollFeedStepResult> {
  const scrollDelayMs = options.scrollDelayMs ?? 1000
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  // 内联采集逻辑（executeScript 不能跨函数调用）
  function collectVisibleIds(): string[] {
    function parseNoteId(href: string): string | null {
      const match = href.match(
        /\/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9]+)/,
      )
      return match?.[1] ?? null
    }

    const ids: string[] = []
    document.querySelectorAll<HTMLElement>('section.note-item').forEach((card) => {
      const rect = card.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) return
      const anchor =
        card.querySelector<HTMLAnchorElement>('a.cover')
        || card.querySelector<HTMLAnchorElement>('a.title')
        || card.querySelector<HTMLAnchorElement>('a[href*="/search_result/"]')
      const href = anchor?.getAttribute('href') ?? ''
      const noteId = parseNoteId(href)
      if (noteId) ids.push(noteId)
    })
    return ids
  }

  const beforeIds = new Set(collectVisibleIds())

  const step = Math.max(window.innerHeight * 0.85, 400)
  window.scrollBy({ top: step, behavior: 'smooth' })
  await sleep(scrollDelayMs)

  const afterIds = collectVisibleIds()
  const hasNew = afterIds.some((id) => !beforeIds.has(id))

  console.info('[RedCopy] 分页滚动一步', { hasNew, visibleCount: afterIds.length })
  return { hasNew, visibleCount: afterIds.length }
}

/**
 * 页面注入：按 data-index 点击指定搜索卡片，打开详情弹窗。
 * 只在当前 DOM 查找，不向下翻页搜寻。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectClickNoteCardByIndex(
  index: number,
  options: InjectClickNoteOptions = {},
): Promise<ClickNoteResult> {
  const openTimeoutMs = options.openTimeoutMs ?? 6000
  const afterOpenMs = options.afterOpenMs ?? 700
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  function fireHumanClick(el: Element) {
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    el.dispatchEvent(new PointerEvent('pointerdown', init))
    el.dispatchEvent(new MouseEvent('mousedown', init))
    el.dispatchEvent(new PointerEvent('pointerup', init))
    el.dispatchEvent(new MouseEvent('mouseup', init))
    el.dispatchEvent(new MouseEvent('click', init))
  }

  const card = document.querySelector<HTMLElement>(
    `section.note-item[data-index="${index}"]`,
  )
  if (!card) {
    return { opened: false, reason: 'card-not-in-dom' }
  }

  card.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  await sleep(200)

  const clickAnchor =
    card.querySelector<HTMLElement>('a.cover')
    || card.querySelector<HTMLElement>('a.title')
    || card.querySelector<HTMLElement>('a[href*="/search_result/"]')

  if (!clickAnchor) {
    return { opened: false, reason: 'click-target-not-found' }
  }

  const clickTarget = clickAnchor.querySelector('img') ?? clickAnchor
  fireHumanClick(clickTarget)

  let waited = 0
  while (waited < openTimeoutMs) {
    if (document.querySelector('.close-box')) {
      await sleep(afterOpenMs)
      return { opened: true }
    }
    await sleep(200)
    waited += 200
  }

  return { opened: false, reason: 'open-timeout' }
}

/** 兼容旧调用 */
export async function injectCollectSearchNotes(
  options: InjectCollectSearchNotesOptions = {},
): Promise<CollectedSearchNote[]> {
  await injectScrollSearchToTop(options)
  return injectCollectVisibleSearchNotes()
}

/**
 * 页面注入：点击 `.close-box` 关闭详情弹窗（兜底用 ESC）。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export async function injectCloseNoteModal(
  options: InjectCloseModalOptions = {},
): Promise<CloseModalResult> {
  const timeoutMs = options.timeoutMs ?? 3000
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  function fireHumanClick(el: Element) {
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    el.dispatchEvent(new PointerEvent('pointerdown', init))
    el.dispatchEvent(new MouseEvent('mousedown', init))
    el.dispatchEvent(new PointerEvent('pointerup', init))
    el.dispatchEvent(new MouseEvent('mouseup', init))
    el.dispatchEvent(new MouseEvent('click', init))
  }

  const closeBox = document.querySelector('.close-box')
  if (closeBox) {
    fireHumanClick(closeBox)
  } else {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
      }),
    )
  }

  let waited = 0
  while (waited < timeoutMs) {
    if (!document.querySelector('.close-box')) {
      await sleep(300)
      return { closed: true }
    }
    await sleep(150)
    waited += 150
  }

  return { closed: false }
}
