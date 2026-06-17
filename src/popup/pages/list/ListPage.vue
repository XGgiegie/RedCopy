<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NText, NTooltip, useMessage } from 'naive-ui'
import { type Task, clearAllTasks, createTask, deleteTask, listTasks } from '../../../shared/task-db'
import { formatAllTasksAsMarkdown } from '../../../shared/export-markdown'
import { logExtractContentJson } from '../../../shared/extract-log'
import { downloadTextFile } from '../../../shared/note-media'
import { extractNoteFromTab } from '../../services/extract-note'
import { useTaskOperationsStore } from '../../stores/task-operations'
import { usePageStatusStore } from '../../stores/page-status'
import TaskListCard from './TaskListCard.vue'
import AutoCollectDialog from './AutoCollectDialog.vue'

const router = useRouter()
const message = useMessage()
const taskOps = useTaskOperationsStore()
const pageStatus = usePageStatusStore()

const tasks = ref<Task[]>([])
const isExtracting = ref(false)
const isExporting = ref(false)
const showAutoCollect = ref(false)

const isNotePage = computed(() => pageStatus.isNotePage)
const isXhsPage = computed(() => pageStatus.isXhsPage)

const busyHint = computed(() => {
  const analyzing = taskOps.analyzingIds.size
  const generating = taskOps.generatingIds.size
  const parts: string[] = []
  if (analyzing > 0) parts.push(`${analyzing} 个任务 AI 分析中`)
  if (generating > 0) parts.push(`${generating} 个任务生成中`)
  return parts.length > 0 ? parts.join('，') : ''
})

async function refreshTasks() {
  tasks.value = await listTasks()
}

// ── 提取 ────────────────────────────────────────────────────

async function handleExtract() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !isNotePage.value) {
    message.warning('请先打开小红书笔记详情页')
    return
  }

  isExtracting.value = true
  try {
    console.log('[RedCopy] 开始提取', { tabId: tab.id })
    const extract = await extractNoteFromTab(tab.id, { includeDom: false })
    logExtractContentJson(extract, '[RedCopy][侧栏]')

    if (!extract.ok) {
      console.warn('[RedCopy] 提取未成功', { error: extract.error })
      message.warning(extract.error ?? '未能提取笔记内容')
      return
    }

    const task = await createTask({
      noteId: extract.noteId,
      url: extract.url,
      note: extract.text,
      noteType: extract.noteType,
    })
    await refreshTasks()

    message.success('已提取并加入任务，进入后可分析')
    console.info('[RedCopy] 提取成功', {
      id: task.id,
      noteId: extract.noteId,
      images: extract.text.images?.length ?? 0,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 提取失败', detail, error)
    message.error(`提取失败：${detail}`)
  } finally {
    isExtracting.value = false
  }
}

// ── 一键导出全部笔记（Markdown 文件下载） ───────────────────

async function handleExportAll() {
  if (tasks.value.length === 0) {
    message.warning('暂无可导出的笔记')
    return
  }

  isExporting.value = true
  try {
    const markdown = formatAllTasksAsMarkdown(tasks.value)
    const stamp = new Date()
      .toLocaleString('zh-CN', { hour12: false })
      .replace(/[/:]/g, '-')
      .replace(/\s+/g, '_')
    await downloadTextFile(markdown, `全部笔记-${stamp}.md`)
    message.success(`已导出 ${tasks.value.length} 条笔记`)
    console.info('[RedCopy] 全部笔记已导出', { count: tasks.value.length })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 导出全部笔记失败', detail, error)
    message.error(`导出失败：${detail}`)
  } finally {
    isExporting.value = false
  }
}

function openTask(id: string) {
  void router.push({ name: 'task', params: { id } })
}

async function handleDelete(id: string) {
  try {
    await deleteTask(id)
    await refreshTasks()
    message.success('已删除任务')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 删除任务失败', { id, detail }, error)
    message.error(`删除失败：${detail}`)
  }
}

async function handleClearAll() {
  if (tasks.value.length === 0) {
    message.warning('暂无历史任务')
    return
  }
  if (taskOps.busyCount > 0) {
    message.warning('有任务进行中，请稍后再清空')
    return
  }

  try {
    const count = await clearAllTasks()
    await refreshTasks()
    message.success(`已清空 ${count} 条历史任务`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 清空历史任务失败', detail, error)
    message.error(`清空失败：${detail}`)
  }
}

onMounted(() => {
  void refreshTasks()
  // 进入首页时主动同步一次当前标签页状态（监听由 App 根组件常驻维护）
  void pageStatus.syncActiveTab()
})

// 后台分析/生成结束后刷新列表，更新进度条
watch(
  () => taskOps.busyCount,
  (count, prevCount) => {
    if (prevCount !== undefined && count < prevCount) {
      void refreshTasks()
    }
  },
)

// 从任务页返回时同步最新数据
watch(
  () => router.currentRoute.value.name,
  (name) => {
    if (name === 'analysis') void refreshTasks()
  },
)
</script>

<template>
  <div class="list-page">
    <div class="list-page-sticky">
      <div v-if="busyHint" class="busy-hint" role="status" aria-live="polite">
        <NText depth="3" class="busy-hint-text">{{ busyHint }}</NText>
      </div>

      <div class="extract-row">
        <NTooltip trigger="hover" :disabled="isNotePage">
          <template #trigger>
            <NButton
              type="primary"
              size="medium"
              class="extract-btn"
              :loading="isExtracting"
              :disabled="!isNotePage"
              @click="handleExtract"
            >
              提取当前笔记
            </NButton>
          </template>
          {{ isNotePage ? '提取当前笔记到任务列表' : '请先打开小红书笔记详情页' }}
        </NTooltip>

        <NTooltip trigger="hover">
          <template #trigger>
            <NButton
              secondary
              size="medium"
              class="auto-btn"
              :disabled="!isXhsPage"
              @click="showAutoCollect = true"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="auto-btn-icon">
                <path
                  d="M10 2a1 1 0 0 1 1 1v1.07A5.002 5.002 0 0 1 15.93 9H17a1 1 0 1 1 0 2h-1.07A5.002 5.002 0 0 1 11 15.93V17a1 1 0 1 1-2 0v-1.07A5.002 5.002 0 0 1 4.07 11H3a1 1 0 1 1 0-2h1.07A5.002 5.002 0 0 1 9 4.07V3a1 1 0 0 1 1-1Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
                />
              </svg>
              自动
            </NButton>
          </template>
          {{ isXhsPage ? '按关键词搜索并自动筛选入库' : '请先打开小红书网站' }}
        </NTooltip>
      </div>

      <AutoCollectDialog
        v-model:show="showAutoCollect"
        @completed="refreshTasks"
      />
    </div>

    <div class="list-page-scroll">
      <TaskListCard
        class="task-section"
        :tasks="tasks"
        :exporting="isExporting"
        @open="openTask"
        @delete="handleDelete"
        @export-all="handleExportAll"
        @clear-all="handleClearAll"
      />
    </div>
  </div>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.list-page-sticky {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #eef0f4;
}

.list-page-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
}

.extract-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.extract-btn {
  flex: 1;
  font-weight: 600;
  height: 40px;
}

.auto-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 12px;
  font-weight: 600;
}

.auto-btn-icon {
  width: 16px;
  height: 16px;
}

.busy-hint {
  padding: 6px 10px;
  border-radius: 8px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
}

.busy-hint-text {
  font-size: 12px;
  color: #ff2442;
}

.task-section {
  flex: 1;
  min-height: 0;
}
</style>
