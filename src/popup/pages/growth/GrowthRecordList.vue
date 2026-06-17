<script setup lang="ts">
import { NPopconfirm, NText } from 'naive-ui'
import {
  type GrowthRecord,
  formatGrowthRecordTime,
} from '../../../shared/growth-records'

defineProps<{
  records: GrowthRecord[]
}>()

const emit = defineEmits<{
  delete: [id: string]
  clearAll: []
}>()

function openNote(url: string) {
  if (!url) return
  void chrome.tabs.create({ url })
}
</script>

<template>
  <div class="growth-record-list">
    <div class="growth-record-header">
      <NText strong class="growth-record-title">互动记录</NText>
      <span v-if="records.length > 0" class="growth-record-count">{{ records.length }}</span>

      <NPopconfirm
        v-if="records.length > 0"
        positive-text="清空"
        negative-text="取消"
        @positive-click="emit('clearAll')"
      >
        <template #trigger>
          <button type="button" class="clear-btn" aria-label="清空互动记录">
            清空
          </button>
        </template>
        确定清空全部 {{ records.length }} 条互动记录？
      </NPopconfirm>
    </div>

    <div v-if="records.length === 0" class="growth-record-empty">
      <span class="growth-record-empty-icon" aria-hidden="true">💬</span>
      <NText depth="3" class="growth-record-empty-text">
        运行后评论或回复过的笔记会记录在这里
      </NText>
    </div>

    <ul v-else class="growth-record-body">
      <li v-for="record in records" :key="record.id" class="growth-record-item">
        <button
          type="button"
          class="growth-record-main"
          :title="record.title || record.noteId"
          @click="openNote(record.url)"
        >
          <span class="growth-record-item-title">{{ record.title || record.noteId }}</span>
          <span class="growth-record-item-meta">
            {{ formatGrowthRecordTime(record.interactedAt) }}
          </span>
          <span class="growth-record-tags">
            <span v-if="record.postedComment" class="growth-tag growth-tag--comment">已评论</span>
            <span v-if="record.repliedCount > 0" class="growth-tag growth-tag--reply">
              回复 {{ record.repliedCount }} 条
            </span>
          </span>
        </button>
        <button
          type="button"
          class="growth-record-delete"
          aria-label="删除记录"
          @click="emit('delete', record.id)"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M6 2.5h4l.5 1.5H13v1H3V4h2.5L6 2.5ZM4 6.5h8l-.7 7.1-.1.9H4.8l-.1-.9L4 6.5Zm2 1.5v5h1V8H6Zm3 0v5h1V8H9Z" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.growth-record-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #eef0f4;
  overflow: hidden;
}

.growth-record-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 10px 12px;
  border-bottom: 1px solid #eef0f4;
}

.growth-record-title {
  font-size: 14px;
}

.growth-record-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #f2f3f5;
  font-size: 11px;
  font-weight: 600;
  color: #86909c;
}

.clear-btn {
  margin-left: auto;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  color: #86909c;
  cursor: pointer;
}

.clear-btn:hover {
  color: #ff2442;
  background: #fff1f0;
}

.growth-record-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 16px;
}

.growth-record-empty-icon {
  font-size: 28px;
  line-height: 1;
}

.growth-record-empty-text {
  font-size: 12px;
  text-align: center;
}

.growth-record-body {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 6px;
  list-style: none;
  overflow-y: auto;
}

.growth-record-item {
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.growth-record-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.growth-record-main:hover {
  background: #f7f8fa;
}

.growth-record-item-title {
  width: 100%;
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.growth-record-item-meta {
  font-size: 11px;
  color: #86909c;
}

.growth-record-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.growth-tag {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
}

.growth-tag--comment {
  background: #fff7e6;
  color: #d46b08;
}

.growth-tag--reply {
  background: #f0f5ff;
  color: #1d39c4;
}

.growth-record-delete {
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #c9cdd4;
  cursor: pointer;
}

.growth-record-delete:hover {
  color: #ff2442;
  background: #fff1f0;
}

.growth-record-delete svg {
  width: 14px;
  height: 14px;
}
</style>
