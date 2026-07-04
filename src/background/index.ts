import { injectExtractNote, isXhsNoteUrl } from '../shared/extract-note'
import { logExtractContentJson } from '../shared/extract-log'
import { formatNoteAsMarkdown } from '../shared/export-markdown'
import {
  BACKGROUND_KEEPALIVE_MESSAGE,
  GET_ANALYZE_GENERATE_TASK_STATUSES_MESSAGE,
  GET_ANALYZE_GENERATE_TASK_STATUS_MESSAGE,
  GET_AUTO_COLLECT_TASK_STATUS_MESSAGE,
  GET_GROWTH_ACQUIRE_TASK_STATUS_MESSAGE,
  DOWNLOAD_NOTE_IMAGE_MESSAGE,
  DOWNLOAD_NOTE_MEDIA_MESSAGE,
  EXTRACT_NOTE_MESSAGE,
  EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE,
  IMAGE_TO_DATA_URL_MESSAGE,
  INJECT_DETAIL_EXPORT_BUTTON_MESSAGE,
  START_ANALYZE_GENERATE_TASK_MESSAGE,
  START_AUTO_COLLECT_TASK_MESSAGE,
  START_GROWTH_ACQUIRE_TASK_MESSAGE,
  STORAGE_GET_MESSAGE,
  STORAGE_REMOVE_MESSAGE,
  STORAGE_SET_MESSAGE,
  STOP_AUTO_COLLECT_TASK_MESSAGE,
  STOP_GROWTH_ACQUIRE_TASK_MESSAGE,
  type AnalyzeGenerateTaskResponse,
  type AnalyzeGenerateTaskStatus,
  type AnalyzeGenerateTaskStatusesResponse,
  type AnalyzeGenerateMode,
  type AutoCollectTaskResponse,
  type BackgroundTaskStatus,
  type DownloadNoteImageRequest,
  type DownloadNoteImageResponse,
  type DownloadNoteMediaRequest,
  type DownloadNoteMediaResponse,
  type ExtractNoteResponse,
  type ExportCurrentNoteMarkdownResponse,
  type ImageToDataUrlResponse,
  type InjectDetailExportButtonResponse,
  type GrowthAcquireTaskResponse,
  type StorageGetResponse,
  type StorageRemoveResponse,
  type StorageSetResponse,
} from '../shared/messages'
import { downloadNoteImage, downloadNoteMedia, downloadTextFile } from '../shared/note-media'
import type { NoteExtractResult } from '../shared/note-types'
import { migratePlainStorageToEncrypted } from '../shared/storage'
import { isProPlan, loadAiSettings } from '../shared/ai-settings'
import { resolveAnalysisImageDataUrls } from '../shared/analysis-image'
import { requestNoteAnalysis } from '../shared/analyze-note'
import type { CreationPurposeKey } from '../shared/creation-intent'
import {
  requestDoubaoDirectGenerate,
  requestDoubaoGenerate,
} from '../shared/doubao-generate'
import { normalizeGeneratedDraft } from '../shared/parse-generated-draft'
import {
  requestProDirectGenerate,
  requestProGenerate,
} from '../shared/pro-generate'
import { getTask, updateTask } from '../shared/task-db'
import type {
  AutoCollectConfig,
  AutoCollectProgress,
  AutoCollectResult,
} from '../shared/auto-collect'
import type {
  GrowthAcquireConfig,
  GrowthAcquireProgress,
  GrowthAcquireResult,
} from '../shared/growth-acquire'
import {
  AutoCollectCancelledError,
  runAutoCollect,
} from '../popup/services/auto-collect-runner'
import {
  GrowthAcquireCancelledError,
  runGrowthAcquire,
} from '../popup/services/growth-acquire-runner'

console.info('[RedCopy] background ready')

const XHS_HOST_FILTER: chrome.events.UrlFilter[] = [
  { hostSuffix: 'xiaohongshu.com' },
]
const FALLBACK_INJECT_DELAY_MS = 600
const VIDEO_REQUEST_CACHE_TTL_MS = 10 * 60 * 1000
const VIDEO_REQUEST_CACHE_LIMIT = 30

interface CapturedVideoRequest {
  url: string
  tabId: number
  time: number
  initiator?: string
  type?: string
}

const capturedVideoRequestsByTab = new Map<number, CapturedVideoRequest[]>()
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html'
let isEnsuringOffscreen = false

function hasRunningBackgroundTask(): boolean {
  return (
    autoCollectTask.running ||
    growthAcquireTask.running ||
    [...analyzeGenerateTasks.values()].some((task) => task.running)
  )
}

async function hasOffscreenDocument(): Promise<boolean> {
  if (!chrome.offscreen?.hasDocument) return false
  return chrome.offscreen.hasDocument()
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument || isEnsuringOffscreen) return
  if (await hasOffscreenDocument()) return

  isEnsuringOffscreen = true
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Keep long-running user-started collection tasks alive after the side panel closes.',
    })
    console.info('[RedCopy] 后台保活文档已创建')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (!detail.includes('Only a single offscreen document')) {
      console.warn('[RedCopy] 创建后台保活文档失败', detail, error)
    }
  } finally {
    isEnsuringOffscreen = false
  }
}

async function closeOffscreenDocumentIfIdle() {
  if (hasRunningBackgroundTask()) return
  if (!chrome.offscreen?.closeDocument) return
  if (!(await hasOffscreenDocument())) return

  try {
    await chrome.offscreen.closeDocument()
    console.info('[RedCopy] 后台保活文档已关闭')
  } catch (error) {
    console.warn('[RedCopy] 关闭后台保活文档失败', error)
  }
}

