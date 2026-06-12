<script setup lang="ts">
import {
  NButton,
  NCard,
  NDynamicTags,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AiAnalysisResult, GeneratedNoteDraft } from '../shared/ai-types'
import {
  clearLastAnalysis,
  loadLastAnalysis,
  saveLastAnalysis,
} from '../shared/analysis-storage'
import { isAiSettingsReady, loadAiSettings } from '../shared/ai-settings'
import {
  clearLastDraft,
  loadLastDraft,
  saveLastDraft,
} from '../shared/draft-storage'
import {
  copyTextToClipboard,
  formatAnalysisAsMarkdown,
  formatAnalysisAsPlainText,
  formatDraftAsMarkdown,
  formatDraftAsPlainText,
  formatNoteAsMarkdown,
} from '../shared/export-markdown'
import {
  API_KEY_SETUP_HINT,
  APP_NAME,
  APP_TAGLINE,
  CONTACT_GROUP,
  CONTACT_QQ,
} from '../shared/brand'
import { loadLastExtract, saveLastExtract } from '../shared/extract-storage'
import {
  downloadAllNoteImages,
  downloadNoteImage,
  formatImagesAsMarkdown,
  getNoteBodyText,
} from '../shared/note-media'
import type {
  NoteExtractResult,
  NoteMediaType,
  NoteTextInfo,
} from '../shared/note-types'
import { analyzeNoteText } from './analyze-note'
import { extractNoteFromTab } from './extract-note'
import { generateNoteDraft } from './generate-note'
import SettingsPanel from './SettingsPanel.vue'
import { useNotePageWatch } from './use-note-page-watch'

const message = useMessage()
let persistDraftTimer: ReturnType<typeof setTimeout> | null = null
const isXhsPage = ref(false)
const isNotePage = ref(false)
const isExtracting = ref(false)
const isAnalyzing = ref(false)
const isGenerating = ref(false)
const isDownloadingAllImages = ref(false)
const downloadingImageIndex = ref<number | null>(null)
const isAiConfigured = ref(false)
const showAiSettings = ref(false)
const notePreview = ref<NoteTextInfo | null>(null)
const analysisResult = ref<AiAnalysisResult | null>(null)
const generatedDraft = ref<GeneratedNoteDraft | null>(null)
const lastExtractMeta = ref<{ noteId: string | null; url: string } | null>(null)
const extractedNoteType = ref<NoteMediaType>('normal')
const generateTopic = ref('')

type ContentView = 'note' | 'analysis' | 'draft'
const contentView = ref<ContentView>('note')

const contentViewOptions = computed(() => {
  const options: { label: string; value: ContentView }[] = []
  if (notePreview.value) options.push({ label: '笔记', value: 'note' })
  if (analysisResult.value) options.push({ label: 'AI 分析', value: 'analysis' })
  if (generatedDraft.value) options.push({ label: '类似笔记', value: 'draft' })
  return options
})

const canSwitchView = computed(() => contentViewOptions.value.length >= 2)

function isActiveContentView(view: ContentView): boolean {
  if (!canSwitchView.value) return true
  return contentView.value === view
}

const showNoteSection = computed(
  () => !!notePreview.value && isActiveContentView('note'),
)

const showAnalysisSection = computed(
  () => !!analysisResult.value && isActiveContentView('analysis'),
)

const showDraftSection = computed(
  () => !!generatedDraft.value && isActiveContentView('draft'),
)

const extractedImages = computed(() => notePreview.value?.images ?? [])

const noteBodyText = computed(() => {
  const note = notePreview.value
  if (!note) return ''
  if (note.desc) return note.desc
  if (note.allText) return note.allText
  return '（无正文）'
})

async function refreshAiSettings() {
  const settings = await loadAiSettings()
  isAiConfigured.value = isAiSettingsReady(settings)
}

async function restoreLastExtract() {
  const saved = await loadLastExtract()
  if (!saved) return

  notePreview.value = saved.note
  lastExtractMeta.value = { noteId: saved.noteId, url: saved.url }
  extractedNoteType.value = saved.noteType ?? 'normal'
  console.info('[RedCopy] 已恢复上次提取', { noteId: saved.noteId })
}

