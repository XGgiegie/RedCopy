import {
  DOWNLOAD_NOTE_MEDIA_MESSAGE,
  EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE,
  type DownloadNoteMediaResponse,
  type DownloadNoteMediaType,
  type ExportCurrentNoteMarkdownResponse,
} from '../shared/messages'

const GLOBAL_FLAG = '__redcopyXhsDetailDownloadEnhancerStarted'
const STYLE_ID = 'redcopy-xhs-detail-style'
const TOAST_ID = 'redcopy-xhs-detail-toast'
const EXPORT_BUTTON_SELECTOR = '[data-redcopy-export-note-btn="true"]'
const DOWNLOAD_BUTTON_SELECTOR = '[data-redcopy-download-media-btn="true"]'
const INLINE_DOWNLOAD_BUTTON_SELECTOR =
  '.redcopy-download-note-media-btn[data-redcopy-download-media-btn="true"]'
const FLOATING_EXPORT_SELECTOR = '.redcopy-export-note-floating'
const SCAN_DELAY_MS = 180
const URL_SCAN_INTERVAL_MS = 600
const TOAST_HIDE_DELAY_MS = 2200
const MEDIA_BUTTON_VERSION = '2'

let scanTimer: number | null = null
let toastTimer: number | null = null
let lastObservedHref = location.href
let lastMediaScanSignature = ''

interface DetailModalContext {
  root: HTMLElement
  noteRoot: HTMLElement
}

interface DownloadableMedia {
  host: HTMLElement
  url: string
  type: DownloadNoteMediaType
}

function initXhsDetailDownloadEnhancer() {
  injectRedCopyStyle()
  startObserveDetailModal()
  patchHistoryState()
  scanAndInject()
  console.info('[RedCopy] 小红书详情弹窗下载增强已启动')
}

