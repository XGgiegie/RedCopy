<script setup lang="ts">
import { NPopconfirm, NText } from 'naive-ui'
import { type Task, formatTaskTime } from '../../../shared/task-db'

defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  open: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <div class="task-list">
    <div class="task-list-header">
      <NText strong class="task-list-title">历史任务</NText>
      <span v-if="tasks.length > 0" class="task-count">{{ tasks.length }}</span>
    </div>

    <div v-if="tasks.length === 0" class="task-empty">
      <span class="task-empty-icon" aria-hidden="true">📋</span>
      <NText depth="3" class="task-empty-text">提取后显示在这里</NText>
    </div>

    <div v-for="task in tasks" :key="task.id" class="task-item">
      <button type="button" class="task-item-main" @click="emit('open', task.id)">
        <div class="task-item-content">
          <NText strong class="task-item-title">
            {{ task.note.title || '（无标题）' }}
          </NText>
          <div class="task-item-meta">
            <span>{{ task.note.author || '未知作者' }}</span>
            <span class="meta-dot" aria-hidden="true">·</span>
            <span>{{ formatTaskTime(task.extractedAt) }}</span>
            <span v-if="task.noteType === 'video'" class="meta-tag">视频</span>
          </div>
          <div class="task-pipeline" aria-label="进度">
            <span class="pipe-step pipe-step--done" title="已提取">提取</span>
            <span class="pipe-line" :class="{ 'pipe-line--done': task.analysis }" />
            <span
              class="pipe-step"
              :class="{ 'pipe-step--done': task.analysis }"
              title="AI 分析"
            >
              分析
            </span>
            <span class="pipe-line" :class="{ 'pipe-line--done': task.draft }" />
            <span
              class="pipe-step"
              :class="{ 'pipe-step--done': task.draft }"
              title="类似笔记"
            >
              生成
            </span>
          </div>
        </div>
        <svg class="task-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M6 4l4 4-4 4V4z" />
        </svg>
      </button>

      <NPopconfirm
        positive-text="删除"
        negative-text="取消"
        @positive-click="emit('delete', task.id)"
      >
        <template #trigger>
          <button
            type="button"
            class="task-delete"
            aria-label="删除任务"
            @click.stop
          >
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path
                d="M6 2.5h4l.5 1.5H13v1H3V4h2.5L6 2.5ZM4 6.5h8l-.7 7.1-.1.9H4.8l-.1-.9L4 6.5Zm2 1.5v5h1V8H6Zm3 0v5h1V8H9Z"
              />
            </svg>
          </button>
        </template>
        确定删除这条任务？分析结果与生成内容将一并删除。
      </NPopconfirm>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
}

.task-list-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
}

.task-list-title {
  font-size: 13px;
}

.task-count {
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

.task-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed #e5e6eb;
  border-radius: 10px;
  background: #fafbfc;
}

.task-empty-icon {
  font-size: 24px;
  opacity: 0.5;
}

.task-empty-text {
  font-size: 12px;
}

.task-item {
  display: flex;
  align-items: stretch;
  gap: 4px;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.task-item:hover {
  border-color: #ffb3c0;
  box-shadow: 0 2px 10px rgba(255, 36, 66, 0.1);
}

.task-item-main {
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

.task-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-item-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.4;
  color: #1d2129;
}

.task-item-meta {
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

.task-pipeline {
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

.task-chevron {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: #c9cdd4;
  transition: color 0.15s ease;
}

.task-item:hover .task-chevron {
  color: #ff2442;
}

.task-delete {
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

.task-delete:hover {
  color: #f53f3f;
  background: #fff1f0;
}

.task-delete svg {
  width: 15px;
  height: 15px;
}
</style>
