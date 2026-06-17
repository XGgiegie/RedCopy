<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NModal, NText } from 'naive-ui'
import type { GrowthAcquireProgress } from '../../../shared/growth-acquire'
import { GROWTH_AI_ACTION_LIMIT } from '../../../shared/growth-acquire'

const props = defineProps<{
  show: boolean
  progress: GrowthAcquireProgress | null
  isRunning: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  stop: []
}>()

const isFinished = computed(
  () =>
    !props.isRunning
    && props.progress != null
    && (props.progress.phase === 'done'
      || props.progress.phase === 'cancelled'
      || props.progress.phase === 'error'),
)

const title = computed(() => {
  if (props.isRunning) return '获客运行中'
  if (props.progress?.phase === 'error') return '运行失败'
  if (props.progress?.phase === 'cancelled') return '已停止'
  return '运行完成'
})

function formatRemaining(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
}

const aiRemainingText = computed(() => {
  if (props.progress?.aiUnlimited) return '不限'
  const used = props.progress?.aiUsed ?? 0
  return String(Math.max(0, GROWTH_AI_ACTION_LIMIT - used))
})

function close() {
  if (props.isRunning) return
  emit('update:show', false)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="growth-run-progress-dialog"
    :style="{ width: 'min(360px, calc(100vw - 24px))' }"
    :title="title"
    :mask-closable="!isRunning"
    :closable="!isRunning"
    @update:show="emit('update:show', $event)"
  >
    <div v-if="progress" class="run-progress-body" role="status" aria-live="polite">
      <div v-if="isRunning" class="run-progress-indicator" aria-hidden="true">
        <span class="run-progress-dot" />
        <span class="run-progress-dot" />
        <span class="run-progress-dot" />
      </div>

      <NText class="run-progress-message">{{ progress.message }}</NText>

      <div class="run-progress-stats">
        <div class="stat-item">
          <span class="stat-label">剩余</span>
          <span class="stat-value">{{ formatRemaining(progress.remainingSec) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">扫描</span>
          <span class="stat-value">{{ progress.scanned }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">评论</span>
          <span class="stat-value">{{ progress.commented }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">回复</span>
          <span class="stat-value">{{ progress.replied }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">跳过</span>
          <span class="stat-value">{{ progress.skipped }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AI 剩余</span>
          <span class="stat-value">{{ aiRemainingText }}</span>
        </div>
      </div>

      <NText v-if="isRunning" depth="3" class="run-progress-tip">
        请勿切换小红书标签页，可在此查看实时进度
      </NText>
    </div>

    <template #footer>
      <div class="run-progress-footer">
        <NButton v-if="isRunning" type="warning" @click="emit('stop')">
          停止运行
        </NButton>
        <NButton v-else type="primary" @click="close">
          {{ isFinished ? '关闭' : '关闭' }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.run-progress-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.run-progress-indicator {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 4px 0;
}

.run-progress-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff2442;
  animation: run-pulse 1.2s ease-in-out infinite;
}

.run-progress-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.run-progress-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes run-pulse {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.run-progress-message {
  display: block;
  font-size: 13px;
  line-height: 1.55;
  color: #1d2129;
  text-align: center;
}

.run-progress-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(52px, 1fr));
  gap: 8px;
  padding: 12px 10px;
  border-radius: 10px;
  background: #f7f8fa;
  border: 1px solid #eef0f4;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.stat-label {
  font-size: 11px;
  color: #86909c;
}

.stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #1d2129;
}

.run-progress-tip {
  display: block;
  font-size: 11px;
  text-align: center;
  line-height: 1.5;
}

.run-progress-footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}
</style>