function startObserveDetailModal() {
  const observer = new MutationObserver(() => {
    scheduleScan()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  window.addEventListener('popstate', scheduleScan)

  window.setInterval(() => {
    if (lastObservedHref !== location.href) {
      lastObservedHref = location.href
      scheduleScan()
      return
    }

    if (isXhsNoteDetailUrl(location.href) && shouldScheduleDetailButtonScan()) {
      scheduleScan()
    }
  }, URL_SCAN_INTERVAL_MS)
}

function patchHistoryState() {
  const rawPushState = history.pushState
  const rawReplaceState = history.replaceState

  history.pushState = function pushState(
    this: History,
    ...args: Parameters<History['pushState']>
  ) {
    const result = rawPushState.apply(this, args)
    scheduleScan()
    return result
  }

  history.replaceState = function replaceState(
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    const result = rawReplaceState.apply(this, args)
    scheduleScan()
    return result
  }
}

function scheduleScan() {
  if (scanTimer) {
    window.clearTimeout(scanTimer)
  }

  scanTimer = window.setTimeout(() => {
    scanAndInject()
  }, SCAN_DELAY_MS)
}

function scanAndInject() {
  const context = findDetailModalContext()
  if (!context) {
    removeFloatingExportButton()
    lastMediaScanSignature = ''
    return
  }

  const exportInjected = injectExportNoteButton(context)
  const mediaInjectedCount = injectMediaDownloadButtons(context)

  if (exportInjected || mediaInjectedCount > 0) {
    console.info('[RedCopy] 详情弹窗按钮注入完成', {
      exportInjected,
      mediaInjectedCount,
    })
  }
}

function shouldScheduleDetailButtonScan(): boolean {
  const context = findDetailModalContext()
  if (!context) return false

  if (!hasExportButton(context)) return true

  const mediaItems = findDownloadableMediaItems(context.noteRoot, context.root)
  const mediaItem = resolveInlineDownloadMediaItem(context, mediaItems)
  const button = getInlineMediaDownloadButton(context)
  if (!mediaItem) return !button
  return (
    !button
    || button.dataset.redcopyMediaUrl !== mediaItem.url
    || button.dataset.redcopyMediaType !== mediaItem.type
  )
}

function isXhsNoteDetailUrl(url: string): boolean {
  return /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/[a-zA-Z0-9]+/.test(url)
}

function findDetailModalContext(): DetailModalContext | null {
  const isNoteDetailUrl = isXhsNoteDetailUrl(location.href)
  const noteRoot =
    document.querySelector<HTMLElement>('#noteContainer.note-container')
    || document.querySelector<HTMLElement>('#noteContainer')

  const modalRoot = noteRoot
    ? (
        noteRoot.closest<HTMLElement>('.note-detail-mask')
        || noteRoot.closest<HTMLElement>('[class*="note-detail"]')
      )
    : (
        document.querySelector<HTMLElement>('.note-detail-mask')
        || document.querySelector<HTMLElement>('[class*="note-detail"]')
        || document.querySelector<HTMLElement>('.close-box')?.closest<HTMLElement>('[class*="container"]')
        || null
      )

  const root = modalRoot || noteRoot
  const resolvedNoteRoot =
    noteRoot
    || root?.querySelector<HTMLElement>('#noteContainer')
    || root

  if (!root || !resolvedNoteRoot) {
    if (isNoteDetailUrl && document.body) {
      return {
        root: document.body,
        noteRoot: document.body,
      }
    }
    return null
  }

  const hasDetailSignal = Boolean(
    resolvedNoteRoot.querySelector(
      '#detail-title, #detail-desc, .interaction-container, .media-container, .note-slider, .note-slider-img, .swiper-slide, video',
    )
    || root.querySelector(
      '#detail-title, #detail-desc, .interaction-container, .media-container, .note-slider, .note-slider-img, .swiper-slide, video, .close-box',
    ),
  )

  if (!hasDetailSignal && !isNoteDetailUrl) return null

  return {
    root,
    noteRoot: resolvedNoteRoot,
  }
}

function injectExportNoteButton(context: DetailModalContext): boolean {
  if (
    context.root.querySelector(EXPORT_BUTTON_SELECTOR)
    || context.noteRoot.querySelector(EXPORT_BUTTON_SELECTOR)
  ) {
    removeFloatingExportButton()
    return false
  }

  removeInlineExportButtons(context)
  removeFloatingExportButton()

  const authorWrapper = findAuthorWrapperMountPoint(context)
  if (authorWrapper) {
    authorWrapper.appendChild(createExportButton())
    return true
  }

  const mountPoint = findExportInlineMountPoint(context)
  if (!mountPoint) return false

  mountPoint.insertAdjacentElement('afterend', createExportButton())
  return true
}

function findAuthorWrapperMountPoint(context: DetailModalContext): HTMLElement | null {
  const selectors = [
    '.interaction-container > .author-container > .author-wrapper',
    '.interaction-container .author-container .author-wrapper',
    '.author-container > .author-wrapper',
    '.author-container .author-wrapper',
  ]

  for (const scope of [context.noteRoot, context.root, document.body]) {
    for (const selector of selectors) {
      const target = scope.querySelector<HTMLElement>(selector)
      if (target?.querySelector('.note-detail-follow-btn')) return target
    }
  }

  return null
}

function findExportInlineMountPoint(context: DetailModalContext): HTMLElement | null {
  const selectors = [
    '.author-container .author-wrapper .note-detail-follow-btn',
    '.author-wrapper .note-detail-follow-btn',
    '.author-container .note-detail-follow-btn',
    '.note-detail-follow-btn',
  ]

  for (const scope of [context.noteRoot, context.root]) {
    for (const selector of selectors) {
      const target = scope.querySelector<HTMLElement>(selector)
      if (target) return target
    }
  }

  const followTextTarget = [...context.root.querySelectorAll<HTMLElement>('button, div, span')]
    .find((el) => {
      const text = el.textContent?.trim() ?? ''
      return text === '关注' || text === '已关注'
    })

  return (
    followTextTarget?.closest<HTMLElement>('.note-detail-follow-btn')
    || followTextTarget?.closest<HTMLElement>('button')
    || null
  )
}

function removeInlineExportButtons(context: DetailModalContext) {
  const inlineButtons = new Set<HTMLElement>([
    ...context.root.querySelectorAll<HTMLElement>(EXPORT_BUTTON_SELECTOR),
    ...context.noteRoot.querySelectorAll<HTMLElement>(EXPORT_BUTTON_SELECTOR),
  ])
  inlineButtons.forEach((el) => el.remove())
}

function removeFloatingExportButton() {
  document.querySelectorAll<HTMLElement>(FLOATING_EXPORT_SELECTOR).forEach((el) => el.remove())
}

function createExportButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'redcopy-export-note-btn'
  button.dataset.redcopyExportNoteBtn = 'true'
  button.textContent = '导出笔记'

  button.addEventListener('pointerdown', stopPageEvent)
  button.addEventListener('mousedown', stopPageEvent)
  button.addEventListener('click', (event) => {
    stopPageEvent(event)
    void handleExportCurrentNote(button)
  })

  return button
}

async function handleExportCurrentNote(button: HTMLButtonElement) {
  if (button.disabled) return

  setExportButtonBusy(button, true)
  try {
    const response = await sendRuntimeMessage<ExportCurrentNoteMarkdownResponse>({
      type: EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE,
    })

    if (!response.ok) {
      throw new Error(response.error ?? '导出失败')
    }

    showToast('Markdown 已开始下载', 'success')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 详情笔记导出失败', detail, error)
    showToast(`导出失败：${detail}`, 'error')
  } finally {
    setExportButtonBusy(button, false)
  }
}

function setExportButtonBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy
  button.dataset.redcopyBusy = busy ? 'true' : 'false'
  button.textContent = busy ? '导出中...' : '导出笔记'
}

