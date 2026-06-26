<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NButton,
  NCheckbox,
  NImage,
  NModal,
  NPopconfirm,
  NText,
  useMessage,
} from 'naive-ui'
import { useTaskOperationsStore } from '../../stores/task-operations'
import {
  type DoubaoModel,
  isAiConfigured,
  isGenerateConfigured,
  isProPlan,
  loadAiSettings,
  saveAnalysisModel,
} from '../../../shared/ai-settings'
import type {
  GeneratedImageRecord,
  GeneratedNoteDraft,
} from '../../../shared/ai-types'
import { normalizeGeneratedDraft } from '../../../shared/parse-generated-draft'
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
import {
  IMAGE_TO_DATA_URL_MESSAGE,
  type ImageToDataUrlResponse,
} from '../../../shared/messages'
import type {
  XhsPublishContentInput,
  XhsPublishImageInput,
} from '../../../shared/publish-xhs'
import { type Task, deleteTask, getTask, updateTask } from '../../../shared/task-db'
import type { ContentView, ContentViewOption } from '../../types/content-view'
import { analyzeNoteText } from '../../services/analyze-note'
import { generateNoteDraft } from '../../services/generate-note'
import { openPublishPage } from '../../services/publish-to-xhs'
import AnalysisCard from './AnalysisCard.vue'
import AnalyzeBar from './AnalyzeBar.vue'
import ContentViewTabs from './ContentViewTabs.vue'
import DraftEditorCard from './DraftEditorCard.vue'
import GenerateSimilarNoteDialog from './GenerateSimilarNoteDialog.vue'
import NotePreviewCard from './NotePreviewCard.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const taskOps = useTaskOperationsStore()

/** 当前任务 id（路由参数），切换任务时整页状态随之重载 */
const taskId = computed(() => String(route.params.id ?? ''))

const task = ref<Task | null>(null)
const isLoading = ref(true)

const contentView = ref<ContentView>('note')
/** 草稿可编辑副本（与 task.draft 解耦，便于自动保存） */
const draftModel = ref<GeneratedNoteDraft | null>(null)
const generateTopic = ref('')

const isAnalyzing = computed(() => taskOps.isAnalyzing(taskId.value))
const isGenerating = computed(() => taskOps.isGenerating(taskId.value))
const showGenerateDialog = ref(false)
const isDownloadingAllImages = ref(false)
const downloadingImageIndex = ref<number | null>(null)
const isOpeningPublish = ref(false)
const publishImageIds = ref<string[]>([])
const showPublishOrderDialog = ref(false)
const publishDialogImageIds = ref<string[]>([])

// ── AI 设置（任务页内联，仅本页消费） ────────────────────────

const analysisModel = ref<DoubaoModel>('doubao-seed-2-0-lite-260428')
const isProPlanRef = ref(false)
const isAiConfiguredRef = ref(false)
const isGenerateReady = ref(false)

async function refreshAiSettings() {
  const settings = await loadAiSettings()
  analysisModel.value = settings.model
  isProPlanRef.value = isProPlan(settings)
  isAiConfiguredRef.value = isAiConfigured(settings)
  isGenerateReady.value = isGenerateConfigured(settings)
}

