import { computed, ref, type Ref } from 'vue'
import { useMessage } from 'naive-ui'
import { addHistoryRecord } from '../../shared/history-storage'
import {
  copyTextToClipboard,
  formatNoteAsMarkdown,
} from '../../shared/export-markdown'
import {
  downloadAllNoteImages,
  downloadNoteImage,
  formatImagesAsMarkdown,
  getNoteBodyText,
} from '../../shared/note-media'
import type { AiAnalysisResult, GeneratedNoteDraft } from '../../shared/ai-types'
import type { NoteMediaType, NoteTextInfo } from '../../shared/note-types'
import type { ContentView, ExtractMeta } from '../types/content-view'
import { extractNoteFromTab } from '../services/extract-note'

interface UseNoteWorkflowOptions {
  notePreview: Ref<NoteTextInfo | null>
  lastExtractMeta: Ref<ExtractMeta | null>
  extractedNoteType: Ref<NoteMediaType>
  analysisResult: Ref<AiAnalysisResult | null>
  generatedDraft: Ref<GeneratedNoteDraft | null>
  contentView: Ref<ContentView>
  isNotePage: Ref<boolean>
  isDetailView: Ref<boolean>
  onExtractSuccess: () => Promise<void>
}

/** 笔记提取、预览、图片下载与复制导出 */
export function useNoteWorkflow(options: UseNoteWorkflowOptions) {
  const {
    notePreview,
    lastExtractMeta,
    isNotePage,
    onExtractSuccess,
  } = options
  const message = useMessage()

  const isExtracting = ref(false)
  const isDownloadingAllImages = ref(false)
  const downloadingImageIndex = ref<number | null>(null)

  const extractedImages = computed(() => notePreview.value?.images ?? [])

  const noteBodyText = computed(() => {
    const note = notePreview.value
    if (!note) return ''
    if (note.desc) return note.desc
    if (note.allText) return note.allText
    return '（无正文）'
  })

  const hasNote = computed(() => !!notePreview.value)

  async function handleExtract() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id || !isNotePage.value) {
      message.warning('请先打开小红书笔记详情页')
      return
    }

    isExtracting.value = true

    let extract: Awaited<ReturnType<typeof extractNoteFromTab>>
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

    try {
      await addHistoryRecord({
        noteId: extract.noteId,
        url: extract.url,
        note: extract.text,
        noteType: extract.noteType,
        extractedAt: Date.now(),
      })
      await onExtractSuccess()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 保存历史记录失败', detail, error)
      message.error(`提取成功，但保存历史失败：${detail}`)
      isExtracting.value = false
      return
    }

    message.success(
      extract.noteType === 'video'
        ? '已提取并加入历史记录，点击进入后可分析'
        : '已提取并加入历史记录，点击进入后可分析',
    )
    console.info('[RedCopy] 提取成功', {
      noteId: extract.noteId,
      images: extract.text.images?.length ?? 0,
      descLength: extract.text.desc?.length ?? 0,
    })

    isExtracting.value = false
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

  return {
    isExtracting,
    extractedImages,
    noteBodyText,
    hasNote,
    isDownloadingAllImages,
    downloadingImageIndex,
    handleExtract,
    handleCopyNoteBody,
    handleCopyNoteImages,
    handleDownloadAllImages,
    handleDownloadImage,
    handleCopyNoteMarkdown,
  }
}
