<script setup lang="ts">
import { computed } from 'vue'
import { APP_NAME } from '../shared/brand'
import ExtractActionBar from './components/actions/ExtractActionBar.vue'
import GenerateSimilarNoteDialog from './components/actions/GenerateSimilarNoteDialog.vue'
import AnalysisCard from './components/content/AnalysisCard.vue'
import ContentViewTabs from './components/content/ContentViewTabs.vue'
import DraftEditorCard from './components/content/DraftEditorCard.vue'
import HistoryDetailHeader from './components/history/HistoryDetailHeader.vue'
import HistoryListCard from './components/history/HistoryListCard.vue'
import NotePreviewCard from './components/content/NotePreviewCard.vue'
import InfoTip from './components/layout/InfoTip.vue'
import PageStatusBar from './components/layout/PageStatusBar.vue'
import PanelLoading from './components/layout/PanelLoading.vue'
import PanelFooter from './components/layout/PanelFooter.vue'
import SettingsGearButton from './components/layout/SettingsGearButton.vue'
import SettingsPage from './components/settings/SettingsPage.vue'
import { usePanelSession } from './composables/use-panel-session'

const { page, ai, view, history, imageSelection, state, note, analysis, draft, isPanelLoading } =
  usePanelSession()

const { isXhsPage, isNotePage } = page
const {
  isAiConfigured,
  isGenerateReady,
  supportsVision,
  isSettingsView,
  analysisProvider,
  analysisModel,
  analysisProviderLabel,
  hasDeepseekKey,
  hasDoubaoKey,
  setAnalysisProvider,
  setAnalysisModel,
  openSettingsPage,
  closeSettingsPage,
  handleSettingsSaved,
  refreshAiSettings,
} = ai
const {
  contentView,
  contentViewOptions,
  canSwitchView,
  showNoteSection,
  showAnalysisSection,
  showDraftSection,
} = view
const {
  records,
  isListView,
  isDetailView,
  activeRecord,
  openRecord,
  backToList,
  deleteRecord,
} = history
const { notePreview, extractedNoteType, analysisResult, generatedDraft } = state
const {
  hasNote,
  isExtracting,
  extractedImages,
  noteBodyText,
  isDownloadingAllImages,
  downloadingImageIndex,
  handleExtract,
  handleCopyNoteMarkdown,
  handleCopyNoteBody,
  handleCopyNoteImages,
  handleDownloadAllImages,
  handleDownloadImage,
} = note
const {
  isImageSelected,
  setImageSelected,
  selectAllImages,
  clearImageSelection,
} = imageSelection
const {
  isAnalyzing,
  hasAnalysis,
  handleAiAnalyze,
  handleCopyAnalysisText,
  handleCopyAnalysisMarkdown,
} = analysis
const {
  generateTopic,
  isGenerating,
  hasDraft,
  showGenerateDialog,
  schedulePersistDraft,
  openGenerateDialog,
  handleGenerateSimilar,
  handleCopyDraftText,
  handleCopyDraftMarkdown,
} = draft

const enableImageSelection = computed(
  () => supportsVision.value && extractedImages.value.length > 0,
)

const APP_TIP = '小红书笔记提取 · AI 分析 · 生成类似笔记'

function handleSettingsCleared() {
  void refreshAiSettings()
}

function handleDeleteActiveRecord() {
  if (!activeRecord.value) return
  void deleteRecord(activeRecord.value.id)
}
</script>

<template>
  <PanelLoading v-if="isPanelLoading" />

  <SettingsPage
    v-else-if="isSettingsView"
    @back="closeSettingsPage"
    @saved="handleSettingsSaved"
    @cleared="handleSettingsCleared"
  />

  <main v-else class="panel">
    <header class="panel-top">
      <div class="panel-brand">
        <span class="brand-mark" aria-hidden="true">🍠</span>
        <span class="brand-name">{{ APP_NAME }}</span>
        <InfoTip :content="APP_TIP" />
      </div>
      <SettingsGearButton @open-settings="openSettingsPage" />
    </header>

    <div class="panel-body">
      <!-- 历史列表 -->
      <div v-if="isListView" class="panel-view">
        <PageStatusBar :is-xhs-page="isXhsPage" :is-note-page="isNotePage" />

        <ExtractActionBar
          mode="list"
          :has-note="hasNote"
          :is-note-page="isNotePage"
          :is-extracting="isExtracting"
          :is-analyzing="isAnalyzing"
          :is-generating="isGenerating"
          :is-ai-configured="isAiConfigured"
          :has-analysis="hasAnalysis"
          :analysis-provider="analysisProvider"
          :analysis-model="analysisModel"
          :has-deepseek-key="hasDeepseekKey"
          :has-doubao-key="hasDoubaoKey"
          :analysis-provider-label="analysisProviderLabel"
          @extract="handleExtract"
          @analyze="handleAiAnalyze"
          @update:analysis-provider="setAnalysisProvider"
          @update:analysis-model="setAnalysisModel"
          @open-settings="openSettingsPage"
        />

        <HistoryListCard
          class="history-section"
          :records="records"
          @open="openRecord"
          @delete="deleteRecord"
        />
      </div>

      <!-- 历史详情 -->
      <div v-else-if="isDetailView" class="panel-view">
        <HistoryDetailHeader
          :title="activeRecord?.note.title"
          @back="backToList"
          @delete="handleDeleteActiveRecord"
        />

        <ExtractActionBar
          mode="detail"
          :has-note="hasNote"
          :is-note-page="isNotePage"
          :is-extracting="isExtracting"
          :is-analyzing="isAnalyzing"
          :is-generating="isGenerating"
          :is-ai-configured="isAiConfigured"
          :has-analysis="hasAnalysis"
          :analysis-provider="analysisProvider"
          :analysis-model="analysisModel"
          :has-deepseek-key="hasDeepseekKey"
          :has-doubao-key="hasDoubaoKey"
          :analysis-provider-label="analysisProviderLabel"
          @extract="handleExtract"
          @analyze="handleAiAnalyze"
          @update:analysis-provider="setAnalysisProvider"
          @update:analysis-model="setAnalysisModel"
          @open-settings="openSettingsPage"
        />

        <ContentViewTabs
          v-if="canSwitchView"
          v-model="contentView"
          :options="contentViewOptions"
        />

        <NotePreviewCard
          v-if="showNoteSection && notePreview"
          :note="notePreview"
          :note-type="extractedNoteType"
          :images="extractedImages"
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
          v-if="showAnalysisSection && analysisResult"
          :analysis="analysisResult"
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
          v-if="showDraftSection && generatedDraft"
          v-model:draft="generatedDraft"
          @copy-text="handleCopyDraftText"
          @copy-markdown="handleCopyDraftMarkdown"
          @edit="schedulePersistDraft"
        />
      </div>

      <PanelFooter />
    </div>

    <GenerateSimilarNoteDialog
      v-model:show="showGenerateDialog"
      :initial-topic="generateTopic"
      :is-generating="isGenerating"
      :has-draft="hasDraft"
      @confirm="handleGenerateSimilar"
    />
  </main>
</template>

<style scoped>
.panel {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
}

.panel-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.brand-mark {
  font-size: 16px;
  line-height: 1;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
  letter-spacing: -0.02em;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 12px;
}

.panel-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.history-section {
  flex: 1;
  min-height: 120px;
}
</style>
