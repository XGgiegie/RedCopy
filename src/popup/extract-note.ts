import type { NoteExtractResult } from '../shared/note-types'
import {
  EXTRACT_NOTE_MESSAGE,
  type ExtractNoteResponse,
} from '../shared/messages'

export interface ExtractNoteOptions {
  includeDom?: boolean
}

/** 通过 background 向标签页注入提取脚本 */
export async function extractNoteFromTab(
  tabId: number,
  options: ExtractNoteOptions = {},
): Promise<NoteExtractResult> {
  let response: ExtractNoteResponse | undefined
  try {
    response = (await chrome.runtime.sendMessage({
      type: EXTRACT_NOTE_MESSAGE,
      tabId,
      includeDom: options.includeDom,
    })) as ExtractNoteResponse | undefined
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 与后台通信失败', detail, error)
    throw new Error(`与后台通信失败：${detail}（请在扩展页刷新后重试）`)
  }

  if (!response) {
    throw new Error('后台无响应，请刷新扩展后重试')
  }
  if (!response.ok || !response.data) {
    throw new Error(response.error ?? '提取失败')
  }

  return response.data
}
