import type {
  AiAnalysisResult,
  GeneratedImageRecord,
  GeneratedNoteDraft,
} from './ai-types'
import { loadLastAnalysis } from './analysis-storage'
import { loadLastDraft } from './draft-storage'
import { loadLastExtract } from './extract-storage'
import type { NoteMediaType, NoteTextInfo } from './note-types'
import { storageGet, storageSet } from './storage'

/**
 * 本地"模拟数据库"：把每条笔记任务（提取 + 分析 + 生成）作为一行独立记录，
 * 统一存放在 chrome.storage.local 的同一张表里。每个任务通过唯一 id 隔离，
 * 任何异步写入都按 id 精确落库，互不串扰。
 */
export const TASK_DB_KEY = 'redcopy:tasks'

/** 旧版历史 key，仅用于迁移 */
const LEGACY_HISTORY_KEY = 'redcopy:history'
const MAX_TASKS = 50

/** 单条任务记录 */
export interface Task {
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
  /** AI 配图生成历史（生成即落库，持久保留） */
  imageHistory: GeneratedImageRecord[]
}

/** 新建任务时由调用方提供的字段 */
export type NewTaskInput = Pick<Task, 'noteId' | 'url' | 'note' | 'noteType'>

/** 允许更新的字段 */
export type TaskPatch = Partial<
  Pick<
    Task,
    | 'analysis'
    | 'analyzedAt'
    | 'draft'
    | 'generatedAt'
    | 'generateTopic'
    | 'imageHistory'
    | 'note'
    | 'noteType'
  >
>

function createTaskId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 补齐历史数据缺失的字段，保证读取到的任务结构完整 */
function normalizeTask(task: Task): Task {
  return {
    ...task,
    imageHistory: Array.isArray(task.imageHistory) ? task.imageHistory : [],
  }
}

function sortByExtractedAt(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.extractedAt - a.extractedAt)
}

/** 从旧版单条缓存构造一条任务（仅迁移用） */
async function buildTaskFromLegacyCaches(): Promise<Task[]> {
  const extract = await loadLastExtract()
  if (!extract) return []

  const analysis = await loadLastAnalysis()
  const draft = await loadLastDraft()

  const task: Task = {
    id: createTaskId(),
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
    imageHistory: [],
  }
  return [task]
}

/**
 * 读取整张表；首次访问时从旧 key / 旧单条缓存迁移一次。
 * 写入空数组也视为"已迁移"，避免重复迁移。
 */
async function readAll(): Promise<Task[]> {
  const current = await storageGet<Task[]>(TASK_DB_KEY)
  if (current !== undefined) return current.map(normalizeTask)

  // 迁移 1：旧版历史数组（结构兼容，字段一致）
  const legacy = await storageGet<Task[]>(LEGACY_HISTORY_KEY)
  if (legacy && legacy.length > 0) {
    await storageSet(TASK_DB_KEY, legacy)
    console.info('[RedCopy] 已从旧历史迁移任务表', { count: legacy.length })
    return legacy.map(normalizeTask)
  }

  // 迁移 2：更早的单条缓存
  const fromCaches = await buildTaskFromLegacyCaches()
  await storageSet(TASK_DB_KEY, fromCaches)
  if (fromCaches.length > 0) {
    console.info('[RedCopy] 已从旧单条缓存迁移任务表')
  }
  return fromCaches.map(normalizeTask)
}

async function writeAll(tasks: Task[]): Promise<void> {
  await storageSet(TASK_DB_KEY, sortByExtractedAt(tasks))
}

/** 列出全部任务（按提取时间倒序） */
export async function listTasks(): Promise<Task[]> {
  return sortByExtractedAt(await readAll())
}

/** 按 id 读取单条任务 */
export async function getTask(id: string): Promise<Task | null> {
  const tasks = await readAll()
  return tasks.find((item) => item.id === id) ?? null
}

/** 新建一条任务并返回 */
export async function createTask(input: NewTaskInput): Promise<Task> {
  const tasks = await readAll()
  const task: Task = {
    ...input,
    id: createTaskId(),
    extractedAt: Date.now(),
    analysis: null,
    analyzedAt: null,
    draft: null,
    generatedAt: null,
    generateTopic: '',
    imageHistory: [],
  }
  const next = sortByExtractedAt([task, ...tasks]).slice(0, MAX_TASKS)
  await writeAll(next)
  console.info('[RedCopy] 已新建任务', { id: task.id, noteId: task.noteId })
  return task
}

/** 按 id 更新任务字段 */
export async function updateTask(
  id: string,
  patch: TaskPatch,
): Promise<Task | null> {
  const tasks = await readAll()
  const index = tasks.findIndex((item) => item.id === id)
  if (index < 0) {
    console.warn('[RedCopy] 更新任务失败：找不到 id', { id })
    return null
  }

  const updated: Task = { ...tasks[index], ...patch }
  tasks[index] = updated
  await writeAll(tasks)
  console.info('[RedCopy] 已更新任务', { id, fields: Object.keys(patch) })
  return updated
}

/** 按 id 删除任务 */
export async function deleteTask(id: string): Promise<void> {
  const tasks = await readAll()
  await writeAll(tasks.filter((item) => item.id !== id))
  console.info('[RedCopy] 已删除任务', { id })
}

/** 格式化任务时间，用于列表展示 */
export function formatTaskTime(timestamp: number): string {
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
