import { computed, ref } from 'vue'
import { useMessage } from 'naive-ui'
import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import {
  type HistoryRecord,
  deleteHistoryRecord,
  loadHistoryRecords,
} from '../../shared/history-storage'
import type { NoteMediaType, NoteTextInfo } from '../../shared/note-types'
import type { ContentView, ExtractMeta } from '../types/content-view'

export type WorkspacePanelView = 'list' | 'detail'

function normalizeDraft(draft: GeneratedNoteDraft): GeneratedNoteDraft {
  return {
    ...draft,
    tags: draft.tags ?? [],
    imageTips: draft.imageTips ?? '',
  }
}

interface UseHistoryWorkspaceOptions {
  notePreview: ReturnType<typeof ref<NoteTextInfo | null>>
  lastExtractMeta: ReturnType<typeof ref<ExtractMeta | null>>
  extractedNoteType: ReturnType<typeof ref<NoteMediaType>>
  analysisResult: ReturnType<typeof ref<AiAnalysisResult | null>>
  generatedDraft: ReturnType<typeof ref<GeneratedNoteDraft | null>>
  generateTopic: ReturnType<typeof ref<string>>
  contentView: ReturnType<typeof ref<ContentView>>
}

/** 历史列表与详情工作区切换 */
export function useHistoryWorkspace(options: UseHistoryWorkspaceOptions) {
  const {
    notePreview,
    lastExtractMeta,
    extractedNoteType,
    analysisResult,
    generatedDraft,
    generateTopic,
    contentView,
  } = options
  const message = useMessage()

  const records = ref<HistoryRecord[]>([])
  const panelView = ref<WorkspacePanelView>('list')
  const activeRecordId = ref<string | null>(null)

  const isListView = computed(() => panelView.value === 'list')
  const isDetailView = computed(() => panelView.value === 'detail')
  const hasHistory = computed(() => records.value.length > 0)
  const activeRecord = computed(
    () => records.value.find((item) => item.id === activeRecordId.value) ?? null,
  )

  async function refreshHistory() {
    records.value = await loadHistoryRecords()
  }

  function clearWorkspace() {
    notePreview.value = null
    lastExtractMeta.value = null
    extractedNoteType.value = 'normal'
    analysisResult.value = null
    generatedDraft.value = null
    generateTopic.value = ''
    contentView.value = 'note'
  }

  function loadWorkspaceFromRecord(record: HistoryRecord) {
    notePreview.value = record.note
    lastExtractMeta.value = { noteId: record.noteId, url: record.url }
    extractedNoteType.value = record.noteType
    analysisResult.value = record.analysis
    generatedDraft.value = record.draft ? normalizeDraft(record.draft) : null
    generateTopic.value = record.generateTopic ?? ''

    if (record.draft) {
      contentView.value = 'draft'
    } else if (record.analysis) {
      contentView.value = 'analysis'
    } else {
      contentView.value = 'note'
    }
  }

  function openRecord(id: string) {
    const record = records.value.find((item) => item.id === id)
    if (!record) return

    activeRecordId.value = id
    panelView.value = 'detail'
    loadWorkspaceFromRecord(record)
    console.info('[RedCopy] 进入历史记录', { id, noteId: record.noteId })
  }

  function backToList() {
    activeRecordId.value = null
    panelView.value = 'list'
    clearWorkspace()
    console.info('[RedCopy] 返回历史列表')
  }

  async function deleteRecord(id: string) {
    const wasActive = activeRecordId.value === id

    try {
      await deleteHistoryRecord(id)
      await refreshHistory()

      if (wasActive) {
        activeRecordId.value = null
        panelView.value = 'list'
        clearWorkspace()
      }

      message.success('已删除记录')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 删除历史记录失败', { id, detail }, error)
      message.error(`删除失败：${detail}`)
    }
  }

  return {
    records,
    panelView,
    activeRecordId,
    activeRecord,
    isListView,
    isDetailView,
    hasHistory,
    refreshHistory,
    openRecord,
    backToList,
    deleteRecord,
    clearWorkspace,
  }
}