function injectMediaDownloadButtons(context: DetailModalContext): number {
  const mediaItems = findDownloadableMediaItems(context.noteRoot, context.root)
  cleanupStaleMediaDownloadButtons(context)

  const mediaItem = resolveInlineDownloadMediaItem(context, mediaItems)
  const existingButton = getInlineMediaDownloadButton(context)
  let injectedCount = 0

  const authorWrapper = findAuthorWrapperMountPoint(context)
  const mountPoint =
    getExportButton(context)
    || authorWrapper
    || findExportInlineMountPoint(context)
  let button = existingButton
  if (!button) {
    if (!mountPoint) {
      logMediaScanResult(mediaItems, 0)
      return 0
    }

    button = createInlineMediaDownloadButton(context)
    placeInlineMediaDownloadButton(button, mountPoint, authorWrapper)
    console.info('[RedCopy] 作者栏下载按钮已注入', {
      mediaType: mediaItem?.type ?? 'pending',
      mountPoint: shortElementLabel(mountPoint),
    })
    injectedCount = 1
  } else if (mountPoint) {
    placeInlineMediaDownloadButton(button, mountPoint, authorWrapper)
  }

  updateInlineMediaDownloadButton(button, mediaItem, context)

  logMediaScanResult(mediaItems, injectedCount)

  return injectedCount
}

function placeInlineMediaDownloadButton(
  button: HTMLButtonElement,
  mountPoint: HTMLElement,
  authorWrapper: HTMLElement | null,
) {
    if (mountPoint === authorWrapper) {
      mountPoint.appendChild(button)
    } else {
      mountPoint.insertAdjacentElement('afterend', button)
    }
}

function hasExportButton(context: DetailModalContext): boolean {
  return Boolean(getExportButton(context))
}

function getExportButton(context: DetailModalContext): HTMLButtonElement | null {
  return (
    context.root.querySelector<HTMLButtonElement>(EXPORT_BUTTON_SELECTOR)
    || context.noteRoot.querySelector<HTMLButtonElement>(EXPORT_BUTTON_SELECTOR)
  )
}

function getInlineMediaDownloadButton(context: DetailModalContext): HTMLButtonElement | null {
  return (
    context.root.querySelector<HTMLButtonElement>(INLINE_DOWNLOAD_BUTTON_SELECTOR)
    || context.noteRoot.querySelector<HTMLButtonElement>(INLINE_DOWNLOAD_BUTTON_SELECTOR)
  )
}

function cleanupStaleMediaDownloadButtons(context: DetailModalContext) {
  const staleButtons = new Set<HTMLButtonElement>([
    ...context.root.querySelectorAll<HTMLButtonElement>(DOWNLOAD_BUTTON_SELECTOR),
    ...context.noteRoot.querySelectorAll<HTMLButtonElement>(DOWNLOAD_BUTTON_SELECTOR),
  ])

  staleButtons.forEach((button) => {
    if (!button.classList.contains('redcopy-download-note-media-btn')) {
      button.remove()
    }
  })
}

function chooseInlineDownloadMediaItem(mediaItems: DownloadableMedia[]): DownloadableMedia | null {
  return (
    mediaItems.find((item) => item.type === 'video')
    || mediaItems.find((item) => item.type === 'live')
    || mediaItems[0]
    || null
  )
}

