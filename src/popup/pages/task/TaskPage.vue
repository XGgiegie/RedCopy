<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NPopconfirm, useMessage } from 'naive-ui'
import {
  type AnalysisProvider,
  type DeepSeekModel,
  type DoubaoModel,
  getAnalysisProviderLabel,
  isAnalysisConfigured,
  isGenerateConfigured,
  isProviderConfigured,
  loadAiSettings,
  saveAnalysisModel,
  saveAnalysisProvider,
} from '../../../shared/ai-settings'
import type { GeneratedNoteDraft } from '../../../shared/ai-types'
import {
  copyTextToClipboard,
  formatAnalysisAsMarkdown,
  formatAnalysisAsPlainText,
  formatDraftAsMarkdown,
  formatDraftAsPlainText,
  formatNoteAsMarkdown,
} from '../../../shared/export-markdown'
import {
  downloadAllNoteImages,
  downloadNoteImage,
  formatImagesAsMarkdown,
  getNoteBodyText,
} from '../../../shared/note-media'
import { type Task, deleteTask, getTask, updateTask } from '../../../shared/task-db'
import type { ContentView, ContentViewOption } from '../../types/content-view'
import { analyzeNoteText } from '../../services/analyze-note'
import { generateNoteDraft } from '../../services/generate-note'
import AnalysisCard from './AnalysisCard.vue'
import AnalyzeBar from './AnalyzeBar.vue'
import ContentViewTabs from './ContentViewTabs.vue'
import DraftEditorCard from './DraftEditorCard.vue'
import GenerateSimilarNoteDialog from './GenerateSimilarNoteDialog.vue'
import NotePreviewCard from './NotePreviewCard.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

/** 当前任务 id（路由参数），切换任务时整页状态随之重载 */
const taskId = computed(() => String(route.params.id ?? ''))

const task = ref<Task | null>(null)
const isLoading = ref(true)

const contentView = ref<ContentView>('note')
/** 草稿可编辑副本（与 task.draft 解耦，便于自动保存） */
const draftModel = ref<GeneratedNoteDraft | null>(null)
const generateTopic = ref('')

const isAnalyzing = ref(false)
const isGenerating = ref(false)
const showGenerateDialog = ref(false)
const isDownloadingAllImages = ref(false)
const downloadingImageIndex = ref<number | null>(null)

// ── AI 设置（任务页内联，仅本页消费） ────────────────────────

const analysisProvider = ref<AnalysisProvider>('deepseek')
const deepseekModel = ref<DeepSeekModel>('deepseek-v4-flash')
const doubaoModel = ref<DoubaoModel>('doubao-seed-2-0-pro-260215')
const hasDeepseekKey = ref(false)
const hasDoubaoKey = ref(false)
const isAiConfigured = ref(false)
const isGenerateReady = ref(false)

const analysisModel = computed<DeepSeekModel | DoubaoModel>(() =>
  analysisProvider.value === 'doubao' ? doubaoModel.value : deepseekModel.value,
)
const supportsVision = computed(() => analysisProvider.value === 'doubao')
const analysisProviderLabel = computed(() =>
  getAnalysisProviderLabel(analysisProvider.value),
)

async function refreshAiSettings() {
  const settings = await loadAiSettings()
  analysisProvider.value = settings.analysisProvider
  deepseekModel.value = settings.deepseek.model
  doubaoModel.value = settings.doubao.model
  hasDeepseekKey.value = isProviderConfigured(settings, 'deepseek')
  hasDoubaoKey.value = isProviderConfigured(settings, 'doubao')
  isAiConfigured.value = isAnalysisConfigured(settings)
  isGenerateReady.value = isGenerateConfigured(settings)
}

async function setAnalysisProvider(provider: AnalysisProvider) {
  if (provider === analysisProvider.value) return
  await saveAnalysisProvider(provider)
  await refreshAiSettings()
  console.info('[RedCopy] 分析服务商已切换', { provider })
}

async function setAnalysisModel(model: DeepSeekModel | DoubaoModel) {
  await saveAnalysisModel(analysisProvider.value, model)
  await refreshAiSettings()
  console.info('[RedCopy] 分析模型已切换', { provider: analysisProvider.value, model })
}

function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) {
  if (areaName !== 'local' || !changes['redcopy:aiSettings']) return
  void refreshAiSettings()
}

// ── 任务内容（派生自 task） ──────────────────────────────────

const note = computed(() => task.value?.note ?? null)
const noteType = computed(() => task.value?.noteType ?? 'normal')
const analysis = computed(() => task.value?.analysis ?? null)
const images = computed(() => task.value?.note.images ?? [])

const hasNote = computed(() => !!note.value)
const hasAnalysis = computed(() => !!analysis.value)
const hasDraft = computed(() => !!draftModel.value)