async function setAnalysisModel(model: DoubaoModel) {
  await saveAnalysisModel(model)
  await refreshAiSettings()
  console.info('[RedCopy] 分析模型已切换', { model })
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
const imageHistory = computed(() => task.value?.imageHistory ?? [])
const publishDialogImages = computed(() =>
  publishDialogImageIds.value
    .map((id) => imageHistory.value.find((record) => record.id === id))
    .filter((record): record is GeneratedImageRecord => Boolean(record)),
)
const publishDialogRecords = computed(() => [
  ...publishDialogImages.value,
  ...imageHistory.value.filter(
    (record) => !publishDialogImageIds.value.includes(record.id),
  ),
])

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
const enableImageSelection = computed(() => images.value.length > 0)
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

function setPublishImageSelected(recordId: string, selected: boolean) {
  if (selected) {
    if (!publishImageIds.value.includes(recordId)) {
      publishImageIds.value = [...publishImageIds.value, recordId]
    }
    return
  }
  publishImageIds.value = publishImageIds.value.filter((id) => id !== recordId)
}

function setPublishCover(recordId: string) {
  publishImageIds.value = [
    recordId,
    ...publishImageIds.value.filter((id) => id !== recordId),
  ]
}

function movePublishImage(recordId: string, direction: -1 | 1) {
  const currentIndex = publishImageIds.value.indexOf(recordId)
  if (currentIndex < 0) return
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= publishImageIds.value.length) return

  const next = [...publishImageIds.value]
  ;[next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]]
  publishImageIds.value = next
}

function setPublishPosition(recordId: string, targetIndex: number) {
  const currentIndex = publishImageIds.value.indexOf(recordId)
  if (currentIndex < 0) return

  const boundedIndex = Math.min(
    Math.max(targetIndex, 0),
    publishImageIds.value.length - 1,
  )
  const next = [...publishImageIds.value]
  const [item] = next.splice(currentIndex, 1)
  next.splice(boundedIndex, 0, item)
  publishImageIds.value = next
}

function selectAllPublishImages() {
  publishImageIds.value = imageHistory.value.map((record) => record.id)
}

function clearPublishImages() {
  publishImageIds.value = []
}

function isDialogPublishSelected(recordId: string): boolean {
  return publishDialogImageIds.value.includes(recordId)
}

function dialogPublishIndex(recordId: string): number {
  return publishDialogImageIds.value.indexOf(recordId)
}

function dialogPublishRoleLabel(recordId: string): string {
  const index = dialogPublishIndex(recordId)
  if (index < 0) return '未选'
  return index === 0 ? '封面' : `页图${index}`
}

function setDialogPublishImageSelected(recordId: string, selected: boolean) {
  if (selected) {
    if (!publishDialogImageIds.value.includes(recordId)) {
      publishDialogImageIds.value = [...publishDialogImageIds.value, recordId]
    }
    return
  }
  publishDialogImageIds.value = publishDialogImageIds.value.filter((id) => id !== recordId)
}

function setDialogPublishCover(recordId: string) {
  publishDialogImageIds.value = [
    recordId,
    ...publishDialogImageIds.value.filter((id) => id !== recordId),
  ]
}

function moveDialogPublishImage(recordId: string, direction: -1 | 1) {
  const currentIndex = dialogPublishIndex(recordId)
  if (currentIndex < 0) return
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= publishDialogImageIds.value.length) return

  const next = [...publishDialogImageIds.value]
  ;[next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]]
  publishDialogImageIds.value = next
}

function selectAllDialogPublishImages() {
  publishDialogImageIds.value = imageHistory.value.map((record) => record.id)
}

function clearDialogPublishImages() {
  publishDialogImageIds.value = []
}

function openPublishOrderDialog() {
  if (imageHistory.value.length === 0) {
    message.warning('请先生成或上传至少一张配图')
    return
  }

  const recordIds = new Set(imageHistory.value.map((record) => record.id))
  const currentIds = publishImageIds.value.filter((id) => recordIds.has(id))
  publishDialogImageIds.value =
    currentIds.length > 0 ? currentIds : imageHistory.value.map((record) => record.id)
  showPublishOrderDialog.value = true
}

function isLocalPublishImage(url: string): boolean {
  return url.trim().startsWith('data:image/')
}

function imageUrlToDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: IMAGE_TO_DATA_URL_MESSAGE, url },
      (response?: ImageToDataUrlResponse) => {
        const err = chrome.runtime.lastError?.message
        if (err) {
          reject(new Error(err))
          return
        }
        if (!response?.ok || !response.dataUrl) {
          reject(new Error(response?.error ?? '图片转 Base64 失败'))
          return
        }
        resolve(response.dataUrl)
      },
    )
  })
}

