<script setup lang="ts">
import { computed } from 'vue'
import InfoTip from './InfoTip.vue'

const props = defineProps<{
  isXhsPage: boolean
  isNotePage: boolean
}>()

const PAGE_TIP =
  '支持图文与视频笔记文案提取。视频笔记可分析文案；图片下载仅适用于图文笔记。'

type PageStatusLevel = 'ready' | 'warn' | 'idle'

const statusLevel = computed<PageStatusLevel>(() => {
  if (props.isNotePage) return 'ready'
  if (props.isXhsPage) return 'warn'
  return 'idle'
})

const statusTitle = computed(() => {
  if (statusLevel.value === 'ready') return '笔记页已就绪'
  if (statusLevel.value === 'warn') return '请打开笔记详情'
  return '未检测到小红书'
})

const statusDesc = computed(() => {
  if (statusLevel.value === 'ready') return '可以提取当前笔记'
  if (statusLevel.value === 'warn') return '当前在小红书站内，需进入一篇笔记'
  return '请切换到小红书笔记详情页'
})
</script>

<template>
  <div class="page-status" :class="`page-status--${statusLevel}`">
    <div class="page-status-signal" aria-hidden="true">
      <span class="status-dot" />
    </div>

    <div class="page-status-text">
      <span class="status-title">{{ statusTitle }}</span>
      <span class="status-desc">{{ statusDesc }}</span>
    </div>

    <InfoTip :content="PAGE_TIP" placement="left" />
  </div>
</template>

<style scoped>
.page-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.page-status--ready {
  background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
  border-color: #86efac;
}

.page-status--warn {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  border-color: #fcd34d;
}

.page-status--idle {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-color: #e2e8f0;
}

.page-status-signal {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: block;
}

.page-status--ready .status-dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
  animation: pulse 2s ease-in-out infinite;
}

.page-status--warn .status-dot {
  background: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.2);
}

.page-status--idle .status-dot {
  background: #94a3b8;
}

.page-status-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  color: #1d2129;
}

.status-desc {
  font-size: 12px;
  line-height: 1.4;
  color: #4e5969;
}

.page-status--ready .status-title {
  color: #15803d;
}

.page-status--warn .status-title {
  color: #b45309;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.12);
  }
}
</style>
