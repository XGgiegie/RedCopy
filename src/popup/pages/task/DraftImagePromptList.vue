<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  NButton,
  NImage,
  NInput,
  NSelect,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import type { DraftImagePrompt, GeneratedImageRecord } from '../../../shared/ai-types'
import {
  DEFAULT_IMAGE_SIZE,
  IMAGE_SIZE_OPTIONS,
  aspectRatioOfSize,
  createEmptyImagePrompt,
  createImageRecordId,
  isValidImageDataUrl,
} from '../../../shared/draft-image'
import {
  copyTextToClipboard,
  formatImageRecordAsMarkdown,
} from '../../../shared/export-markdown'
import { downloadImageByUrl, guessImageExtension } from '../../../shared/note-media'
import { useTaskOperationsStore } from '../../stores/task-operations'
import { generateDraftImage } from '../../services/generate-image'

const imagePrompts = defineModel<DraftImagePrompt[]>('imagePrompts', { required: true })

const props = defineProps<{
  taskId: string
  isGenerateReady: boolean
  imageHistory: GeneratedImageRecord[]
}>()

const emit = defineEmits<{
  edit: []
  generated: [record: GeneratedImageRecord]
  deleteImage: [recordId: string]
}>()

const message = useMessage()
const taskOps = useTaskOperationsStore()

const fileInputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const uploadTargetId = ref<string | null>(null)

// 参考图与尺寸属于本地临时输入，不写入持久化草稿（避免 base64 撑爆存储）
const referencesByPrompt = reactive<Record<string, string[]>>({})
const sizeByPrompt = reactive<Record<string, string>>({})
const dragOverId = ref<string | null>(null)

const sizeOptions = IMAGE_SIZE_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}))

function getReferences(id: string): string[] {
  return referencesByPrompt[id] ?? []
}

function getSize(id: string): string {
  return sizeByPrompt[id] ?? DEFAULT_IMAGE_SIZE
}

function resultsOf(promptId: string): GeneratedImageRecord[] {
  return props.imageHistory.filter((record) => record.promptId === promptId)
}

function notifyEdit() {
  emit('edit')
}

function addPrompt() {
  const nextIndex = imagePrompts.value.length + 1
  imagePrompts.value = [
    ...imagePrompts.value,
    createEmptyImagePrompt(`配图${nextIndex}`),
  ]
  notifyEdit()
}

function removePrompt(id: string) {
  imagePrompts.value = imagePrompts.value.filter((item) => item.id !== id)
  delete referencesByPrompt[id]
  delete sizeByPrompt[id]
  notifyEdit()
}

function updatePrompt(id: string, patch: Partial<DraftImagePrompt>) {
  imagePrompts.value = imagePrompts.value.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  )
  notifyEdit()
}

// ── 参考图上传（点击 + 拖拽，统一转 base64） ─────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读取失败'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

async function addReferenceFiles(id: string, files: FileList | File[]) {
  const list = Array.from(files).filter((file) => file.type.startsWith('image/'))
  if (list.length === 0) {
    message.warning('请选择图片文件')
    return
  }

  const accepted: string[] = []
  for (const file of list) {
    if (file.size > 10 * 1024 * 1024) {
      message.warning(`「${file.name}」超过 10MB，已跳过`)
      continue
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (!isValidImageDataUrl(dataUrl)) {
        message.warning(`「${file.name}」格式不受支持，已跳过`)
        continue
      }
      accepted.push(dataUrl)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 读取参考图失败', { detail }, error)
    }
  }

  if (accepted.length === 0) return
  referencesByPrompt[id] = [...getReferences(id), ...accepted]
  message.success(`已添加 ${accepted.length} 张参考图`)
}

function triggerUpload(id: string) {
  uploadTargetId.value = id
  fileInputRef.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  const id = uploadTargetId.value
  input.value = ''
  uploadTargetId.value = null
  if (!files || !id) return
  await addReferenceFiles(id, files)
}

function onDrop(id: string, event: DragEvent) {
  dragOverId.value = null
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    void addReferenceFiles(id, files)
  }
}

function removeReference(id: string, index: number) {
  const next = getReferences(id).filter((_, i) => i !== index)
  if (next.length > 0) referencesByPrompt[id] = next
  else delete referencesByPrompt[id]
}

// ── 生成 ────────────────────────────────────────────────────

function isGenerating(item: DraftImagePrompt): boolean {
  return taskOps.isGeneratingImage(props.taskId, item.id)
}

