import type { NoteExtractResult } from '../shared/note-types'
import {
  EXTRACT_NOTE_MESSAGE,
  type ExtractNoteResponse,
} from '../shared/messages'

/** 通过 background 向标签页注入提取脚本 */
export async function extractNoteFromTab(
  tabId: number,
): Promise<NoteExtractResult> {
  const response = (await chrome.runtime.sendMessage({
    type: EXTRACT_NOTE_MESSAGE,
    tabId,
  })) as ExtractNoteResponse | undefined

  if (!response) {
    throw new Error('后台无响应，请刷新扩展后重试')
  }
  if (!response.ok || !response.data) {
    throw new Error(response.error ?? '提取失败')
  }

  return response.data
}