function createIdleTaskStatus<TProgress, TResult>():
  BackgroundTaskStatus<TProgress, TResult> {
  return {
    running: false,
    cancelled: false,
    progress: null,
    result: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  }
}

const autoCollectTask =
  createIdleTaskStatus<AutoCollectProgress, AutoCollectResult>()
const growthAcquireTask =
  createIdleTaskStatus<GrowthAcquireProgress, GrowthAcquireResult>()
const analyzeGenerateTasks = new Map<string, AnalyzeGenerateTaskStatus>()

function cloneTaskStatus<TProgress, TResult>(
  status: BackgroundTaskStatus<TProgress, TResult>,
): BackgroundTaskStatus<TProgress, TResult> {
  return { ...status }
}

function beginTask<TProgress, TResult>(
  status: BackgroundTaskStatus<TProgress, TResult>,
) {
  status.running = true
  status.cancelled = false
  status.result = null
  status.error = null
  status.startedAt = Date.now()
  status.finishedAt = null
}

function finishTask<TProgress, TResult>(
  status: BackgroundTaskStatus<TProgress, TResult>,
  result: TResult,
) {
  status.running = false
  status.result = result
  status.error = null
  status.finishedAt = Date.now()
}

function failTask<TProgress, TResult>(
  status: BackgroundTaskStatus<TProgress, TResult>,
  error: unknown,
) {
  const detail = error instanceof Error ? error.message : String(error)
  status.running = false
  status.error = detail
  status.finishedAt = Date.now()
}

function startAutoCollectTask(
  config: AutoCollectConfig,
): AutoCollectTaskResponse {
  if (autoCollectTask.running) {
    return { ok: false, error: '自动采集正在运行中' }
  }

  beginTask(autoCollectTask)
  void ensureOffscreenDocument()
  autoCollectTask.progress = {
    phase: 'navigating',
    message: '准备开始…',
    scanned: 0,
    extracted: 0,
    skipped: 0,
  }

  void runAutoCollect(config, {
    onProgress: (progress) => {
      autoCollectTask.progress = progress
    },
    isCancelled: () => autoCollectTask.cancelled,
  })
    .then((result) => {
      finishTask(autoCollectTask, result)
      void closeOffscreenDocumentIfIdle()
    })
    .catch((error: unknown) => {
      if (error instanceof AutoCollectCancelledError) {
        finishTask(autoCollectTask, {
          extracted: autoCollectTask.progress?.extracted ?? 0,
          skipped: autoCollectTask.progress?.skipped ?? 0,
          scanned: autoCollectTask.progress?.scanned ?? 0,
        })
        void closeOffscreenDocumentIfIdle()
        return
      }
      console.error('[RedCopy] 后台自动采集失败', error)
      failTask(autoCollectTask, error)
      autoCollectTask.progress = {
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
        scanned: autoCollectTask.progress?.scanned ?? 0,
        extracted: autoCollectTask.progress?.extracted ?? 0,
        skipped: autoCollectTask.progress?.skipped ?? 0,
      }
      void closeOffscreenDocumentIfIdle()
    })

  return {
    ok: true,
    status: cloneTaskStatus(autoCollectTask),
  }
}

function stopAutoCollectTask(): AutoCollectTaskResponse {
  if (autoCollectTask.running) {
    autoCollectTask.cancelled = true
    autoCollectTask.progress = {
      phase: 'cancelled',
      message: '正在取消…',
      scanned: autoCollectTask.progress?.scanned ?? 0,
      extracted: autoCollectTask.progress?.extracted ?? 0,
      skipped: autoCollectTask.progress?.skipped ?? 0,
    }
  }
  return { ok: true, status: cloneTaskStatus(autoCollectTask) }
}

function startGrowthAcquireTask(
  config: GrowthAcquireConfig,
): GrowthAcquireTaskResponse {
  if (growthAcquireTask.running) {
    return { ok: false, error: '自动垂直养号正在运行中' }
  }

  beginTask(growthAcquireTask)
  void ensureOffscreenDocument()
  growthAcquireTask.progress = {
    phase: 'navigating',
    message: '准备开始…',
    scanned: 0,
    skipped: 0,
    replied: 0,
    commented: 0,
    aiUsed: 0,
    remainingSec: Math.min(Math.max(config.durationMinutes || 30, 1), 480) * 60,
  }

  void runGrowthAcquire(config, {
    onProgress: (progress) => {
      growthAcquireTask.progress = progress
    },
    isCancelled: () => growthAcquireTask.cancelled,
  })
    .then((result) => {
      finishTask(growthAcquireTask, result)
      void closeOffscreenDocumentIfIdle()
    })
    .catch((error: unknown) => {
      if (error instanceof GrowthAcquireCancelledError) {
        finishTask(growthAcquireTask, {
          skipped: growthAcquireTask.progress?.skipped ?? 0,
          scanned: growthAcquireTask.progress?.scanned ?? 0,
          replied: growthAcquireTask.progress?.replied ?? 0,
          commented: growthAcquireTask.progress?.commented ?? 0,
          ranMs:
            growthAcquireTask.startedAt == null
              ? 0
              : Date.now() - growthAcquireTask.startedAt,
        })
        void closeOffscreenDocumentIfIdle()
        return
      }
      console.error('[RedCopy] 后台自动垂直养号失败', error)
      failTask(growthAcquireTask, error)
      growthAcquireTask.progress = {
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
        scanned: growthAcquireTask.progress?.scanned ?? 0,
        skipped: growthAcquireTask.progress?.skipped ?? 0,
        replied: growthAcquireTask.progress?.replied ?? 0,
        commented: growthAcquireTask.progress?.commented ?? 0,
        aiUsed: growthAcquireTask.progress?.aiUsed ?? 0,
        aiUnlimited: growthAcquireTask.progress?.aiUnlimited,
        remainingSec: growthAcquireTask.progress?.remainingSec ?? 0,
      }
      void closeOffscreenDocumentIfIdle()
    })

  return {
    ok: true,
    status: cloneTaskStatus(growthAcquireTask),
  }
}

