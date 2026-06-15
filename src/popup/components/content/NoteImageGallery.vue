<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NButton, NCheckbox, NText } from 'naive-ui'

const props = defineProps<{
  images: string[]
  isDownloadingAll: boolean
  downloadingIndex: number | null
  enableImageSelection: boolean
  isImageSelected: (index: number) => boolean
}>()

const emit = defineEmits<{
  copyImages: []
  downloadAll: []
  downloadImage: [index: number]
  toggleImage: [index: number]
  setImageSelected: [index: number, selected: boolean]
  selectAllImages: []
  clearImageSelection: []
}>()

const currentIndex = ref(0)

const currentImage = computed(() => props.images[currentIndex.value] ?? '')
const totalCount = computed(() => props.images.length)
const canGoPrev = computed(() => currentIndex.value > 0)
const canGoNext = computed(() => currentIndex.value < props.images.length - 1)

watch(
  () => props.images,
  () => {
    currentIndex.value = 0
  },
)

function goTo(index: number) {
  if (index < 0 || index >= props.images.length) return
  currentIndex.value = index
}

function goPrev() {
  if (canGoPrev.value) currentIndex.value -= 1
}

function goNext() {
  if (canGoNext.value) currentIndex.value += 1
}
</script>

<template>
  <div class="image-gallery">
    <div class="gallery-toolbar">
      <NText depth="3" class="gallery-toolbar-label">
        笔记图片 · {{ totalCount }} 张
        <span v-if="enableImageSelection" class="vision-hint">· 勾选参与 AI 识图</span>
        <span v-else class="vision-hint vision-hint--muted">· 识图请切换「豆包图文」</span>
      </NText>
      <div class="gallery-toolbar-actions">
        <template v-if="enableImageSelection">
          <NButton size="tiny" quaternary @click="emit('selectAllImages')">
            全选
          </NButton>
          <NButton size="tiny" quaternary @click="emit('clearImageSelection')">
            清空
          </NButton>
        </template>
        <NButton size="tiny" secondary @click="emit('copyImages')">
          复制
        </NButton>
        <NButton
          size="tiny"
          type="primary"
          :loading="isDownloadingAll"
          @click="emit('downloadAll')"
        >
          全部下载
        </NButton>
      </div>
    </div>

    <div class="gallery-main">
      <button
        type="button"
        class="gallery-nav gallery-nav--prev"
        :disabled="!canGoPrev"
        aria-label="上一张"
        @click="goPrev"
      >
        ‹
      </button>

      <div
        class="gallery-viewport"
        :class="{
          'gallery-viewport--selected':
            enableImageSelection && isImageSelected(currentIndex),
        }"
      >
        <img
          v-if="currentImage"
          :src="currentImage"
          :alt="`笔记图片 ${currentIndex + 1}`"
          class="gallery-main-image"
          decoding="async"
        />

        <label
          v-if="enableImageSelection"
          class="gallery-check"
          @click.stop
        >
          <NCheckbox
            :checked="isImageSelected(currentIndex)"
            @update:checked="
              (checked) => emit('setImageSelected', currentIndex, checked)
            "
          />
          <span>识图</span>
        </label>

        <NButton
          class="gallery-download-btn"
          size="tiny"
          secondary
          :loading="downloadingIndex === currentIndex"
          @click="emit('downloadImage', currentIndex)"
        >
          下载
        </NButton>
      </div>

      <button
        type="button"
        class="gallery-nav gallery-nav--next"
        :disabled="!canGoNext"
        aria-label="下一张"
        @click="goNext"
      >
        ›
      </button>
    </div>

    <NText depth="3" class="gallery-counter">
      {{ currentIndex + 1 }} / {{ totalCount }}
    </NText>

    <div class="gallery-thumbs" role="tablist" aria-label="图片缩略图导航">
      <button
        v-for="(imgUrl, index) in images"
        :key="`${imgUrl}-${index}`"
        type="button"
        class="gallery-thumb"
        :class="{
          'gallery-thumb--active': index === currentIndex,
          'gallery-thumb--selected':
            enableImageSelection && isImageSelected(index),
        }"
        :aria-label="`第 ${index + 1} 张`"
        :aria-selected="index === currentIndex"
        role="tab"
        @click="goTo(index)"
      >
        <img :src="imgUrl" :alt="`缩略图 ${index + 1}`" class="gallery-thumb-image" />
        <span v-if="enableImageSelection && isImageSelected(index)" class="gallery-thumb-badge">
          识
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.image-gallery {
  margin-bottom: 12px;
}

.gallery-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.gallery-toolbar-label {
  font-size: 12px;
  flex: 1;
  min-width: 0;
}

.vision-hint {
  color: #ff2442;
}

.vision-hint--muted {
  color: #86909c;
}

.gallery-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.gallery-main {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gallery-nav {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.gallery-nav:hover:not(:disabled) {
  background: #e5e6eb;
  color: #1d2129;
}

.gallery-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.gallery-viewport {
  position: relative;
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 220px;
  border-radius: 8px;
  background: #f2f3f5;
  border: 2px solid transparent;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.gallery-viewport--selected {
  border-color: #ff2442;
}

.gallery-main-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.gallery-check {
  position: absolute;
  left: 8px;
  top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px 2px 4px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 11px;
  color: #1d2129;
  cursor: pointer;
}

.gallery-download-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: rgba(255, 255, 255, 0.92) !important;
}

.gallery-counter {
  display: block;
  text-align: center;
  font-size: 11px;
  margin: 6px 0 8px;
}

.gallery-thumbs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  -webkit-overflow-scrolling: touch;
}

.gallery-thumb {
  position: relative;
  flex: 0 0 52px;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  background: #f2f3f5;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s ease, opacity 0.15s ease;
}

.gallery-thumb:hover {
  opacity: 0.9;
}

.gallery-thumb--active {
  border-color: #ff2442;
}

.gallery-thumb--selected:not(.gallery-thumb--active) {
  border-color: #ffb3c0;
}

.gallery-thumb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gallery-thumb-badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: #ff2442;
  color: #fff;
  font-size: 9px;
  line-height: 14px;
  text-align: center;
}
</style>
