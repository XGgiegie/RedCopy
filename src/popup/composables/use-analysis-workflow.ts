import { computed, ref, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { updateHistoryRecord } from '../../shared/history-storage'
import {
  copyTextToClipboard,
  formatAnalysisAsMarkdown,
  formatAnalysisAsPlainText,
} from '../../shared/export-markdown'
import type { AiAnalysisResult } from '../../shared/ai-types'
import type { NoteTextInfo } from '../../shared/note-types'
import type { ContentView, ExtractMeta } from '../types/content-view'
import { analyzeNoteText } from '../services/analyze-note'

interface UseAnalysisWorkflowOptions {
  notePreview: Ref<NoteTextInfo | null>
  lastExtractMeta: Ref<ExtractMeta | null>
  analysisResult: Ref<AiAnalysisResult | null>
  contentView: Ref<ContentView>
  selectedImageUrls: Ref<string[]>
  supportsVision: Ref<boolean>
  isDetailView: Ref<boolean>
  activeRecordId: Ref<string | null>
  onRecordUpdated: () => Promise<void>
}

/** AI 分析流程：执行分析、写入历史记录、复制导出 */
export function useAnalysisWorkflow(options: UseAnalysisWorkflowOptions) {
  const {
    notePreview,
    lastExtractMeta,
    analysisResult,
    contentView,
    selectedImageUrls,
    supportsVision,
    isDetailView,
    activeRecordId,
    onRecordUpdated,
  } = options
  const message = useMessage()
  const isAnalyzing = ref(false)

  async function handleAiAnalyze() {
    if (!isDetailView.value) {
      message.warning('请先点击历史记录进入详情，再进行分析')
      return
    }

    if (!notePreview.value) {
      message.warning('当前记录无笔记内容')
      return
    }

    if (!lastExtractMeta.value || !activeRecordId.value) {
      message.warning('缺少笔记元数据')
      return
    }

    if (
      supportsVision.value &&
      notePreview.value.images?.length &&
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

      const analysis = await analyzeNoteText({
        noteId: lastExtractMeta.value.noteId,
        url: lastExtractMeta.value.url,
        text: notePreview.value,
        imageUrls,
      })

      analysisResult.value = analysis
      contentView.value = 'analysis'

      const analyzedAt = Date.now()
      await updateHistoryRecord(activeRecordId.value, {
        analysis,
        analyzedAt,
      })
      await onRecordUpdated()

      message.success(
        imageUrls?.length
          ? `AI 分析完成（已识别 ${imageUrls.length} 张配图）`
          : 'AI 分析完成，可生成类似笔记',
      )
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] AI 分析失败', detail, error)
      message.error(`分析失败：${detail}`)
    } finally {
      isAnalyzing.value = false
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

  const hasAnalysis = computed(() => !!analysisResult.value)

  return {
    isAnalyzing,
    hasAnalysis,
    handleAiAnalyze,
    handleCopyAnalysisText,
    handleCopyAnalysisMarkdown,
  }
}
