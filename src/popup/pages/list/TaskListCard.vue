<script setup lang="ts">
import { NPopconfirm, NText, NTooltip } from 'naive-ui'
import { type Task, formatTaskTime } from '../../../shared/task-db'
import { useTaskOperationsStore } from '../../stores/task-operations'

defineProps<{
  tasks: Task[]
  exporting?: boolean
}>()

const emit = defineEmits<{
  open: [id: string]
  delete: [id: string]
  exportAll: []
  clearAll: []
}>()

const taskOps = useTaskOperationsStore()
</script>

<template>
  <div class="task-list">
    <div class="task-list-header">
      <NText strong class="task-list-title">历史任务</NText>
      <span v-if="tasks.length > 0" class="task-count">{{ tasks.length }}</span>

      <div class="task-list-tools">
        <NTooltip v-if="tasks.length > 0" trigger="hover">
          <template #trigger>
            <button
              type="button"
              class="tool-btn"
              :class="{ 'tool-btn--busy': exporting }"
              :disabled="exporting"
              aria-label="导出全部笔记"
              @click="emit('exportAll')"
            >
              <span v-if="exporting" class="tool-btn-spinner" aria-hidden="true" />
              <svg v-else viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1.5a.75.75 0 0 1 .75.75v6.19l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 1.06-1.06l1.72 1.72V2.25A.75.75 0 0 1 8 1.5ZM2.75 11a.75.75 0 0 1 .75.75v1.25c0 .14.11.25.25.25h8.5a.25.25 0 0 0 .25-.25v-1.25a.75.75 0 0 1 1.5 0v1.25A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25v-1.25a.75.75 0 0 1 .75-.75Z" />
              </svg>
              <span class="tool-btn-text">导出</span>
            </button>
          </template>
          导出全部笔记为 Markdown 文件
        </NTooltip>

        <NPopconfirm
          v-if="tasks.length > 0"
          positive-text="清空"
          negative-text="取消"
          :disabled="taskOps.busyCount > 0"
          @positive-click="emit('clearAll')"
        >
          <template #trigger>
            <NTooltip trigger="hover">
              <template #trigger>
                <button
                  type="button"
                  class="tool-btn tool-btn--danger"
                  :disabled="taskOps.busyCount > 0"
                  aria-label="清空全部任务"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M6 2.5h4l.5 1.5H13v1H3V4h2.5L6 2.5ZM4 6.5h8l-.7 7.1-.1.9H4.8l-.1-.9L4 6.5Zm2 1.5v5h1V8H6Zm3 0v5h1V8H9Z" />
                  </svg>
                  <span class="tool-btn-text">清空</span>
                </button>
              </template>
              {{ taskOps.busyCount > 0 ? '有任务进行中，暂不可清空' : '清空全部历史任务' }}
            </NTooltip>
          </template>
          确定清空全部 {{ tasks.length }} 条历史任务？分析结果与生成内容将一并删除。
        </NPopconfirm>
      </div>
    </div>

    <div v-if="tasks.length === 0" class="task-empty">
      <span class="task-empty-icon" aria-hidden="true">📋</span>
      <NText depth="3" class="task-empty-text">提取后显示在这里</NText>
    </div>

    <div v-else class="task-list-body">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="task-item"
        :class="{ 'task-item--busy': taskOps.isBusy(task.id) }"
      >
        <button type="button" class="task-item-main" @click="emit('open', task.id)">
          <div class="task-item-content">
            <div class="task-item-title-row">
              <NText strong class="task-item-title">
                {{ task.note.title || '（无标题）' }}
              </NText>
              <span v-if="taskOps.getStatusLabel(task.id)" class="task-status-badge">
                <span class="task-status-spinner" aria-hidden="true" />
                {{ taskOps.getStatusLabel(task.id) }}
              </span>
            </div>
            <div class="task-item-meta">
              <span>{{ task.note.author || '未知作者' }}</span>
              <span class="meta-dot" aria-hidden="true">·</span>
              <span>{{ formatTaskTime(task.extractedAt) }}</span>
              <span v-if="task.noteType === 'video'" class="meta-tag">视频</span>
            </div>
            <div class="task-item-stats" aria-label="互动数据">
              <span class="stat-chip" title="点赞">
                <span class="stat-icon" aria-hidden="true">❤️</span>
                {{ task.note.likedCount || '0' }}
              </span>
              <span class="stat-chip" title="收藏">
                <span class="stat-icon" aria-hidden="true">⭐</span>
                {{ task.note.collectedCount || '0' }}
              </span>
              <span class="stat-chip" title="评论">
                <span class="stat-icon" aria-hidden="true">💬</span>
                {{ task.note.commentCount || '0' }}
              </span>
            </div>
            <div class="task-pipeline" aria-label="进度">
              <span class="pipe-step pipe-step--done" title="已提取">提取</span>
              <span
                class="pipe-line"
                :class="{
                  'pipe-line--done': task.analysis,
                  'pipe-line--active': taskOps.isAnalyzing(task.id) && !task.analysis,
                }"
              />
              <span
                class="pipe-step"
                :class="{
                  'pipe-step--done': task.analysis,
                  'pipe-step--active': taskOps.isAnalyzing(task.id),
                }"
                title="AI 分析"
              >
                分析
              </span>
              <span
                class="pipe-line"
                :class="{
                  'pipe-line--done': task.draft,
                  'pipe-line--active': taskOps.isGenerating(task.id) && !task.draft,
                }"
              />
              <span
                class="pipe-step"
                :class="{
                  'pipe-step--done': task.draft,
                  'pipe-step--active':
                    taskOps.isGenerating(task.id) ||
                    taskOps.isGeneratingImagesForTask(task.id),
                }"
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
          :disabled="taskOps.isBusy(task.id)"
          @positive-click="emit('delete', task.id)"
        >
          <template #trigger>
            <button
              type="button"
              class="task-delete"
              :class="{ 'task-delete--disabled': taskOps.isBusy(task.id) }"
              :disabled="taskOps.isBusy(task.id)"
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
  flex-shrink: 0;
  padding: 0 2px 6px;
}

