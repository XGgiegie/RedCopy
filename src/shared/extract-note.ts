import type {
  DomTreeNode,
  NoteExtractResult,
  NoteMediaType,
  NoteTextInfo,
} from './note-types'

/** 判断是否为笔记详情页 URL */
export function isXhsNoteUrl(url: string): boolean {
  return /xiaohongshu\.com\/(explore|discovery\/item)\/[a-zA-Z0-9]+/.test(url)
}

export interface InjectExtractNoteOptions {
  /** 是否提取完整 DOM 快照（树 + outerHTML），默认 true */
  includeDom?: boolean
}

/**
 * 注入页面上下文：提取当前小红书笔记文本 + DOM 结构。
 * 必须完全自包含，供 scripting.executeScript 使用。
 */
export function injectExtractNote(
  options: InjectExtractNoteOptions = {},
): NoteExtractResult {
  const includeDom = options.includeDom ?? true
  const url = location.href
  const isNotePage = /xiaohongshu\.com\/(explore|discovery\/item)\/[a-zA-Z0-9]+/.test(
    url,
  )

  /** 从 URL 解析当前笔记 ID（SPA 下用于定位当前笔记，避免取到历史缓存里的其它笔记） */
  function parseNoteIdFromUrl(href: string): string | null {
    const match = href.match(
      /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/,
    )
    return match?.[1] ?? null
  }

  const urlNoteId = parseNoteIdFromUrl(url)

  const NOTE_ROOT_SELECTORS = [
    '#noteContainer',
    '.note-detail',
    '.interaction-container',
    '.note-content',
    '#detail-desc',
    '.note-scroller',
    'main',
  ]

  const emptyText: NoteTextInfo = {
    title: '',
    desc: '',
    author: '',
    tags: [],
    publishTime: '',
    likedCount: '',
    collectedCount: '',
    commentCount: '',
    allText: '',
    images: [],
  }

  function normalizeImageUrl(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim().replace(/&amp;/g, '&')
    if (!trimmed) return null
    if (trimmed.startsWith('//')) return `${location.protocol === 'http:' ? 'http:' : 'https:'}${trimmed}`
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return null
  }

  function parseImageUrls(note: Record<string, unknown>): string[] {
    const imageList = note.imageList
    if (!Array.isArray(imageList)) return []

    const urls: string[] = []
    for (const img of imageList) {
      const item = img as Record<string, unknown>
      const urlDefault = normalizeImageUrl(item.urlDefault)
      if (urlDefault) {
        urls.push(urlDefault)
        continue
      }
      const url = normalizeImageUrl(item.url)
      if (url) {
        urls.push(url)
        continue
      }
      const infoList = item.infoList
      if (Array.isArray(infoList) && infoList.length > 0) {
        for (const info of infoList) {
          const infoUrl = normalizeImageUrl((info as Record<string, unknown>).url)
          if (infoUrl) {
            urls.push(infoUrl)
            break
          }
        }
      }
    }
    return [...new Set(urls)]
  }

  function extractImagesFromDom(): string[] {
    const urls = [
      ...document.querySelectorAll(
        '.swiper-slide img, .note-slider img, [class*="carousel"] img, [class*="slide"] img, .img-container img',
      ),
    ]
      .map((el) => {
        const img = el as HTMLImageElement
        return normalizeImageUrl(
          img.currentSrc
          || img.src
          || img.getAttribute('data-src')
          || img.getAttribute('data-original'),
        )
      })
      .filter(
        (src): src is string =>
          typeof src === 'string' && !/avatar|icon/i.test(src),
      )

    return [...new Set(urls)]
  }

  function textOf(el: Element | null): string {
    return el?.textContent?.trim() ?? ''
  }

  function findNoteRoot(): { el: Element; selector: string } | null {
    for (const selector of NOTE_ROOT_SELECTORS) {
      const el = document.querySelector(selector)
      if (el) return { el, selector }
    }
    return null
  }

  function buildDomTree(el: Element, depth = 0, maxDepth = 8): DomTreeNode {
    const className =
      typeof el.className === 'string' && el.className
        ? el.className.slice(0, 160)
        : undefined

    const directText = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ')

    const node: DomTreeNode = {
      tag: el.tagName.toLowerCase(),
      ...(el.id ? { id: el.id } : {}),
      ...(className ? { className } : {}),
      ...(directText ? { text: directText.slice(0, 300) } : {}),
    }

    if (depth >= maxDepth) return node

    const children = [...el.children]
      .map((child) => buildDomTree(child, depth + 1, maxDepth))
      .filter((c) => c.tag || c.text || c.children?.length)

    if (children.length > 0) node.children = children
    return node
  }

  function detectVideoFromDom(): boolean {
    return Boolean(
      document.querySelector(
        '#noteContainer video, .note-detail video, .player-container video, video.xgplayer-media',
      ),
    )
  }

  function detectNoteType(note: Record<string, unknown> | null): NoteMediaType {
    if (!note) {
      return detectVideoFromDom() ? 'video' : 'normal'
    }

    const type = String(note.type ?? note.noteType ?? '').toLowerCase()
    if (type === 'video') return 'video'
    if (note.video != null || note.videoInfo != null) return 'video'
    return detectVideoFromDom() ? 'video' : 'normal'
  }

  function extractFromDom(): Partial<NoteTextInfo> {
    const title =
      textOf(document.querySelector('#detail-title'))
      || textOf(document.querySelector('.title'))
      || textOf(document.querySelector('[class*="note-title"]'))

    const desc =
      textOf(document.querySelector('#detail-desc'))
      || textOf(document.querySelector('.note-text'))
      || textOf(document.querySelector('[class*="note-content"]'))

    const author =
      textOf(document.querySelector('.username'))
      || textOf(document.querySelector('[class*="author"]'))
      || textOf(document.querySelector('.user-name'))

    const tags = [
      ...document.querySelectorAll('#detail-desc a, .tag, [class*="tag"]'),
    ]
      .map((el) => el.textContent?.trim() ?? '')
      .filter((t) => t.startsWith('#') || t.length < 30)

    const publishTime =
      textOf(document.querySelector('.date'))
      || textOf(document.querySelector('[class*="date"]'))

    const likedCount =
      textOf(document.querySelector('.like-wrapper .count'))
      || textOf(document.querySelector('[class*="like"] .count'))

    const collectedCount =
      textOf(document.querySelector('#note-page-collect-board-guide span'))
      || textOf(document.querySelector('[class*="collect"] .count'))

    const commentCount =
      textOf(document.querySelector('.chat-wrapper span'))
      || textOf(document.querySelector('[class*="comment"] .count'))

    const root = findNoteRoot()
    const allText = root ? textOf(root.el) : ''

    return {
      title,
      desc,
      author,
      tags: [...new Set(tags)],
      publishTime,
      likedCount,
      collectedCount,
      commentCount,
      allText,
      images: extractImagesFromDom(),
    }
  }

  function extractFromInitialState(): {
    noteId: string | null
    structured: Record<string, unknown> | null
    partial: Partial<NoteTextInfo>
  } {
    const win = window as Window & {
      __INITIAL_STATE__?: {
        note?: {
          firstNoteId?: { value?: string }
          currentNoteId?: string
          noteDetailMap?: Record<
            string,
            { note?: Record<string, unknown> }
          >
        }
      }
    }

    const noteModule = win.__INITIAL_STATE__?.note
    if (!noteModule?.noteDetailMap) {
      return { noteId: urlNoteId, structured: null, partial: {} }
    }

    const map = noteModule.noteDetailMap

    // 优先用 URL 中的笔记 ID 定位当前笔记。
    // 小红书 SPA 的 noteDetailMap 会累积浏览过的多篇笔记，
    // 而 firstNoteId 始终指向本次会话第一篇笔记，直接使用会导致
    // 当前笔记（尤其是无标题笔记）错误地取到上一篇笔记的标题等内容。
    let noteId: string | null = null
    if (urlNoteId && map[urlNoteId]) {
      noteId = urlNoteId
    } else {
      noteId =
        noteModule.currentNoteId
        ?? noteModule.firstNoteId?.value
        ?? null
      if (!noteId || !map[noteId]) {
        noteId = urlNoteId ?? Object.keys(map)[0] ?? null
      }
    }

    if (!noteId || !map[noteId]?.note) {
      return { noteId, structured: null, partial: {} }
    }

    const note = map[noteId].note as Record<string, unknown>
    const interact = (note.interactInfo ?? {}) as Record<string, string>
    const user = (note.user ?? {}) as Record<string, string>

    const tagList = Array.isArray(note.tagList)
      ? (note.tagList as { name?: string }[])
          .map((t) => t.name ?? '')
          .filter(Boolean)
      : []

    return {
      noteId,
      structured: note,
      partial: {
        title: String(note.title ?? ''),
        desc: String(note.desc ?? ''),
        author: String(user.nickname ?? user.name ?? ''),
        tags: tagList,
        publishTime: String(note.time ?? note.createTime ?? ''),
        likedCount: String(interact.likedCount ?? ''),
        collectedCount: String(interact.collectedCount ?? ''),
        commentCount: String(interact.commentCount ?? ''),
        images: parseImageUrls(note),
      },
    }
  }

  try {
    const fromState = extractFromInitialState()
    const fromDom = extractFromDom()
    const hasState = fromState.structured != null

    // 合并策略：
    // - 命中 __INITIAL_STATE__（按当前 URL 的笔记 ID 精确定位）时，结构化数据是
    //   当前笔记的权威来源。文案字段（标题/正文/作者/标签等）一律以 state 为准，
    //   即便为空也不再回退 DOM——否则小红书 SPA 复用 DOM 时，上一篇笔记残留的
    //   标题/正文会污染当前（尤其是无标题）笔记。
    // - 未命中 state 时，才整体回退到 DOM 提取结果。
    const text: NoteTextInfo = hasState
      ? {
          ...emptyText,
          ...fromDom,
          ...fromState.partial,
        }
      : {
          ...emptyText,
          ...fromDom,
        }

    // state 未提供或为空的字段，用 DOM 兜底
    if (hasState) {
      // 图片：state 无图（如视频/异常）时才用 DOM 轮播兜底
      if (!text.images?.length && fromDom.images?.length) {
        text.images = fromDom.images
      }
      // 全文：state 不含 allText，沿用 DOM 根节点文本
      if (!text.allText && fromDom.allText) {
        text.allText = fromDom.allText
      }
    }

    if (!text.allText && (text.title || text.desc)) {
      text.allText = [text.title, text.desc, text.author, ...text.tags]
        .filter(Boolean)
        .join('\n')
    }

    const root = includeDom ? findNoteRoot() : null
    const dom = root
      ? {
          rootSelector: root.selector,
          outerHTML: root.el.outerHTML.slice(0, 50000),
          tree: buildDomTree(root.el),
        }
      : null

    const noteType = detectNoteType(fromState.structured)
    const hasDom = Boolean(text.title || text.desc || text.allText)

    console.info('[RedCopy] 笔记提取完成', {
      noteId: fromState.noteId,
      noteType,
      source: hasState ? (hasDom ? 'mixed' : 'initial_state') : 'dom',
      title: text.title?.slice(0, 40),
    })

    const hasContent =
      hasState
      || hasDom
      || Boolean(text.title || text.desc || text.allText)

  function logContentJson(payload: {
    ok: boolean
    noteId: string | null
    url: string
    noteType: NoteMediaType
    source: NoteExtractResult['source']
    text: NoteTextInfo
    structured: Record<string, unknown> | null
    error?: string
  }) {
    // 在笔记页 MAIN 世界打印，开发者工具选「当前小红书标签页」即可看到
    console.log('[RedCopy] 提取内容 JSON', payload)
    try {
      console.log(
        '[RedCopy] 提取内容 JSON（可复制）\n' + JSON.stringify(payload, null, 2),
      )
    } catch {
      console.log('[RedCopy] 提取内容 JSON（可复制，序列化受限）', payload)
    }
  }

  function emitResult(result: NoteExtractResult): NoteExtractResult {
    logContentJson({
      ok: result.ok,
      noteId: result.noteId,
      url: result.url,
      noteType: result.noteType,
      source: result.source,
      text: result.text,
      // 调试时始终带上 structured，不受 includeDom 开关影响
      structured: fromState.structured,
      ...(result.error ? { error: result.error } : {}),
    })
    return result
  }

    // 视频笔记不支持图片轮播解析，但标题/正文/标签等文案仍可提取用于 AI 分析
    if (noteType === 'video') {
      return emitResult({
        ok: hasContent,
        url,
        noteId: fromState.noteId,
        isNotePage,
        noteType,
        source: hasState
          ? (hasDom ? 'mixed' : 'initial_state')
          : (hasDom ? 'dom' : 'none'),
        text,
        structured: includeDom ? fromState.structured : null,
        dom,
        ...(hasContent
          ? {}
          : { error: '未能提取视频笔记文案，请确认页面已加载完成' }),
      })
    }

    return emitResult({
      ok: hasContent,
      url,
      noteId: fromState.noteId,
      isNotePage,
      noteType,
      source: hasState
        ? (hasDom ? 'mixed' : 'initial_state')
        : (hasDom ? 'dom' : 'none'),
      text,
      structured: includeDom ? fromState.structured : null,
      dom,
      ...(hasContent
        ? {}
        : { error: isNotePage ? '未找到笔记数据' : '当前不是笔记详情页' }),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 笔记提取失败', msg)
    const failed: NoteExtractResult = {
      ok: false,
      url,
      noteId: null,
      isNotePage,
      noteType: detectVideoFromDom() ? 'video' : 'normal',
      source: 'none',
      text: emptyText,
      structured: null,
      dom: null,
      error: msg,
    }
    console.log('[RedCopy] 提取内容 JSON', {
      ok: false,
      url,
      error: msg,
      text: emptyText,
    })
    return failed
  }
}
