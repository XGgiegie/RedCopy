const GLOBAL_FLAG = '__redcopyXhsDetailDownloadEnhancerStarted'
const STYLE_ID = 'redcopy-xhs-detail-style'
const TOAST_ID = 'redcopy-xhs-detail-toast'
const EXPORT_BUTTON_SELECTOR = '[data-redcopy-export-note-btn="true"]'
const DOWNLOAD_BUTTON_SELECTOR = '[data-redcopy-download-image-btn="true"]'
const EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE = 'redcopy:export-current-note-markdown'
const DOWNLOAD_NOTE_IMAGE_MESSAGE = 'redcopy:download-note-image'
const SCAN_DELAY_MS = 180
const TOAST_HIDE_DELAY_MS = 2200

interface ExportCurrentNoteMarkdownResponse {
  ok: boolean
  error?: string
}

interface DownloadNoteImageResponse {
  ok: boolean
  error?: string
}

let scanTimer: number | null = null
let toastTimer: number | null = null

interface DetailModalContext {
  root: HTMLElement
  noteRoot: HTMLElement
}

interface ExportMountPoint {
  target: HTMLElement
  mode: 'afterend' | 'append'
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
  if (!context) return

  const exportInjected = injectExportNoteButton(context)
  const imageInjectedCount = injectImageDownloadButtons(context)

  if (exportInjected || imageInjectedCount > 0) {
    console.info('[RedCopy] 详情弹窗按钮注入完成', {
      exportInjected,
      imageInjectedCount,
    })
  }
}

function findDetailModalContext(): DetailModalContext | null {
  const noteRoot =
    document.querySelector<HTMLElement>('#noteContainer.note-container')
    || document.querySelector<HTMLElement>('#noteContainer')

  const root =
    noteRoot?.closest<HTMLElement>('.note-detail-mask')
    || document.querySelector<HTMLElement>('.note-detail-mask')
    || noteRoot?.closest<HTMLElement>('[class*="note-detail"]')
    || document.querySelector<HTMLElement>('[class*="note-detail"]')
    || document.querySelector<HTMLElement>('.close-box')?.closest<HTMLElement>('[class*="container"]')
    || null

  const resolvedNoteRoot =
    noteRoot
    || root?.querySelector<HTMLElement>('#noteContainer')
    || root

  if (!root || !resolvedNoteRoot) return null

  const hasDetailSignal = Boolean(
    resolvedNoteRoot.querySelector('#detail-title, #detail-desc, .interaction-container, .media-container')
    || root.querySelector('#detail-title, #detail-desc, .interaction-container, .media-container, .close-box'),
  )

  if (!hasDetailSignal) return null

  return {
    root,
    noteRoot: resolvedNoteRoot,
  }
}

function injectExportNoteButton(context: DetailModalContext): boolean {
  if (context.root.querySelector(EXPORT_BUTTON_SELECTOR)) return false

  const mountPoint = findExportMountPoint(context.noteRoot, context.root)
  if (!mountPoint) {
    console.debug('[RedCopy] 未找到导出按钮挂载点', {
      hasNoteRoot: Boolean(context.noteRoot),
      hasInteraction: Boolean(context.noteRoot.querySelector('.interaction-container')),
      hasAuthor: Boolean(context.noteRoot.querySelector('.author-container, .author, [class*="author"]')),
    })
    return false
  }

  const button = createExportButton()
  if (mountPoint.mode === 'afterend') {
    mountPoint.target.insertAdjacentElement('afterend', button)
  } else {
    mountPoint.target.appendChild(button)
  }

  return true
}