async function handleGenerate(item: DraftImagePrompt) {
  if (!props.isGenerateReady) {
    message.warning('请先在设置中配置 ARK API Key')
    return
  }
  if (!item.prompt.trim()) {
    message.warning('请先填写配图提示词')
    return
  }

  const { taskId } = props
  const references = getReferences(item.id)
  const size = getSize(item.id)

  taskOps.startImage(taskId, item.id)
  try {
    const url = await generateDraftImage({
      prompt: item.prompt,
      referenceImages: references,
      size,
    })

    const record: GeneratedImageRecord = {
      id: createImageRecordId(),
      promptId: item.id,
      label: item.label,
      prompt: item.prompt,
      size,
      aspectRatio: aspectRatioOfSize(size),
      fromReference: references.length > 0,
      url,
      createdAt: Date.now(),
    }
    emit('generated', record)
    message.success(references.length > 0 ? '参考图生成完成' : '配图生成完成')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 配图生成失败', { taskId, promptId: item.id, detail }, error)
    message.error(detail)
  } finally {
    taskOps.stopImage(taskId, item.id)
  }
}

// ── 用户上传自己的配图（直接入历史，不经过 AI 生成） ─────────

function triggerImageUpload() {
  imageInputRef.value?.click()
}

async function onImageFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  input.value = ''
  if (!files || files.length === 0) return

  const list = Array.from(files).filter((file) => file.type.startsWith('image/'))
  if (list.length === 0) {
    message.warning('请选择图片文件')
    return
  }

  let added = 0
  for (const file of list) {
    if (file.size > 15 * 1024 * 1024) {
      message.warning(`「${file.name}」超过 15MB，已跳过`)
      continue
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (!isValidImageDataUrl(dataUrl)) {
        message.warning(`「${file.name}」格式不受支持，已跳过`)
        continue
      }
      const record: GeneratedImageRecord = {
        id: createImageRecordId(),
        label: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || '上传配图',
        prompt: '',
        size: '原图',
        fromReference: false,
        source: 'upload',
        url: dataUrl,
        createdAt: Date.now(),
      }
      emit('generated', record)
      added += 1
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 上传配图失败', { detail }, error)
    }
  }

  if (added > 0) message.success(`已上传 ${added} 张配图到历史`)
}

// ── 单图操作 ────────────────────────────────────────────────

async function copyImageMarkdown(record: GeneratedImageRecord) {
  try {
    await copyTextToClipboard(formatImageRecordAsMarkdown(record))
    message.success('图片 Markdown 已复制')
  } catch (error) {
    console.error('[RedCopy] 复制图片 Markdown 失败', error)
    message.error('复制失败')
  }
}

async function downloadImage(record: GeneratedImageRecord) {
  const ext = guessImageExtension(record.url)
  const name = `${record.label || '配图'}-${record.id}${ext}`
  try {
    await downloadImageByUrl(record.url, name)
    message.success('已开始下载')
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 配图下载失败', { detail }, error)
    message.error(`下载失败：${detail}`)
  }
}

function removeRecord(record: GeneratedImageRecord) {
  emit('deleteImage', record.id)
}

const promptCount = computed(() => imagePrompts.value.length)
</script>