async function ensurePublishImagesAreLocalBase64(
  records: GeneratedImageRecord[],
): Promise<GeneratedImageRecord[]> {
  const current = task.value
  if (!current) return records

  const convertedById = new Map<string, GeneratedImageRecord>()
  for (const record of records) {
    if (isLocalPublishImage(record.url)) {
      convertedById.set(record.id, record)
      continue
    }

    message.info(`正在转存「${record.label || '配图'}」为本地图片`)
    const dataUrl = await imageUrlToDataUrl(record.url)
    convertedById.set(record.id, {
      ...record,
      source: record.source ?? 'generated',
      url: dataUrl,
    })
  }

  if (convertedById.size === 0) return records

  const nextHistory = current.imageHistory.map((record) =>
    convertedById.get(record.id) ?? record,
  )
  const updated = await updateTask(current.id, { imageHistory: nextHistory })
  if (taskId.value === current.id && updated) task.value = updated

  return records.map((record) => convertedById.get(record.id) ?? record)
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
  return normalizeGeneratedDraft(draft)
}

async function loadTask(id: string) {
  isLoading.value = true
  const found = await getTask(id)
  task.value = found

  if (found) {
    const normalizedDraft = found.draft ? normalizeDraft(found.draft) : null
    draftModel.value = normalizedDraft
    generateTopic.value = found.generateTopic ?? ''
    contentView.value = found.draft ? 'draft' : found.analysis ? 'analysis' : 'note'
    selectedIndices.value = (found.note.images ?? []).map((_, index) => index)
    publishImageIds.value = []

    // 修复历史未解析成功的 JSON 草稿，或迁移旧版 imageTips → imagePrompts
    if (
      found.draft &&
      normalizedDraft &&
      (normalizedDraft.title !== found.draft.title ||
        (normalizedDraft.imagePrompts.length > 0 &&
          !(found.draft.imagePrompts?.length)))
    ) {
      await updateTask(id, { draft: normalizedDraft })
      task.value = { ...found, draft: normalizedDraft }
    }

    console.info('[RedCopy] 进入任务', { id, noteId: found.noteId })
  } else {
    draftModel.value = null
    console.warn('[RedCopy] 任务不存在', { id })
  }
  isLoading.value = false
}

watch(taskId, (id) => void loadTask(id), { immediate: true })

