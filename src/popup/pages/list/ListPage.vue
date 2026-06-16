<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NText, NTooltip, useMessage } from 'naive-ui'
import { isXhsNoteUrl } from '../../../shared/extract-note'
import { type Task, createTask, deleteTask, listTasks } from '../../../shared/task-db'
import { formatAllTasksAsMarkdown } from '../../../shared/export-markdown'
import { logExtractContentJson } from '../../../shared/extract-log'
import { downloadTextFile } from '../../../shared/note-media'
import { extractNoteFromTab } from '../../services/extract-note'
import { useTaskOperationsStore } from '../../stores/task-operations'
import PageStatusBar from './PageStatusBar.vue'
import TaskListCard from './TaskListCard.vue'

const router = useRouter()
const message = useMessage()
const taskOps = useTaskOperationsStore()

const tasks = ref<Task[]>([])
const isXhsPage = ref(false)
const isNotePage = ref(false)
const isExtracting = ref(false)
const isExporting = ref(false)

const busyHint = computed(() => {
  const analyzing = taskOps.analyzingIds.size
  const generating = taskOps.generatingIds.size
  const parts: string[] = []
  if (analyzing > 0) parts.push(`${analyzing} 个任务 AI 分析中`)
  if (generating > 0) parts.push(`${generating} 个任务生成中`)
  return parts.length > 0 ? parts.join('，') : ''
})

let watchingTabId: number | undefined

async function refreshTasks() {
  tasks.value = await listTasks()
}

// ── 当前标签页状态监听（控制「提取」按钮可用） ──────────────────

function applyPageUrl(url: string) {
  isXhsPage.value = /xiaohongshu\.com/.test(url)
  isNotePage.value = isXhsNoteUrl(url)
  console.info('[RedCopy] 页面状态更新', {
    url: url.slice(0, 100),
    isXhsPage: isXhsPage.value,
    isNotePage: isNotePage.value,
  })
}

async function syncActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  watchingTabId = tab?.id
  applyPageUrl(tab?.url ?? '')
}

const onTabActivated: Parameters<
  typeof chrome.tabs.onActivated.addListener
>[0] = (activeInfo) => {
  void (async () => {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    watchingTabId = tab.id
    applyPageUrl(tab.url ?? '')
  })()
}

const onTabUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
  tabId,
  changeInfo,
  tab,
) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return
  if (watchingTabId !== tabId) return
  applyPageUrl(changeInfo.url ?? tab.url ?? '')
}

const onHistoryStateUpdated: Parameters<
  typeof chrome.webNavigation.onHistoryStateUpdated.addListener
>[0] = (details) => {
  if (watchingTabId !== details.tabId) return
  applyPageUrl(details.url)
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

onMounted(() => {
  void refreshTasks()
  void syncActiveTab()
  chrome.tabs.onActivated.addListener(onTabActivated)
  chrome.tabs.onUpdated.addListener(onTabUpdated)
  chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated, {
    url: [{ hostSuffix: 'xiaohongshu.com' }],
  })
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
    if (name === 'list') void refreshTasks()
  },
)

onUnmounted(() => {
  chrome.tabs.onActivated.removeListener(onTabActivated)
  chrome.tabs.onUpdated.removeListener(onTabUpdated)
  chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated)
})
</script>

<template>
  <div class="list-page">
    <PageStatusBar :is-xhs-page="isXhsPage" :is-note-page="isNotePage" />

    <div v-if="busyHint" class="busy-hint" role="status" aria-live="polite">
      <NText depth="3" class="busy-hint-text">{{ busyHint }}</NText>
    </div>

    <NTooltip trigger="hover" :disabled="isNotePage">
      <template #trigger>
        <NButton
          type="primary"
          block
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

    <NButton
      v-if="tasks.length > 0"
      secondary
      block
      size="small"
      class="export-all-btn"
      :loading="isExporting"
      @click="handleExportAll"
    >
      一键导出全部笔记（Markdown）
    </NButton>

    <TaskListCard class="task-section" :tasks="tasks" @open="openTask" @delete="handleDelete" />
  </div>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 10px 12px 12px;
}

.extract-btn {
  font-weight: 600;
  height: 40px;
}

.export-all-btn {
  font-weight: 500;
}

.busy-hint {
  padding: 8px 10px;
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
  min-height: 120px;
}
</style>
