<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NImage, NSpace, NText, useMessage } from 'naive-ui'
import type { GeneratedImageRecord } from '../../../shared/ai-types'
import {
  copyTextToClipboard,
  formatImageHistoryAsMarkdown,
  formatImageRecordAsMarkdown,
} from '../../../shared/export-markdown'
import { downloadImageByUrl, guessImageExtension } from '../../../shared/note-media'

const props = defineProps<{
  records: GeneratedImageRecord[]
}>()

const emit = defineEmits<{
  deleteImage: [recordId: string]
}>()

const message = useMessage()
const isDownloadingAll = ref(false)

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sourceLabel(record: GeneratedImageRecord): string {
  if (record.source === 'upload') return '上传'
  return record.fromReference ? '图生图' : '文生图'
}

async function copyAllMarkdown() {
  if (props.records.length === 0) return
  try {
    await copyTextToClipboard(formatImageHistoryAsMarkdown(props.records))
    message.success(`已复制 ${props.records.length} 张图片的 Markdown`)
  } catch (error) {
    console.error('[RedCopy] 复制配图历史 Markdown 失败', error)
    message.error('复制失败')
  }
}

async function copyOneMarkdown(record: GeneratedImageRecord) {
  try {
    await copyTextToClipboard(formatImageRecordAsMarkdown(record))
    message.success('图片 Markdown 已复制')
  } catch (error) {
    console.error('[RedCopy] 复制图片 Markdown 失败', error)
    message.error('复制失败')
  }
}

function buildFilename(record: GeneratedImageRecord): string {
  const ext = guessImageExtension(record.url)
  return `${record.label || '配图'}-${record.id}${ext}`
}

async function downloadOne(record: GeneratedImageRecord) {
  try {
    await downloadImageByUrl(record.url, buildFilename(record))
    message.success('已开始下载')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 配图下载失败', { detail }, error)
    message.error(`下载失败：${detail}`)
  }
}

async function downloadAll() {
  if (props.records.length === 0) return
  isDownloadingAll.value = true
  let success = 0
  let failed = 0
  try {
    for (const [index, record] of props.records.entries()) {
      try {
        await downloadImageByUrl(record.url, buildFilename(record))
        success += 1
      } catch (error) {
        failed += 1
        console.error('[RedCopy] 批量配图下载失败', { id: record.id, error })
      }
      if (index < props.records.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 180))
      }
    }
    if (failed === 0) message.success(`已开始下载 ${success} 张配图`)
    else message.warning(`下载完成：成功 ${success} 张，失败 ${failed} 张`)
  } finally {
    isDownloadingAll.value = false
  }
}
</script>

<template>
  <div v-if="records.length > 0" class="image-history">
    <div class="image-history-header">
      <NText depth="3" class="content-label">配图历史 · {{ records.length }} 张</NText>
      <NSpace :size="6">
        <NButton size="tiny" secondary @click="copyAllMarkdown">
          一键复制 Markdown
        </NButton>
        <NButton
          size="tiny"
          type="primary"
          :loading="isDownloadingAll"
          @click="downloadAll"
        >
          全部下载
        </NButton>
      </NSpace>
    </div>

    <div class="history-grid">
      <div v-for="record in records" :key="record.id" class="history-card">
        <NImage
          :src="record.url"
          object-fit="cover"
          class="history-image"
          :img-props="{ alt: '配图历史' }"
        />
        <div class="history-info">
          <NText class="history-label">{{ record.label || '配图' }}</NText>
          <NText depth="3" class="history-sub">
            {{ sourceLabel(record) }} ·
            {{ record.aspectRatio ?? record.size }} · {{ formatTime(record.createdAt) }}
          </NText>
        </div>
        <NSpace :size="4" class="history-actions">
          <NButton size="tiny" quaternary @click="copyOneMarkdown(record)">
            复制 MD
          </NButton>
          <NButton size="tiny" quaternary @click="downloadOne(record)">
            下载
          </NButton>
          <NButton
            size="tiny"
            quaternary
            type="error"
            @click="emit('deleteImage', record.id)"
          >
            删除
          </NButton>
        </NSpace>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-history {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #eef0f4;
}

.image-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.image-history-header .content-label {
  margin-bottom: 0;
}

.history-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #f7f8fa;
  border: 1px solid #eef0f4;
  border-radius: 8px;
}

.history-image {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  border: 1px solid #e5e6eb;
  flex-shrink: 0;
  overflow: hidden;
}

.history-image :deep(img) {
  width: 64px;
  height: 64px;
  object-fit: cover;
  display: block;
  cursor: zoom-in;
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-label {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-sub {
  font-size: 11px;
}

.history-actions {
  flex-shrink: 0;
}
</style>