function resolveInlineDownloadMediaItem(
  context: DetailModalContext,
  mediaItems: DownloadableMedia[],
): DownloadableMedia | null {
  const mediaItem = chooseInlineDownloadMediaItem(mediaItems)
  if (mediaItem) return mediaItem

  const videoHost = findVideoFallbackHost(context)
  if (videoHost) {
    return {
      host: videoHost,
      url: 'blob:redcopy-unresolved-video',
      type: 'video',
    }
  }

  return null
}

function findVideoFallbackHost(context: DetailModalContext): HTMLElement | null {
  return (
    context.noteRoot.querySelector<HTMLElement>('.media-container.video-player-media')
    || context.root.querySelector<HTMLElement>('.media-container.video-player-media')
    || context.noteRoot.querySelector<HTMLElement>('.player-container, .xgplayer, video')
    || context.root.querySelector<HTMLElement>('.player-container, .xgplayer, video')
  )
}

function createInlineMediaDownloadButton(context: DetailModalContext): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'redcopy-export-note-btn redcopy-download-note-media-btn'
  button.dataset.redcopyDownloadMediaBtn = 'true'
  button.dataset.redcopyMediaButtonVersion = MEDIA_BUTTON_VERSION

  button.addEventListener('pointerdown', stopPageEvent)
  button.addEventListener('mousedown', stopPageEvent)
  button.addEventListener('click', (event) => {
    stopPageEvent(event)
    void handleDownloadInlineMedia(button, context)
  })

  return button
}

function updateInlineMediaDownloadButton(
  button: HTMLButtonElement,
  mediaItem: DownloadableMedia | null,
  context: DetailModalContext,
) {
  const fallbackType: DownloadNoteMediaType = findVideoFallbackHost(context) ? 'video' : 'image'
  const mediaType = mediaItem?.type ?? fallbackType
  const title = mediaType === 'image' ? '下载图片' : '下载视频'
  button.textContent = title
  button.title = title
  button.setAttribute('aria-label', title)
  button.dataset.redcopyMediaType = mediaType

  if (mediaItem?.url) {
    button.dataset.redcopyMediaUrl = mediaItem.url
  } else if (mediaType === 'video') {
    button.dataset.redcopyMediaUrl = 'blob:redcopy-unresolved-video'
  } else {
    delete button.dataset.redcopyMediaUrl
  }
}

function logMediaScanResult(mediaItems: DownloadableMedia[], injectedCount: number) {
  const imageCount = mediaItems.filter((item) => item.type === 'image').length
  const videoCount = mediaItems.filter((item) => item.type === 'video').length
  const liveCount = mediaItems.filter((item) => item.type === 'live').length
  const signature = [
    location.href,
    mediaItems.length,
    imageCount,
    videoCount,
    liveCount,
    injectedCount,
    mediaItems.map((item) => `${item.type}:${shortElementLabel(item.host)}`).join('|'),
  ].join('::')

  if (signature === lastMediaScanSignature && injectedCount === 0) return
  lastMediaScanSignature = signature

  console.info('[RedCopy] detail media scan', {
    total: mediaItems.length,
    imageCount,
    videoCount,
    liveCount,
    injectedCount,
    hosts: mediaItems.map((item) => ({
      type: item.type,
      host: shortElementLabel(item.host),
      url: item.url.slice(0, 96),
    })),
  })
}

function shortElementLabel(el: HTMLElement): string {
  const id = el.id ? `#${el.id}` : ''
  const classes = typeof el.className === 'string'
    ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 4).map((name) => `.${name}`).join('')
    : ''
  return `${el.tagName.toLowerCase()}${id}${classes}`
}

function findDownloadableMediaItems(
  noteRoot: HTMLElement,
  root: HTMLElement,
): DownloadableMedia[] {
  const itemByHost = new Map<HTMLElement, DownloadableMedia>()
  const scopes = collectMediaSearchScopes(noteRoot, root)

  const directSelectors = [
    '.media-container .note-slider-img',
    '.media-container .img-container',
    '.media-container picture',
    '.media-container video',
    '.media-container .player-container',
    '.media-container [class*="video"]',
    '.media-container [class*="live"]',
    '.note-slider',
    '.note-slider-img',
    '.note-slider .note-slider-img',
    '.note-slider .img-container',
    '.note-slider picture',
    '.note-slider video',
    '.swiper-slide',
    '.swiper-slide .note-slider-img',
    '.swiper-slide .img-container',
    '.swiper-slide video',
    '.swiper-slide [class*="video"]',
    '.swiper-slide [class*="live"]',
  ]

  for (const scope of scopes) {
    for (const selector of directSelectors) {
      scope.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        addDownloadableMediaHost(itemByHost, resolveMediaHost(el), el)
      })
    }

    scope
      .querySelectorAll<HTMLElement>(
        '.media-container img, .note-slider img, .swiper-slide img, .img-container img, '
        + '.media-container video, .note-detail video, .player-container video, video.xgplayer-media',
      )
      .forEach((media) => {
        const host = resolveMediaHost(media)
        if (host) addDownloadableMediaHost(itemByHost, host, media)
      })
  }

  return [...itemByHost.values()]
}

