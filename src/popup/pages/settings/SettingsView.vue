<script setup lang="ts">
import { useRouter } from 'vue-router'
import SettingsPanel from './SettingsPanel.vue'

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push('/')
}
</script>

<template>
  <div class="settings-view">
    <SettingsPanel page-mode @close="goBack" />
  </div>
</template>

<style scoped>
.settings-view {
  padding: 12px;
}
</style>