function stopGrowthAcquireTask(): GrowthAcquireTaskResponse {
  if (growthAcquireTask.running) {
    growthAcquireTask.cancelled = true
    growthAcquireTask.progress = {
      phase: 'cancelled',
      message: '正在停止…',
      scanned: growthAcquireTask.progress?.scanned ?? 0,
      skipped: growthAcquireTask.progress?.skipped ?? 0,
      replied: growthAcquireTask.progress?.replied ?? 0,
      commented: growthAcquireTask.progress?.commented ?? 0,
      aiUsed: growthAcquireTask.progress?.aiUsed ?? 0,
      aiUnlimited: growthAcquireTask.progress?.aiUnlimited,
      remainingSec: growthAcquireTask.progress?.remainingSec ?? 0,
    }
  }
  return { ok: true, status: cloneTaskStatus(growthAcquireTask) }
}

function getAnalyzeGenerateTaskStatus(taskId: string): AnalyzeGenerateTaskStatus {
  return analyzeGenerateTasks.get(taskId) ?? createIdleTaskStatus()
}

function setAnalyzeGenerateProgress(
  status: AnalyzeGenerateTaskStatus,
  taskId: string,
  phase: NonNullable<AnalyzeGenerateTaskStatus['progress']>['phase'],
  message: string,
  mode?: AnalyzeGenerateMode,
) {
  status.progress = { taskId, phase, message, mode }
}

function cloneAnalyzeGenerateStatuses():
  Record<string, AnalyzeGenerateTaskStatus> {
  return Object.fromEntries(
    [...analyzeGenerateTasks.entries()].map(([taskId, status]) => [
      taskId,
      cloneTaskStatus(status),
    ]),
  )
}

async function runAnalyzeGenerateTask(payload: {
  taskId: string
  mode?: AnalyzeGenerateMode
  purpose?: CreationPurposeKey
  topic?: string
  imageUrls?: string[]
}) {
  const { taskId, purpose, topic = '', imageUrls, mode = 'note_analysis' } = payload
  const status = analyzeGenerateTasks.get(taskId)
  if (!status) return

  try {
    const task = await getTask(taskId)
    if (!task) throw new Error('任务已不存在')

    const settings = await loadAiSettings()
    if (mode === 'direct') {
      const trimmedTopic = topic.trim()
      if (!purpose) throw new Error('请先选择创作目的')
      if (!trimmedTopic) throw new Error('请先填写明确主题或卖点')

      setAnalyzeGenerateProgress(status, taskId, 'generating', '正在直接创作…', mode)
      const draft = isProPlan(settings)
        ? await requestProDirectGenerate({ purpose, topic: trimmedTopic }, settings)
        : await requestDoubaoDirectGenerate({ purpose, topic: trimmedTopic }, settings)
      const normalized = normalizeGeneratedDraft(draft)
      const generatedAt = Date.now()

      const generated = await updateTask(taskId, {
        draft: normalized,
        generatedAt,
        generatePurpose: purpose,
        generateTopic: trimmedTopic,
      })
      if (!generated) throw new Error('任务已不存在')

      setAnalyzeGenerateProgress(status, taskId, 'complete', '创作已完成', mode)
      finishTask(status, {
        taskId,
        draft: normalized,
        generatedAt,
      })
      return
    }

    if (!task.note) throw new Error('当前任务无笔记内容')

    const analysisImageUrls = await resolveAnalysisImageDataUrls(imageUrls)
    setAnalyzeGenerateProgress(
      status,
      taskId,
      'analyzing',
      analysisImageUrls?.length ? '正在理解笔记和配图…' : '正在理解笔记结构…',
      mode,
    )
    const analysis = await requestNoteAnalysis(
      {
        noteId: task.noteId,
        url: task.url,
        text: task.note,
        imageUrls: analysisImageUrls,
      },
      settings,
    )

    const analyzed = await updateTask(taskId, {
      analysis,
      analyzedAt: Date.now(),
    })
    if (!analyzed) throw new Error('任务已不存在')

    setAnalyzeGenerateProgress(status, taskId, 'generating', '正在生成创作草稿…', mode)
    const draft = isProPlan(settings)
      ? await requestProGenerate(
          {
            noteId: analyzed.noteId,
            url: analyzed.url,
            text: analyzed.note,
            analysis,
            purpose,
            topic,
          },
          settings,
        )
      : await requestDoubaoGenerate(
          {
            noteId: analyzed.noteId,
            url: analyzed.url,
            text: analyzed.note,
            analysis,
            purpose,
            topic,
          },
          settings,
        )
    const normalized = normalizeGeneratedDraft(draft)
    const generatedAt = Date.now()

    const generated = await updateTask(taskId, {
      draft: normalized,
      generatedAt,
      generatePurpose: purpose ?? null,
      generateTopic: topic,
    })
    if (!generated) throw new Error('任务已不存在')

    setAnalyzeGenerateProgress(status, taskId, 'complete', '创作草稿已生成', mode)
    finishTask(status, {
      taskId,
      draft: normalized,
      generatedAt,
    })
  } catch (error) {
    console.error('[RedCopy] 后台创作任务失败', { taskId, mode }, error)
    failTask(status, error)
    setAnalyzeGenerateProgress(
      status,
      taskId,
      'error',
      error instanceof Error ? error.message : String(error),
      mode,
    )
  } finally {
    void closeOffscreenDocumentIfIdle()
  }
}

