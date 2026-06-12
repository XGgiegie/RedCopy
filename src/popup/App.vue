<script setup lang="ts">
import {
  NButton,
  NCard,
  NModal,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { AiAnalysisResult } from '../shared/ai-types'
import { loadLastAnalysis, saveLastAnalysis } from '../shared/analysis-storage'
import { isAiSettingsReady, loadAiSettings } from '../shared/ai-settings'
import { loadLastExtract, saveLastExtract } from '../shared/extract-storage'
import type { NoteExtractResult, NoteTextInfo } from '../shared/note-types'
import { analyzeNoteText } from './analyze-note'
import { extractNoteFromTab } from './extract-note'
import SettingsPanel from './SettingsPanel.vue'
import { useNotePageWatch } from './use-note-page-watch'

const message = useMessage()
const isXhsPage = ref(false)
const isNotePage = ref(false)
const isExtracting = ref(false)
const isAnalyzing = ref(false)
const isAiConfigured = ref(false)
const showAiSettings = ref(false)
const notePreview = ref<NoteTextInfo | null>(null)
const analysisResult = ref<AiAnalysisResult | null>(null)
const lastExtractMeta = ref<{ noteId: string | null; url: string } | null>(null)

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
  console.info('[RedCopy] 已恢复上次提取', { noteId: saved.noteId })
}

async function restoreLastAnalysis() {
  const saved = await loadLastAnalysis()
  if (!saved) return

  analysisResult.value = saved.analysis
  console.info('[RedCopy] 已恢复上次分析', { noteId: saved.noteId })
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
    message.warning('请先打开小红书图文笔记详情页')
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
  message.success('笔记内容已提取')
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
    refreshAiSettings(),
  ])
})

onUnmounted(() => {
  chrome.storage?.onChanged?.removeListener(handleStorageChanged)
})
</script>

<template>
  <main class="panel">
    <NModal
      v-model:show="showAiSettings"
      preset="card"
      title="更换 API Key"
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
      title="小红书爆款解析助手"
      size="small"
      :bordered="false"
      class="panel-card"
    >
      <template #header-extra>
        <NButton
          quaternary
          circle
          size="small"
          title="更换 API Key"
          class="settings-gear-btn"
          @click="openSettingsPanel"
        >
          <svg class="gear-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96a.488.488 0 0 0-.59.22l-1.92 3.32c-.12.22-.09.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.09-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </NButton>
      </template>

      <NSpace vertical :size="12">
        <NSpace align="center" justify="space-between">
          <NText depth="3" style="font-size: 12px;">提取与分析图文笔记</NText>
          <NSpace :size="6">
            <NTag type="info" size="small" round :bordered="false">仅图文</NTag>
            <NTag :type="isNotePage ? 'success' : isXhsPage ? 'warning' : 'default'" size="small" round>
              {{ isNotePage ? '已就绪' : isXhsPage ? '非笔记页' : '未命中' }}
            </NTag>
          </NSpace>
        </NSpace>

        <NText depth="3" class="support-hint">
          暂不支持视频笔记，请打开图文笔记详情页后操作。
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
            :disabled="!isAiConfigured || !notePreview"
            :title="!isAiConfigured ? '请先点击右上角齿轮配置 API Key' : ''"
            @click="handleAiAnalyze"
          >
            {{ analysisResult ? '重新 AI 分析' : 'AI 分析' }}
          </NButton>
        </NSpace>

        <div v-if="notePreview" class="note-preview-card">
          <NSpace align="center" class="preview-meta">
            <NTag type="primary" size="small" round :bordered="false">
              👤 {{ notePreview.author || '未知作者' }}
            </NTag>
          </NSpace>

          <div v-if="extractedImages.length > 0" class="preview-images-wrap">
            <div class="preview-images">
              <img
                v-for="(imgUrl, index) in extractedImages"
                :key="`${imgUrl}-${index}`"
                :src="imgUrl"
                loading="lazy"
                decoding="async"
                :alt="`笔记图片 ${index + 1}`"
                class="preview-image"
              />
            </div>
            <div class="image-count-badge">{{ extractedImages.length }} 张</div>
          </div>

          <div class="preview-header">
            <NText strong class="preview-title">{{ notePreview.title || '（无标题）' }}</NText>
          </div>

          <div class="preview-content">
            <NText depth="3" class="content-label">完整正文</NText>
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

        <div v-if="analysisResult" class="analysis-card">
          <NSpace align="center" justify="space-between" class="analysis-header">
            <NText strong>AI 分析结果</NText>
            <NTag v-if="analysisResult.score != null" type="success" size="small" round>
              评分 {{ analysisResult.score }}
            </NTag>
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
            <NText depth="3" class="analysis-label">改写建议</NText>
            <ul class="analysis-list">
              <li v-for="(item, index) in analysisResult.rewriteSuggestions" :key="index">
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <NText v-if="!notePreview" depth="3" class="empty-hint">
          点击「执行提取」获取当前笔记内容，不会自动执行。
        </NText>
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

.note-preview-card,
.analysis-card {
  background: #ffffff;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.preview-meta {
  margin-bottom: 12px;
}

.support-hint,
.empty-hint {
  font-size: 12px;
  line-height: 1.5;
}

.preview-images-wrap {
  position: relative;
  margin-bottom: 12px;
}

.preview-images {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}

.preview-image {
  flex: 0 0 88%;
  width: 88%;
  height: 220px;
  border-radius: 8px;
  object-fit: cover;
  scroll-snap-align: start;
  background: #f2f3f5;
  display: block;
}

.image-count-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  pointer-events: none;
  z-index: 2;
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
</style>