.task-list-title {
  font-size: 13px;
}

.task-list-tools {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.tool-btn:hover:not(:disabled) {
  color: #ff2442;
  border-color: #ffb3c0;
  background: #fff5f6;
}

.tool-btn--danger:hover:not(:disabled) {
  color: #f53f3f;
  border-color: #ffccc7;
  background: #fff1f0;
}

.tool-btn:disabled {
  cursor: default;
  opacity: 0.7;
}

.tool-btn svg {
  width: 14px;
  height: 14px;
}

.tool-btn-text {
  line-height: 1;
}

.tool-btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #e5e6eb;
  border-top-color: #ff2442;
  border-radius: 50%;
  animation: tool-spin 0.7s linear infinite;
}

@keyframes tool-spin {
  to {
    transform: rotate(360deg);
  }
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
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  border: 1px dashed #e5e6eb;
  border-radius: 10px;
  background: #fafbfc;
}

.task-list-body {
  flex: 1;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  /* 防止 flex 子项被压缩，超出时由本容器滚动 */
  align-content: flex-start;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #c9cdd4 #eef0f4;
}

.task-list-body::-webkit-scrollbar {
  width: 8px;
}

.task-list-body::-webkit-scrollbar-track {
  background: #eef0f4;
  border-radius: 4px;
}

.task-list-body::-webkit-scrollbar-thumb {
  background: #c9cdd4;
  border-radius: 4px;
  border: 2px solid #eef0f4;
  min-height: 32px;
}

.task-list-body::-webkit-scrollbar-thumb:hover {
  background: #a9aeb8;
}

.task-empty-icon {
  font-size: 24px;
  opacity: 0.5;
}

.task-empty-text {
  font-size: 12px;
}

.task-item {
  flex-shrink: 0;
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

.task-item--busy {
  border-color: #ffb3c0;
  background: #fffafb;
}

.task-item-title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.task-item-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.4;
  color: #1d2129;
  flex: 1;
  min-width: 0;
}

.task-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  background: #fff1f0;
  color: #ff2442;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.task-status-spinner {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border: 1.5px solid #ffd6dc;
  border-top-color: #ff2442;
  border-radius: 50%;
  animation: task-status-spin 0.65s linear infinite;
}

@keyframes task-status-spin {
  to {
    transform: rotate(360deg);
  }
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

.task-item-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: #4e5969;
  line-height: 1.2;
}

.stat-icon {
  font-size: 10px;
  line-height: 1;
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
  padding: 1px 0;
  transition: color 0.15s ease, background 0.15s ease;
}

.pipe-step--active {
  color: #ff2442;
  font-weight: 600;
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
  transition: background 0.15s ease;
}

.pipe-line--done {
  background: #ffb3c0;
}

.pipe-line--active {
  background: linear-gradient(90deg, #e5e6eb 0%, #ff2442 45%, #e5e6eb 90%);
  background-size: 200% 100%;
  animation: pipe-line-flow 1.1s ease-in-out infinite;
}

@keyframes pipe-line-flow {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
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

.task-delete:hover:not(:disabled) {
  color: #f53f3f;
  background: #fff1f0;
}

.task-delete--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.task-delete--disabled:hover {
  color: #c9cdd4;
  background: transparent;
}

.task-delete svg {
  width: 15px;
  height: 15px;
}
</style>