function collectMediaSearchScopes(
  noteRoot: HTMLElement,
  root: HTMLElement,
): HTMLElement[] {
  const scopes = new Set<HTMLElement>([noteRoot, root])

  document
    .querySelectorAll<HTMLElement>(
      '.note-slider, .media-container, .note-detail-mask, [class*="note-detail"]',
    )
    .forEach((el) => scopes.add(el))

  document
    .querySelectorAll<HTMLElement>('.note-slider-img, .swiper-slide, .img-container')
    .forEach((el) => {
      const mediaScope =
        el.closest<HTMLElement>('.note-slider')
        || el.closest<HTMLElement>('.media-container')
        || el.closest<HTMLElement>('.note-detail-mask')
        || el.closest<HTMLElement>('[class*="note-detail"]')
      if (mediaScope) scopes.add(mediaScope)
    })

  return [...scopes]
}

function resolveMediaHost(el: HTMLElement): HTMLElement {
  if (el.matches('.note-slider')) {
    const activeMedia =
      el.querySelector<HTMLElement>('.swiper-slide-active .note-slider-img')
      || el.querySelector<HTMLElement>('.swiper-slide-active .img-container')
      || el.querySelector<HTMLElement>('.swiper-slide-active video')
      || el.querySelector<HTMLElement>('.note-slider-img')
      || el.querySelector<HTMLElement>('.img-container')
      || el.querySelector<HTMLElement>('video')
    if (activeMedia) return resolveMediaHost(activeMedia)
  }

  if (el.matches('.swiper-slide')) {
    const slideMedia =
      el.querySelector<HTMLElement>('.note-slider-img')
      || el.querySelector<HTMLElement>('.img-container')
      || el.querySelector<HTMLElement>('video')
      || el.querySelector<HTMLElement>('img')
    if (slideMedia) return resolveMediaHost(slideMedia)
  }

  if (hasVideoSignal(el)) {
    return (
      el.closest<HTMLElement>('.media-container.video-player-media')
      || el.closest<HTMLElement>('.media-container')
      || el.closest<HTMLElement>('.player-container')
      || el.closest<HTMLElement>('.swiper-slide')
      || el
    )
  }

  return (
    el.closest<HTMLElement>('.note-slider-img')
    || el.closest<HTMLElement>('.img-container')
    || el.closest<HTMLElement>('.player-container')
    || el.closest<HTMLElement>('.swiper-slide')
    || el.closest<HTMLElement>('.media-container')
    || el
  )
}

function addDownloadableMediaHost(
  itemByHost: Map<HTMLElement, DownloadableMedia>,
  host: HTMLElement,
  source: HTMLElement,
) {
  if (itemByHost.has(host)) return

  const media = getMediaFromHost(source) || getMediaFromHost(host)
  if (!media) return

  itemByHost.set(host, {
    host,
    url: media.url,
    type: media.type,
  })
}

async function handleDownloadCurrentMedia(
  button: HTMLButtonElement,
  media: {
    url: string
    type: DownloadNoteMediaType
  },
  context: DetailModalContext,
) {
  if (button.disabled) return

  const mediaItems = collectCurrentNoteMedia(context)
  const mediaIndex = Math.max(0, mediaItems.findIndex((item) => item.url === media.url))

  setDownloadButtonBusy(button, true)
  try {
    const response = await sendRuntimeMessage<DownloadNoteMediaResponse>({
      type: DOWNLOAD_NOTE_MEDIA_MESSAGE,
      url: media.url,
      index: mediaIndex,
      mediaType: media.type,
      context: {
        title: getCurrentNoteTitle(context.noteRoot),
        noteId: getCurrentNoteId(context.root),
      },
    })

    if (!response.ok) {
      throw new Error(response.error ?? '下载失败')
    }

    showToast(media.type === 'image' ? '图片已开始下载' : '视频已开始下载', 'success')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 详情媒体下载失败', { media, detail }, error)
    showToast(`下载失败：${detail}`, 'error')
  } finally {
    setDownloadButtonBusy(button, false)
  }
}

