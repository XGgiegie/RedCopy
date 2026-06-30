<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MODULE_CREATION, MODULE_GROWTH } from '../../shared/brand'

const route = useRoute()
const router = useRouter()

const activeModule = computed(() => route.name)

function goCreation() {
  if (route.name !== 'creation') {
    void router.push({ name: 'creation' })
  }
}

function goGrowth() {
  if (route.name !== 'growth') {
    void router.push({ name: 'growth' })
  }
}
</script>

<template>
  <nav class="module-tabs" aria-label="功能模块">
    <button
      type="button"
      class="module-tab"
      :class="{ 'module-tab--active': activeModule === 'creation' }"
      @click="goCreation"
    >
      {{ MODULE_CREATION }}
    </button>
    <button
      type="button"
      class="module-tab"
      :class="{ 'module-tab--active': activeModule === 'growth' }"
      @click="goGrowth"
    >
      {{ MODULE_GROWTH }}
    </button>
  </nav>
</template>

<style scoped>
.module-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 6px 12px;
  background: #fff;
  border-bottom: 1px solid #eef0f4;
}

.module-tab {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: #86909c;
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease;
}

.module-tab:hover {
  color: #4e5969;
  background: #f7f8fa;
}

.module-tab--active {
  color: #ff2442;
  background: #fff1f0;
  border-color: #ffccc7;
}

.module-tab--active:hover {
  color: #ff2442;
  background: #fff1f0;
}
</style>
