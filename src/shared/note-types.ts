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
}

/** 笔记 DOM 快照 */
export interface NoteDomSnapshot {
  rootSelector: string
  outerHTML: string
  tree: DomTreeNode | null
}

/** 页面注入脚本返回结构 */
export interface NoteExtractResult {
  ok: boolean
  url: string
  noteId: string | null
  isNotePage: boolean
  source: 'initial_state' | 'dom' | 'mixed' | 'none'
  text: NoteTextInfo
  /** __INITIAL_STATE__ 中的笔记 JSON（可序列化部分） */
  structured: Record<string, unknown> | null
  dom: NoteDomSnapshot | null
  error?: string
}
