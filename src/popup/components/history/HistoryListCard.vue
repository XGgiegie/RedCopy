<script setup lang="ts">
import { NPopconfirm, NText } from 'naive-ui'
import type { HistoryRecord } from '../../../shared/history-storage'
import { formatHistoryTime } from '../../../shared/history-storage'

defineProps<{
  records: HistoryRecord[]
}>()

const emit = defineEmits<{
  open: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <div class="history-list">
    <div class="history-list-header">
      <NText strong class="history-list-title">历史</NText>
      <span v-if="records.length > 0" class="history-count">{{ records.length }}</span>
    </div>

    <div v-if="records.length === 0" class="history-empty">
      <span class="history-empty-icon" aria-hidden="true">📋</span>
      <NText depth="3" class="history-empty-text">提取后显示在这里</NText>
    </div>

    <div v-for="record in records" :key="record.id" class="history-item">
      <button type="button" class="history-item-main" @click="emit('open', record.id)">
        <div class="history-item-content">
          <NText strong class="history-item-title">
            {{ record.note.title || '（无标题）' }}
          </NText>
          <div class="history-item-meta">
            <span>{{ record.note.author || '未知作者' }}</span>
            <span class="meta-dot" aria-hidden="true">·</span>
            <span>{{ formatHistoryTime(record.extractedAt) }}</span>
            <span v-if="record.noteType === 'video'" class="meta-tag">视频</span>
          </div>
          <div class="history-pipeline" aria-label="进度">
            <span class="pipe-step pipe-step--done" title="已提取">提取</span>
            <span class="pipe-line" :class="{ 'pipe-line--done': record.analysis }" />
            <span
              class="pipe-step"
              :class="{ 'pipe-step--done': record.analysis }"
              title="AI 分析"
            >
              分析
            </span>
            <span class="pipe-line" :class="{ 'pipe-line--done': record.draft }" />
            <span
              class="pipe-step"
              :class="{ 'pipe-step--done': record.draft }"
              title="类似笔记"
            >
              生成
            </span>
          </div>
        </div>
        <svg class="history-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M6 4l4 4-4 4V4z" />
        </svg>
      </button>

      <NPopconfirm
        positive-text="删除"
        negative-text="取消"
        @positive-click="emit('delete', record.id)"
      >
        <template #trigger>
          <button
            type="button"
            class="history-delete"
            aria-label="删除记录"
            @click.stop
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                d="M6 2.5h4l.5 1.5H13v1H3V4h2.5L6 2.5ZM4 6.5h8l-.7 7.1-.1.9H4.8l-.1-.9L4 6.5Zm2 1.5v5h1V8H6Zm3 0v5h1V8H9Z"
              />
            </svg>
          </button>
        </template>
        确定删除这条记录？分析结果与生成内容将一并删除。
      </NPopconfirm>
    </div>
  </div>
</template>

<style scoped>
.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
}

.history-list-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
}

.history-list-title {
  font-size: 13px;
}

.history-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #f2f3f5;
  font-size: 11px;
  font-weight: 600;
  color: #86909c;
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed #e5e6eb;
  border-radius: 10px;
  background: #fafbfc;
}

.history-empty-icon {
  font-size: 24px;
  opacity: 0.5;
}

.history-empty-text {
  font-size: 12px;
}

.history-item {
  display: flex;
  align-items: stretch;
  gap: 4px;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.history-item:hover {
  border-color: #ffb3c0;
  box-shadow: 0 2px 10px rgba(255, 36, 66, 0.1);
}

.history-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 12px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.history-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.4;
  color: #1d2129;
}

.history-item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
  color: #86909c;
}

.meta-dot {
  opacity: 0.6;
}

.meta-tag {
  padding: 0 5px;
  border-radius: 4px;
  background: #fff7e6;
  color: #d46b08;
  font-size: 10px;
  font-weight: 500;
}

.history-pipeline {
  display: flex;
  align-items: center;
  gap: 0;
  margin-top: 2px;
}

.pipe-step {
  font-size: 10px;
  color: #c9cdd4;
  font-weight: 500;
  white-space: nowrap;
}

.pipe-step--done {
  color: #ff2442;
}

.pipe-line {
  flex: 1;
  min-width: 12px;
  max-width: 24px;
  height: 2px;
  margin: 0 4px;
  border-radius: 1px;
  background: #e5e6eb;
}

.pipe-line--done {
  background: #ffb3c0;
}

.history-chevron {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: #c9cdd4;
  transition: color 0.15s ease;
}

.history-item:hover .history-chevron {
  color: #ff2442;
}

.history-delete {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  margin: 6px 6px 6px 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.history-delete:hover {
  color: #f53f3f;
  background: #fff1f0;
}

.history-delete svg {
  width: 15px;
  height: 15px;
}
</style>
