/** 简化 DOM 树节点 */
export interface DomTreeNode {
  tag: string
  id?: string
  className?: string
  text?: string
  children?: DomTreeNode[]
}

/** 笔记文本字段 */
export interface NoteTextInfo {
  title: string
  desc: string
  author: string
  tags: string[]
  publishTime: string
  likedCount: string
  collectedCount: string
  commentCount: string
  /** 笔记区域内可见文本汇总 */
  allText: string
  /** 笔记图片 URL 列表 */
  images: string[]
}

/** 笔记 DOM 快照 */
export interface NoteDomSnapshot {
  rootSelector: string
  outerHTML: string
  tree: DomTreeNode | null
}

/** 笔记媒介类型 */
export type NoteMediaType = 'normal' | 'video'

/** 页面注入脚本返回结构 */
export interface NoteExtractResult {
  ok: boolean
  url: string
  noteId: string | null
  isNotePage: boolean
  /** normal=图文，video=视频（暂不支持分析） */
  noteType: NoteMediaType
  source: 'initial_state' | 'dom' | 'mixed' | 'none'
  text: NoteTextInfo
  /** __INITIAL_STATE__ 中的笔记 JSON（可序列化部分） */
  structured: Record<string, unknown> | null
  dom: NoteDomSnapshot | null
  error?: string
}