async function restoreLastAnalysis() {
  const saved = await loadLastAnalysis()
  if (!saved) return

  analysisResult.value = saved.analysis
  console.info('[RedCopy] 已恢复上次分析', { noteId: saved.noteId })
}

function normalizeDraft(draft: GeneratedNoteDraft): GeneratedNoteDraft {
  return {
    ...draft,
    tags: draft.tags ?? [],
    imageTips: draft.imageTips ?? '',
  }
}

async function restoreLastDraft() {
  const saved = await loadLastDraft()
  if (!saved) return

  generatedDraft.value = normalizeDraft(saved.draft)
  console.info('[RedCopy] 已恢复上次类似笔记', { noteId: saved.noteId })
}

function openSettingsPanel() {
  showAiSettings.value = true
}

function handleSettingsSaved() {
  showAiSettings.value = false
  void refreshAiSettings()
}

useNotePageWatch(isXhsPage, isNotePage)

async function handleExtract() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id || !isNotePage.value) {
    message.warning('请先打开小红书笔记详情页')
    return
  }

  isExtracting.value = true

  // 第一步：提取笔记内容
  let extract: NoteExtractResult
  try {
    console.info('[RedCopy] 开始提取', { tabId: tab.id })
    extract = await extractNoteFromTab(tab.id, { includeDom: false })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 提取请求失败', detail, error)
    message.error(`提取失败：${detail}`)
    isExtracting.value = false
    return
  }

  if (!extract.ok) {
    console.warn('[RedCopy] 提取未成功', { error: extract.error })
    message.warning(extract.error ?? '未能提取笔记内容')
    isExtracting.value = false
    return
  }

  // 提取成功：先展示并提示，保存失败不影响该结果
  notePreview.value = extract.text
  lastExtractMeta.value = { noteId: extract.noteId, url: extract.url }
  extractedNoteType.value = extract.noteType

  // 重新提取后清空旧 AI 结果，避免与新笔记内容错位
  analysisResult.value = null
  generatedDraft.value = null
  contentView.value = 'note'
  try {
    await Promise.all([clearLastAnalysis(), clearLastDraft()])
    console.info('[RedCopy] 已清空上次 AI 结果', { noteId: extract.noteId })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.warn('[RedCopy] 清空 AI 缓存失败', detail, error)
  }

  message.success(
    extract.noteType === 'video'
      ? '已提取视频笔记文案（可进行文本分析与生成）'
      : '笔记内容已提取',
  )
  console.info('[RedCopy] 提取成功', {
    noteId: extract.noteId,
    images: extract.text.images?.length ?? 0,
    descLength: extract.text.desc?.length ?? 0,
  })

  // 第二步：保存上次提取结果（独立处理，失败仅提示，不报“提取失败”）
  try {
    await saveLastExtract({
      noteId: extract.noteId,
      url: extract.url,
      note: extract.text,
      noteType: extract.noteType,
    })
    console.info('[RedCopy] 提取结果已保存', { noteId: extract.noteId })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 保存提取结果失败', detail, error)
    message.warning('提取成功，但本地保存失败')
  } finally {
    isExtracting.value = false
  }
}

function getImageDownloadContext() {
  return {
    title: notePreview.value?.title,
    noteId: lastExtractMeta.value?.noteId,
  }
}

async function handleCopyNoteBody() {
  if (!notePreview.value) return

  try {
    const text = getNoteBodyText(notePreview.value)
    await copyTextToClipboard(text)
    message.success('正文已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制正文失败', detail, error)
    message.error('复制失败')
  }
}

async function handleCopyNoteImages() {
  if (!notePreview.value?.images.length) {
    message.warning('当前笔记没有图片')
    return
  }

  try {
    const markdown = formatImagesAsMarkdown(notePreview.value.images)
    await copyTextToClipboard(markdown)
    message.success('图片 Markdown 已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制图片失败', detail, error)
    message.error('复制失败')
  }
}

