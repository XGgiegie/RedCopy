<script setup lang="ts">
import { NCard, NText } from 'naive-ui'
import { APP_NAME, APP_TAGLINE } from '../shared/brand'
import SettingsPanel from '../popup/SettingsPanel.vue'
</script>

<template>
  <main class="options-page">
    <NCard :title="APP_NAME" size="small" class="options-card">
      <NText depth="3" class="options-tagline">{{ APP_TAGLINE }}</NText>
      <NText depth="3" class="options-tip">
        若本页保存失败，请在小红书页面打开扩展侧栏，点击右上角 ⚙ 配置 API Key。
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

.options-tagline {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.options-tip {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 12px;
}
</style>
