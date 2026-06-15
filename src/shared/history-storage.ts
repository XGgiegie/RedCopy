import type { AiAnalysisResult, GeneratedNoteDraft } from './ai-types'
import { loadLastAnalysis } from './analysis-storage'
import { loadLastDraft } from './draft-storage'
import { loadLastExtract } from './extract-storage'
import type { NoteMediaType, NoteTextInfo } from './note-types'
import { storageGet, storageSet } from './storage'

export const HISTORY_STORAGE_KEY = 'redcopy:history'
const MAX_HISTORY_RECORDS = 50

/** 单条提取历史（含分析、生成结果） */
export interface HistoryRecord {
  id: string
  noteId: string | null
  url: string
  note: NoteTextInfo
  noteType: NoteMediaType
  extractedAt: number
  analysis: AiAnalysisResult | null
  analyzedAt: number | null
  draft: GeneratedNoteDraft | null
  generatedAt: number | null
  generateTopic: string
}

export type HistoryRecordInput = Omit<
  HistoryRecord,
  'id' | 'analysis' | 'analyzedAt' | 'draft' | 'generatedAt' | 'generateTopic'
>

function createRecordId(): string {
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sortByExtractedAt(records: HistoryRecord[]): HistoryRecord[] {
  return [...records].sort((a, b) => b.extractedAt - a.extractedAt)
}

/** 将旧版单条缓存迁移为历史记录（仅首次） */
async function migrateLegacyRecordsIfNeeded(): Promise<HistoryRecord[]> {
  const existing = await storageGet<HistoryRecord[]>(HISTORY_STORAGE_KEY)
  if (existing && existing.length > 0) return sortByExtractedAt(existing)

  const extract = await loadLastExtract()
  if (!extract) return []

  const analysis = await loadLastAnalysis()
  const draft = await loadLastDraft()

  const migrated: HistoryRecord = {
    id: createRecordId(),
    noteId: extract.noteId,
    url: extract.url,
    note: extract.note,
    noteType: extract.noteType ?? 'normal',
    extractedAt: Date.now(),
    analysis: analysis?.analysis ?? null,
    analyzedAt: analysis?.analyzedAt ?? null,
    draft: draft?.draft ?? null,
    generatedAt: draft?.generatedAt ?? null,
    generateTopic: '',
  }

  const records = [migrated]
  await storageSet(HISTORY_STORAGE_KEY, records)
  console.info('[RedCopy] 已迁移旧版缓存为历史记录', { id: migrated.id })
  return records
}

export async function loadHistoryRecords(): Promise<HistoryRecord[]> {
  const records = await migrateLegacyRecordsIfNeeded()
  return sortByExtractedAt(records)
}

export async function addHistoryRecord(
  input: HistoryRecordInput,
): Promise<HistoryRecord> {
  const records = await loadHistoryRecords()

  const record: HistoryRecord = {
    ...input,
    id: createRecordId(),
    analysis: null,
    analyzedAt: null,
    draft: null,
    generatedAt: null,
    generateTopic: '',
  }

  const next = [record, ...records].slice(0, MAX_HISTORY_RECORDS)
  await storageSet(HISTORY_STORAGE_KEY, next)
  console.info('[RedCopy] 已新增历史记录', { id: record.id, noteId: record.noteId })
  return record
}

export async function updateHistoryRecord(
  id: string,
  patch: Partial<
    Pick<
      HistoryRecord,
      | 'analysis'
      | 'analyzedAt'
      | 'draft'
      | 'generatedAt'
      | 'generateTopic'
      | 'note'
      | 'noteType'
    >
  >,
): Promise<HistoryRecord | null> {
  const records = await loadHistoryRecords()
  const index = records.findIndex((item) => item.id === id)
  if (index < 0) return null

  const updated: HistoryRecord = {
    ...records[index],
    ...patch,
  }
  records[index] = updated
  await storageSet(HISTORY_STORAGE_KEY, sortByExtractedAt(records))
  return updated
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const records = await loadHistoryRecords()
  const next = records.filter((item) => item.id !== id)
  await storageSet(HISTORY_STORAGE_KEY, next)
  console.info('[RedCopy] 已删除历史记录', { id })
}

export function formatHistoryTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const time = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) return `今天 ${time}`

  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
