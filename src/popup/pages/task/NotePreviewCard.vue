<script setup lang="ts">
import '../../styles/content-card.css'
import { NButton, NSpace, NTag, NText } from 'naive-ui'
import type { NoteMediaType, NoteTextInfo } from '../../../shared/note-types'
import NoteImageGallery from './NoteImageGallery.vue'

defineProps<{
  note: NoteTextInfo
  noteType: NoteMediaType
  images: string[]
  bodyText: string
  isDownloadingAll: boolean
  downloadingIndex: number | null
  enableImageSelection: boolean
  isImageSelected: (index: number) => boolean
}>()

defineEmits<{
  copyMarkdown: []
  copyBody: []
  copyImages: []
  downloadAll: []
  downloadImage: [index: number]
  toggleImage: [index: number]
  setImageSelected: [index: number, selected: boolean]
  selectAllImages: []
  clearImageSelection: []
}>()
</script>

<template>
  <div class="content-card note-preview-card">
    <NSpace align="center" justify="space-between" class="content-card-header">
      <NSpace :size="6">
        <NTag type="primary" size="small" round :bordered="false">
          👤 {{ note.author || '未知作者' }}
        </NTag>
        <NTag
          v-if="noteType === 'video'"
          type="warning"
          size="small"
          round
          :bordered="false"
        >
          视频笔记
        </NTag>
      </NSpace>
      <NButton size="tiny" secondary @click="$emit('copyMarkdown')">
        复制 Markdown
      </NButton>
    </NSpace>

    <NoteImageGallery
      v-if="images.length > 0"
      :images="images"
      :is-downloading-all="isDownloadingAll"
      :downloading-index="downloadingIndex"
      :enable-image-selection="enableImageSelection"
      :is-image-selected="isImageSelected"
      @copy-images="$emit('copyImages')"
      @download-all="$emit('downloadAll')"
      @download-image="$emit('downloadImage', $event)"
      @toggle-image="$emit('toggleImage', $event)"
      @set-image-selected="(index, checked) => $emit('setImageSelected', index, checked)"
      @select-all-images="$emit('selectAllImages')"
      @clear-image-selection="$emit('clearImageSelection')"
    />

    <div class="preview-header">
      <NText strong class="preview-title">{{ note.title || '（无标题）' }}</NText>
    </div>

    <div class="preview-content">
      <NSpace align="center" justify="space-between" class="content-toolbar">
        <NText depth="3" class="content-label">完整正文</NText>
        <NButton size="tiny" secondary @click="$emit('copyBody')">
          复制正文
        </NButton>
      </NSpace>
      <NText depth="2" class="desc-preview">{{ bodyText }}</NText>
    </div>

    <NSpace v-if="note.tags?.length" :size="6" class="preview-tags">
      <NTag
        v-for="tag in note.tags"
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
        <span class="stat-value">{{ note.likedCount || 0 }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">⭐ 收藏</span>
        <span class="stat-value">{{ note.collectedCount || 0 }}</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-label">💬 评论</span>
        <span class="stat-value">{{ note.commentCount || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-toolbar {
  margin-bottom: 6px;
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
</style>
