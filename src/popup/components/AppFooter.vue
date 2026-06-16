<script setup lang="ts">
import { NTooltip } from 'naive-ui'
import { CONTACT_GROUP, CONTACT_QQ } from '../../shared/brand'

const FEEDBACK_TIP = `交流反馈\nQQ：${CONTACT_QQ}\n群：${CONTACT_GROUP}`
const FLOW_TIP =
  '提取 → 进入记录 → AI 分析 → 生成类似笔记。分析模型在详情页切换。'
</script>

<template>
  <footer class="app-footer">
    <NTooltip trigger="hover" placement="top" :style="{ maxWidth: '240px' }">
      <template #trigger>
        <button type="button" class="footer-icon" aria-label="使用流程">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 3.5h-1.5v5.25l4.25 2.45.75-1.3-3.5-2.02V5.5Z"
            />
          </svg>
        </button>
      </template>
      {{ FLOW_TIP }}
    </NTooltip>

    <NTooltip trigger="hover" placement="top" :style="{ maxWidth: '200px' }">
      <template #trigger>
        <button type="button" class="footer-icon" aria-label="交流反馈">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v7A1.5 1.5 0 0 1 15.5 13H8.56l-3.1 2.07a.75.75 0 0 1-1.17-.62V13H4.5A1.5 1.5 0 0 1 3 11.5v-7Z"
            />
          </svg>
        </button>
      </template>
      {{ FEEDBACK_TIP }}
    </NTooltip>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-shrink: 0;
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid #eef0f4;
}

.footer-icon {
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
  transition: color 0.15s ease, background 0.15s ease;
}

.footer-icon:hover {
  color: #86909c;
  background: #f2f3f5;
}

.footer-icon svg {
  width: 16px;
  height: 16px;
}
</style>
