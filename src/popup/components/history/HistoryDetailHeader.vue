<script setup lang="ts">
import { NButton, NPopconfirm } from 'naive-ui'

defineProps<{
  title?: string
}>()

defineEmits<{
  back: []
  delete: []
}>()
</script>

<template>
  <header class="detail-header">
    <NButton text type="primary" size="small" class="back-btn" @click="$emit('back')">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M10 3.5 5.5 8 10 12.5 9 13.5l-5-5.5 5-5.5 1 1z" />
      </svg>
      历史
    </NButton>
    <h2 v-if="title" class="detail-title">{{ title }}</h2>

    <NPopconfirm
      positive-text="删除"
      negative-text="取消"
      @positive-click="$emit('delete')"
    >
      <template #trigger>
        <NButton quaternary size="small" class="delete-btn" title="删除记录">
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              d="M6 2.5h4l.5 1.5H13v1H3V4h2.5L6 2.5ZM4 6.5h8l-.7 7.1-.1.9H4.8l-.1-.9L4 6.5Zm2 1.5v5h1V8H6Zm3 0v5h1V8H9Z"
            />
          </svg>
        </NButton>
      </template>
      确定删除这条记录？分析结果与生成内容将一并删除。
    </NPopconfirm>
  </header>
</template>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eef0f4;
}

.back-btn {
  flex-shrink: 0;
  padding-left: 0 !important;
}

.back-btn :deep(.n-button__content) {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.back-btn svg {
  width: 14px;
  height: 14px;
}

.detail-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #1d2129;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  flex-shrink: 0;
  color: #86909c !important;
  padding: 0 6px !important;
}

.delete-btn:hover {
  color: #f53f3f !important;
  background: #fff1f0 !important;
}

.delete-btn svg {
  width: 15px;
  height: 15px;
  display: block;
}
</style>
