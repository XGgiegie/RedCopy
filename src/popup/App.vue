<script setup lang="ts">
import {
  NButton,
  NCard,
  NCode,
  NCollapse,
  NCollapseItem,
  NSpace,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { onMounted, ref } from 'vue'
import { isXhsNoteUrl } from '../shared/extract-note'
import type { NoteExtractResult } from '../shared/note-types'
import { extractNoteFromTab } from './extract-note'

const message = useMessage()
const isXhsPage = ref(false)
const isNotePage = ref(false)
const pageTitle = ref('检测中…')
const isExtracting = ref(false)
const noteResult = ref<NoteExtractResult | null>(null)

async function extractCurrentNote(tabId: number) {
  isExtracting.value = true
  noteResult.value = null

  try {
    const result = await extractNoteFromTab(tabId)
    noteResult.value = result

    if (result.ok) {
      message.success('笔记内容已提取')
      console.info('[RedCopy] 笔记数据', result)
    } else {
      message.warning(result.error ?? '未能提取笔记内容')
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 提取失败', detail, error)
    message.error(`提取失败：${detail}`)
  } finally {
    isExtracting.value = false
  }
}

async function checkXhsPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ?? ''
  const matched = /xiaohongshu\.com/.test(url)
  const note = isXhsNoteUrl(url)

  isXhsPage.value = matched
  isNotePage.value = note
  pageTitle.value = matched ? tab?.title ?? '当前页面' : '未在小红书页面'

  if (!matched) {
    message.warning('请在小红书页面使用')
    return
  }

  if (!note) {
    message.info('请打开一篇笔记详情页（/explore/xxx）')
    return
  }

  message.success('已识别笔记页面')
  if (tab?.id != null) {
    await extractCurrentNote(tab.id)
  }
}

function handleExtract() {
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    debugger;
    if (!tab?.id || !isNotePage.value) {
      message.warning('请先打开小红书笔记详情页')
      return
    }
    await extractCurrentNote(tab.id)
  })
}

function handleCopy() {
  if (!noteResult.value) return
  const payload = JSON.stringify(noteResult.value, null, 2)
  navigator.clipboard.writeText(payload).then(
    () => message.success('已复制到剪贴板'),
    () => message.error('复制失败'),
  )
}

onMounted(checkXhsPage)
</script>

<template>
  <main class="popup">
    <NCard title="小红书爆款解析助手" size="small" :bordered="false">
      <NSpace vertical :size="12">
        <NText depth="3">提取当前笔记文本与 DOM 结构</NText>
        <NTag :type="isNotePage ? 'success' : isXhsPage ? 'warning' : 'default'" size="small" round>
          {{ isNotePage ? '笔记详情页' : isXhsPage ? '小红书非笔记页' : '非小红书页面' }}
        </NTag>
        <NText depth="3">{{ pageTitle }}</NText>

        <template v-if="noteResult?.ok">
          <NText strong>{{ noteResult.text.title || '（无标题）' }}</NText>
          <NText depth="3" class="desc-preview">
            {{ noteResult.text.desc || noteResult.text.allText.slice(0, 200) }}
          </NText>
          <NSpace :size="4">
            <NTag v-if="noteResult.text.author" size="small">{{ noteResult.text.author }}</NTag>
            <NTag v-if="noteResult.noteId" size="small" type="info">{{ noteResult.noteId }}</NTag>
            <NTag size="small">{{ noteResult.source }}</NTag>
          </NSpace>
        </template>

        <NButton
          type="primary"
          block
          :loading="isExtracting"
          :disabled="!isNotePage"
          @click="handleExtract"
        >
          提取笔记内容
        </NButton>

        <NButton
          v-if="noteResult?.ok"
          block
          quaternary
          @click="handleCopy"
        >
          复制完整 JSON
        </NButton>

        <NCollapse v-if="noteResult">
          <NCollapseItem title="文本字段" name="text">
            <NCode :code="JSON.stringify(noteResult.text, null, 2)" language="json" word-wrap />
          </NCollapseItem>
          <NCollapseItem v-if="noteResult.dom?.tree" title="DOM 树结构" name="dom">
            <NCode
              :code="JSON.stringify(noteResult.dom.tree, null, 2)"
              language="json"
              word-wrap
            />
          </NCollapseItem>
          <NCollapseItem v-if="noteResult.structured" title="结构化数据 (__INITIAL_STATE__)" name="state">
            <NCode
              :code="JSON.stringify(noteResult.structured, null, 2)"
              language="json"
              word-wrap
            />
          </NCollapseItem>
        </NCollapse>
      </NSpace>
    </NCard>
  </main>
</template>

<style scoped>
.popup {
  width: 360px;
  max-height: 520px;
  overflow-y: auto;
  padding: 12px;
  background: #f7f8fa;
}

.desc-preview {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
