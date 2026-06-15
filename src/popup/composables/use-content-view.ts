import { computed, ref, type Ref } from 'vue'
import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import type { NoteTextInfo } from '../../shared/note-types'
import type { ContentView, ContentViewOption } from '../types/content-view'

/** 笔记 / AI 分析 / 类似笔记 三视图切换 */
export function useContentView(
  notePreview: Ref<NoteTextInfo | null>,
  analysisResult: Ref<AiAnalysisResult | null>,
  generatedDraft: Ref<GeneratedNoteDraft | null>,
) {
  const contentView = ref<ContentView>('note')

  const contentViewOptions = computed<ContentViewOption[]>(() => {
    const options: ContentViewOption[] = []
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

  return {
    contentView,
    contentViewOptions,
    canSwitchView,
    showNoteSection,
    showAnalysisSection,
    showDraftSection,
  }
}