async function startAnalyzeGenerateTask(payload: {
  taskId: string
  mode?: AnalyzeGenerateMode
  purpose?: CreationPurposeKey
  topic?: string
  imageUrls?: string[]
}): Promise<AnalyzeGenerateTaskResponse> {
  const taskId = payload.taskId.trim()
  const mode = payload.mode ?? 'note_analysis'
  if (!taskId) return { ok: false, error: '缺少任务 id' }

  const current = analyzeGenerateTasks.get(taskId)
  if (current?.running) {
    return { ok: false, error: '创作任务正在运行中' }
  }

  const task = await getTask(taskId)
  if (!task) return { ok: false, error: '任务已不存在' }

  const status = createIdleTaskStatus<
    NonNullable<AnalyzeGenerateTaskStatus['progress']>,
    NonNullable<AnalyzeGenerateTaskStatus['result']>
  >()
  beginTask(status)
  setAnalyzeGenerateProgress(
    status,
    taskId,
    mode === 'direct' ? 'generating' : 'analyzing',
    '准备开始…',
    mode,
  )
  analyzeGenerateTasks.set(taskId, status)
  void ensureOffscreenDocument()
  void runAnalyzeGenerateTask({ ...payload, taskId, mode })

  return { ok: true, status: cloneTaskStatus(status) }
}

void migratePlainStorageToEncrypted().catch((error: unknown) => {
  console.error('[RedCopy] 启动时存储加密迁移失败', error)
})

chrome.runtime.onInstalled.addListener(() => {
  void migratePlainStorageToEncrypted().catch((error: unknown) => {
    console.error('[RedCopy] 安装后存储加密迁移失败', error)
  })
})

// 点击扩展图标时从浏览器右侧打开侧栏，而非悬浮 Popup
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error('[RedCopy] 侧栏行为配置失败', error)
  })

function injectXhsInlineExportButtonFallback(
  exportMessageType: string,
  mediaMessageType: string,
  sourceTabId: number,
) {
  const BUTTON_SELECTOR = '[data-redcopy-export-note-btn="true"]'
  const MEDIA_BUTTON_SELECTOR = '[data-redcopy-download-media-btn="true"]'
  const FLOATING_SELECTOR = '.redcopy-export-note-floating'
  const STYLE_ID = 'redcopy-xhs-inline-export-style'
  const NOTE_URL_RE = /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/[a-zA-Z0-9]+/

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
  if (!mountPoint) return { ok: false, reason: 'mount_not_found', url: location.href }
  const fallbackMountPoint = mountPoint

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

  function insertAuthorButton(button: HTMLButtonElement, after?: Element | null) {
    const authorWrapper = findAuthorWrapper()
    if (after?.parentElement) {
      after.insertAdjacentElement('afterend', button)
      return
    }

    if (authorWrapper) {
      authorWrapper.appendChild(button)
      return
    }

    fallbackMountPoint.insertAdjacentElement('afterend', button)
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

  function updateMediaButtonText(button: HTMLButtonElement) {
    button.textContent = hasVideoSignal() ? '下载视频' : '下载图片'
  }

  let exportButton = document.querySelector<HTMLButtonElement>(BUTTON_SELECTOR)
  let exportInjected = false

  if (!exportButton) {
    exportButton = document.createElement('button')
    exportButton.type = 'button'
    exportButton.className = 'redcopy-export-note-btn'
    exportButton.textContent = '导出笔记'
    exportButton.dataset.redcopyExportNoteBtn = 'true'

    function setExportBusy(busy: boolean) {
      if (!exportButton) return
      exportButton.disabled = busy
      exportButton.textContent = busy ? '导出中...' : '导出笔记'
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
            if (exportButton) exportButton.textContent = '导出失败'
            setTimeout(() => setExportBusy(false), 1400)
            return
          }

          if (exportButton) exportButton.textContent = '已开始下载'
          setTimeout(() => setExportBusy(false), 1400)
        },
      )
    })

    insertAuthorButton(exportButton)
    exportInjected = true
  }

  let mediaButton = document.querySelector<HTMLButtonElement>(MEDIA_BUTTON_SELECTOR)
  let mediaInjected = false

  if (!mediaButton) {
    mediaButton = document.createElement('button')
    mediaButton.type = 'button'
    mediaButton.className = 'redcopy-export-note-btn redcopy-download-note-media-btn'
    mediaButton.dataset.redcopyDownloadMediaBtn = 'true'
    updateMediaButtonText(mediaButton)

    function setMediaBusy(busy: boolean) {
      if (!mediaButton) return
      mediaButton.disabled = busy
      mediaButton.textContent = busy ? '下载中...' : (hasVideoSignal() ? '下载视频' : '下载图片')
    }

    mediaButton.addEventListener('pointerdown', stopEvent)
    mediaButton.addEventListener('mousedown', stopEvent)
    mediaButton.addEventListener('click', (event) => {
      stopEvent(event)

      if (!mediaButton || mediaButton.disabled) return

      const media = getCurrentMedia()
      if (!media.url) {
        mediaButton.textContent = '未找到媒体'
        setTimeout(() => updateMediaButtonText(mediaButton as HTMLButtonElement), 1400)
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
            if (mediaButton) mediaButton.textContent = '下载失败'
            setTimeout(() => setMediaBusy(false), 1400)
            return
          }

          if (mediaButton) mediaButton.textContent = '已开始下载'
          setTimeout(() => setMediaBusy(false), 1400)
        },
      )
    })

    insertAuthorButton(mediaButton, exportButton)
    mediaInjected = true
  } else {
    updateMediaButtonText(mediaButton)
    insertAuthorButton(mediaButton, exportButton)
  }

  return {
    ok: true,
    exportInjected,
    mediaInjected,
    existed: !exportInjected && !mediaInjected,
    url: location.href,
  }
}

