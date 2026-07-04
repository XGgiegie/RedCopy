<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NText, NTooltip, useMessage } from 'naive-ui'
import { type CreationPurposeKey } from '../../../shared/creation-intent'
import { type Task, clearAllTasks, createTask, deleteTask, listTasks } from '../../../shared/task-db'
import { formatAllTasksAsMarkdown } from '../../../shared/export-markdown'
import { logExtractContentJson } from '../../../shared/extract-log'
import { downloadTextFile } from '../../../shared/note-media'
import { isGenerateConfigured, loadAiSettings } from '../../../shared/ai-settings'
import { extractNoteFromTab } from '../../services/extract-note'
import { useTaskOperationsStore } from '../../stores/task-operations'
import { usePageStatusStore } from '../../stores/page-status'
import {
  getAnalyzeGenerateTaskStatuses,
  startAnalyzeGenerateTask,
} from '../../services/background-tasks'
import GenerateComposerPanel from '../task/GenerateComposerPanel.vue'
import TaskListCard from './TaskListCard.vue'
import AutoCollectDialog from './AutoCollectDialog.vue'

const router = useRouter()
const message = useMessage()
const taskOps = useTaskOperationsStore()
const pageStatus = usePageStatusStore()

const tasks = ref<Task[]>([])
const isExtracting = ref(false)
const isDirectCreating = ref(false)
const directPurpose = ref<CreationPurposeKey | null>(null)
const directTopic = ref('')
const directCreateError = ref('')
const isExporting = ref(false)
const showAutoCollect = ref(false)
const activeSubPage = ref<'direct' | 'imitate'>('direct')

const isNotePage = computed(() => pageStatus.isNotePage)
const isXhsPage = computed(() => pageStatus.isXhsPage)
let analyzeGenerateStatusTimer: ReturnType<typeof setInterval> | null = null

const busyHint = computed(() => {
  const analyzing = taskOps.analyzingIds.size
  const generating = taskOps.generatingIds.size
  const parts: string[] = []
  if (analyzing > 0) parts.push(`${analyzing} 个任务分析中`)
  if (generating > 0) parts.push(`${generating} 个任务创作中`)
  return parts.length > 0 ? parts.join('，') : ''
})

async function refreshTasks() {
  tasks.value = await listTasks()
}

function createBlankNote(title: string) {
  return {
    title,
    desc: '',
    author: '',
    tags: [],
    publishTime: '',
    likedCount: '',
    collectedCount: '',
    commentCount: '',
    allText: '',
    images: [],
  }
}

async function syncAnalyzeGenerateStatuses(refreshWhenFinished = false) {
  try {
    const previousBusyCount = taskOps.busyCount
    const response = await getAnalyzeGenerateTaskStatuses()
    taskOps.syncAnalyzeGenerateStatuses(response.statuses ?? {})
    if (refreshWhenFinished && taskOps.busyCount < previousBusyCount) {
      await refreshTasks()
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn('[RedCopy] 同步后台生成任务状态失败', detail, error)
  }
}

// ── 创作入口 ────────────────────────────────────────────────

async function handleDirectCreate() {
  const purpose = directPurpose.value
  const topic = directTopic.value.trim()
  directCreateError.value = ''
  if (!purpose) {
    directCreateError.value = '请先选择笔记主题。'
    message.warning('请先选择创作目的')
    return
  }
  if (!topic) {
    directCreateError.value = '请先填写明确主题、卖点、场景或案例。'
    message.warning('请先填写明确主题或卖点')
    return
  }

  isDirectCreating.value = true
  try {
    const settings = await loadAiSettings()
    if (!isGenerateConfigured(settings)) {
      directCreateError.value = '缺少可用的 API Key，请先完成配置后再创作。'
      message.warning('请先配置 API Key 后再创作')
      void router.push('/settings')
      return
    }

    const title = topic.length > 28 ? `${topic.slice(0, 28)}…` : topic
    const task = await createTask({
      noteId: null,
      url: '',
      note: createBlankNote(title),
      noteType: 'normal',
      creationMode: 'direct',
      generatePurpose: purpose,
      generateTopic: topic,
    })
    const response = await startAnalyzeGenerateTask({
      taskId: task.id,
      mode: 'direct',
      purpose,
      topic,
    })
    taskOps.syncAnalyzeGenerateStatus(task.id, response.status)
    directPurpose.value = null
    directTopic.value = ''
    directCreateError.value = ''
    await refreshTasks()
    message.success('已开始直接创作，任务会在后台继续')
    void router.push({ name: 'task', params: { id: task.id } })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 直接创作启动失败', detail, error)
    directCreateError.value = detail
    message.error(`直接创作失败：${detail}`)
  } finally {
    isDirectCreating.value = false
  }
}

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
      creationMode: 'note_analysis',
    })
    await refreshTasks()

    message.success('已提取参考笔记，可进入任务仿照创作')
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

