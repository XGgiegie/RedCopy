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

  function parseImageUrls(note: Record<string, unknown>): string[] {
    const imageList = note.imageList
    if (!Array.isArray(imageList)) return []

    const urls: string[] = []
    for (const img of imageList) {
      const item = img as Record<string, unknown>
      if (typeof item.urlDefault === 'string' && item.urlDefault) {
        urls.push(item.urlDefault)
        continue
      }
      if (typeof item.url === 'string' && item.url) {
        urls.push(item.url)
        continue
      }
      const infoList = item.infoList
      if (Array.isArray(infoList) && infoList.length > 0) {
        const first = infoList[0] as Record<string, unknown>
        if (typeof first.url === 'string' && first.url) {
          urls.push(first.url)
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
      .map((el) => (el as HTMLImageElement).src)
      .filter((src) => src.startsWith('http') && !/avatar|icon/i.test(src))

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
      return { noteId: null, structured: null, partial: {} }
    }

    let noteId =
      noteModule.firstNoteId?.value
      ?? noteModule.currentNoteId
      ?? null

    const map = noteModule.noteDetailMap
    if (!noteId || !map[noteId]) {
      const keys = Object.keys(map)
      noteId = keys[0] ?? null
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

    const text: NoteTextInfo = {
      ...emptyText,
      ...fromDom,
      ...Object.fromEntries(
        Object.entries(fromState.partial).filter(([, v]) => {
          if (Array.isArray(v)) return v.length > 0
          return typeof v === 'string' && v.length > 0
        }),
      ) as Partial<NoteTextInfo>,
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
    const hasState = fromState.structured != null
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

    // 视频笔记不支持图片轮播解析，但标题/正文/标签等文案仍可提取用于 AI 分析
    if (noteType === 'video') {
      return {
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
      }
    }

    return {
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
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 笔记提取失败', msg)
    return {
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
  }
}