function injectAuthorExportButtonIntoTab(tabId: number) {
  if (!chrome.scripting?.executeScript) {
    return Promise.reject(new Error('chrome.scripting 不可用'))
  }

  return chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'ISOLATED',
      func: injectXhsInlineExportButtonFallback,
      args: [EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE, DOWNLOAD_NOTE_MEDIA_MESSAGE, tabId],
    })
    .then((results) => {
      const result = results[0]?.result
      console.info('[RedCopy] 详情页作者栏按钮兜底注入完成', {
        tabId,
        result,
      })
      return result
    })
    .catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.warn('[RedCopy] 详情页作者栏按钮兜底注入失败', { tabId, msg, error })
      throw error
    })
}

function scheduleAuthorButtonInjection(tabId: number, url?: string) {
  if (!url || !isXhsNoteUrl(url)) return

  void injectAuthorExportButtonIntoTab(tabId).catch(() => {})
  setTimeout(() => {
    void injectAuthorExportButtonIntoTab(tabId).catch(() => {})
  }, FALLBACK_INJECT_DELAY_MS)
}

function injectFallbackIntoExistingNoteTabs() {
  chrome.tabs
    .query({ url: ['*://*.xiaohongshu.com/*'] })
    .then((tabs) => {
      tabs.forEach((tab) => {
        if (typeof tab.id !== 'number') return
        scheduleAuthorButtonInjection(tab.id, tab.url)
      })
    })
    .catch((error: unknown) => {
      console.warn('[RedCopy] 查询小红书标签页失败', error)
    })
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) capturedVideoRequestsByTab.delete(tabId)
  if (!changeInfo.url && changeInfo.status !== 'complete') return
  scheduleAuthorButtonInjection(tabId, changeInfo.url ?? tab.url)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  capturedVideoRequestsByTab.delete(tabId)
})

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  scheduleAuthorButtonInjection(details.tabId, details.url)
}, {
  url: XHS_HOST_FILTER,
})

chrome.webNavigation.onCompleted.addListener((details) => {
  scheduleAuthorButtonInjection(details.tabId, details.url)
}, {
  url: XHS_HOST_FILTER,
})

void injectFallbackIntoExistingNoteTabs()

function resolveMessageTabId(
  message: { tabId?: unknown },
  sender: chrome.runtime.MessageSender,
): number | null {
  if (typeof message.tabId === 'number') return message.tabId
  return typeof sender.tab?.id === 'number' ? sender.tab.id : null
}

function normalizeCapturedUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim().replace(/&amp;/g, '&')
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return ''
  if (trimmed.startsWith('//')) return `https:${trimmed}`

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href
  } catch {
    return ''
  }

  return ''
}