const noteBodyText = computed(() => {
  const value = note.value
  if (!value) return ''
  if (value.desc) return value.desc
  if (value.allText) return value.allText
  return '（无正文）'
})

// ── 配图勾选（识图分析用） ───────────────────────────────────

const selectedIndices = ref<number[]>([])
const enableImageSelection = computed(
  () => supportsVision.value && images.value.length > 0,
)
const selectedImageUrls = computed(() =>
  selectedIndices.value
    .map((index) => images.value[index])
    .filter((url): url is string => Boolean(url)),
)

function isImageSelected(index: number): boolean {
  return selectedIndices.value.includes(index)
}

function setImageSelected(index: number, selected: boolean) {
  if (selected) {
    if (!isImageSelected(index)) {
      selectedIndices.value = [...selectedIndices.value, index].sort((a, b) => a - b)
    }
    return
  }
  selectedIndices.value = selectedIndices.value.filter((i) => i !== index)
}

function selectAllImages() {
  selectedIndices.value = images.value.map((_, index) => index)
}

function clearImageSelection() {
  selectedIndices.value = []
}

// ── 视图切换（笔记 / 分析 / 类似笔记） ───────────────────────

const contentViewOptions = computed<ContentViewOption[]>(() => {
  const options: ContentViewOption[] = []
  if (note.value) options.push({ label: '笔记', value: 'note' })
  if (analysis.value) options.push({ label: 'AI 分析', value: 'analysis' })
  if (draftModel.value) options.push({ label: '类似笔记', value: 'draft' })
  return options
})
const canSwitchView = computed(() => contentViewOptions.value.length >= 2)

function isActiveView(view: ContentView): boolean {
  if (!canSwitchView.value) return true
  return contentView.value === view
}
const showNoteSection = computed(() => !!note.value && isActiveView('note'))
const showAnalysisSection = computed(() => !!analysis.value && isActiveView('analysis'))
const showDraftSection = computed(() => !!draftModel.value && isActiveView('draft'))

// ── 加载任务 ────────────────────────────────────────────────

function normalizeDraft(draft: GeneratedNoteDraft): GeneratedNoteDraft {
  return { ...draft, tags: draft.tags ?? [], imageTips: draft.imageTips ?? '' }
}

async function loadTask(id: string) {
  isLoading.value = true
  const found = await getTask(id)
  task.value = found

  if (found) {
    draftModel.value = found.draft ? normalizeDraft(found.draft) : null
    generateTopic.value = found.generateTopic ?? ''
    contentView.value = found.draft ? 'draft' : found.analysis ? 'analysis' : 'note'
    selectedIndices.value = (found.note.images ?? []).map((_, index) => index)
    console.info('[RedCopy] 进入任务', { id, noteId: found.noteId })
  } else {
    draftModel.value = null
    console.warn('[RedCopy] 任务不存在', { id })
  }
  isLoading.value = false
}

watch(taskId, (id) => void loadTask(id), { immediate: true })

// ── 分析（捕获 id，避免切换任务时结果串台） ──────────────────

async function handleAnalyze() {
  const current = task.value
  if (!current) return
  const id = current.id

  if (!current.note) {
    message.warning('当前任务无笔记内容')
    return
  }
  if (
    supportsVision.value &&
    current.note.images?.length &&
    selectedImageUrls.value.length === 0
  ) {
    message.warning('请至少选择一张配图参与分析')
    return
  }

  isAnalyzing.value = true
  try {
    const imageUrls =
      supportsVision.value && selectedImageUrls.value.length > 0
        ? selectedImageUrls.value
        : undefined

    const analysisResult = await analyzeNoteText({
      noteId: current.noteId,
      url: current.url,
      text: current.note,
      imageUrls,
    })

    const updated = await updateTask(id, {
      analysis: analysisResult,
      analyzedAt: Date.now(),
    })

    // 仅当用户仍停留在该任务时才刷新视图，否则结果只静默落库
    if (taskId.value === id && updated) {
      task.value = updated
      contentView.value = 'analysis'
    }

    message.success(
      imageUrls?.length
        ? `AI 分析完成（已识别 ${imageUrls.length} 张配图）`
        : 'AI 分析完成，可生成类似笔记',
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] AI 分析失败', { id, detail }, error)
    message.error(`分析失败：${detail}`)
  } finally {
    isAnalyzing.value = false
  }
}

// ── 生成类似笔记 ────────────────────────────────────────────

function openGenerateDialog() {
  if (!analysis.value) {
    message.warning('请先完成 AI 分析')
    return
  }
  showGenerateDialog.value = true
}

