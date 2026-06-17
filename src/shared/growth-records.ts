import { storageGet, storageSet } from './storage'

/** 涨粉获客互动记录（独立于笔记分析任务库） */
export const GROWTH_RECORDS_KEY = 'redcopy:growthRecords'

const MAX_RECORDS = 100

export interface GrowthRecord {
  id: string
  noteId: string
  url: string
  title: string
  /** 是否在该笔记下发表了顶层评论 */
  postedComment: boolean
  /** 回复他人评论的次数 */
  repliedCount: number
  interactedAt: number
}

export interface GrowthRecordInput {
  noteId: string
  url: string
  title: string
  postedComment: boolean
  repliedCount: number
}

function createRecordId(): string {
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sortByTime(records: GrowthRecord[]): GrowthRecord[] {
  return [...records].sort((a, b) => b.interactedAt - a.interactedAt)
}

async function readAll(): Promise<GrowthRecord[]> {
  const records = await storageGet<GrowthRecord[]>(GROWTH_RECORDS_KEY)
  return sortByTime(records ?? [])
}

async function writeAll(records: GrowthRecord[]): Promise<void> {
  await storageSet(GROWTH_RECORDS_KEY, sortByTime(records).slice(0, MAX_RECORDS))
}

/** 列出全部获客互动记录 */
export async function listGrowthRecords(): Promise<GrowthRecord[]> {
  return readAll()
}

/**
 * 按 noteId 合并更新互动记录（同一笔记多次运行会累加回复数）。
 */
export async function upsertGrowthRecord(input: GrowthRecordInput): Promise<GrowthRecord> {
  const records = await readAll()
  const index = records.findIndex((item) => item.noteId === input.noteId)

  if (index >= 0) {
    const existing = records[index]
    const updated: GrowthRecord = {
      ...existing,
      url: input.url || existing.url,
      title: input.title || existing.title,
      postedComment: existing.postedComment || input.postedComment,
      repliedCount: existing.repliedCount + input.repliedCount,
      interactedAt: Date.now(),
    }
    records[index] = updated
    await writeAll(records)
    console.info('[RedCopy][获客] 已更新互动记录', {
      noteId: input.noteId,
      repliedCount: updated.repliedCount,
      postedComment: updated.postedComment,
    })
    return updated
  }

  const created: GrowthRecord = {
    id: createRecordId(),
    noteId: input.noteId,
    url: input.url,
    title: input.title,
    postedComment: input.postedComment,
    repliedCount: input.repliedCount,
    interactedAt: Date.now(),
  }
  await writeAll([created, ...records])
  console.info('[RedCopy][获客] 已新建互动记录', { noteId: input.noteId })
  return created
}

/** 删除单条获客记录 */
export async function deleteGrowthRecord(id: string): Promise<void> {
  const records = await readAll()
  await writeAll(records.filter((item) => item.id !== id))
  console.info('[RedCopy][获客] 已删除互动记录', { id })
}

/** 清空全部获客记录 */
export async function clearGrowthRecords(): Promise<number> {
  const records = await readAll()
  const count = records.length
  await writeAll([])
  console.info('[RedCopy][获客] 已清空互动记录', { count })
  return count
}

export function formatGrowthRecordTime(timestamp: number): string {
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
