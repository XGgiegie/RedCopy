import { injectExtractNote } from '../shared/extract-note'
import { logExtractContentJson } from '../shared/extract-log'
import { formatNoteAsMarkdown } from '../shared/export-markdown'
import {
  DOWNLOAD_NOTE_IMAGE_MESSAGE,
  EXTRACT_NOTE_MESSAGE,
  EXPORT_CURRENT_NOTE_MARKDOWN_MESSAGE,
  STORAGE_GET_MESSAGE,
  STORAGE_REMOVE_MESSAGE,
  STORAGE_SET_MESSAGE,
  type DownloadNoteImageRequest,
  type DownloadNoteImageResponse,
  type ExtractNoteResponse,
  type ExportCurrentNoteMarkdownResponse,
  type StorageGetResponse,
  type StorageRemoveResponse,
  type StorageSetResponse,
} from '../shared/messages'
import { downloadNoteImage, downloadTextFile } from '../shared/note-media'
import type { NoteExtractResult } from '../shared/note-types'
import { migratePlainStorageToEncrypted } from '../shared/storage'

console.info('[RedCopy] background ready')

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

function resolveMessageTabId(
  message: { tabId?: unknown },
  sender: chrome.runtime.MessageSender,
): number | null {
  if (typeof message.tabId === 'number') return message.tabId
  return typeof sender.tab?.id === 'number' ? sender.tab.id : null
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

function buildSingleNoteMarkdownFilename(extract: NoteExtractResult): string {
  const fallbackTime = new Date()
    .toLocaleString('zh-CN', { hour12: false })
    .replace(/[/:]/g, '-')
    .replace(/\s+/g, '_')

  const name = extract.text.title?.trim() || extract.noteId || fallbackTime
  return `小红书笔记-${name}.md`
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