function isLikelyImageUrl(url: string): boolean {
  return /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:$|[?#])/i.test(url)
    || /(?:sns-img|sns-webpic|webpic|imageView2|imageMogr2|format\/(?:webp|jpg|png|avif)|_webp|webp|avatar|cover|poster)/i.test(url)
}

function isLikelyVideoUrl(url: string): boolean {
  if (!url || isLikelyImageUrl(url)) return false

  return /\.(?:mp4|m3u8|webm|mov|flv|ts)(?:$|[?#])/i.test(url)
    || /(?:sns-video|video|stream|m3u8|mp4|live|mimeType=video|mime_type=video|type=video)/i.test(url)
}

function scoreCapturedVideoUrl(url: string): number {
  const lower = url.toLowerCase()
  let score = 0
  if (/\.mp4(?:$|[?#])/.test(lower)) score += 100
  if (/\.m3u8(?:$|[?#])/.test(lower)) score += 90
  if (/sns-video/.test(lower)) score += 70
  if (/video/.test(lower)) score += 50
  if (/stream|live/.test(lower)) score += 35
  if (/\.ts(?:$|[?#])/.test(lower)) score += 10
  if (/range=|part|segment|slice|chunk/.test(lower)) score -= 10
  return score
}

function pruneCapturedVideoRequests(now = Date.now()) {
  capturedVideoRequestsByTab.forEach((requests, tabId) => {
    const fresh = requests
      .filter((request) => now - request.time <= VIDEO_REQUEST_CACHE_TTL_MS)
      .slice(0, VIDEO_REQUEST_CACHE_LIMIT)

    if (fresh.length > 0) {
      capturedVideoRequestsByTab.set(tabId, fresh)
    } else {
      capturedVideoRequestsByTab.delete(tabId)
    }
  })
}

function captureVideoRequest(details: chrome.webRequest.OnBeforeRequestDetails) {
  if (details.tabId < 0) return undefined

  const url = normalizeCapturedUrl(details.url)
  if (!isLikelyVideoUrl(url)) return undefined

  const now = Date.now()
  const requests = capturedVideoRequestsByTab.get(details.tabId) ?? []
  const next = [
    {
      url,
      tabId: details.tabId,
      time: now,
      initiator: details.initiator,
      type: details.type,
    },
    ...requests.filter((request) => request.url !== url),
  ]
    .filter((request) => now - request.time <= VIDEO_REQUEST_CACHE_TTL_MS)
    .slice(0, VIDEO_REQUEST_CACHE_LIMIT)

  capturedVideoRequestsByTab.set(details.tabId, next)
  return undefined
}

function getRecentCapturedVideoUrl(tabId: number): CapturedVideoRequest | null {
  pruneCapturedVideoRequests()
  const requests = capturedVideoRequestsByTab.get(tabId) ?? []
  return requests
    .filter((request) => isLikelyVideoUrl(request.url))
    .sort((a, b) => {
      const scoreDiff = scoreCapturedVideoUrl(b.url) - scoreCapturedVideoUrl(a.url)
      return scoreDiff || b.time - a.time
    })[0] ?? null
}

if (chrome.webRequest?.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    captureVideoRequest,
    {
      urls: [
        '*://*.xiaohongshu.com/*',
        '*://*.xhscdn.com/*',
      ],
      types: ['media', 'xmlhttprequest', 'other'],
    },
  )
}

function executeExtractNote(
  tabId: number,
  includeDom: boolean,
): Promise<NoteExtractResult> {
  if (!chrome.scripting?.executeScript) {
    return Promise.reject(
      new Error('chrome.scripting 不可用，请确认 manifest 含 scripting 权限并已刷新扩展'),
    )
  }

  return chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      func: injectExtractNote,
      args: [{ includeDom }],
    })
    .then(([result]) => {
      if (!result?.result) {
        throw new Error('注入脚本未返回数据')
      }
      return result.result
    })
}

interface ResolvedPageVideoUrl {
  url: string
  source: string
}

function injectResolveCurrentVideoUrl(preferredUrl: string): ResolvedPageVideoUrl | null {
  const urlNoteId = location.href.match(
    /xiaohongshu\.com\/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9]+)/,
  )?.[1] ?? null

  function normalize(value: unknown): string {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim().replace(/&amp;/g, '&')
    if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return ''
    if (trimmed.startsWith('//')) return `${location.protocol === 'http:' ? 'http:' : 'https:'}${trimmed}`
    try {
      const parsed = new URL(trimmed, location.href)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href
    } catch {
      return ''
    }
    return ''
  }

  function isImageUrl(url: string): boolean {
    return /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)(?:$|[?#])/i.test(url)
      || /(?:sns-img|sns-webpic|webpic|imageView2|imageMogr2|format\/(?:webp|jpg|png|avif)|_webp|webp|avatar|cover|poster)/i.test(url)
  }

  function isVideoUrl(url: string): boolean {
    if (isImageUrl(url)) return false

    return /\.(?:mp4|m3u8|webm|mov|flv|ts)(?:$|[?#])/i.test(url)
      || /(?:sns-video|video|stream|m3u8|mp4|live|mimeType=video|mime_type=video|type=video)/i.test(url)
  }

  function score(url: string): number {
    const lower = url.toLowerCase()
    let value = 0
    if (url === preferredUrl) value += 100
    if (/\.mp4(?:$|[?#])/i.test(url)) value += 80
    if (/\.m3u8(?:$|[?#])/i.test(url)) value += 70
    if (/sns-video|video/.test(lower)) value += 50
    if (/live|stream/.test(lower)) value += 35
    if (/\.webm|\.mov|\.flv|\.ts/.test(lower)) value += 30
    if (isImageUrl(url)) value -= 300
    return value
  }

  const visitedObjects = new WeakSet<object>()

  function collectFromObject(value: unknown, candidates: Map<string, string>, source: string, depth = 0) {
    if (depth > 9 || candidates.size > 80) return
    if (typeof value === 'string') {
      const url = normalize(value)
      if (url && isVideoUrl(url)) candidates.set(url, source)
      return
    }
    if (!value || typeof value !== 'object') return
    if (visitedObjects.has(value)) return
    visitedObjects.add(value)
    if (Array.isArray(value)) {
      value.forEach((item) => collectFromObject(item, candidates, source, depth + 1))
      return
    }
    Object.values(value as Record<string, unknown>).forEach((item) => {
      collectFromObject(item, candidates, source, depth + 1)
    })
  }

  const candidates = new Map<string, string>()

  document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    [
      video.getAttribute('src'),
      video.getAttribute('data-src'),
      video.src,
      video.currentSrc,
    ].forEach((value) => {
      const url = normalize(value)
      if (url && isVideoUrl(url)) candidates.set(url, 'dom_video')
    })
  })

  document.querySelectorAll<HTMLElement>('[src], [data-src], [data-video], [data-video-url], [data-url]').forEach((el) => {
    el.getAttributeNames().forEach((name) => {
      const url = normalize(el.getAttribute(name))
      if (url && isVideoUrl(url)) candidates.set(url, 'dom_attr')
    })
  })

  performance.getEntries().forEach((entry) => {
    const url = normalize((entry as PerformanceResourceTiming).name)
    if (url && isVideoUrl(url)) candidates.set(url, 'performance')
  })

  document.querySelectorAll<HTMLElement>('.xgplayer, .player-el, .player-container').forEach((el, index) => {
    collectFromObject(el, candidates, `player_element_${index}`)
  })

  const win = window as Window & {
    __INITIAL_STATE__?: unknown
    __INITIAL_STATE?: unknown
  }
  collectFromObject(win.__INITIAL_STATE__ ?? win.__INITIAL_STATE, candidates, 'initial_state')

  if (urlNoteId) {
    const state = win.__INITIAL_STATE__ as {
      note?: {
        noteDetailMap?: Record<string, { note?: unknown }>
      }
    } | undefined
    const note = state?.note?.noteDetailMap?.[urlNoteId]?.note
    collectFromObject(note, candidates, 'current_note_state')
  }

  ;[
    '__INITIAL_STATE__',
    '__INITIAL_STATE',
    '__REDUX_STATE__',
    '__NUXT__',
    '__APOLLO_STATE__',
  ].forEach((key) => {
    collectFromObject((win as unknown as Record<string, unknown>)[key], candidates, key)
  })

  const best = [...candidates.entries()]
    .sort(([a], [b]) => score(b) - score(a))[0]

  return best ? { url: best[0], source: best[1] } : null
}

function resolveCurrentPageVideoUrl(tabId: number, preferredUrl: string) {
  if (!chrome.scripting?.executeScript) {
    return Promise.reject(new Error('chrome.scripting 不可用'))
  }

  return chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: injectResolveCurrentVideoUrl,
    args: [preferredUrl],
  }).then(([result]) => result?.result ?? null)
}

async function resolveDownloadableMediaUrl(
  request: DownloadNoteMediaRequest,
  sender: chrome.runtime.MessageSender,
): Promise<string> {
  if (request.mediaType === 'image') return request.url
  if (!request.url.startsWith('blob:') && isLikelyVideoUrl(request.url)) {
    return request.url
  }

  const tabId = resolveMessageTabId(request, sender)
  if (tabId == null) {
    throw new Error('视频只有页面临时 blob 地址，且缺少 tabId，无法解析真实下载地址')
  }

  const resolved = await resolveCurrentPageVideoUrl(tabId, request.url)
  if (resolved?.url && isLikelyVideoUrl(resolved.url)) {
    console.info('[RedCopy] 已解析真实视频地址', {
      source: resolved.source,
      url: resolved.url.slice(0, 120),
    })
    return resolved.url
  }

  const captured = getRecentCapturedVideoUrl(tabId)
  if (captured?.url) {
    console.info('[RedCopy] 已使用捕获的视频请求地址', {
      source: 'captured_web_request',
      type: captured.type,
      ageMs: Date.now() - captured.time,
      url: captured.url.slice(0, 120),
    })
    return captured.url
  }

  throw new Error('视频当前只有 blob 播放地址，未捕获到真实 mp4/m3u8；请先播放视频几秒后再点下载')
}

function buildSingleNoteMarkdownFilename(extract: NoteExtractResult): string {
  const fallbackTime = new Date()
    .toLocaleString('zh-CN', { hour12: false })
    .replace(/[/:]/g, '-')
    .replace(/\s+/g, '_')

  const name = extract.text.title?.trim() || extract.noteId || fallbackTime
  return `小红书笔记-${name}.md`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function imageUrlToDataUrl(url: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const blob = await response.blob()
  if (blob.size === 0) throw new Error('图片内容为空')

  return {
    dataUrl: await blobToDataUrl(blob),
    mimeType: blob.type || response.headers.get('content-type') || 'image/jpeg',
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === BACKGROUND_KEEPALIVE_MESSAGE) {
    sendResponse({ ok: true })
    if (!hasRunningBackgroundTask()) void closeOffscreenDocumentIfIdle()
    return false
  }

  if (message?.type === START_ANALYZE_GENERATE_TASK_MESSAGE) {
    startAnalyzeGenerateTask({
      taskId: String(message.taskId ?? ''),
      mode: message.mode === 'direct' ? 'direct' : 'note_analysis',
      topic: typeof message.topic === 'string' ? message.topic : '',
      imageUrls: Array.isArray(message.imageUrls)
        ? message.imageUrls.map(String)
        : undefined,
    })
      .then((response) => sendResponse(response))
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error)
        sendResponse({ ok: false, error: detail } satisfies AnalyzeGenerateTaskResponse)
      })
    return true
  }

  if (message?.type === GET_ANALYZE_GENERATE_TASK_STATUS_MESSAGE) {
    sendResponse({
      ok: true,
      status: cloneTaskStatus(
        getAnalyzeGenerateTaskStatus(String(message.taskId ?? '')),
      ),
    } satisfies AnalyzeGenerateTaskResponse)
    return false
  }

  if (message?.type === GET_ANALYZE_GENERATE_TASK_STATUSES_MESSAGE) {
    sendResponse({
      ok: true,
      statuses: cloneAnalyzeGenerateStatuses(),
    } satisfies AnalyzeGenerateTaskStatusesResponse)
    return false
  }

  if (message?.type === START_AUTO_COLLECT_TASK_MESSAGE) {
    try {
      sendResponse(startAutoCollectTask(message.config as AutoCollectConfig))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      sendResponse({ ok: false, error: detail } satisfies AutoCollectTaskResponse)
    }
    return false
  }

  if (message?.type === STOP_AUTO_COLLECT_TASK_MESSAGE) {
    sendResponse(stopAutoCollectTask())
    return false
  }

  if (message?.type === GET_AUTO_COLLECT_TASK_STATUS_MESSAGE) {
    sendResponse({
      ok: true,
      status: cloneTaskStatus(autoCollectTask),
    } satisfies AutoCollectTaskResponse)
    return false
  }

  if (message?.type === START_GROWTH_ACQUIRE_TASK_MESSAGE) {
    try {
      sendResponse(startGrowthAcquireTask(message.config as GrowthAcquireConfig))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      sendResponse({ ok: false, error: detail } satisfies GrowthAcquireTaskResponse)
    }
    return false
  }

  if (message?.type === STOP_GROWTH_ACQUIRE_TASK_MESSAGE) {
    sendResponse(stopGrowthAcquireTask())
    return false
  }

  if (message?.type === GET_GROWTH_ACQUIRE_TASK_STATUS_MESSAGE) {
    sendResponse({
      ok: true,
      status: cloneTaskStatus(growthAcquireTask),
    } satisfies GrowthAcquireTaskResponse)
    return false
  }

  // 存储代理：供 dev 模式下 chrome.storage 不可用的扩展页使用
  if (message?.type === STORAGE_GET_MESSAGE) {
    chrome.storage.local
      .get(message.key)
      .then((data) => {
        sendResponse({
          ok: true,
          value: data[message.key],
        } satisfies StorageGetResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 代理读取存储失败', msg, error)
        sendResponse({ ok: false, error: msg } satisfies StorageGetResponse)
      })
    return true
  }

  if (message?.type === STORAGE_SET_MESSAGE) {
    chrome.storage.local
      .set({ [message.key]: message.value })
      .then(() => {
        sendResponse({ ok: true } satisfies StorageSetResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 代理写入存储失败', msg, error)
        sendResponse({ ok: false, error: msg } satisfies StorageSetResponse)
      })
    return true
  }

  if (message?.type === STORAGE_REMOVE_MESSAGE) {
    chrome.storage.local
      .remove(message.key)
      .then(() => {
        sendResponse({ ok: true } satisfies StorageRemoveResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 代理删除存储失败', msg, error)
        sendResponse({ ok: false, error: msg } satisfies StorageRemoveResponse)
      })
    return true
  }

  if (message?.type === IMAGE_TO_DATA_URL_MESSAGE) {
    const url = typeof message.url === 'string' ? message.url.trim() : ''
    if (!url) {
      sendResponse({
        ok: false,
        error: '缺少图片 URL',
      } satisfies ImageToDataUrlResponse)
      return false
    }

    imageUrlToDataUrl(url)
      .then((result) => {
        sendResponse({
          ok: true,
          dataUrl: result.dataUrl,
          mimeType: result.mimeType,
        } satisfies ImageToDataUrlResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 图片转 Base64 失败', { url: url.slice(0, 120), msg }, error)
        sendResponse({
          ok: false,
          error: msg,
        } satisfies ImageToDataUrlResponse)
      })

    return true
  }

  if (message?.type === EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE) {
    const tabId = resolveMessageTabId(message, sender)
    if (tabId == null) {
      sendResponse({
        ok: false,
        error: '缺少 tabId',
      } satisfies ExportCurrentNoteMarkdownResponse)
      return false
    }

    executeExtractNote(tabId, false)
      .then(async (extract) => {
        logExtractContentJson(extract, '[RedCopy][详情导出]')

        if (!extract.ok) {
          throw new Error(extract.error ?? '未能提取当前笔记内容')
        }

        const markdown = formatNoteAsMarkdown(extract.text, {
          url: extract.url,
          noteId: extract.noteId,
        })
        await downloadTextFile(markdown, buildSingleNoteMarkdownFilename(extract))

        sendResponse({ ok: true } satisfies ExportCurrentNoteMarkdownResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 详情笔记 Markdown 导出失败', msg, error)
        sendResponse({
          ok: false,
          error: msg,
        } satisfies ExportCurrentNoteMarkdownResponse)
      })

    return true
  }

  if (message?.type === DOWNLOAD_NOTE_IMAGE_MESSAGE) {
    const request = message as DownloadNoteImageRequest
    if (!request.url) {
      sendResponse({
        ok: false,
        error: '缺少图片 URL',
      } satisfies DownloadNoteImageResponse)
      return false
    }

    downloadNoteImage(request.url, request.index, request.context ?? {})
      .then(() => {
        sendResponse({ ok: true } satisfies DownloadNoteImageResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 详情图片下载失败', msg, error)
        sendResponse({
          ok: false,
          error: msg,
        } satisfies DownloadNoteImageResponse)
      })

    return true
  }

  if (message?.type === DOWNLOAD_NOTE_MEDIA_MESSAGE) {
    const request = message as DownloadNoteMediaRequest
    if (!request.url) {
      sendResponse({
        ok: false,
        error: '缺少媒体 URL',
      } satisfies DownloadNoteMediaResponse)
      return false
    }

    resolveDownloadableMediaUrl(request, sender)
      .then((url) =>
        downloadNoteMedia(
          url,
          request.index,
          request.mediaType,
          request.context ?? {},
        ),
      )
      .then(() => {
        sendResponse({ ok: true } satisfies DownloadNoteMediaResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RedCopy] 详情媒体下载失败', msg, error)
        sendResponse({
          ok: false,
          error: msg,
        } satisfies DownloadNoteMediaResponse)
      })

    return true
  }

  if (message?.type === INJECT_DETAIL_EXPORT_BUTTON_MESSAGE) {
    const tabId = resolveMessageTabId(message, sender)
    if (tabId == null) {
      sendResponse({
        ok: false,
        error: '缺少 tabId',
      } satisfies InjectDetailExportButtonResponse)
      return false
    }

    injectAuthorExportButtonIntoTab(tabId)
      .then((result) => {
        const failedReason =
          result
          && typeof result === 'object'
          && 'ok' in result
          && (result as { ok?: unknown }).ok === false
            ? (
                typeof (result as { reason?: unknown }).reason === 'string'
                  ? (result as { reason: string }).reason
                  : 'inject_result_not_ok'
              )
            : null

        if (failedReason) {
          sendResponse({
            ok: false,
            error: failedReason,
            result,
          } satisfies InjectDetailExportButtonResponse)
          return
        }

        sendResponse({
          ok: true,
          result,
        } satisfies InjectDetailExportButtonResponse)
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error)
        sendResponse({
          ok: false,
          error: msg,
        } satisfies InjectDetailExportButtonResponse)
      })

    return true
  }

  if (message?.type !== EXTRACT_NOTE_MESSAGE) return false

  const tabId = resolveMessageTabId(message, sender)
  const includeDom = message.includeDom !== false
  if (tabId == null) {
    sendResponse({ ok: false, error: '缺少 tabId' } satisfies ExtractNoteResponse)
    return false
  }

  executeExtractNote(tabId, includeDom)
    .then((extract) => {
      logExtractContentJson(extract, '[RedCopy][后台]')
      sendResponse({
        ok: true,
        data: extract,
      } satisfies ExtractNoteResponse)
    })
    .catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] executeScript 失败', msg, error)
      sendResponse({ ok: false, error: msg } satisfies ExtractNoteResponse)
    })

  return true
})
