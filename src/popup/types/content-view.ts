/** 任务详情主内容区视图 */
export type ContentView = 'note' | 'analysis' | 'draft'

export interface ContentViewOption {
  label: string
  value: ContentView
}
