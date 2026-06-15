<script setup lang="ts">
import { NButton, NText } from 'naive-ui'
import SettingsPanel from './SettingsPanel.vue'

defineEmits<{
  back: []
  saved: []
  cleared: []
}>()
</script>

<template>
  <main class="settings-page">
    <header class="settings-page-header">
      <NButton text type="primary" size="small" @click="$emit('back')">
        ← 返回
      </NButton>
      <NText strong class="settings-page-title">API Key</NText>
      <span class="settings-page-spacer" aria-hidden="true" />
    </header>

    <div class="settings-page-body">
      <SettingsPanel
        page-mode
        @saved="$emit('saved')"
        @cleared="$emit('cleared')"
        @close="$emit('back')"
      />
    </div>
  </main>
</template>

<style scoped>
.settings-page {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  background: #f7f8fa;
}

.settings-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
  position: sticky;
  top: 0;
  z-index: 2;
}

.settings-page-title {
  font-size: 14px;
}

.settings-page-spacer {
  width: 48px;
}

.settings-page-body {
  padding: 12px;
}
</style>
