import type { NoteTextInfo } from './note-types'

/** 将小红书展示的互动数字（如 1.2万、999+）解析为整数 */
export function parseEngagementCount(
  raw: string | number | null | undefined,
): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.round(raw) : 0
  }

  const normalized = String(raw)
    .trim()
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .replace(/\+$/, '')

  if (!normalized || normalized === '-' || normalized === '--') return 0

  const wanMatch = normalized.match(/^([\d.]+)万$/i)
  if (wanMatch) return Math.round(parseFloat(wanMatch[1]) * 10000)

  const wanEnMatch = normalized.match(/^([\d.]+)w$/i)
  if (wanEnMatch) return Math.round(parseFloat(wanEnMatch[1]) * 10000)

  const qianMatch = normalized.match(/^([\d.]+)千$/i)
  if (qianMatch) return Math.round(parseFloat(qianMatch[1]) * 1000)

  const kMatch = normalized.match(/^([\d.]+)k$/i)
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000)

  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? Math.round(n) : 0
}

export interface EngagementFilter {
  minLikedCount: number
  minCollectedCount: number
  minCommentCount: number
}

/** 判断笔记互动数据是否满足筛选条件（0 表示不限制） */
export function passesEngagementFilter(
  note: Pick<NoteTextInfo, 'likedCount' | 'collectedCount' | 'commentCount'>,
  filter: EngagementFilter,
): boolean {
  if (
    filter.minLikedCount > 0
    && parseEngagementCount(note.likedCount) < filter.minLikedCount
  ) {
    return false
  }
  if (
    filter.minCollectedCount > 0
    && parseEngagementCount(note.collectedCount) < filter.minCollectedCount
  ) {
    return false
  }
  if (
    filter.minCommentCount > 0
    && parseEngagementCount(note.commentCount) < filter.minCommentCount
  ) {
    return false
  }
  return true
}
