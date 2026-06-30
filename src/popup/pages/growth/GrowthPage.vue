<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NText, useMessage } from 'naive-ui'
import { MODULE_GROWTH } from '../../../shared/brand'
import {
  type GrowthRecord,
  clearGrowthRecords,
  deleteGrowthRecord,
  listGrowthRecords,
} from '../../../shared/growth-records'
import { usePageStatusStore } from '../../stores/page-status'
import GrowthCollectDialog from './GrowthCollectDialog.vue'
import GrowthRecordList from './GrowthRecordList.vue'

const message = useMessage()
const router = useRouter()
const pageStatus = usePageStatusStore()

const records = ref<GrowthRecord[]>([])
const activeSubPage = ref<'config' | 'records'>('config')

const isXhsPage = computed(() => pageStatus.isXhsPage)

async function refreshRecords() {
  records.value = await listGrowthRecords()
}

async function handleDelete(id: string) {
  try {
    await deleteGrowthRecord(id)
    await refreshRecords()
    message.success('已删除互动记录')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][获客] 删除记录失败', { id, detail }, error)
    message.error(`删除失败：${detail}`)
  }
}

async function handleClearAll() {
  if (records.value.length === 0) {
    message.warning('暂无互动记录')
    return
  }

  try {
    const count = await clearGrowthRecords()
    await refreshRecords()
    message.success(`已清空 ${count} 条互动记录`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][获客] 清空互动记录失败', detail, error)
    message.error(`清空失败：${detail}`)
  }
}

onMounted(() => {
  void refreshRecords()
  void pageStatus.syncActiveTab()
})

watch(
  () => router.currentRoute.value.name,
  (name) => {
    if (name === 'growth') void refreshRecords()
  },
)
</script>

<template>
  <div class="growth-page">
    <div class="growth-page-sticky">
      <section class="growth-hero">
        <div class="growth-hero-head">
          <span class="growth-hero-icon" aria-hidden="true">🎯</span>
          <div class="growth-hero-text">
            <h2 class="growth-hero-title">{{ MODULE_GROWTH }}</h2>
          </div>
        </div>
      </section>

      <nav class="growth-subnav" aria-label="自动垂直养号二级导航">
        <button
          type="button"
          class="growth-subnav-btn"
          :class="{ 'growth-subnav-btn--active': activeSubPage === 'config' }"
          @click="activeSubPage = 'config'"
        >
          运行配置
        </button>
        <button
          type="button"
          class="growth-subnav-btn"
          :class="{ 'growth-subnav-btn--active': activeSubPage === 'records' }"
          @click="activeSubPage = 'records'"
        >
          互动记录
        </button>
      </nav>

      <NText v-if="!isXhsPage" depth="3" class="growth-page-tip">
        请先打开小红书网站，再启动自动垂直养号。
      </NText>
    </div>

    <div class="growth-page-scroll">
      <GrowthCollectDialog
        v-if="activeSubPage === 'config'"
        :is-xhs-page="isXhsPage"
        @completed="refreshRecords"
      />

      <GrowthRecordList
        v-else
        class="growth-list"
        :records="records"
        @delete="handleDelete"
        @clear-all="handleClearAll"
      />
    </div>
  </div>
</template>

<style scoped>
.growth-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.growth-page-sticky {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #eef0f4;
}

.growth-hero {
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #fff7ed 0%, #fff1f0 100%);
  border: 1px solid #ffd8bf;
}

.growth-hero-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.growth-hero-icon {
  flex-shrink: 0;
  font-size: 22px;
  line-height: 1;
}

.growth-hero-text {
  min-width: 0;
}

.growth-hero-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
  letter-spacing: -0.02em;
}

.growth-page-tip {
  display: block;
  padding: 7px 10px;
  border-radius: 8px;
  background: #fff7e6;
  border: 1px solid #ffe7ba;
  color: #d46b08;
  font-size: 12px;
  line-height: 1.45;
}

.growth-subnav {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.growth-subnav-btn {
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.growth-subnav-btn:hover {
  color: #ff2442;
  border-color: #ffb3c0;
  background: #fff5f6;
}

.growth-subnav-btn--active,
.growth-subnav-btn--active:hover {
  color: #ff2442;
  border-color: #ffccc7;
  background: #fff1f0;
}

.growth-page-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px 12px 12px;
}

.growth-page-scroll:has(.growth-collect-panel) {
  overflow-y: auto;
  scrollbar-width: none;
}

.growth-page-scroll:has(.growth-collect-panel)::-webkit-scrollbar {
  display: none;
}

.growth-page-scroll:has(.growth-list) {
  overflow: hidden;
}

.growth-list {
  flex: 1;
  min-height: 0;
}
</style>