async function handleDownloadInlineMedia(
  button: HTMLButtonElement,
  context: DetailModalContext,
) {
  let url = button.dataset.redcopyMediaUrl ?? ''
  let type = button.dataset.redcopyMediaType as DownloadNoteMediaType | undefined

  if (!url || !type) {
    const mediaItem = resolveInlineDownloadMediaItem(
      context,
      findDownloadableMediaItems(context.noteRoot, context.root),
    )
    if (mediaItem) {
      url = mediaItem.url
      type = mediaItem.type
      updateInlineMediaDownloadButton(button, mediaItem, context)
    } else if (findVideoFallbackHost(context)) {
      url = 'blob:redcopy-unresolved-video'
      type = 'video'
      updateInlineMediaDownloadButton(button, { host: context.root, url, type }, context)
    }
  }

  if (!url || !type) {
    showToast('未找到可下载的媒体地址', 'error')
    return
  }

  await handleDownloadCurrentMedia(button, { url, type }, context)
}

function setDownloadButtonBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy
  button.dataset.redcopyBusy = busy ? 'true' : 'false'
}

function collectCurrentNoteMedia(context: DetailModalContext): Array<{
  url: string
  type: DownloadNoteMediaType
}> {
  const items = findDownloadableMediaItems(context.noteRoot, context.root)
    .map((item) => ({ url: item.url, type: item.type }))

  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

function getMediaFromHost(host: HTMLElement): {
  url: string
  type: DownloadNoteMediaType
} | null {
  const hasVideo = hasVideoSignal(host)

  if (hasVideo) {
    const videoUrl = getVideoUrlFromHost(host)
    if (videoUrl) {
      return {
        url: videoUrl,
        type: isLiveMediaHost(host, videoUrl) ? 'live' : 'video',
      }
    }

    return {
      url: 'blob:redcopy-unresolved-video',
      type: isLiveMediaHost(host, '') ? 'live' : 'video',
    }
  }

  const imageUrl = getImageUrlFromHost(host)
  if (imageUrl) {
    return {
      url: imageUrl,
      type: 'image',
    }
  }

  const deepUrl = findMediaUrlInData(host, hasVideo)
  if (deepUrl) {
    return {
      url: deepUrl,
      type: classifyMediaUrl(host, deepUrl),
    }
  }

  return null
}

function getImageUrlFromHost(host: HTMLElement): string {
  const img = host.matches('img')
    ? host as HTMLImageElement
    : host.querySelector<HTMLImageElement>('img')
  const src = normalizeImageUrl(
    img?.currentSrc
    || img?.src
    || img?.getAttribute('data-src')
    || img?.getAttribute('data-original'),
  )
  if (src) return src

  const slide = host.closest<HTMLElement>('.swiper-slide')
  const backgroundImages = [
    host.style.backgroundImage,
    getComputedStyle(host).backgroundImage,
    slide?.style.backgroundImage,
    slide ? getComputedStyle(slide).backgroundImage : '',
  ]

  for (const backgroundImage of backgroundImages) {
    const url = parseBackgroundImageUrl(backgroundImage ?? '')
    if (url) return url
  }

  return ''
}

function getVideoUrlFromHost(host: HTMLElement): string {
  const video = host.matches('video')
    ? host as HTMLVideoElement
    : host.querySelector<HTMLVideoElement>('video')
  const videoUrls = [
    video?.getAttribute('src'),
    video?.getAttribute('data-src'),
    video?.src,
    video?.currentSrc,
  ]
    .map(normalizeMediaUrl)
    .filter(Boolean)
    .filter((url) => !isImageUrl(url))
  const directVideoUrl = videoUrls.find((url) => !url.startsWith('blob:'))
  const blobVideoUrl = videoUrls.find((url) => url.startsWith('blob:'))
  if (directVideoUrl) return directVideoUrl

  const source = video?.querySelector<HTMLSourceElement>('source[src]')
    || host.querySelector<HTMLSourceElement>('source[src]')
  const sourceSrc = normalizeMediaUrl(source?.src || source?.getAttribute('src'))
  if (sourceSrc && !isImageUrl(sourceSrc) && !sourceSrc.startsWith('blob:')) {
    return sourceSrc
  }

  const directAttrs = [
    'src',
    'data-src',
    'data-video',
    'data-video-url',
    'data-url',
  ]
  for (const attr of directAttrs) {
    const attrUrl = normalizeMediaUrl(host.getAttribute(attr))
    if (attrUrl && !isImageUrl(attrUrl)) return attrUrl
  }

  const dataUrl = findMediaUrlInData(host, false)
  if (dataUrl && !isImageUrl(dataUrl)) return dataUrl

  return blobVideoUrl ?? ''
}

function findMediaUrlInData(root: HTMLElement, includeGlobalState = false): string {
  const seen = new Set<object>()
  const candidates: string[] = []

  function visit(value: unknown, depth: number) {
    if (depth > 7 || candidates.length > 20) return
    if (typeof value === 'string') {
      const normalized = normalizeMediaUrl(value)
      if (normalized && isProbablyDownloadableMediaUrl(normalized)) {
        candidates.push(normalized)
      }
      return
    }
    if (!value || typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1))
      return
    }

    Object.values(value as Record<string, unknown>).forEach((item) => {
      visit(item, depth + 1)
    })
  }

  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    for (const attr of el.getAttributeNames()) {
      const value = el.getAttribute(attr) ?? ''
      const normalized = normalizeMediaUrl(value)
      if (normalized && isProbablyDownloadableMediaUrl(normalized)) {
        candidates.push(normalized)
      }

      if ((attr.startsWith('data-') || attr === 'style') && value.includes('{')) {
        try {
          visit(JSON.parse(value), 0)
        } catch {
          // Some Xiaohongshu data attributes contain non-JSON snippets.
        }
      }
    }
  }

  if (includeGlobalState) {
    const state = (window as Window & {
      __INITIAL_STATE__?: unknown
      __INITIAL_STATE?: unknown
    }).__INITIAL_STATE__ ?? (window as Window & { __INITIAL_STATE?: unknown }).__INITIAL_STATE
    visit(state, 0)
  }

  return chooseBestMediaUrl(root, candidates)
}

