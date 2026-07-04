<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="settings-view">
    <div class="settings-hub">
      <button type="button" class="hub-card" @click="router.push('/apikey')">
        <span class="hub-card-icon" aria-hidden="true">🔑</span>
        <div class="hub-card-body">
          <span class="hub-card-title">API Key 设置</span>
          <span class="hub-card-desc">配置豆包 / Pro 版 API Key，选择 AI 方案</span>
        </div>
        <span class="hub-card-arrow">›</span>
      </button>

      <button type="button" class="hub-card" @click="router.push('/prompts')">
        <span class="hub-card-icon" aria-hidden="true">✍️</span>
        <div class="hub-card-body">
          <span class="hub-card-title">AI 提示词</span>
          <span class="hub-card-desc">自定义分析、生成、评论回复等场景的系统提示词</span>
        </div>
        <span class="hub-card-arrow">›</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 12px;
}

.settings-hub {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hub-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 12px;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.hub-card:hover {
  border-color: #ff2442;
  box-shadow: 0 0 0 2px rgba(255, 36, 66, 0.08);
}

.hub-card-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.hub-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hub-card-title {
  font-size: 14px;
  font-weight: 700;
  color: #1d2129;
}

.hub-card-desc {
  font-size: 12px;
  color: #86909c;
  line-height: 1.4;
}

.hub-card-arrow {
  font-size: 20px;
  color: #c9cdd4;
  flex-shrink: 0;
  line-height: 1;
}
</style>
