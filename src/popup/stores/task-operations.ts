import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AnalyzeGenerateTaskStatus } from '../../shared/messages'

/** 任务后台操作类型 */
export type TaskOperationType = 'analyzing' | 'generating'

function cloneSet(source: Set<string>): Set<string> {
  return new Set(source)
}

function imageOpKey(taskId: string, promptId: string): string {
  return `${taskId}:${promptId}`
}

/**
 * 按任务 id 记录进行中的 AI 操作。
 * 状态挂在 Pinia 上，离开任务详情页后仍可见，列表可展示「准备中 / 生成中」。
 */
export const useTaskOperationsStore = defineStore('taskOperations', () => {
  const analyzingIds = ref<Set<string>>(new Set())
  const generatingIds = ref<Set<string>>(new Set())
  const generatingImageKeys = ref<Set<string>>(new Set())

  const busyCount = computed(
    () =>
      analyzingIds.value.size +
      generatingIds.value.size +
      generatingImageKeys.value.size,
  )

  const busyTaskIds = computed(() => {
    const ids = new Set<string>()
    for (const id of analyzingIds.value) ids.add(id)
    for (const id of generatingIds.value) ids.add(id)
    return ids
  })

  function start(taskId: string, type: TaskOperationType) {
    if (type === 'analyzing') {
      analyzingIds.value = cloneSet(analyzingIds.value).add(taskId)
    } else {
      generatingIds.value = cloneSet(generatingIds.value).add(taskId)
    }
    console.info('[RedCopy] 任务操作开始', { taskId, type })
  }

  function stop(taskId: string, type: TaskOperationType) {
    if (type === 'analyzing') {
      const next = cloneSet(analyzingIds.value)
      next.delete(taskId)
      analyzingIds.value = next
    } else {
      const next = cloneSet(generatingIds.value)
      next.delete(taskId)
      generatingIds.value = next
    }
    console.info('[RedCopy] 任务操作结束', { taskId, type })
  }

  function isAnalyzing(taskId: string): boolean {
    return analyzingIds.value.has(taskId)
  }

  function isGenerating(taskId: string): boolean {
    return generatingIds.value.has(taskId)
  }

  function isBusy(taskId: string): boolean {
    return (
      isAnalyzing(taskId) ||
      isGenerating(taskId) ||
      isGeneratingImagesForTask(taskId)
    )
  }

  function startImage(taskId: string, promptId: string) {
    generatingImageKeys.value = cloneSet(generatingImageKeys.value).add(
      imageOpKey(taskId, promptId),
    )
    console.info('[RedCopy] 配图生成开始', { taskId, promptId })
  }

  function stopImage(taskId: string, promptId: string) {
    const next = cloneSet(generatingImageKeys.value)
    next.delete(imageOpKey(taskId, promptId))
    generatingImageKeys.value = next
    console.info('[RedCopy] 配图生成结束', { taskId, promptId })
  }

  function isGeneratingImage(taskId: string, promptId: string): boolean {
    return generatingImageKeys.value.has(imageOpKey(taskId, promptId))
  }

  function isGeneratingImagesForTask(taskId: string): boolean {
    const prefix = `${taskId}:`
    for (const key of generatingImageKeys.value) {
      if (key.startsWith(prefix)) return true
    }
    return false
  }

  function syncAnalyzeGenerateStatus(
    taskId: string,
    status?: AnalyzeGenerateTaskStatus | null,
  ) {
    const nextAnalyzing = cloneSet(analyzingIds.value)
    const nextGenerating = cloneSet(generatingIds.value)
    nextAnalyzing.delete(taskId)
    nextGenerating.delete(taskId)

    if (status?.running && status.progress?.phase === 'analyzing') {
      nextAnalyzing.add(taskId)
    } else if (status?.running && status.progress?.phase === 'generating') {
      nextGenerating.add(taskId)
    }

    analyzingIds.value = nextAnalyzing
    generatingIds.value = nextGenerating
  }

  function syncAnalyzeGenerateStatuses(
    statuses: Record<string, AnalyzeGenerateTaskStatus>,
  ) {
    const nextAnalyzing = new Set<string>()
    const nextGenerating = new Set<string>()

    for (const [taskId, status] of Object.entries(statuses)) {
      if (!status.running) continue
      if (status.progress?.phase === 'analyzing') nextAnalyzing.add(taskId)
      if (status.progress?.phase === 'generating') nextGenerating.add(taskId)
    }

    analyzingIds.value = nextAnalyzing
    generatingIds.value = nextGenerating
  }

  function getStatusLabel(taskId: string): string | null {
    if (isAnalyzing(taskId)) return '分析中'
    if (isGenerating(taskId)) return '创作中'
    if (isGeneratingImagesForTask(taskId)) return '配图生成中'
    return null
  }

  return {
    analyzingIds,
    generatingIds,
    generatingImageKeys,
    busyCount,
    busyTaskIds,
    start,
    stop,
    syncAnalyzeGenerateStatus,
    syncAnalyzeGenerateStatuses,
    startImage,
    stopImage,
    isAnalyzing,
    isGenerating,
    isGeneratingImage,
    isGeneratingImagesForTask,
    isBusy,
    getStatusLabel,
  }
})
