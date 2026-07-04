<script setup lang="ts">
import '../../styles/content-card.css'
import { NButton, NCollapse, NCollapseItem, NSpace, NTag, NText } from 'naive-ui'
import type { AiAnalysisResult } from '../../../shared/ai-types'

defineProps<{
  analysis: AiAnalysisResult
}>()

defineEmits<{
  copyText: []
  copyMarkdown: []
}>()
</script>

<template>
  <div class="content-card analysis-card">
    <NSpace align="center" justify="space-between" class="content-card-header">
      <NSpace align="center" :size="8">
        <NText strong>AI 分析</NText>
        <NTag v-if="analysis.score != null" type="success" size="small" round>
          评分 {{ analysis.score }}
        </NTag>
      </NSpace>
      <NSpace :size="6">
        <NButton size="tiny" type="primary" @click="$emit('copyText')">
          复制
        </NButton>
        <NButton size="tiny" secondary @click="$emit('copyMarkdown')">
          Markdown
        </NButton>
      </NSpace>
    </NSpace>

    <div class="content-block">
      <NCollapse>
        <NCollapseItem title="查看 AI 分析结果" name="analysis-detail">
          <div class="content-block">
            <NText depth="3" class="content-label">总结</NText>
            <NText class="content-text">{{ analysis.summary }}</NText>
          </div>

          <div v-if="analysis.titleAnalysis" class="content-block">
            <NText depth="3" class="content-label">标题分析</NText>
            <NText class="content-text">{{ analysis.titleAnalysis }}</NText>
          </div>

          <div v-if="analysis.contentStructure?.length" class="content-block">
            <NText depth="3" class="content-label">内容结构</NText>
            <ul class="content-list">
              <li v-for="(item, index) in analysis.contentStructure" :key="index">
                {{ item }}
              </li>
            </ul>
          </div>

          <div v-if="analysis.engagementInsight" class="content-block">
            <NText depth="3" class="content-label">互动洞察</NText>
            <NText class="content-text">{{ analysis.engagementInsight }}</NText>
          </div>

          <div v-if="analysis.rewriteSuggestions?.length" class="content-block">
            <NText depth="3" class="content-label">爆款创作建议</NText>
            <ul class="content-list">
              <li v-for="(item, index) in analysis.rewriteSuggestions" :key="index">
                {{ item }}
              </li>
            </ul>
          </div>
        </NCollapseItem>
      </NCollapse>
    </div>
  </div>
</template>