function findExportMountPoint(
  noteRoot: HTMLElement,
  root: HTMLElement,
): ExportMountPoint | null {
  const selectors: Array<{ selector: string; mode: ExportMountPoint['mode'] }> = [
    {
      selector: '.interaction-container .author-container .note-detail-follow-btn',
      mode: 'afterend',
    },
    { selector: '.author-container .note-detail-follow-btn', mode: 'afterend' },
    { selector: '.author .note-detail-follow-btn', mode: 'afterend' },
    { selector: '.interaction-container .author-container [class*="follow"]', mode: 'afterend' },
    { selector: '.author-container [class*="follow"]', mode: 'afterend' },
    { selector: '.author [class*="follow"]', mode: 'afterend' },
    { selector: '.interaction-container .author-wrapper', mode: 'append' },
    { selector: '.interaction-container .author-container', mode: 'append' },
    { selector: '.author-container', mode: 'append' },
    { selector: '.author', mode: 'append' },
    { selector: '.interaction-container', mode: 'append' },
  ]

  for (const { selector, mode } of selectors) {
    const target =
      noteRoot.querySelector<HTMLElement>(selector)
      || root.querySelector<HTMLElement>(selector)
    if (target) return { target, mode }
  }

  const followTextTarget = [...root.querySelectorAll<HTMLElement>('button, div, span')]
    .find((el) => {
      const text = el.textContent?.trim() ?? ''
      return text === '关注' || text === '已关注'
    })

  if (followTextTarget) {
    const target =
      followTextTarget.closest<HTMLElement>('button')
      || followTextTarget.closest<HTMLElement>('[class*="follow"]')
      || followTextTarget
    return { target, mode: 'afterend' }
  }

  return null
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

function injectImageDownloadButtons(context: DetailModalContext): number {
  const imgBoxes = findImageDownloadHosts(context.noteRoot, context.root)
  let injectedCount = 0

  imgBoxes.forEach((imgBox) => {
    if (imgBox.querySelector(DOWNLOAD_BUTTON_SELECTOR)) return

    imgBox.classList.add('redcopy-image-download-host')

    const computedStyle = getComputedStyle(imgBox)
    if (computedStyle.position === 'static') {
      imgBox.style.position = 'relative'
    }

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'redcopy-download-image-btn'
    button.dataset.redcopyDownloadImageBtn = 'true'
    button.title = '下载图片'
    button.setAttribute('aria-label', '下载图片')
    button.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2.5a1 1 0 0 1 1 1v7.09l2.3-2.3a1 1 0 0 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42L9 10.59V3.5a1 1 0 0 1 1-1ZM4.5 15a1 1 0 0 1 1 1v.5h9V16a1 1 0 1 1 2 0v1.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V16a1 1 0 0 1 1-1Z" />
      </svg>
    `

    button.addEventListener('pointerdown', stopPageEvent)
    button.addEventListener('mousedown', stopPageEvent)
    button.addEventListener('click', (event) => {
      stopPageEvent(event)
      void handleDownloadCurrentImage(button, imgBox, context)
    })

    imgBox.appendChild(button)
    injectedCount += 1
  })

  return injectedCount
}

function findImageDownloadHosts(
  noteRoot: HTMLElement,
  root: HTMLElement,
): HTMLElement[] {
  const hostSet = new Set<HTMLElement>()
  const scopes = [noteRoot, root]

  const directSelectors = [
    '.media-container .note-slider-img',
    '.media-container .img-container',
    '.media-container picture',
    '.note-slider .note-slider-img',
    '.note-slider .img-container',
  ]

  for (const scope of scopes) {
    for (const selector of directSelectors) {
      scope.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        if (hasDownloadableImage(el)) hostSet.add(el)
      })
    }

    scope
      .querySelectorAll<HTMLImageElement>(
        '.media-container img, .note-slider img, .swiper-slide img, .img-container img',
      )
      .forEach((img) => {
        const host =
          img.closest<HTMLElement>('.note-slider-img')
          || img.closest<HTMLElement>('.img-container')
          || img.closest<HTMLElement>('picture')
          || img.parentElement
        if (host && hasDownloadableImage(host)) hostSet.add(host)
      })
  }

  return [...hostSet]
}

function hasDownloadableImage(host: HTMLElement): boolean {
  return Boolean(getImageUrlFromSliderBox(host))
}

async function handleDownloadCurrentImage(
  button: HTMLButtonElement,
  imgBox: HTMLElement,
  context: DetailModalContext,
) {
  if (button.disabled) return

  const imageUrl = getImageUrlFromSliderBox(imgBox)
  if (!imageUrl) {
    showToast('未找到可下载的图片地址', 'error')
    return
  }

  const imageUrls = collectCurrentNoteImageUrls(context)
  const imageIndex = Math.max(0, imageUrls.indexOf(imageUrl))

  setDownloadButtonBusy(button, true)
  try {
    const response = await sendRuntimeMessage<DownloadNoteImageResponse>({
      type: DOWNLOAD_NOTE_IMAGE_MESSAGE,
      url: imageUrl,
      index: imageIndex,
      context: {
        title: getCurrentNoteTitle(context.noteRoot),
        noteId: getCurrentNoteId(context.root),
      },
    })

    if (!response.ok) {
      throw new Error(response.error ?? '下载失败')
    }

    showToast('图片已开始下载', 'success')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 详情图片下载失败', { imageUrl, detail }, error)
    showToast(`下载失败：${detail}`, 'error')
  } finally {
    setDownloadButtonBusy(button, false)
  }
}

function setDownloadButtonBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy
  button.dataset.redcopyBusy = busy ? 'true' : 'false'
}

function collectCurrentNoteImageUrls(context: DetailModalContext): string[] {
  const urls = findImageDownloadHosts(context.noteRoot, context.root)
    .map(getImageUrlFromSliderBox)
    .filter(Boolean)

  return Array.from(new Set(urls))
}

function getImageUrlFromSliderBox(imgBox: HTMLElement): string {
  const img = imgBox.querySelector<HTMLImageElement>('img')
  const src = normalizeImageUrl(
    img?.currentSrc
    || img?.src
    || img?.getAttribute('data-src')
    || img?.getAttribute('data-original'),
  )
  if (src) return src

  const slide = imgBox.closest<HTMLElement>('.swiper-slide')
  const backgroundImages = [
    imgBox.style.backgroundImage,
    getComputedStyle(imgBox).backgroundImage,
    slide?.style.backgroundImage,
    slide ? getComputedStyle(slide).backgroundImage : '',
  ]

  for (const backgroundImage of backgroundImages) {
    const url = parseBackgroundImageUrl(backgroundImage ?? '')
    if (url) return url
  }

  return ''
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
    /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/,
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
      margin-left: 8px;
      height: 40px;
      padding: 0 18px;
      border: none;
      border-radius: 999px;
      background: #111;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      line-height: 40px;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.16s ease, transform 0.16s ease, background 0.16s ease;
    }

    .redcopy-export-note-btn:hover {
      background: #222;
    }

    .redcopy-export-note-btn:active {
      transform: scale(0.98);
    }

    .redcopy-export-note-btn:disabled {
      cursor: default;
      opacity: 0.7;
      transform: none;
    }

    .redcopy-download-image-btn {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 999999;
      width: 36px;
      height: 36px;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.62);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity 0.16s ease, transform 0.16s ease, background 0.16s ease;
      pointer-events: auto;
    }

    .redcopy-download-image-btn svg {
      width: 18px;
      height: 18px;
      display: block;
    }

    .redcopy-download-image-btn:hover {
      background: rgba(0, 0, 0, 0.78);
    }

    .redcopy-download-image-btn:disabled {
      cursor: default;
      opacity: 0.72;
    }

    .redcopy-image-download-host:hover .redcopy-download-image-btn,
    .note-slider-img:hover .redcopy-download-image-btn,
    .img-container:hover .redcopy-download-image-btn {
      opacity: 1;
      transform: translateY(0);
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
