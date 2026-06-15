<script setup lang="ts">
import { NText } from 'naive-ui'
import { APP_NAME, APP_TAGLINE } from '../shared/brand'
import SettingsPanel from '../popup/components/settings/SettingsPanel.vue'
</script>

<template>
  <main class="options-page">
    <header class="options-header">
      <NText strong class="options-title">{{ APP_NAME }}</NText>
      <NText depth="3" class="options-tagline">{{ APP_TAGLINE }}</NText>
    </header>

    <section class="options-card">
      <SettingsPanel />
    </section>
  </main>
</template>

<style scoped>
.options-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24px 16px 32px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #f7f8fa;
}

.options-header {
  max-width: 560px;
  margin: 0 auto 16px;
}

.options-title {
  display: block;
  font-size: 18px;
  margin-bottom: 4px;
}

.options-tagline {
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.options-card {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #eef0f4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}
</style>
