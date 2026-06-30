<script setup lang="ts">
import { useRouter } from 'vue-router'
import SettingsPanel from './SettingsPanel.vue'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/creation')
}
</script>

<template>
  <div class="settings-view">
    <SettingsPanel page-mode @close="goBack" />
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
}
</style>
