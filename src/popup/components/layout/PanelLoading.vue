<script setup lang="ts">
import { NSpin, NText } from 'naive-ui'
import { APP_NAME } from '../../../shared/brand'
</script>

<template>
  <main class="panel-loading" role="status" aria-live="polite" aria-busy="true">
    <div class="loading-content">
      <span class="loading-mark" aria-hidden="true">🍠</span>
      <NText strong class="loading-title">{{ APP_NAME }}</NText>
      <NSpin size="small" class="loading-spin" />
      <NText depth="3" class="loading-hint">正在加载...</NText>
    </div>
  </main>
</template>

<style scoped>
.panel-loading {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px;
  animation: fade-in 0.25s ease;
}

.loading-mark {
  font-size: 32px;
  line-height: 1;
  animation: float 1.8s ease-in-out infinite;
}

.loading-title {
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
  letter-spacing: -0.02em;
}

.loading-spin {
  margin-top: 4px;
}

.loading-hint {
  font-size: 12px;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
</style>
