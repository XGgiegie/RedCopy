import { injectExtractNote } from '../shared/extract-note'
import {
  EXTRACT_NOTE_MESSAGE,
  STORAGE_GET_MESSAGE,
  STORAGE_REMOVE_MESSAGE,
  STORAGE_SET_MESSAGE,
  type ExtractNoteResponse,
  type StorageGetResponse,
  type StorageRemoveResponse,
  type StorageSetResponse,
} from '../shared/messages'

console.info('[RedCopy] background ready')

// 点击扩展图标时从浏览器右侧打开侧栏，而非悬浮 Popup
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error('[RedCopy] 侧栏行为配置失败', error)
  })

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

  if (message?.type !== EXTRACT_NOTE_MESSAGE) return false

  const tabId = message.tabId as number
  if (typeof tabId !== 'number') {
    sendResponse({ ok: false, error: '缺少 tabId' } satisfies ExtractNoteResponse)
    return false
  }

  if (!chrome.scripting?.executeScript) {
    sendResponse({
      ok: false,
      error: 'chrome.scripting 不可用，请确认 manifest 含 scripting 权限并已刷新扩展',
    } satisfies ExtractNoteResponse)
    return false
  }

  const includeDom = message.includeDom !== false

  chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      func: injectExtractNote,
      args: [{ includeDom }],
    })
    .then(([result]) => {
      if (!result?.result) {
        sendResponse({
          ok: false,
          error: '注入脚本未返回数据',
        } satisfies ExtractNoteResponse)
        return
      }
      sendResponse({
        ok: true,
        data: result.result,
      } satisfies ExtractNoteResponse)
    })
    .catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] executeScript 失败', msg, error)
      sendResponse({ ok: false, error: msg } satisfies ExtractNoteResponse)
    })

  return true
})
