import { computed, onUnmounted, ref, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { updateHistoryRecord } from '../../shared/history-storage'
import {
  copyTextToClipboard,
  formatDraftAsMarkdown,
  formatDraftAsPlainText,
} from '../../shared/export-markdown'
import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import type { NoteTextInfo } from '../../shared/note-types'
import type { ContentView, ExtractMeta } from '../types/content-view'
import { generateNoteDraft } from '../services/generate-note'

interface UseDraftWorkflowOptions {
  notePreview: Ref<NoteTextInfo | null>
  lastExtractMeta: Ref<ExtractMeta | null>
  analysisResult: Ref<AiAnalysisResult | null>
  generatedDraft: Ref<GeneratedNoteDraft | null>
  generateTopic: Ref<string>
  contentView: Ref<ContentView>
  isDetailView: Ref<boolean>
  activeRecordId: Ref<string | null>
  onRecordUpdated: () => Promise<void>
}

function normalizeDraft(draft: GeneratedNoteDraft): GeneratedNoteDraft {
  return {
    ...draft,
    tags: draft.tags ?? [],
    imageTips: draft.imageTips ?? '',
  }
}

/** 类似笔记生成、编辑自动保存、复制导出 */
export function useDraftWorkflow(options: UseDraftWorkflowOptions) {
  const {
    notePreview,
    lastExtractMeta,
    analysisResult,
    generatedDraft,
    generateTopic,
    contentView,
    isDetailView,
    activeRecordId,
    onRecordUpdated,
  } = options
  const message = useMessage()

  const isGenerating = ref(false)
  const showGenerateDialog = ref(false)

  let persistDraftTimer: ReturnType<typeof setTimeout> | null = null

  const hasDraft = computed(() => !!generatedDraft.value)

  function openGenerateDialog() {
    if (!analysisResult.value) {
      message.warning('请先完成 AI 分析')
      return
    }
    showGenerateDialog.value = true
  }

  function closeGenerateDialog() {
    if (isGenerating.value) return
    showGenerateDialog.value = false
  }

  function schedulePersistDraft() {
    if (
      !generatedDraft.value ||
      !lastExtractMeta.value ||
      !notePreview.value ||
      !activeRecordId.value
    ) {
      return
    }

    if (persistDraftTimer) clearTimeout(persistDraftTimer)
    persistDraftTimer = setTimeout(() => {
      void persistDraftEdits()
    }, 600)
  }

  async function persistDraftEdits() {
    if (!generatedDraft.value || !activeRecordId.value) {
      return
    }

    try {
      await updateHistoryRecord(activeRecordId.value, {
        draft: generatedDraft.value,
        generateTopic: generateTopic.value,
      })
      await onRecordUpdated()
      console.info('[RedCopy] 类似笔记编辑已保存到历史')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 保存类似笔记编辑失败', detail, error)
    }
  }

  async function handleGenerateSimilar(topicInput?: string) {
    if (!isDetailView.value) {
      message.warning('请先进入历史记录详情')
      return
    }

    if (!notePreview.value) {
      message.warning('当前记录无笔记内容')
      return
    }

    if (!analysisResult.value) {
      message.warning('请先完成 AI 分析，再生成类似笔记')
      return
    }

    if (!lastExtractMeta.value || !activeRecordId.value) {
      message.warning('缺少笔记元数据')
      return
    }

    if (topicInput !== undefined) {
      generateTopic.value = topicInput
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
      showGenerateDialog.value = false

      const generatedAt = Date.now()
      await updateHistoryRecord(activeRecordId.value, {
        draft: generatedDraft.value,
        generatedAt,
        generateTopic: generateTopic.value,
      })
      await onRecordUpdated()

      message.success('类似笔记已生成，可直接编辑')
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 生成类似笔记失败', detail, error)
      message.error(`生成失败：${detail}`)
    } finally {
      isGenerating.value = false
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

  onUnmounted(() => {
    if (persistDraftTimer) clearTimeout(persistDraftTimer)
  })

  return {
    generateTopic,
    isGenerating,
    hasDraft,
    showGenerateDialog,
    schedulePersistDraft,
    openGenerateDialog,
    closeGenerateDialog,
    handleGenerateSimilar,
    handleCopyDraftText,
    handleCopyDraftMarkdown,
  }
}
