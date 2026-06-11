<script setup lang="ts">
import {
  NButton,
  NCard,
  NCode,
  NCollapse,
  NCollapseItem,
  NSpace,
  NTag,
  NText,
  NCarousel, // 新增：轮播图组件
  NImage,    // 新增：图片组件
  useMessage,
} from 'naive-ui'
import { onMounted, ref, computed } from 'vue'
import { isXhsNoteUrl } from '../shared/extract-note'
import type { NoteExtractResult } from '../shared/note-types'
import { extractNoteFromTab } from './extract-note'

const message = useMessage()
const isXhsPage = ref(false)
const isNotePage = ref(false)
const pageTitle = ref('检测中…')
const isExtracting = ref(false)
const noteResult = ref<NoteExtractResult | null>(null)

// 工具函数：获取图片列表 (兼容不同命名习惯，请根据你的实际数据结构调整)
const extractedImages = computed(() => {
  if (!noteResult.value) return []
  // 假设你的图片数组可能叫 images, imageList 等
  const data = noteResult.value.text || {}
  return data.images || data.imageList || noteResult.value.images || []
})

// 工具函数：格式化时间戳
function formatTime(timestamp?: string | number) {
  if (!timestamp) return '未知时间'
  const date = new Date(Number(timestamp))
  return isNaN(date.getTime()) 
    ? '未知时间' 
    : `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

async function extractCurrentNote(tabId: number) {
  isExtracting.value = true
  noteResult.value = null

  try {
    const result = await extractNoteFromTab(tabId)
    noteResult.value = result

    if (result.ok) {
      message.success('笔记内容已提取')
      console.info('[RedCopy] 笔记数据', result)
    } else {
      message.warning(result.error ?? '未能提取笔记内容')
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 提取失败', detail, error)
    message.error(`提取失败：${detail}`)
  } finally {
    isExtracting.value = false
  }
}

async function checkXhsPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const url = tab?.url ?? ''
  const matched = /xiaohongshu\.com/.test(url)
  const note = isXhsNoteUrl(url)

  isXhsPage.value = matched
  isNotePage.value = note
  pageTitle.value = matched ? tab?.title ?? '当前页面' : '未在小红书页面'

  if (!matched) {
    message.warning('请在小红书页面使用')
    return
  }

  if (!note) {
    message.info('请打开一篇笔记详情页（/explore/xxx）')
    return
  }

  message.success('已识别笔记页面')
  if (tab?.id != null) {
    await extractCurrentNote(tab.id)
  }
}

function handleExtract() {
  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id || !isNotePage.value) {
      message.warning('请先打开小红书笔记详情页')
      return
    }
    await extractCurrentNote(tab.id)
  })
}

function handleCopy() {
  if (!noteResult.value) return
  const payload = JSON.stringify(noteResult.value, null, 2)
  navigator.clipboard.writeText(payload).then(
    () => message.success('已复制完整 JSON 到剪贴板'),
    () => message.error('复制失败'),
  )
}

function handleCopyDom() {
  if (!noteResult.value?.dom?.tree) {
    message.warning('未获取到 DOM 结构')
    return
  }
  const payload = JSON.stringify(noteResult.value.dom.tree, null, 2)
  navigator.clipboard.writeText(payload).then(
    () => message.success('已复制 DOM 结构'),
    () => message.error('复制失败'),
  )
}

onMounted(checkXhsPage)
</script>

<template>
  <main class="popup">
    <NCard title="小红书爆款解析助手" size="small" :bordered="false">
      <NSpace vertical :size="12">
        <NSpace align="center" justify="space-between">
          <NText depth="3" style="font-size: 12px;">提取当前笔记文本与结构</NText>
          <NTag :type="isNotePage ? 'success' : isXhsPage ? 'warning' : 'default'" size="small" round>
            {{ isNotePage ? '已就绪' : isXhsPage ? '非笔记页' : '未命中' }}
          </NTag>
        </NSpace>

        <!-- 美化后的数据展示卡片 -->
        <div v-if="noteResult?.ok" class="note-preview-card">
          
          <!-- 作者与元数据 -->
          <NSpace align="center" justify="space-between" class="preview-meta">
            <NTag type="primary" size="small" round bordered="false">
              👤 {{ noteResult.text.author || '未知作者' }}
            </NTag>
            <NText depth="3" style="font-size: 12px;">
              {{ formatTime(noteResult.text.publishTime) }}
            </NText>
          </NSpace>

          <!-- 新增：图片展示区 (轮播图) -->
          <div v-if="extractedImages.length > 0" class="preview-carousel-wrap">
            <NCarousel
              effect="slide"
              centered-slides
              show-arrow
              dot-type="line"
              class="note-carousel"
            >
              <!-- 为了视觉效果好，这里用 NImage 组件，支持点击放大预览 -->
              <NImage
                v-for="(imgUrl, index) in extractedImages"
                :key="index"
                :src="imgUrl"
                object-fit="cover"
                class="carousel-image"
              />
            </NCarousel>
            <!-- 左上角显示图片数量角标 -->
            <div class="image-count-badge">1 / {{ extractedImages.length }}</div>
          </div>

          <!-- 标题区 -->
          <div class="preview-header">
            <NText strong class="preview-title">{{ noteResult.text.title || '（无标题）' }}</NText>
          </div>

          <!-- 正文预览 -->
          <div class="preview-content">
            <NText depth="2" class="desc-preview">
              {{ noteResult.text.desc || noteResult.text.allText?.slice(0, 200) }}
            </NText>
          </div>

          <!-- 标签区 -->
          <NSpace v-if="noteResult.text.tags && noteResult.text.tags.length" :size="6" class="preview-tags">
            <NTag 
              v-for="tag in noteResult.text.tags" 
              :key="tag" 
              type="error" 
              size="small" 
              round 
              :bordered="false"
              style="background-color: #ffeef0; color: #ff2442;"
            >
              # {{ tag }}
            </NTag>
          </NSpace>

          <!-- 互动数据看板 -->
          <div class="preview-stats">
            <div class="stat-item">
              <span class="stat-label">❤️ 点赞</span>
              <span class="stat-value">{{ noteResult.text.likedCount || 0 }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">⭐ 收藏</span>
              <span class="stat-value">{{ noteResult.text.collectedCount || 0 }}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">💬 评论</span>
              <span class="stat-value">{{ noteResult.text.commentCount || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 按钮组 -->
        <NButton
          type="primary"
          block
          :loading="isExtracting"
          :disabled="!isNotePage"
          @click="handleExtract"
        >
          {{ noteResult?.ok ? '重新提取笔记' : '提取笔记内容' }}
        </NButton>

        <NSpace v-if="noteResult?.ok" vertical :size="8">
          <NSpace :wrap="false">
            <NButton block secondary @click="handleCopy" style="flex: 1;">
              复制完整 JSON
            </NButton>
            <NButton v-if="noteResult.dom?.tree" block type="primary" secondary @click="handleCopyDom" style="flex: 1; margin: 0;">
              复制 DOM 树
            </NButton>
          </NSpace>
        </NSpace>

        <!-- 开发者视图 -->
        <NCollapse v-if="noteResult" class="dev-collapse">
          <NCollapseItem title="📦 开发者视图：原始提取字段" name="text">
            <NCode :code="JSON.stringify(noteResult.text, null, 2)" language="json" word-wrap />
          </NCollapseItem>
          <NCollapseItem v-if="noteResult.dom?.tree" title="🌳 DOM 树结构" name="dom">
            <NCode :code="JSON.stringify(noteResult.dom.tree, null, 2)" language="json" word-wrap />
          </NCollapseItem>
          <NCollapseItem v-if="noteResult.structured" title="⚙️ 结构化数据 (State)" name="state">
            <NCode :code="JSON.stringify(noteResult.structured, null, 2)" language="json" word-wrap />
          </NCollapseItem>
        </NCollapse>
      </NSpace>
    </NCard>
  </main>
</template>

<style scoped>
.popup {
  width: 380px;
  max-height: 600px; /* 为了放得下图片稍微加高一点 */
  overflow-y: auto;
  background: #f7f8fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.note-preview-card {
  background: #ffffff;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  margin-top: 4px;
  margin-bottom: 8px;
}

.preview-meta {
  margin-bottom: 12px;
}

/* 轮播图样式 */
.preview-carousel-wrap {
  position: relative;
  width: 100%;
  height: 240px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
  background: #f2f3f5;
}

.note-carousel {
  width: 100%;
  height: 100%;
}

.carousel-image {
  width: 100%;
  height: 240px;
  display: block;
}

.image-count-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  pointer-events: none;
  z-index: 2;
}

.preview-title {
  font-size: 16px;
  line-height: 1.4;
  color: #333;
}

.preview-content {
  margin-top: 10px;
  background: #f9fafa;
  padding: 10px;
  border-radius: 6px;
}

.desc-preview {
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-tags {
  margin-top: 12px;
}

.preview-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fcfcfd;
  border: 1px solid #f2f3f5;
  border-radius: 8px;
  padding: 10px 16px;
  margin-top: 14px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: #86909c;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background-color: #e5e6eb;
}

.dev-collapse {
  margin-top: 8px;
  background: #fff;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #eef0f4;
}

/* 覆盖 Naive UI 轮播图内部图片的 object-fit 行为 */
:deep(.n-image img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>