async function handleGenerate(topicInput?: string) {
  const current = task.value
  if (!current) return
  const id = current.id

  if (!current.analysis) {
    message.warning('请先完成 AI 分析，再生成类似笔记')
    return
  }

  if (topicInput !== undefined) generateTopic.value = topicInput
  isGenerating.value = true
  try {
    const draft = await generateNoteDraft({
      noteId: current.noteId,
      url: current.url,
      text: current.note,
      analysis: current.analysis,
      topic: generateTopic.value,
    })
    const normalized = normalizeDraft(draft)

    const updated = await updateTask(id, {
      draft: normalized,
      generatedAt: Date.now(),
      generateTopic: generateTopic.value,
    })

    if (taskId.value === id && updated) {
      task.value = updated
      draftModel.value = normalized
      contentView.value = 'draft'
    }
    showGenerateDialog.value = false
    message.success('类似笔记已生成，可直接编辑')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 生成类似笔记失败', { id, detail }, error)
    message.error(`生成失败：${detail}`)
  } finally {
    isGenerating.value = false
  }
}

// ── 草稿编辑自动保存（捕获 id） ──────────────────────────────

let persistTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDraftPersist() {
  const id = task.value?.id
  if (!id || !draftModel.value) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => void persistDraft(id), 600)
}

async function persistDraft(id: string) {
  if (!draftModel.value) return
  try {
    const updated = await updateTask(id, {
      draft: draftModel.value,
      generateTopic: generateTopic.value,
    })
    if (taskId.value === id && updated) task.value = updated
    console.info('[RedCopy] 草稿编辑已保存', { id })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 保存草稿编辑失败', { id, detail }, error)
  }
}

// ── 复制 / 下载 ─────────────────────────────────────────────

function imageDownloadContext() {
  return { title: note.value?.title, noteId: task.value?.noteId ?? undefined }
}

async function copyWith(action: () => Promise<void>, okMsg: string) {
  try {
    await action()
    message.success(okMsg)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制失败', detail, error)
    message.error('复制失败')
  }
}

function handleCopyNoteMarkdown() {
  if (!note.value || !task.value) return
  void copyWith(
    () =>
      copyTextToClipboard(
        formatNoteAsMarkdown(note.value!, {
          url: task.value!.url,
          noteId: task.value!.noteId,
        }),
      ),
    '笔记 Markdown 已复制',
  )
}

function handleCopyNoteBody() {
  if (!note.value) return
  void copyWith(() => copyTextToClipboard(getNoteBodyText(note.value!)), '正文已复制')
}

function handleCopyNoteImages() {
  if (!note.value?.images.length) {
    message.warning('当前笔记没有图片')
    return
  }
  void copyWith(
    () => copyTextToClipboard(formatImagesAsMarkdown(note.value!.images)),
    '图片 Markdown 已复制',
  )
}

async function handleDownloadAllImages() {
  if (!note.value?.images.length) {
    message.warning('当前笔记没有图片')
    return
  }
  isDownloadingAllImages.value = true
  try {
    const result = await downloadAllNoteImages(note.value.images, imageDownloadContext())
    if (result.failed === 0) {
      message.success(`已开始下载 ${result.success} 张图片`)
    } else {
      message.warning(`下载完成：成功 ${result.success} 张，失败 ${result.failed} 张`)
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 批量下载图片失败', detail, error)
    message.error(`下载失败：${detail}`)
  } finally {
    isDownloadingAllImages.value = false
  }
}

async function handleDownloadImage(index: number) {
  const url = note.value?.images?.[index]
  if (!url) return
  downloadingImageIndex.value = index
  try {
    await downloadNoteImage(url, index, imageDownloadContext())
    message.success(`图片 ${index + 1} 已开始下载`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 单张图片下载失败', { index, detail }, error)
    message.error(`下载失败：${detail}`)
  } finally {
    downloadingImageIndex.value = null
  }
}

function handleCopyAnalysisText() {
  if (!analysis.value) return
  void copyWith(
    () => copyTextToClipboard(formatAnalysisAsPlainText(analysis.value!)),
    'AI 分析已复制',
  )
}

function handleCopyAnalysisMarkdown() {
  if (!analysis.value) return
  void copyWith(
    () => copyTextToClipboard(formatAnalysisAsMarkdown(analysis.value!)),
    'AI 分析 Markdown 已复制',
  )
}

function handleCopyDraftText() {
  if (!draftModel.value) return
  void copyWith(
    () => copyTextToClipboard(formatDraftAsPlainText(draftModel.value!)),
    '类似笔记已复制',
  )
}

function handleCopyDraftMarkdown() {
  if (!draftModel.value) return
  void copyWith(
    () => copyTextToClipboard(formatDraftAsMarkdown(draftModel.value!)),
    '类似笔记 Markdown 已复制',
  )
}

// ── 删除 / 设置 ─────────────────────────────────────────────

async function handleDeleteTask() {
  const id = task.value?.id
  if (!id) return
  try {
    await deleteTask(id)
    message.success('已删除任务')
    void router.push('/')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 删除任务失败', { id, detail }, error)
    message.error(`删除失败：${detail}`)
  }
}

function openSettings() {
  void router.push('/settings')
}

onMounted(() => {
  void refreshAiSettings()
  chrome.storage?.onChanged?.addListener(onStorageChanged)
})

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(onStorageChanged)
  if (persistTimer) clearTimeout(persistTimer)
})
</script>