function chooseBestMediaUrl(host: HTMLElement, candidates: string[]): string {
  const unique = [...new Set(candidates)]
  const video = unique.find((url) => !isImageUrl(url) && /\.(mp4|m3u8|webm|mov|flv)(?:$|[?#])/i.test(url))
    || unique.find((url) => !isImageUrl(url) && /(video|stream|live|mp4|m3u8)/i.test(url))
  if (video) return video

  const image = unique.find(isImageUrl)
  if (image) return image

  const text = host.textContent?.toLowerCase() ?? ''
  if (text.includes('live') || text.includes('直播')) {
    return unique.find((url) => /live|m3u8|stream/i.test(url)) ?? ''
  }

  return ''
}

function normalizeMediaUrl(value: unknown): string {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim().replace(/&amp;/g, '&')
  if (!trimmed) return ''
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed
  if (trimmed.startsWith('//')) {
    return `${location.protocol === 'http:' ? 'http:' : 'https:'}${trimmed}`
  }

  try {
    const url = new URL(trimmed, location.href)
    if (['http:', 'https:'].includes(url.protocol)) return url.href
  } catch {
    return ''
  }

  return ''
}

function isImageUrl(url: string): boolean {
  return /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:$|[?#])/i.test(url)
    || /(?:sns-img|sns-webpic|webpic|imageView2|imageMogr2|format\/(?:webp|jpg|png|avif)|_webp|webp)/i.test(url)
}

function isProbablyDownloadableMediaUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  return /\.(?:jpe?g|png|gif|webp|avif|bmp|svg|mp4|m3u8|webm|mov|flv|ts)(?:$|[?#])/i.test(url)
    || /(?:xhscdn|sns-img|sns-video|video|stream|live|imageView2|imageMogr2|format\/)/i.test(url)
}

function hasVideoSignal(host: HTMLElement): boolean {
  if (host.matches('video') || host.querySelector('video, source[src]')) return true

  const signal = `${host.className} ${host.id} ${host.textContent ?? ''}`.toLowerCase()
  if (/(video|player|live|直播|视频)/i.test(signal)) return true

  return host.getAttributeNames().some((name) =>
    /video|live|player|stream/i.test(name)
    || /video|live|player|stream/i.test(host.getAttribute(name) ?? ''),
  )
}

function classifyMediaUrl(host: HTMLElement, url: string): DownloadNoteMediaType {
  if (isImageUrl(url)) return 'image'
  return isLiveMediaHost(host, url) ? 'live' : 'video'
}

function isLiveMediaHost(host: HTMLElement, url: string): boolean {
  const text = `${host.className} ${host.id} ${host.textContent ?? ''} ${url}`.toLowerCase()
  return text.includes('live') || text.includes('直播')
}

function normalizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return ''

  const trimmed = value.trim().replace(/&amp;/g, '&')
  if (!trimmed || trimmed.startsWith('data:')) return ''
  if (trimmed.startsWith('//')) {
    return `${location.protocol === 'http:' ? 'http:' : 'https:'}${trimmed}`
  }

  try {
    const url = new URL(trimmed, location.href)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return ''
  }

  return ''
}

function parseBackgroundImageUrl(backgroundImage: string): string {
  const match = backgroundImage.match(/url\(["']?(.*?)["']?\)/)
  return normalizeImageUrl(match?.[1])
}

function getCurrentNoteTitle(noteRoot: HTMLElement): string {
  return noteRoot.querySelector<HTMLElement>('#detail-title')?.innerText?.trim() ?? ''
}

function getCurrentNoteId(root: HTMLElement): string | null {
  const noteId = root.getAttribute('note-id')
  if (noteId) return noteId

  const match = location.href.match(
    /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9]+)/,
  )
  return match?.[1] ?? null
}

function stopPageEvent(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function sendRuntimeMessage<T extends { ok: boolean; error?: string }>(
  payload: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response: T | undefined) => {
      const err = chrome.runtime.lastError?.message
      if (err) {
        reject(new Error(err))
        return
      }
      if (!response) {
        reject(new Error('后台无响应，请刷新扩展后重试'))
        return
      }
      resolve(response)
    })
  })
}

function showToast(text: string, type: 'success' | 'error') {
  let toast = document.querySelector<HTMLElement>(`#${TOAST_ID}`)
  if (!toast) {
    toast = document.createElement('div')
    toast.id = TOAST_ID
    document.documentElement.appendChild(toast)
  }

  toast.className = `redcopy-xhs-detail-toast redcopy-xhs-detail-toast-${type}`
  toast.textContent = text
  toast.dataset.visible = 'true'

  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }

  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = 'false'
  }, TOAST_HIDE_DELAY_MS)
}