// ── 一键导出全部创作任务（Markdown 文件下载） ───────────────

async function handleExportAll() {
  if (tasks.value.length === 0) {
    message.warning('暂无可导出的创作任务')
    return
  }

  isExporting.value = true
  try {
    const markdown = formatAllTasksAsMarkdown(tasks.value)
    const stamp = new Date()
      .toLocaleString('zh-CN', { hour12: false })
      .replace(/[/:]/g, '-')
      .replace(/\s+/g, '_')
    await downloadTextFile(markdown, `全部创作任务-${stamp}.md`)
    message.success(`已导出 ${tasks.value.length} 条创作任务`)
    console.info('[RedCopy] 全部创作任务已导出', { count: tasks.value.length })
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
    message.warning('暂无创作任务')
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
  void syncAnalyzeGenerateStatuses()
  analyzeGenerateStatusTimer = setInterval(() => {
    void syncAnalyzeGenerateStatuses(true)
  }, 2200)
  // 进入首页时主动同步一次当前标签页状态（监听由 App 根组件常驻维护）
  void pageStatus.syncActiveTab()
})

onUnmounted(() => {
  if (analyzeGenerateStatusTimer) {
    clearInterval(analyzeGenerateStatusTimer)
    analyzeGenerateStatusTimer = null
  }
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
    if (name === 'creation') void refreshTasks()
  },
)
</script>

<template>
  <div class="list-page">
    <div class="list-page-sticky">
      <div v-if="busyHint" class="busy-hint" role="status" aria-live="polite">
        <NText depth="3" class="busy-hint-text">{{ busyHint }}</NText>
      </div>

      <nav class="creation-subnav" aria-label="创作二级导航">
        <button
          type="button"
          class="creation-subnav-btn"
          :class="{ 'creation-subnav-btn--active': activeSubPage === 'direct' }"
          @click="activeSubPage = 'direct'"
        >
          直接创作
        </button>
        <button
          type="button"
          class="creation-subnav-btn"
          :class="{ 'creation-subnav-btn--active': activeSubPage === 'imitate' }"
          @click="activeSubPage = 'imitate'"
        >
          仿照创作
        </button>
      </nav>

      <section v-if="activeSubPage === 'direct'" class="creation-module">
        <GenerateComposerPanel
          mode="direct"
          :purpose="directPurpose"
          :topic="directTopic"
          :is-generating="isDirectCreating"
          :has-draft="false"
          :error-message="directCreateError"
          @update:purpose="directPurpose = $event"
          @update:topic="directTopic = $event"
          @confirm="handleDirectCreate"
        />
      </section>

      <section v-else class="creation-module">
        <div class="module-heading">
          <NText strong class="module-title">仿照创作</NText>
          <NText depth="3" class="module-subtitle">提取参考笔记，再仿照结构与卖点生成草稿</NText>
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
            {{ isNotePage ? '提取当前笔记到创作任务' : '请先打开小红书笔记详情页' }}
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
      </section>

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
        title="创作任务"
        empty-text="直接创作或仿照创作后显示在这里"
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

.creation-subnav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.creation-subnav-btn {
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.creation-subnav-btn:hover {
  color: #ff2442;
  border-color: #ffb3c0;
  background: #fff5f6;
}

.creation-subnav-btn--active,
.creation-subnav-btn--active:hover {
  color: #ff2442;
  border-color: #ffccc7;
  background: #fff1f0;
}

.extract-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.creation-module {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  background: #fff;
}

.module-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.module-title {
  flex-shrink: 0;
  font-size: 13px;
  color: #1d2129;
}

.module-subtitle {
  min-width: 0;
  font-size: 11px;
  line-height: 1.4;
  text-align: right;
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
