import { computed, onMounted, ref } from 'vue'
import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import { isXhsNoteUrl } from '../../shared/extract-note'
import type { NoteMediaType, NoteTextInfo } from '../../shared/note-types'
import type { ExtractMeta } from '../types/content-view'
import { useAiSettings } from './use-ai-settings'
import { useAnalysisWorkflow } from './use-analysis-workflow'
import { useContentView } from './use-content-view'
import { useDraftWorkflow } from './use-draft-workflow'
import { useHistoryWorkspace } from './use-history-workspace'
import { useImageSelection } from './use-image-selection'
import { useNotePageWatch } from './use-note-page-watch'
import { useNoteWorkflow } from './use-note-workflow'

/**
 * 侧栏主会话：历史列表 + 详情工作区 + 提取/分析/生成。
 */
export function usePanelSession() {
  const isXhsPage = ref(false)
  const isNotePage = ref(false)

  const notePreview = ref<NoteTextInfo | null>(null)
  const lastExtractMeta = ref<ExtractMeta | null>(null)
  const extractedNoteType = ref<NoteMediaType>('normal')
  const analysisResult = ref<AiAnalysisResult | null>(null)
  const generatedDraft = ref<GeneratedNoteDraft | null>(null)

  const view = useContentView(notePreview, analysisResult, generatedDraft)
  const ai = useAiSettings()

  const generateTopic = ref('')

  const history = useHistoryWorkspace({
    notePreview,
    lastExtractMeta,
    extractedNoteType,
    analysisResult,
    generatedDraft,
    generateTopic,
    contentView: view.contentView,
  })

  const draft = useDraftWorkflow({
    notePreview,
    lastExtractMeta,
    analysisResult,
    generatedDraft,
    generateTopic,
    contentView: view.contentView,
    isDetailView: history.isDetailView,
    activeRecordId: history.activeRecordId,
    onRecordUpdated: history.refreshHistory,
  })

  const imageSelection = useImageSelection(
    computed(() => notePreview.value?.images ?? []),
  )

  const analysis = useAnalysisWorkflow({
    notePreview,
    lastExtractMeta,
    analysisResult,
    contentView: view.contentView,
    selectedImageUrls: imageSelection.selectedImageUrls,
    supportsVision: ai.supportsVision,
    isDetailView: history.isDetailView,
    activeRecordId: history.activeRecordId,
    onRecordUpdated: history.refreshHistory,
  })

  const note = useNoteWorkflow({
    notePreview,
    lastExtractMeta,
    extractedNoteType,
    analysisResult,
    generatedDraft,
    contentView: view.contentView,
    isNotePage,
    isDetailView: history.isDetailView,
    onExtractSuccess: history.refreshHistory,
  })

  useNotePageWatch(isXhsPage, isNotePage)

  const isPanelLoading = ref(true)

  async function syncInitialPageStatus() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url ?? ''
    isXhsPage.value = /xiaohongshu\.com/.test(url)
    isNotePage.value = isXhsNoteUrl(url)
    console.info('[RedCopy] 初始页面状态', {
      isXhsPage: isXhsPage.value,
      isNotePage: isNotePage.value,
    })
  }

  async function initializePanel() {
    const startedAt = Date.now()
    const minLoadingMs = 420

    try {
      await Promise.all([
        history.refreshHistory(),
        ai.refreshAiSettings(),
        syncInitialPageStatus(),
      ])
      console.info('[RedCopy] 侧栏初始化完成')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 侧栏初始化失败', detail, error)
    } finally {
      const elapsed = Date.now() - startedAt
      if (elapsed < minLoadingMs) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingMs - elapsed))
      }
      isPanelLoading.value = false
    }
  }

  onMounted(() => {
    void initializePanel()
  })

  return {
    isPanelLoading,
    page: { isXhsPage, isNotePage },
    ai,
    view,
    history,
    imageSelection,
    state: {
      notePreview,
      lastExtractMeta,
      extractedNoteType,
      analysisResult,
      generatedDraft,
      contentView: view.contentView,
    },
    note,
    analysis,
    draft,
  }
}
