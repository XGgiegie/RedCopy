<script setup lang="ts">
import { NButton } from 'naive-ui'

defineEmits<{
  openSettings: []
}>()
</script>

<template>
  <NButton
    quaternary
    circle
    size="small"
    title="配置 API Key"
    class="settings-gear-btn"
    @click="$emit('openSettings')"
  >
    <svg class="gear-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.52-.4-1.08-.73-1.69-.98l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.61.25-1.17.59-1.69.98l-2.39-.96a.488.488 0 0 0-.59.22l-1.92 3.32c-.12.22-.09.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.52.4 1.08.73 1.69.98l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.61-.25 1.17-.59 1.69-.98l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.09-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  </NButton>
</template>

<style scoped>
.settings-gear-btn {
  color: #86909c;
}

.settings-gear-btn:hover {
  color: #ff2442;
}

.gear-icon {
  width: 16px;
  height: 16px;
  display: block;
}
</style>