watch(imageHistory, (records) => {
  const recordIds = new Set(records.map((record) => record.id))
  publishImageIds.value = publishImageIds.value.filter((id) => recordIds.has(id))
})

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
    current.note.images?.length &&
    selectedImageUrls.value.length === 0
  ) {
    message.warning('请至少选择一张配图参与分析')
    return
  }

  taskOps.start(id, 'analyzing')
  try {
    const imageUrls =
      selectedImageUrls.value.length > 0 ? selectedImageUrls.value : undefined

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
    taskOps.stop(id, 'analyzing')
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
  taskOps.start(id, 'generating')
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
    taskOps.stop(id, 'generating')
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

// ── 配图生成历史（生成即落库，避免离开页面丢失） ────────────

async function handleImageGenerated(record: GeneratedImageRecord) {
  const current = task.value
  if (!current) {
    message.error('任务未加载，配图无法保存')
    return
  }
  const id = current.id
  try {
    const nextHistory = [record, ...(current.imageHistory ?? [])]
    const updated = await updateTask(id, { imageHistory: nextHistory })
    if (taskId.value === id && updated) task.value = updated
    console.info('[RedCopy] 配图已入历史并持久化', { id, recordId: record.id })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 配图保存失败', { id, recordId: record.id, detail }, error)
    message.error(`配图保存失败：${detail}`)
  }
}

async function handleDeleteImage(recordId: string) {
  const current = task.value
  if (!current) return
  const id = current.id
  const nextHistory = (current.imageHistory ?? []).filter(
    (item) => item.id !== recordId,
  )
  publishImageIds.value = publishImageIds.value.filter((id) => id !== recordId)
  const updated = await updateTask(id, { imageHistory: nextHistory })
  if (taskId.value === id && updated) task.value = updated
  console.info('[RedCopy] 已从配图历史删除', { id, recordId })
}

// ── 打开小红书发布页 ─────────────────────────────────────────

async function handleOpenPublishPage() {
  openPublishOrderDialog()
}

async function handleConfirmPublishOrder() {
  if (publishDialogImages.value.length === 0) {
    message.warning('请至少选择一张图片')
    return
  }

  isOpeningPublish.value = true
  try {
    const localImages = await ensurePublishImagesAreLocalBase64(publishDialogImages.value)
    publishImageIds.value = localImages.map((record) => record.id)
    const publishImages: XhsPublishImageInput[] = localImages.map(
      (record, index) => ({
        id: record.id,
        label: index === 0
          ? `封面-${record.label || '配图'}`
          : `页图${index}-${record.label || '配图'}`,
        url: record.url,
      }),
    )
    const publishContent: XhsPublishContentInput = {
      title: draftModel.value?.title ?? '',
      body: draftModel.value?.body ?? '',
      tags: draftModel.value?.tags ?? [],
    }
    const result = await openPublishPage(publishImages, publishContent)
    showPublishOrderDialog.value = false
    message.success(
      result.upload
        ? `已打开发布页并上传 ${result.upload.uploaded} 张图片，标题正文标签已回填`
        : '已打开小红书发布页',
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 打开发布页失败', detail, error)
    message.error(`打开失败：${detail}`)
  } finally {
    isOpeningPublish.value = false
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
    void router.push('/analysis')
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
  // 离开页面前若仍有未保存的草稿编辑，立即刷盘，避免丢失
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
    const id = task.value?.id
    if (id && draftModel.value) void persistDraft(id)
  }
})
</script>

<template>
  <div class="task-page">
    <div v-if="isLoading" class="task-placeholder">加载中…</div>

    <div v-else-if="!task" class="task-placeholder">
      任务不存在或已被删除
      <NButton size="small" class="task-placeholder-btn" @click="router.push('/analysis')">
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
        :content-view="contentView"
        :has-note="hasNote"
        :has-analysis="hasAnalysis"
        :has-draft="hasDraft"
        :is-analyzing="isAnalyzing"
        :is-generating="isGenerating"
        :is-ai-configured="isAiConfiguredRef"
        :is-generate-ready="isGenerateReady"
        :model="analysisModel"
        :is-pro-plan="isProPlanRef"
        @analyze="handleAnalyze"
        @generate="openGenerateDialog"
        @update:model="setAnalysisModel"
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
        @copy-text="handleCopyAnalysisText"
        @copy-markdown="handleCopyAnalysisMarkdown"
      />

      <DraftEditorCard
        v-if="showDraftSection && draftModel"
        v-model:draft="draftModel"
        :task-id="taskId"
        :is-pro-plan="isProPlanRef"
        :is-generate-ready="isGenerateReady"
        :image-history="imageHistory"
        :publish-image-ids="publishImageIds"
        :is-opening-publish="isOpeningPublish"
        @copy-text="handleCopyDraftText"
        @copy-markdown="handleCopyDraftMarkdown"
        @edit="scheduleDraftPersist"
        @generated="handleImageGenerated"
        @delete-image="handleDeleteImage"
        @set-publish-image-selected="setPublishImageSelected"
        @set-publish-cover="setPublishCover"
        @move-publish-image="movePublishImage"
        @set-publish-position="setPublishPosition"
        @select-all-publish-images="selectAllPublishImages"
        @clear-publish-images="clearPublishImages"
        @open-publish-page="handleOpenPublishPage"
      />
    </template>

    <GenerateSimilarNoteDialog
      v-model:show="showGenerateDialog"
      :initial-topic="generateTopic"
      :is-generating="isGenerating"
      :has-draft="hasDraft"
      @confirm="handleGenerate"
    />

    <NModal
      v-model:show="showPublishOrderDialog"
      preset="card"
      title="发布图片顺序"
      class="publish-order-modal"
      style="width: min(420px, calc(100vw - 28px))"
      :bordered="false"
      size="small"
    >
      <div class="publish-order-dialog">
        <NText depth="3" class="publish-order-hint">
          确认后先进入小红书图文发布页，再按此顺序触发上传；第 1 张为封面，后续依次为页图。
        </NText>

        <div class="publish-order-toolbar">
          <NText depth="3" class="publish-order-count">
            已选 {{ publishDialogImages.length }} / {{ imageHistory.length }} 张
          </NText>
          <div class="publish-order-toolbar-actions">
            <NButton size="tiny" secondary @click="selectAllDialogPublishImages">
              全选
            </NButton>
            <NButton size="tiny" secondary @click="clearDialogPublishImages">
              清空
            </NButton>
          </div>
        </div>

        <div class="publish-order-list">
          <div
            v-for="record in publishDialogRecords"
            :key="record.id"
            class="publish-order-item"
            :class="{ 'publish-order-item--selected': isDialogPublishSelected(record.id) }"
          >
            <NImage
              :src="record.url"
              object-fit="contain"
              class="publish-order-image"
              :img-props="{ alt: '发布图片' }"
            />
            <div class="publish-order-info">
              <div class="publish-order-main">
                <NCheckbox
                  :checked="isDialogPublishSelected(record.id)"
                  @update:checked="(value) => setDialogPublishImageSelected(record.id, Boolean(value))"
                >
                  {{ dialogPublishRoleLabel(record.id) }}
                </NCheckbox>
                <NText class="publish-order-label">
                  {{ record.label || '配图' }}
                </NText>
              </div>
              <NText depth="3" class="publish-order-meta">
                {{ record.aspectRatio ?? record.size }}
              </NText>
              <div
                v-if="isDialogPublishSelected(record.id)"
                class="publish-order-actions"
              >
                <NButton size="tiny" secondary @click="setDialogPublishCover(record.id)">
                  设为封面
                </NButton>
                <NButton size="tiny" quaternary @click="moveDialogPublishImage(record.id, -1)">
                  上移
                </NButton>
                <NButton size="tiny" quaternary @click="moveDialogPublishImage(record.id, 1)">
                  下移
                </NButton>
              </div>
            </div>
          </div>
        </div>

        <div class="publish-order-footer">
          <NButton size="small" secondary @click="showPublishOrderDialog = false">
            取消
          </NButton>
          <NButton
            size="small"
            type="primary"
            :loading="isOpeningPublish"
            :disabled="publishDialogImages.length === 0"
            @click="handleConfirmPublishOrder"
          >
            确定并上传
          </NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.task-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
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

.publish-order-modal {
  width: min(420px, calc(100vw - 28px));
}

.publish-order-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.publish-order-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.publish-order-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.publish-order-count {
  font-size: 12px;
}

.publish-order-toolbar-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.publish-order-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(54vh, 460px);
  overflow-y: auto;
  padding-right: 2px;
}

.publish-order-item {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 9px;
  padding: 8px;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  background: #f7f8fa;
}

.publish-order-item--selected {
  border-color: rgba(255, 36, 66, 0.42);
  background: #fff7f7;
}

.publish-order-image {
  width: 76px;
  height: 76px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.publish-order-image :deep(img) {
  width: 76px;
  height: 76px;
  object-fit: contain;
  display: block;
}

.publish-order-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.publish-order-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.publish-order-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.publish-order-meta {
  font-size: 11px;
}

.publish-order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.publish-order-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}
</style>
