import { injectExtractNote } from '../shared/extract-note'
import {
  EXTRACT_NOTE_MESSAGE,
  type ExtractNoteResponse,
} from '../shared/messages'

console.info('[RedCopy] background ready')

// Popup 在 CRXJS dev 模式下可能拿不到 chrome.scripting，统一由 background 注入
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

  chrome.scripting
    .executeScript({
      target: { tabId },
      world: 'MAIN',
      func: injectExtractNote,
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