async function handleDownloadAllImages() {
  if (!notePreview.value?.images.length) {
    message.warning('当前笔记没有图片')
    return
  }

  isDownloadingAllImages.value = true
  try {
    const result = await downloadAllNoteImages(
      notePreview.value.images,
      getImageDownloadContext(),
    )
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
  const images = notePreview.value?.images
  const url = images?.[index]
  if (!url) return

  downloadingImageIndex.value = index
  try {
    await downloadNoteImage(url, index, getImageDownloadContext())
    message.success(`图片 ${index + 1} 已开始下载`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 单张图片下载失败', { index, detail }, error)
    message.error(`下载失败：${detail}`)
  } finally {
    downloadingImageIndex.value = null
  }
}

async function handleCopyNoteMarkdown() {
  if (!notePreview.value) return

  try {
    const markdown = formatNoteAsMarkdown(notePreview.value, {
      url: lastExtractMeta.value?.url,
      noteId: lastExtractMeta.value?.noteId,
    })
    await copyTextToClipboard(markdown)
    message.success('笔记 Markdown 已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制笔记 Markdown 失败', detail, error)
    message.error('复制失败')
  }
}

async function handleCopyAnalysisText() {
  if (!analysisResult.value) return

  try {
    const text = formatAnalysisAsPlainText(analysisResult.value)
    await copyTextToClipboard(text)
    message.success('AI 分析已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制 AI 分析失败', detail, error)
    message.error('复制失败')
  }
}

async function handleCopyAnalysisMarkdown() {
  if (!analysisResult.value) return

  try {
    const markdown = formatAnalysisAsMarkdown(analysisResult.value)
    await copyTextToClipboard(markdown)
    message.success('AI 分析 Markdown 已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制分析 Markdown 失败', detail, error)
    message.error('复制失败')
  }
}

function schedulePersistDraft() {
  if (!generatedDraft.value || !lastExtractMeta.value || !notePreview.value) {
    return
  }

  if (persistDraftTimer) clearTimeout(persistDraftTimer)
  persistDraftTimer = setTimeout(() => {
    void persistDraftEdits()
  }, 600)
}

async function persistDraftEdits() {
  if (!generatedDraft.value || !lastExtractMeta.value || !notePreview.value) {
    return
  }

  try {
    await saveLastDraft({
      noteId: lastExtractMeta.value.noteId,
      url: lastExtractMeta.value.url,
      generatedAt: Date.now(),
      note: notePreview.value,
      draft: generatedDraft.value,
    })
    console.info('[RedCopy] 类似笔记编辑已保存')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 保存类似笔记编辑失败', detail, error)
  }
}

async function handleCopyDraftText() {
  if (!generatedDraft.value) return

  try {
    const text = formatDraftAsPlainText(generatedDraft.value)
    await copyTextToClipboard(text)
    message.success('类似笔记已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制生成稿失败', detail, error)
    message.error('复制失败')
  }
}

async function handleCopyDraftMarkdown() {
  if (!generatedDraft.value) return

  try {
    const markdown = formatDraftAsMarkdown(generatedDraft.value)
    await copyTextToClipboard(markdown)
    message.success('类似笔记 Markdown 已复制')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 复制生成稿 Markdown 失败', detail, error)
    message.error('复制失败')
  }
}

async function handleOneClickGenerate() {
  if (!notePreview.value) {
    message.warning('请先执行提取，再生成类似笔记')
    return
  }

  if (!analysisResult.value) {
    message.warning('请先进行 AI 分析，再生成类似笔记')
    return
  }

  if (!lastExtractMeta.value) {
    message.warning('缺少笔记元数据，请重新提取后再生成')
    return
  }

  isGenerating.value = true

  try {
    const draft = await generateNoteDraft({
      noteId: lastExtractMeta.value.noteId,
      url: lastExtractMeta.value.url,
      text: notePreview.value,
      analysis: analysisResult.value,
      topic: generateTopic.value,
    })

    generatedDraft.value = normalizeDraft(draft)
    contentView.value = 'draft'

    try {
      await saveLastDraft({
        noteId: lastExtractMeta.value.noteId,
        url: lastExtractMeta.value.url,
        generatedAt: Date.now(),
        note: notePreview.value,
        draft: generatedDraft.value,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 保存类似笔记失败', detail, error)
      message.warning('生成成功，但本地保存失败')
    }

    message.success('类似笔记已生成，可直接编辑')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 生成类似笔记失败', detail, error)
    message.error(`生成失败：${detail}`)
  } finally {
    isGenerating.value = false
  }
}

async function handleAiAnalyze() {
  if (!notePreview.value) {
    message.warning('请先执行提取，再进行分析')
    return
  }

  if (!lastExtractMeta.value) {
    message.warning('缺少笔记元数据，请重新提取后再分析')
    return
  }

  isAnalyzing.value = true

  try {
    const analysis = await analyzeNoteText({
      noteId: lastExtractMeta.value.noteId,
      url: lastExtractMeta.value.url,
      text: notePreview.value,
    })

    analysisResult.value = analysis
    contentView.value = 'analysis'

    try {
      await saveLastAnalysis({
        noteId: lastExtractMeta.value.noteId,
        url: lastExtractMeta.value.url,
        analyzedAt: Date.now(),
        note: notePreview.value,
        analysis,
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 保存分析结果失败', detail, error)
      message.warning('分析成功，但本地保存失败')
    }

    message.success('AI 分析完成')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] AI 分析失败', detail, error)
    message.error(`分析失败：${detail}`)
  } finally {
    isAnalyzing.value = false
  }
}

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) {
  if (areaName !== 'local' || !changes['redcopy:aiSettings']) return
  void refreshAiSettings()
}

onMounted(() => {
  // 侧栏为原生扩展上下文，chrome.storage 通常可用；仍做保护避免异常
  chrome.storage?.onChanged?.addListener(handleStorageChanged)
  void Promise.all([
    restoreLastExtract(),
    restoreLastAnalysis(),
    restoreLastDraft(),
    refreshAiSettings(),
  ])
})

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged)
  if (persistDraftTimer) clearTimeout(persistDraftTimer)
})
</script>

<template>
  <main class="panel">
    <NModal
      v-model:show="showAiSettings"
      preset="card"
      title="配置 API Key"
      :bordered="false"
      size="small"
      style="width: 92%; max-width: 360px;"
      @after-leave="void refreshAiSettings()"
    >
      <SettingsPanel
        @saved="handleSettingsSaved"
        @close="showAiSettings = false"
      />
    </NModal>

    <NCard
      :title="APP_NAME"
      size="small"
      :bordered="false"
      class="panel-card"
    >
      <template #header-extra>
        <NButton
          quaternary
          circle
          size="small"
          title="配置 API Key"
          class="settings-gear-btn"
          @click="openSettingsPanel"
        >
          <svg class="gear-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96a.488.488 0 0 0-.59.22l-1.92 3.32c-.12.22-.09.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.09-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </NButton>
      </template>

      <NSpace vertical :size="12">
        <NText depth="3" class="app-tagline">{{ APP_TAGLINE }}</NText>

        <div
          v-if="!isAiConfigured"
          class="api-key-hint"
          role="button"
          tabindex="0"
          @click="openSettingsPanel"
          @keydown.enter="openSettingsPanel"
        >
          <NText class="api-key-hint-title">🍠 请先配置 DeepSeek API Key</NText>
          <NText depth="3" class="api-key-hint-text">
            {{ API_KEY_SETUP_HINT }}
            <NButton
              text
              tag="a"
              type="primary"
              size="tiny"
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
              @click.stop
            >
              去申请
            </NButton>
          </NText>
        </div>

        <NSpace align="center" justify="space-between">
          <NText depth="3" style="font-size: 12px;">提取与分析图文笔记</NText>
          <NSpace :size="6">
            <NTag type="info" size="small" round :bordered="false">图文+视频文案</NTag>
            <NTag :type="isNotePage ? 'success' : isXhsPage ? 'warning' : 'default'" size="small" round>
              {{ isNotePage ? '已就绪' : isXhsPage ? '非笔记页' : '未命中' }}
            </NTag>
          </NSpace>
        </NSpace>

        <NText depth="3" class="support-hint">
          视频笔记可提取标题/正文等文案用于分析与生成；图片下载仅适用于图文笔记。
        </NText>

        <NSpace vertical :size="8">
          <NButton
            type="primary"
            block
            :loading="isExtracting"
            :disabled="!isNotePage"
            @click="handleExtract"
          >
            {{ notePreview ? '重新提取笔记' : '执行提取' }}
          </NButton>

          <NButton
            block
            secondary
            :loading="isAnalyzing"
            :disabled="!isAiConfigured || !notePreview || isGenerating"
            :title="!isAiConfigured ? '请先点击右上角齿轮配置 API Key' : ''"
            @click="handleAiAnalyze"
          >
            {{ analysisResult ? '重新 AI 分析' : 'AI 分析' }}
          </NButton>
        </NSpace>

        <div v-if="analysisResult" class="generate-block">
          <NInput
            v-model:value="generateTopic"
            type="textarea"
            placeholder="想卖什么 / 主题或卖点（选填，留空也能生成）"
            :autosize="{ minRows: 1, maxRows: 4 }"
          />
          <NButton
            block
            class="one-click-generate-btn"
            :loading="isGenerating"
            :disabled="!isAiConfigured || !notePreview || isExtracting || isAnalyzing"
            @click="handleOneClickGenerate"
          >
            {{ generatedDraft ? '重新生成类似笔记' : '生成类似笔记' }}
          </NButton>
        </div>

        <NRadioGroup
          v-if="canSwitchView"
          v-model:value="contentView"
          size="small"
          class="content-view-switch"
        >
          <NRadioButton
            v-for="option in contentViewOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </NRadioButton>
        </NRadioGroup>

        <div v-if="showNoteSection && notePreview" class="note-preview-card">
          <NSpace align="center" justify="space-between" class="preview-meta">
            <NSpace :size="6">
              <NTag type="primary" size="small" round :bordered="false">
                👤 {{ notePreview.author || '未知作者' }}
              </NTag>
              <NTag
                v-if="extractedNoteType === 'video'"
                type="warning"
                size="small"
                round
                :bordered="false"
              >
                视频笔记
              </NTag>
            </NSpace>
            <NButton size="tiny" secondary @click="handleCopyNoteMarkdown">
              复制 Markdown
            </NButton>
          </NSpace>

          <div v-if="extractedImages.length > 0" class="preview-images-wrap">
            <NSpace align="center" justify="space-between" class="images-toolbar">
              <NText depth="3" class="images-toolbar-label">
                笔记图片 · {{ extractedImages.length }} 张
              </NText>
              <NSpace :size="6">
                <NButton size="tiny" secondary @click="handleCopyNoteImages">
                  复制图片
                </NButton>
                <NButton
                  size="tiny"
                  type="primary"
                  :loading="isDownloadingAllImages"
                  @click="handleDownloadAllImages"
                >
                  全部下载
                </NButton>
              </NSpace>
            </NSpace>

            <div class="preview-images">
              <div
                v-for="(imgUrl, index) in extractedImages"
                :key="`${imgUrl}-${index}`"
                class="preview-image-item"
              >
                <img
                  :src="imgUrl"
                  loading="lazy"
                  decoding="async"
                  :alt="`笔记图片 ${index + 1}`"
                  class="preview-image"
                />
                <NButton
                  class="preview-image-download-btn"
                  size="tiny"
                  secondary
                  :loading="downloadingImageIndex === index"
                  @click="handleDownloadImage(index)"
                >
                  下载
                </NButton>
              </div>
            </div>
          </div>

          <div class="preview-header">
            <NText strong class="preview-title">{{ notePreview.title || '（无标题）' }}</NText>
          </div>

          <div class="preview-content">
            <NSpace align="center" justify="space-between" class="content-toolbar">
              <NText depth="3" class="content-label">完整正文</NText>
              <NButton size="tiny" secondary @click="handleCopyNoteBody">
                复制正文
              </NButton>
            </NSpace>
            <NText depth="2" class="desc-preview">{{ noteBodyText }}</NText>
          </div>

          <NSpace v-if="notePreview.tags?.length" :size="6" class="preview-tags">
            <NTag
              v-for="tag in notePreview.tags"
              :key="tag"
              type="error"
              size="small"
              round
              :bordered="false"
              style="background-color: #ffeef0; color: #ff2442;"
            >
              # {{ tag }}
            </NTag>
          </NSpace>

          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-label">❤️ 点赞</span>
              <span class="stat-value">{{ notePreview.likedCount || 0 }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">⭐ 收藏</span>
              <span class="stat-value">{{ notePreview.collectedCount || 0 }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">💬 评论</span>
              <span class="stat-value">{{ notePreview.commentCount || 0 }}</span>
            </div>
          </div>
        </div>

        <div v-if="showAnalysisSection && analysisResult" class="analysis-card">
          <NSpace align="center" justify="space-between" class="analysis-header">
            <NSpace align="center" :size="8">
              <NText strong>AI 分析</NText>
              <NTag v-if="analysisResult.score != null" type="success" size="small" round>
                评分 {{ analysisResult.score }}
              </NTag>
            </NSpace>
            <NSpace :size="6">
              <NButton size="tiny" type="primary" @click="handleCopyAnalysisText">
                复制
              </NButton>
              <NButton size="tiny" secondary @click="handleCopyAnalysisMarkdown">
                Markdown
              </NButton>
            </NSpace>
          </NSpace>

          <div class="analysis-block">
            <NText depth="3" class="analysis-label">总结</NText>
            <NText class="analysis-text">{{ analysisResult.summary }}</NText>
          </div>

          <div v-if="analysisResult.titleAnalysis" class="analysis-block">
            <NText depth="3" class="analysis-label">标题分析</NText>
            <NText class="analysis-text">{{ analysisResult.titleAnalysis }}</NText>
          </div>

          <div v-if="analysisResult.contentStructure?.length" class="analysis-block">
            <NText depth="3" class="analysis-label">内容结构</NText>
            <ul class="analysis-list">
              <li v-for="(item, index) in analysisResult.contentStructure" :key="index">
                {{ item }}
              </li>
            </ul>
          </div>

          <div v-if="analysisResult.engagementInsight" class="analysis-block">
            <NText depth="3" class="analysis-label">互动洞察</NText>
            <NText class="analysis-text">{{ analysisResult.engagementInsight }}</NText>
          </div>

          <div v-if="analysisResult.rewriteSuggestions?.length" class="analysis-block">
            <NText depth="3" class="analysis-label">爆款创作建议</NText>
            <ul class="analysis-list">
              <li v-for="(item, index) in analysisResult.rewriteSuggestions" :key="index">
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <div v-if="showDraftSection && generatedDraft" class="draft-card">
          <NSpace align="center" justify="space-between" class="draft-header">
            <NText strong>类似笔记</NText>
            <NSpace :size="6">
              <NButton size="tiny" type="primary" @click="handleCopyDraftText">
                复制
              </NButton>
              <NButton size="tiny" secondary @click="handleCopyDraftMarkdown">
                Markdown
              </NButton>
            </NSpace>
          </NSpace>

          <NText depth="3" class="draft-edit-hint">内容可直接编辑，修改后会自动保存</NText>

          <div class="draft-block">
            <NText depth="3" class="draft-label">标题</NText>
            <NInput
              v-model:value="generatedDraft.title"
              placeholder="输入标题"
              @update:value="schedulePersistDraft"
            />
          </div>

          <div class="draft-block">
            <NText depth="3" class="draft-label">正文</NText>
            <NInput
              v-model:value="generatedDraft.body"
              type="textarea"
              placeholder="输入正文"
              :autosize="{ minRows: 6, maxRows: 16 }"
              @update:value="schedulePersistDraft"
            />
          </div>

          <div class="draft-block">
            <NText depth="3" class="draft-label">标签</NText>
            <NDynamicTags
              v-model:value="generatedDraft.tags"
              @update:value="schedulePersistDraft"
            />
          </div>

          <div class="draft-block">
            <NText depth="3" class="draft-label">配图建议</NText>
            <NInput
              v-model:value="generatedDraft.imageTips"
              type="textarea"
              placeholder="配图张数、封面与风格建议（选填）"
              :autosize="{ minRows: 2, maxRows: 8 }"
              @update:value="schedulePersistDraft"
            />
          </div>
        </div>

        <NText v-if="!notePreview" depth="3" class="empty-hint">
          点击「执行提取」获取当前笔记内容，不会自动执行。
        </NText>

        <footer class="panel-footer">
          <NText depth="3" class="footer-label">交流反馈</NText>
          <NText depth="3" class="footer-contact">
            QQ：{{ CONTACT_QQ }} · 群：{{ CONTACT_GROUP }}
          </NText>
        </footer>
      </NSpace>
    </NCard>
  </main>
</template>

<style scoped>
.panel {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.panel-card {
  min-height: 100%;
  border-radius: 0;
}

.settings-gear-btn {
  color: #86909c;
}

.settings-gear-btn:hover {
  color: #ff2442;
}

.gear-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.generate-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.one-click-generate-btn {
  background: linear-gradient(135deg, #ff2442 0%, #ff6b81 100%) !important;
  color: #fff !important;
  border: none !important;
  font-weight: 600;
}

.one-click-generate-btn:hover:not(:disabled) {
  opacity: 0.92;
}

.one-click-generate-btn:disabled {
  opacity: 0.55;
}

.note-preview-card,
.analysis-card,
.draft-card {
  background: #ffffff;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.preview-meta {
  margin-bottom: 12px;
}

.app-tagline {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.api-key-hint {
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7f0;
  border: 1px solid #ffe4cc;
  cursor: pointer;
}

.api-key-hint-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #d46b08;
  margin-bottom: 4px;
}

.api-key-hint-text {
  display: block;
  font-size: 12px;
  line-height: 1.6;
}

.support-hint,
.empty-hint {
  font-size: 12px;
  line-height: 1.5;
}

.panel-footer {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid #eef0f4;
  text-align: center;
}

.footer-label {
  display: block;
  font-size: 11px;
  margin-bottom: 4px;
}

.footer-contact {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.content-view-switch {
  display: flex;
  width: 100%;
  margin-top: 2px;
}

.content-view-switch :deep(.n-radio-button) {
  flex: 1;
  text-align: center;
}

.preview-images-wrap {
  margin-bottom: 12px;
}

.images-toolbar {
  margin-bottom: 8px;
}

.images-toolbar-label {
  font-size: 12px;
}

.preview-images {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
  align-items: flex-start;
}

.preview-image-item {
  position: relative;
  flex: 0 0 88%;
  width: 88%;
  scroll-snap-align: start;
}

.preview-image {
  width: 100%;
  height: auto;
  border-radius: 8px;
  object-fit: contain;
  background: #f2f3f5;
  display: block;
}

.preview-image-download-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: rgba(255, 255, 255, 0.92) !important;
}

.content-toolbar {
  margin-bottom: 6px;
}

.preview-title {
  font-size: 16px;
  line-height: 1.4;
  color: #333;
}

.preview-content {
  margin-top: 10px;
  background: #f9fafa;
  padding: 10px;
  border-radius: 6px;
}

.content-label {
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}

.desc-preview {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-tags {
  margin-top: 12px;
}

.preview-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fcfcfd;
  border: 1px solid #f2f3f5;
  border-radius: 8px;
  padding: 10px 16px;
  margin-top: 14px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: #86909c;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background-color: #e5e6eb;
}

.analysis-header {
  margin-bottom: 12px;
}

.analysis-block + .analysis-block {
  margin-top: 12px;
}

.analysis-label {
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}

.analysis-text {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.analysis-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: #1d2129;
}

.draft-header {
  margin-bottom: 8px;
}

.draft-edit-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.draft-block + .draft-block,
.draft-tags + .draft-block {
  margin-top: 12px;
}

.draft-label {
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}

.draft-title {
  font-size: 16px;
  line-height: 1.4;
  color: #333;
}

.draft-text {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.draft-tags {
  margin-top: 12px;
}
</style>