function injectRedCopyStyle() {
  if (document.querySelector(`#${STYLE_ID}`)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .redcopy-export-note-btn {
      appearance: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      align-self: center;
      box-sizing: border-box;
      margin-left: 4px;
      height: 40px;
      padding: 0 16px;
      border: 1px solid rgba(255, 36, 66, 0.34);
      border-radius: 999px;
      background: #fff;
      color: #ff2442;
      font-family: inherit;
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.16s ease, transform 0.16s ease, background 0.16s ease;
    }

    .redcopy-export-note-btn:hover {
      background: #fff5f6;
    }

    .redcopy-export-note-btn:active {
      transform: scale(0.98);
    }

    .redcopy-export-note-btn:disabled {
      cursor: default;
      opacity: 0.7;
      transform: none;
    }

    .redcopy-download-note-media-btn {
      margin-left: 4px;
      background: #ff2442;
      color: #fff;
      border-color: #ff2442;
    }

    .redcopy-download-note-media-btn:hover {
      background: #e61e3c;
      border-color: #e61e3c;
    }

    .redcopy-xhs-detail-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      max-width: min(360px, calc(100vw - 48px));
      padding: 10px 14px;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      opacity: 0;
      transform: translateY(-8px);
      pointer-events: none;
      transition: opacity 0.16s ease, transform 0.16s ease;
    }

    .redcopy-xhs-detail-toast[data-visible="true"] {
      opacity: 1;
      transform: translateY(0);
    }

    .redcopy-xhs-detail-toast-success {
      background: #111;
    }

    .redcopy-xhs-detail-toast-error {
      background: #d03050;
    }
  `

  document.documentElement.appendChild(style)
}

const runtimeWindow = window as Window & {
  [GLOBAL_FLAG]?: boolean
}

if (!runtimeWindow[GLOBAL_FLAG]) {
  runtimeWindow[GLOBAL_FLAG] = true
  initXhsDetailDownloadEnhancer()
}
