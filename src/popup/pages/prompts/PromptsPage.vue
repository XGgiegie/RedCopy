<script setup lang="ts">
import { NCollapse, NCollapseItem, NSpin } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { type AppPrompts, defaultPrompts, loadPrompts } from '../../../shared/prompts'

const router = useRouter()
const loading = ref(true)
const current = ref<AppPrompts>({ ...defaultPrompts })

const promptMeta = [
  {
    key: 'analysis' as keyof AppPrompts,
    icon: '📊',
    title: '笔记分析',
    desc: '拆解爆款笔记，给出仿写建议',
    source: '创作页 → 分析笔记',
  },
  {
    key: 'generate' as keyof AppPrompts,
    icon: '🧩',
    title: '笔记生成通用模板',
    desc: '所有直接创作 / 仿照创作共用的基础 system prompt',
    source: '创作页 → 生成草稿',
  },
  {
    key: 'purposeTechnicalShare' as keyof AppPrompts,
    icon: '🛠',
    title: '硬核干货 / 技术分享类',
    desc: '技术拆解、架构思路、配置与自动化工作流',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposeMythBusting' as keyof AppPrompts,
    icon: '🧠',
    title: '避坑解密 / 信息差类',
    desc: '认知纠偏、揭露套路、打破信息垄断',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposeIndieDevDiary' as keyof AppPrompts,
    icon: '📈',
    title: '独立开发 / 搞钱日记类',
    desc: '产品从 0 到 1、数据复盘和商业化闭环',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposePainPointSolution' as keyof AppPrompts,
    icon: '⚡',
    title: '场景痛点 / 解决方案类',
    desc: '抓狂场景还原 + 高效率替代方案',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposeResourceRoundup' as keyof AppPrompts,
    icon: '📦',
    title: '资源合集 / 打包白嫖类',
    desc: '开源库、平替工具、配置和脚本合集',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposeInteractiveCocreation' as keyof AppPrompts,
    icon: '🤝',
    title: '听劝养成 / 互动共创类',
    desc: '公开半成品、征集建议、邀请用户共创',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposeIndustryInsight' as keyof AppPrompts,
    icon: '🧭',
    title: '行业观察 / 职场感悟类',
    desc: '行业观察、职场真相和个人判断',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'purposeCommercialPromotion' as keyof AppPrompts,
    icon: '💰',
    title: '直接带货 / 商业推广类',
    desc: '商业合作、自有服务和明确转化场景',
    source: '创作页 → 生成草稿 → 主题子模板',
  },
  {
    key: 'growthReply' as keyof AppPrompts,
    icon: '💬',
    title: '评论回复',
    desc: '自动回复粉丝或潜在用户的评论',
    source: '自动垂直养号 → 回复评论',
  },
  {
    key: 'growthNoteComment' as keyof AppPrompts,
    icon: '🔥',
    title: '笔记抢首评',
    desc: '对目标爆款笔记主动发表评论',
    source: '自动垂直养号 → 抢首评',
  },
] as const

const promptGroups = [
  {
    key: 'analysis',
    title: '创作分析',
    desc: '和爆款拆解相关的提示词',
    items: ['analysis'],
  },
  {
    key: 'generate',
    title: '笔记生成模板',
    desc: '1 条通用模板 + 8 条主题子模板',
    items: [
      'generate',
      'purposeTechnicalShare',
      'purposeMythBusting',
      'purposeIndieDevDiary',
      'purposePainPointSolution',
      'purposeResourceRoundup',
      'purposeInteractiveCocreation',
      'purposeIndustryInsight',
      'purposeCommercialPromotion',
    ],
  },
  {
    key: 'growth',
    title: '养号互动',
    desc: '评论回复与抢首评相关提示词',
    items: ['growthReply', 'growthNoteComment'],
  },
] as const

function groupContains(
  group: (typeof promptGroups)[number],
  key: keyof AppPrompts,
): boolean {
  return (group.items as readonly (keyof AppPrompts)[]).includes(key)
}

onMounted(async () => {
  try {
    current.value = await loadPrompts()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="prompts-list-page">
    <div v-if="loading" class="loading-wrap">
      <NSpin size="medium" />
    </div>

    <template v-else>
      <p class="page-hint">笔记生成现在分为 1 条通用模板 + 8 条主题子模板，点击任意条目进入全屏编辑</p>

      <NCollapse class="prompt-groups" :default-expanded-names="['generate']">
        <NCollapseItem
          v-for="group in promptGroups"
          :key="group.key"
          :name="group.key"
          :title="group.title"
        >
          <template #header-extra>
            <span class="group-desc">{{ group.desc }}</span>
          </template>

          <div class="prompt-cards">
            <button
              v-for="meta in promptMeta.filter((item) => groupContains(group, item.key))"
              :key="meta.key"
              type="button"
              class="prompt-card"
              @click="router.push('/prompts/' + meta.key)"
            >
              <span class="prompt-card-icon" aria-hidden="true">{{ meta.icon }}</span>
              <div class="prompt-card-body">
                <span class="prompt-card-title">{{ meta.title }}</span>
                <span class="prompt-card-source">{{ meta.source }}</span>
                <span class="prompt-card-preview">{{ current[meta.key].slice(0, 60).trim() }}...</span>
              </div>
              <span class="prompt-card-arrow">›</span>
            </button>
          </div>
        </NCollapseItem>
      </NCollapse>
    </template>
  </div>
</template>

<style scoped>
.prompts-list-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 14px 12px;
  gap: 10px;
  overflow-y: auto;
  background: #f7f8fa;
}
.loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.page-hint {
  margin: 0;
  font-size: 12px;
  color: #86909c;
}
.prompt-groups {
  --n-divider-color: transparent;
}
.group-desc {
  font-size: 11px;
  color: #86909c;
}
.prompt-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
}
.prompt-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.prompt-card:hover {
  border-color: #ff2442;
  box-shadow: 0 0 0 2px rgba(255,36,66,0.08);
}
.prompt-card-icon {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}
.prompt-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.prompt-card-title {
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
}
.prompt-card-source {
  font-size: 11px;
  color: #86909c;
}
.prompt-card-preview {
  font-size: 11px;
  color: #c9cdd4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prompt-card-arrow {
  font-size: 20px;
  color: #c9cdd4;
  flex-shrink: 0;
  line-height: 1;
}
</style>
