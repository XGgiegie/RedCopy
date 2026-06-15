/** 侧栏主内容区视图 */
export type ContentView = 'note' | 'analysis' | 'draft'

export interface ContentViewOption {
  label: string
  value: ContentView
}

/** 提取结果关联的页面元数据 */
export interface ExtractMeta {
  noteId: string | null
  url: string
}
