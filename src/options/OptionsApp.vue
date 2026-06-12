<script setup lang="ts">
import { NCard, NText } from 'naive-ui'
import SettingsPanel from '../popup/SettingsPanel.vue'
</script>

<template>
  <main class="options-page">
    <NCard size="small" class="options-card">
      <NText depth="3" class="options-tip">
        若独立设置页保存失败，请在小红书页面打开扩展侧栏，在侧栏内配置 AI 设置。
      </NText>
      <SettingsPanel />
    </NCard>
  </main>
</template>

<style scoped>
.options-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.options-card {
  max-width: 560px;
  margin: 0 auto;
}

.options-tip {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}
</style>
