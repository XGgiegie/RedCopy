import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isXhsNoteUrl } from '../../shared/extract-note'
import {
  DOWNLOAD_NOTE_MEDIA_MESSAGE,
  EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE,
  INJECT_DETAIL_EXPORT_BUTTON_MESSAGE,
  type InjectDetailExportButtonResponse,
} from '../../shared/messages'

/** 当前标签页相对小红书的状态层级 */
export type PageStatusLevel = 'ready' | 'warn' | 'idle'

const DIRECT_INJECTION_TIMEOUT_MS = 3000

function injectXhsInlineExportButtonFromSidepanel(
  exportMessageType: string,
  mediaMessageType: string,
  sourceTabId: number,
) {
  const BUTTON_SELECTOR = '[data-redcopy-export-note-btn="true"]'
  const MEDIA_BUTTON_SELECTOR = '[data-redcopy-download-media-btn="true"]'
  const FLOATING_SELECTOR = '.redcopy-export-note-floating'
  const STYLE_ID = 'redcopy-xhs-inline-export-style'
  const NOTE_URL_RE = /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/[a-zA-Z0-9]+/
  const EXPORT_LABEL = '\u5bfc\u51fa\u7b14\u8bb0'
  const EXPORT_BUSY_LABEL = '\u5bfc\u51fa\u4e2d...'
  const EXPORT_FAILED_LABEL = '\u5bfc\u51fa\u5931\u8d25'
  const DOWNLOAD_STARTED_LABEL = '\u5df2\u5f00\u59cb\u4e0b\u8f7d'
  const DOWNLOAD_IMAGE_LABEL = '\u4e0b\u8f7d\u56fe\u7247'
  const DOWNLOAD_VIDEO_LABEL = '\u4e0b\u8f7d\u89c6\u9891'
  const DOWNLOAD_BUSY_LABEL = '\u4e0b\u8f7d\u4e2d...'
  const DOWNLOAD_FAILED_LABEL = '\u4e0b\u8f7d\u5931\u8d25'
  const MEDIA_MISSING_LABEL = '\u672a\u627e\u5230\u5a92\u4f53'

  if (!NOTE_URL_RE.test(location.href)) {
    document.querySelectorAll<HTMLElement>(BUTTON_SELECTOR).forEach((el) => el.remove())
    document.querySelectorAll<HTMLElement>(MEDIA_BUTTON_SELECTOR).forEach((el) => el.remove())
    document.querySelectorAll<HTMLElement>(FLOATING_SELECTOR).forEach((el) => el.remove())
    return { ok: false, reason: 'not_note_url', url: location.href }
  }

  document.querySelectorAll<HTMLElement>(FLOATING_SELECTOR).forEach((el) => el.remove())

  function findAuthorWrapper(): HTMLElement | null {
    const selectors = [
      '.interaction-container > .author-container > .author-wrapper',
      '.interaction-container .author-container .author-wrapper',
      '.author-container > .author-wrapper',
      '.author-container .author-wrapper',
    ]

    for (const selector of selectors) {
      const target = document.querySelector<HTMLElement>(selector)
      if (target?.querySelector('.note-detail-follow-btn')) return target
    }

    return null
  }

  function findMountPoint(): HTMLElement | null {
    const authorWrapper = findAuthorWrapper()
    if (authorWrapper) return authorWrapper

    const selectors = [
      '.author-container .author-wrapper .note-detail-follow-btn',
      '.author-wrapper .note-detail-follow-btn',
      '.author-container .note-detail-follow-btn',
      '.note-detail-follow-btn',
    ]
    for (const selector of selectors) {
      const target = document.querySelector<HTMLElement>(selector)
      if (target) return target
    }

    const followTextTarget = [...document.querySelectorAll<HTMLElement>('button, div, span')]
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

  const mountPoint = findMountPoint()
  const existingExportButton = document.querySelector<HTMLButtonElement>(BUTTON_SELECTOR)
  if (!mountPoint && !existingExportButton) {
    return { ok: false, reason: 'mount_not_found', url: location.href }
  }

  if (!document.querySelector(`#${STYLE_ID}`)) {
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
    `
    document.documentElement.appendChild(style)
  }

  function insertAuthorButton(button: HTMLButtonElement, after?: Element | null): boolean {
    const authorWrapper = findAuthorWrapper()
    if (after?.parentElement) {
      after.insertAdjacentElement('afterend', button)
      return true
    }

    if (authorWrapper) {
      authorWrapper.appendChild(button)
      return true
    }

    if (mountPoint) {
      mountPoint.insertAdjacentElement('afterend', button)
      return true
    }

    return false
  }

  function stopEvent(event: Event) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  function normalizeUrl(value: unknown): string {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim().replace(/&amp;/g, '&')
    if (!trimmed || trimmed.startsWith('data:')) return ''
    if (trimmed.startsWith('//')) return `${location.protocol === 'http:' ? 'http:' : 'https:'}${trimmed}`

    try {
      const url = new URL(trimmed, location.href)
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
    } catch {
      return ''
    }

    return ''
  }

  function hasVideoSignal(): boolean {
    return Boolean(
      document.querySelector('.media-container.video-player-media, .player-container video, .xgplayer video, video'),
    )
  }

  function findImageUrl(): string {
    const images = [
      ...document.querySelectorAll<HTMLImageElement>(
        '.media-container img, .note-slider img, .swiper-slide img, .note-slider-img img, .img-container img',
      ),
    ]
      .filter((img) => !img.closest('.comments-el, .avatar, .avatar-container, .comment-picture, .note-content-emoji'))
      .map((img) => ({
        url: normalizeUrl(
          img.currentSrc
          || img.src
          || img.getAttribute('data-src')
          || img.getAttribute('data-original'),
        ),
        size: (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0),
      }))
      .filter((item) => item.url && !/avatar|icon|emoji|comment/i.test(item.url))
      .sort((a, b) => b.size - a.size)

    return images[0]?.url ?? ''
  }

  function getCurrentMedia(): { url: string; mediaType: 'image' | 'video' } {
    if (hasVideoSignal()) {
      return {
        url: 'blob:redcopy-unresolved-video',
        mediaType: 'video',
      }
    }

    return {
      url: findImageUrl(),
      mediaType: 'image',
    }
  }

  function updateMediaButtonState(button: HTMLButtonElement) {
    const media = getCurrentMedia()
    const label = media.mediaType === 'video' ? DOWNLOAD_VIDEO_LABEL : DOWNLOAD_IMAGE_LABEL
    button.textContent = label
    button.title = label
    button.setAttribute('aria-label', label)
    button.dataset.redcopyMediaType = media.mediaType
    if (media.url) {
      button.dataset.redcopyMediaUrl = media.url
    } else {
      delete button.dataset.redcopyMediaUrl
    }
  }

  let exportButton = existingExportButton
  let exportInjected = false

  if (!exportButton) {
    exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'redcopy-export-note-btn'
    exportButton.textContent = EXPORT_LABEL
    exportButton.dataset.redcopyExportNoteBtn = 'true'

    function setExportBusy(busy: boolean) {
      if (!exportButton) return
      exportButton.disabled = busy
      exportButton.textContent = busy ? EXPORT_BUSY_LABEL : EXPORT_LABEL
    }

    exportButton.addEventListener('pointerdown', stopEvent)
    exportButton.addEventListener('mousedown', stopEvent)
    exportButton.addEventListener('click', (event) => {
      stopEvent(event)

      if (!exportButton || exportButton.disabled) return
      setExportBusy(true)
      chrome.runtime.sendMessage(
        { type: exportMessageType, tabId: sourceTabId },
        (response?: { ok?: boolean; error?: string }) => {
          const err = chrome.runtime.lastError?.message
          if (err || !response?.ok) {
            if (exportButton) exportButton.textContent = EXPORT_FAILED_LABEL
            setTimeout(() => setExportBusy(false), 1400)
            return
          }

          if (exportButton) exportButton.textContent = DOWNLOAD_STARTED_LABEL
          setTimeout(() => setExportBusy(false), 1400)
        },
      )
    })

    if (!insertAuthorButton(exportButton)) {
      return { ok: false, reason: 'mount_not_found', url: location.href }
    }
    exportInjected = true
  }

  let mediaButton = document.querySelector<HTMLButtonElement>(MEDIA_BUTTON_SELECTOR)
  let mediaInjected = false

  if (!mediaButton) {
    mediaButton = document.createElement('button')
    mediaButton.type = 'button'
    mediaButton.className = 'redcopy-export-note-btn redcopy-download-note-media-btn'
    mediaButton.dataset.redcopyDownloadMediaBtn = 'true'
    updateMediaButtonState(mediaButton)

    function setMediaBusy(busy: boolean) {
      if (!mediaButton) return
      mediaButton.disabled = busy
      if (busy) {
        mediaButton.textContent = DOWNLOAD_BUSY_LABEL
      } else {
        updateMediaButtonState(mediaButton)
      }
    }

    mediaButton.addEventListener('pointerdown', stopEvent)
    mediaButton.addEventListener('mousedown', stopEvent)
    mediaButton.addEventListener('click', (event) => {
      stopEvent(event)

      if (!mediaButton || mediaButton.disabled) return

      const media = getCurrentMedia()
      if (!media.url) {
        mediaButton.textContent = MEDIA_MISSING_LABEL
        setTimeout(() => updateMediaButtonState(mediaButton as HTMLButtonElement), 1400)
        return
      }

      setMediaBusy(true)
      chrome.runtime.sendMessage(
        {
          type: mediaMessageType,
          tabId: sourceTabId,
          url: media.url,
          index: 0,
          mediaType: media.mediaType,
          context: {
            title: document.querySelector<HTMLElement>('#detail-title')?.innerText?.trim() ?? '',
            noteId: location.href.match(
              /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9]+)/,
            )?.[1] ?? null,
          },
        },
        (response?: { ok?: boolean; error?: string }) => {
          const err = chrome.runtime.lastError?.message
          if (err || !response?.ok) {
            if (mediaButton) mediaButton.textContent = DOWNLOAD_FAILED_LABEL
            setTimeout(() => setMediaBusy(false), 1400)
            return
          }

          if (mediaButton) mediaButton.textContent = DOWNLOAD_STARTED_LABEL
          setTimeout(() => setMediaBusy(false), 1400)
        },
      )
    })

    if (!insertAuthorButton(mediaButton, exportButton)) {
      return { ok: false, reason: 'mount_not_found', url: location.href }
    }
    mediaInjected = true
  } else {
    updateMediaButtonState(mediaButton)
    insertAuthorButton(mediaButton, exportButton)
  }

  return {
    ok: true,
    exportInjected,
    mediaInjected,
    existed: !exportInjected && !mediaInjected,
    source: 'sidepanel_direct',
    url: location.href,
  }
}

/**
 * 集中检测「当前激活标签页是否为小红书笔记详情页」。
 * 提升为全局 store，便于标题栏状态标签与列表页提取按钮共享同一份状态。
 */
export const usePageStatusStore = defineStore('pageStatus', () => {
  const isXhsPage = ref(false)
  const isNotePage = ref(false)
  let watchingTabId: number | undefined
  let started = false
  let lastInjectionKey = ''

  /** 标题栏页面标签层级 */
  const tagLevel = computed<PageStatusLevel>(() => {
    if (isXhsPage.value) return 'ready'
    return 'idle'
  })

  /** 标题栏页面标签短文案 */
  const tagLabel = computed(() => (isXhsPage.value ? '小红书' : '未在小红书'))

  /** 标题栏页面标签悬停说明 */
  const tagTooltip = computed(() => {
    if (!isXhsPage.value) return '点击打开小红书网站'
    if (isNotePage.value) return '当前在笔记详情页，可直接提取'
    return '当前在小红书站内，进入笔记详情页后可提取'
  })

  /** 未在小红书时，标签可点击跳转 */
  const tagClickable = computed(() => !isXhsPage.value)

  async function injectDetailExportButtonDirect(tabId: number) {
    if (!chrome.scripting?.executeScript) {
      throw new Error('chrome.scripting 不可用')
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: injectXhsInlineExportButtonFromSidepanel,
      args: [EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE, DOWNLOAD_NOTE_MEDIA_MESSAGE, tabId],
    })

    return result?.result
  }

  function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error(`${label} 超时 ${ms}ms`))
      }, ms)

      promise
        .then((value) => {
          window.clearTimeout(timer)
          resolve(value)
        })
        .catch((error: unknown) => {
          window.clearTimeout(timer)
          reject(error)
        })
    })
  }

  function getInlineInjectionFailureReason(result: unknown): string | null {
    if (!result) return 'no_result'
    if (typeof result !== 'object') return null

    const record = result as Record<string, unknown>
    if (record.ok !== false) return null

    if (typeof record.reason === 'string') return record.reason
    if (typeof record.error === 'string') return record.error
    return 'inline_injection_failed'
  }

  function requestBackgroundDetailExportButtonInjection(
    tabId: number,
    url: string,
  ) {
    chrome.runtime.sendMessage(
      {
        type: INJECT_DETAIL_EXPORT_BUTTON_MESSAGE,
        tabId,
      },
      (response?: InjectDetailExportButtonResponse) => {
        const err = chrome.runtime.lastError?.message
        if (err || !response?.ok) {
          console.warn('[RedCopy] 后台兜底注入详情页作者栏按钮失败', {
            tabId,
            url: url.slice(0, 100),
            error: err ?? response?.error ?? '无响应',
          })
          return
        }

        console.info('[RedCopy] 后台兜底注入详情页作者栏按钮完成', {
          tabId,
          url: url.slice(0, 100),
          result: response.result,
        })
      },
    )
  }

  function requestDetailExportButtonInjection(tabId: number, url: string) {
    const key = `${tabId}:${url}`
    if (lastInjectionKey === key) return
    lastInjectionKey = key

    void withTimeout(
      injectDetailExportButtonDirect(tabId),
      DIRECT_INJECTION_TIMEOUT_MS,
      '侧栏直接注入详情页作者栏按钮',
    )
      .then((result) => {
        const failureReason = getInlineInjectionFailureReason(result)
        if (failureReason) throw new Error(failureReason)

        console.info('[RedCopy] 侧栏直接注入详情页作者栏按钮完成', {
          tabId,
          url: url.slice(0, 100),
          result,
        })
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error)
        console.warn('[RedCopy] 侧栏直接注入详情页作者栏按钮失败', {
          tabId,
          url: url.slice(0, 100),
          error: detail,
        })

        requestBackgroundDetailExportButtonInjection(tabId, url)
        window.setTimeout(() => {
          void withTimeout(
            injectDetailExportButtonDirect(tabId),
            DIRECT_INJECTION_TIMEOUT_MS,
            '侧栏二次直接注入详情页作者栏按钮',
          )
            .then((result) => {
              const failureReason = getInlineInjectionFailureReason(result)
              if (failureReason) throw new Error(failureReason)

              console.info('[RedCopy] 侧栏二次直接注入详情页作者栏按钮完成', {
                tabId,
                url: url.slice(0, 100),
                result,
              })
            })
            .catch((retryError: unknown) => {
              const retryDetail = retryError instanceof Error
                ? retryError.message
                : String(retryError)
              lastInjectionKey = ''
              console.warn('[RedCopy] 侧栏二次直接注入详情页作者栏按钮失败', {
                tabId,
                url: url.slice(0, 100),
                error: retryDetail,
              })
            })
        }, 800)
      })
  }

  function applyPageUrl(url: string, tabId = watchingTabId) {
    isXhsPage.value = /xiaohongshu\.com/.test(url)
    isNotePage.value = isXhsNoteUrl(url)
    console.info('[RedCopy] 页面状态更新', {
      url: url.slice(0, 100),
      isXhsPage: isXhsPage.value,
      isNotePage: isNotePage.value,
    })

    if (tabId != null && isNotePage.value) {
      requestDetailExportButtonInjection(tabId, url)
    }
  }

  async function syncActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    watchingTabId = tab?.id
    applyPageUrl(tab?.url ?? '', tab?.id)
  }

  const onTabActivated: Parameters<
    typeof chrome.tabs.onActivated.addListener
  >[0] = (activeInfo) => {
    void (async () => {
      const tab = await chrome.tabs.get(activeInfo.tabId)
      watchingTabId = tab.id
      applyPageUrl(tab.url ?? '', tab.id)
    })()
  }

  const onTabUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
    tabId,
    changeInfo,
    tab,
  ) => {
    if (!changeInfo.url && changeInfo.status !== 'complete') return
    if (watchingTabId !== tabId) return
    applyPageUrl(changeInfo.url ?? tab.url ?? '', tabId)
  }

  const onHistoryStateUpdated: Parameters<
    typeof chrome.webNavigation.onHistoryStateUpdated.addListener
  >[0] = (details) => {
    if (watchingTabId !== details.tabId) return
    applyPageUrl(details.url, details.tabId)
  }

  /** 启动监听（幂等）。建议在常驻的 App 根组件挂载时调用。 */
  function start() {
    if (started) return
    started = true
    void syncActiveTab()
    chrome.tabs.onActivated.addListener(onTabActivated)
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated, {
      url: [{ hostSuffix: 'xiaohongshu.com' }],
    })
  }

  function stop() {
    if (!started) return
    started = false
    chrome.tabs.onActivated.removeListener(onTabActivated)
    chrome.tabs.onUpdated.removeListener(onTabUpdated)
    chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated)
  }

  return {
    isXhsPage,
    isNotePage,
    level: tagLevel,
    label: tagLabel,
    tagLevel,
    tagLabel,
    tagTooltip,
    tagClickable,
    start,
    stop,
    syncActiveTab,
  }
})