<template>
  <div class="image-prompt-list">
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden-file-input"
      @change="onFileSelected"
    />
    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden-file-input"
      @change="onImageFilesSelected"
    />

    <div class="image-prompt-header">
      <NText depth="3" class="content-label">配图创作 · {{ promptCount }} 条</NText>
      <NSpace :size="6">
        <NButton size="tiny" quaternary @click="triggerImageUpload">
          上传配图
        </NButton>
        <NButton size="tiny" secondary @click="addPrompt">添加配图</NButton>
      </NSpace>
    </div>

    <NText depth="3" class="image-prompt-hint">
      每条提示词可直接文生图；上传 / 拖拽参考图后转为图生图（支持多图融合），生成前可自由编辑提示词与尺寸。
    </NText>

    <div v-if="promptCount === 0" class="image-prompt-empty">
      <NText depth="3">暂无配图提示词，点击「添加配图」开始创作</NText>
    </div>

    <div
      v-for="(item, index) in imagePrompts"
      :key="item.id"
      class="image-prompt-item"
    >
      <div class="image-prompt-item-header">
        <NInput
          :value="item.label"
          size="small"
          placeholder="用途，如封面"
          class="label-input"
          @update:value="(v) => updatePrompt(item.id, { label: v })"
        />
        <NButton
          size="tiny"
          quaternary
          type="error"
          :disabled="isGenerating(item)"
          @click="removePrompt(item.id)"
        >
          删除
        </NButton>
      </div>

      <NInput
        :value="item.prompt"
        type="textarea"
        :placeholder="`配图 ${index + 1} 的完整文生图提示词`"
        :autosize="{ minRows: 3, maxRows: 10 }"
        @update:value="(v) => updatePrompt(item.id, { prompt: v })"
      />

      <div class="control-row">
        <div class="size-field">
          <NText depth="3" class="mini-label">尺寸</NText>
          <NSelect
            :value="getSize(item.id)"
            :options="sizeOptions"
            size="small"
            class="size-select"
            @update:value="(v) => (sizeByPrompt[item.id] = v)"
          />
        </div>
      </div>

      <div
        class="dropzone"
        :class="{ 'dropzone-active': dragOverId === item.id }"
        @click="triggerUpload(item.id)"
        @dragover.prevent="dragOverId = item.id"
        @dragenter.prevent="dragOverId = item.id"
        @dragleave.prevent="dragOverId = null"
        @drop.prevent="onDrop(item.id, $event)"
      >
        <NText depth="3" class="dropzone-text">
          点击或拖拽上传参考图（可多张，转 Base64 图生图）
        </NText>
      </div>

      <div v-if="getReferences(item.id).length > 0" class="reference-grid">
        <div
          v-for="(refImage, refIndex) in getReferences(item.id)"
          :key="refIndex"
          class="reference-thumb"
        >
          <NImage
            :src="refImage"
            object-fit="cover"
            class="reference-thumb-image"
            :img-props="{ alt: '参考图' }"
          />
          <button
            type="button"
            class="reference-remove"
            title="移除"
            @click.stop="removeReference(item.id, refIndex)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="generate-row">
        <NButton
          size="small"
          type="primary"
          :loading="isGenerating(item)"
          :disabled="!item.prompt.trim()"
          @click="handleGenerate(item)"
        >
          {{ getReferences(item.id).length > 0 ? '参考图生成' : '生成配图' }}
        </NButton>
        <NText v-if="!isGenerateReady" depth="3" class="key-hint">
          需配置 ARK API Key
        </NText>
      </div>

      <div v-if="resultsOf(item.id).length > 0" class="result-grid">
        <div
          v-for="record in resultsOf(item.id)"
          :key="record.id"
          class="result-card"
        >
          <NImage
            :src="record.url"
            object-fit="cover"
            class="result-image"
            :img-props="{ alt: '生成结果' }"
          />
          <div class="result-meta">
            <NText depth="3" class="result-size">
              {{ record.aspectRatio ?? '' }} · {{ record.size }}
            </NText>
            <NSpace :size="4">
              <NButton size="tiny" quaternary @click="copyImageMarkdown(record)">
                MD
              </NButton>
              <NButton size="tiny" quaternary @click="downloadImage(record)">
                下载
              </NButton>
              <NButton
                size="tiny"
                quaternary
                type="error"
                @click="removeRecord(record)"
              >
                删
              </NButton>
            </NSpace>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-prompt-list {
  margin-top: 4px;
}

.image-prompt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.image-prompt-header .content-label {
  margin-bottom: 0;
}

.image-prompt-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 10px;
}

.image-prompt-empty {
  padding: 16px;
  text-align: center;
  background: #f7f8fa;
  border-radius: 8px;
  font-size: 12px;
}

.image-prompt-item {
  padding: 12px;
  margin-top: 10px;
  background: #f7f8fa;
  border: 1px solid #eef0f4;
  border-radius: 8px;
}

.image-prompt-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.label-input {
  flex: 1;
  min-width: 0;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.size-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-label {
  font-size: 12px;
  white-space: nowrap;
}

.size-select {
  width: 160px;
}

.dropzone {
  margin-top: 8px;
  padding: 12px;
  border: 1px dashed #c9cdd4;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #fff;
}

.dropzone:hover {
  border-color: #f53f3f;
}

.dropzone-active {
  border-color: #f53f3f;
  background: #fff1f0;
}

.dropzone-text {
  font-size: 12px;
}

.reference-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.reference-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e6eb;
}

.reference-thumb-image {
  width: 100%;
  height: 100%;
}

.reference-thumb-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: zoom-in;
}

.reference-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  line-height: 14px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.generate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.key-hint {
  font-size: 11px;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e5e6eb;
}

.result-card {
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.result-image {
  display: block;
  width: 100%;
  height: 120px;
}

.result-image :deep(img) {
  width: 100%;
  height: 120px;
  object-fit: cover;
  display: block;
  cursor: zoom-in;
}

.result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  gap: 4px;
}

.result-size {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hidden-file-input {
  display: none;
}
</style>
