<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NTooltip, useMessage } from 'naive-ui'
import { isXhsNoteUrl } from '../../../shared/extract-note'
import { type Task, createTask, deleteTask, listTasks } from '../../../shared/task-db'
import { extractNoteFromTab } from '../../services/extract-note'
import PageStatusBar from './PageStatusBar.vue'
import TaskListCard from './TaskListCard.vue'

const router = useRouter()
const message = useMessage()

const tasks = ref<Task[]>([])
const isXhsPage = ref(false)
const isNotePage = ref(false)
const isExtracting = ref(false)

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
    console.info('[RedCopy] 开始提取', { tabId: tab.id })
    const extract = await extractNoteFromTab(tab.id, { includeDom: false })

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

onUnmounted(() => {
  chrome.tabs.onActivated.removeListener(onTabActivated)
  chrome.tabs.onUpdated.removeListener(onTabUpdated)
  chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated)
})
</script>

<template>
  <div class="list-page">
    <PageStatusBar :is-xhs-page="isXhsPage" :is-note-page="isNotePage" />

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

.task-section {
  flex: 1;
  min-height: 120px;
}
</style>