<template>
  <div class="task-page">
    <div v-if="isLoading" class="task-placeholder">加载中…</div>

    <div v-else-if="!task" class="task-placeholder">
      任务不存在或已被删除
      <NButton size="small" class="task-placeholder-btn" @click="router.push('/')">
        返回列表
      </NButton>
    </div>

    <template v-else>
      <div class="task-toolbar">
        <h2 class="task-toolbar-title">{{ task.note.title || '（无标题）' }}</h2>
        <NPopconfirm
          positive-text="删除"
          negative-text="取消"
          @positive-click="handleDeleteTask"
        >
          <template #trigger>
            <NButton quaternary size="small" class="delete-btn" title="删除任务">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path
                  d="M6 2.5h4l.5 1.5H13v1H3V4h2.5L6 2.5ZM4 6.5h8l-.7 7.1-.1.9H4.8l-.1-.9L4 6.5Zm2 1.5v5h1V8H6Zm3 0v5h1V8H9Z"
                />
              </svg>
            </NButton>
          </template>
          确定删除这条任务？分析结果与生成内容将一并删除。
        </NPopconfirm>
      </div>

      <AnalyzeBar
        :has-note="hasNote"
        :is-analyzing="isAnalyzing"
        :is-generating="isGenerating"
        :is-ai-configured="isAiConfigured"
        :has-analysis="hasAnalysis"
        :analysis-provider="analysisProvider"
        :analysis-model="analysisModel"
        :has-deepseek-key="hasDeepseekKey"
        :has-doubao-key="hasDoubaoKey"
        :analysis-provider-label="analysisProviderLabel"
        @analyze="handleAnalyze"
        @update:analysis-provider="setAnalysisProvider"
        @update:analysis-model="setAnalysisModel"
        @open-settings="openSettings"
      />

      <ContentViewTabs
        v-if="canSwitchView"
        v-model="contentView"
        :options="contentViewOptions"
      />

      <NotePreviewCard
        v-if="showNoteSection && note"
        :note="note"
        :note-type="noteType"
        :images="images"
        :body-text="noteBodyText"
        :is-downloading-all="isDownloadingAllImages"
        :downloading-index="downloadingImageIndex"
        :enable-image-selection="enableImageSelection"
        :is-image-selected="isImageSelected"
        @copy-markdown="handleCopyNoteMarkdown"
        @copy-body="handleCopyNoteBody"
        @copy-images="handleCopyNoteImages"
        @download-all="handleDownloadAllImages"
        @download-image="handleDownloadImage"
        @set-image-selected="setImageSelected"
        @select-all-images="selectAllImages"
        @clear-image-selection="clearImageSelection"
      />

      <AnalysisCard
        v-if="showAnalysisSection && analysis"
        :analysis="analysis"
        :show-generate="hasAnalysis"
        :is-generating="isGenerating"
        :is-generate-ready="isGenerateReady"
        :is-analyzing="isAnalyzing"
        :has-draft="hasDraft"
        @copy-text="handleCopyAnalysisText"
        @copy-markdown="handleCopyAnalysisMarkdown"
        @generate-similar="openGenerateDialog"
      />

      <DraftEditorCard
        v-if="showDraftSection && draftModel"
        v-model:draft="draftModel"
        @copy-text="handleCopyDraftText"
        @copy-markdown="handleCopyDraftMarkdown"
        @edit="scheduleDraftPersist"
      />
    </template>

    <GenerateSimilarNoteDialog
      v-model:show="showGenerateDialog"
      :initial-topic="generateTopic"
      :is-generating="isGenerating"
      :has-draft="hasDraft"
      @confirm="handleGenerate"
    />
  </div>
</template>

<style scoped>
.task-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 100%;
  padding: 10px 12px 12px;
}

.task-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 16px;
  color: #86909c;
  font-size: 13px;
}

.task-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef0f4;
}

.task-toolbar-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #1d2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  flex-shrink: 0;
  color: #86909c !important;
  padding: 0 6px !important;
}

.delete-btn:hover {
  color: #f53f3f !important;
  background: #fff1f0 !important;
}

.delete-btn svg {
  width: 15px;
  height: 15px;
  display: block;
}
</style>
