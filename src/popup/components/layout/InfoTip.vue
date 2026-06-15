<script setup lang="ts">
import { NTooltip } from 'naive-ui'

defineProps<{
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}>()
</script>

<template>
  <NTooltip
    trigger="hover"
    :placement="placement ?? 'top'"
    :style="{ maxWidth: '260px' }"
  >
    <template #trigger>
      <button type="button" class="info-tip" :aria-label="content">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 6.75h1.5V5.25h-1.5v1.5Zm0 4.5h1.5V7.5h-1.5v3.75Z"
          />
        </svg>
      </button>
    </template>
    {{ content }}
  </NTooltip>
</template>

<style scoped>
.info-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #c9cdd4;
  cursor: help;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.info-tip:hover {
  color: #86909c;
}

.info-tip svg {
  width: 14px;
  height: 14px;
}
</style>
