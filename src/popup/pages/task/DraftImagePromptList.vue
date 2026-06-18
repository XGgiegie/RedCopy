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
  compressImageFileForStorage,
  createEmptyImagePrompt,
  createImageRecordId,
  DEFAULT_IMAGE_SIZE,
  IMAGE_SIZE_OPTIONS,
  aspectRatioOfSize,
  isLikelyImageFile,
  isValidImageDataUrl,
} from '../../../shared/draft-image'
import {
  copyTextToClipboard,
  formatImageRecordAsMarkdown,
} from '../../../shared/export-markdown'
import { downloadImageByUrl, guessImageExtension } from '../../../shared/note-media'
import { useTaskOperationsStore } from '../../stores/task-operations'
import { generateDraftImage } from '../../services/generate-image'
import type { ProImageModel } from '../../../shared/pro-ai-api'
import type {
  ProGeminiImageSize,
  ProGptImageBackground,
  ProGptImageModeration,
  ProGptImageQuality,
  ProGptImageSize,
  ProImageAspectRatio,
} from '../../../shared/pro-image'

const imagePrompts = defineModel<DraftImagePrompt[]>('imagePrompts', { required: true })

const props = defineProps<{
  taskId: string
  isProPlan: boolean
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
const isGeneratingAll = ref(false)

// 参考图与尺寸属于本地临时输入，不写入持久化草稿（避免 base64 撑爆存储）
const referencesByPrompt = reactive<Record<string, string[]>>({})
const sizeByPrompt = reactive<Record<string, string>>({})
const proModelByPrompt = reactive<Record<string, ProImageModel>>({})
const proGeminiRatioByPrompt = reactive<Record<string, ProImageAspectRatio>>({})
const proGeminiSizeByPrompt = reactive<Record<string, ProGeminiImageSize>>({})
const proGptSizeByPrompt = reactive<Record<string, ProGptImageSize>>({})
const proGptQualityByPrompt = reactive<Record<string, ProGptImageQuality>>({})
const proGptModerationByPrompt = reactive<Record<string, ProGptImageModeration>>({})
const proGptBackgroundByPrompt = reactive<Record<string, ProGptImageBackground>>({})
const dragOverId = ref<string | null>(null)

const sizeOptions = IMAGE_SIZE_OPTIONS.map((item) => ({
  label: item.label,
  value: item.value,
}))

// 原生 textarea 自适应高度指令：
// 改用原生 textarea 替换 naive-ui NInput，避免其受控逻辑在外部值回流时重写 DOM 导致光标跳到末尾。
// 高度上下限由 CSS 的 min-height/max-height 控制，这里只负责按内容撑高。
function resizeTextarea(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const vAutosize = {
  mounted(el: HTMLTextAreaElement) {
    resizeTextarea(el)
  },
  updated(el: HTMLTextAreaElement) {
    resizeTextarea(el)
  },
}

const proModelOptions: Array<{ label: string; value: ProImageModel }> = [
  { label: 'Gemini 3.1 Flash Image', value: 'gemini-3.1-flash-image' },
  { label: 'GPT Image 2', value: 'gpt-image-2' },
]

const geminiRatioOptions: Array<{ label: string; value: ProImageAspectRatio }> = [
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
]

const geminiImageSizeOptions: Array<{ label: string; value: ProGeminiImageSize }> = [
  { label: '1k', value: '1k' },
  { label: '2k', value: '2k' },
]

const gptSizeOptions: Array<{ label: string; value: ProGptImageSize }> = [
  { label: '1024×1024', value: '1024x1024' },
  { label: '1024×1536', value: '1024x1536' },
  { label: '1536×1024', value: '1536x1024' },
  { label: '自动', value: 'auto' },
]

const gptQualityOptions: Array<{ label: string; value: ProGptImageQuality }> = [
  { label: '高', value: 'high' },
  { label: '中', value: 'medium' },
  { label: '低', value: 'low' },
  { label: '自动', value: 'auto' },
]

const gptModerationOptions: Array<{ label: string; value: ProGptImageModeration }> = [
  { label: '低', value: 'low' },
  { label: '自动', value: 'auto' },
]

const gptBackgroundOptions: Array<{ label: string; value: ProGptImageBackground }> = [
  { label: '自动', value: 'auto' },
  { label: '透明', value: 'transparent' },
  { label: '不透明', value: 'opaque' },
]

function getReferences(id: string): string[] {
  return referencesByPrompt[id] ?? []
}

function getSize(id: string): string {
  return sizeByPrompt[id] ?? DEFAULT_IMAGE_SIZE
}

function getProModel(id: string): ProImageModel {
  return proModelByPrompt[id] ?? 'gemini-3.1-flash-image'
}

function getProGeminiRatio(id: string): ProImageAspectRatio {
  return proGeminiRatioByPrompt[id] ?? '1:1'
}

function getProGeminiSize(id: string): ProGeminiImageSize {
  return proGeminiSizeByPrompt[id] ?? '1k'
}

function getProGptSize(id: string): ProGptImageSize {
  return proGptSizeByPrompt[id] ?? '1024x1024'
}

function getProGptQuality(id: string): ProGptImageQuality {
  return proGptQualityByPrompt[id] ?? 'high'
}

function getProGptModeration(id: string): ProGptImageModeration {
  return proGptModerationByPrompt[id] ?? 'low'
}

function getProGptBackground(id: string): ProGptImageBackground {
  return proGptBackgroundByPrompt[id] ?? 'auto'
}

function currentImageMeta(id: string): { size: string; aspectRatio?: string } {
  if (!props.isProPlan) {
    const size = getSize(id)
    return { size, aspectRatio: aspectRatioOfSize(size) }
  }

  const model = getProModel(id)
  if (model === 'gpt-image-2') {
    const size = getProGptSize(id)
    return {
      size,
      aspectRatio:
        size === '1024x1024'
          ? '1:1'
          : size === '1024x1536'
            ? '2:3'
            : size === '1536x1024'
              ? '3:2'
              : undefined,
    }
  }

  return {
    size: getProGeminiSize(id),
    aspectRatio: getProGeminiRatio(id),
  }
}

function resultsOf(promptId: string): GeneratedImageRecord[] {
  return props.imageHistory.filter((record) => record.promptId === promptId)
}

function notifyEdit() {
  emit('edit')
}

function addPrompt() {
  const nextIndex = imagePrompts.value.length + 1
  // 原地 push，保持与父级共享同一响应式数组，避免穿过多层 defineModel 重新赋值时丢失更新
  imagePrompts.value.push(createEmptyImagePrompt(`配图${nextIndex}`))
  notifyEdit()
}

function removePrompt(id: string) {
  // 原地 splice 删除，确保父级 draftModel 同步更新、持久化不会还原已删除项
  const index = imagePrompts.value.findIndex((item) => item.id === id)
  if (index === -1) {
    console.warn('[RedCopy] 未找到要删除的配图项', { id })
    return
  }
  imagePrompts.value.splice(index, 1)
  delete referencesByPrompt[id]
  delete sizeByPrompt[id]
  delete proModelByPrompt[id]
  delete proGeminiRatioByPrompt[id]
  delete proGeminiSizeByPrompt[id]
  delete proGptSizeByPrompt[id]
  delete proGptQualityByPrompt[id]
  delete proGptModerationByPrompt[id]
  delete proGptBackgroundByPrompt[id]
  console.info('[RedCopy] 已删除配图项', { id, remaining: imagePrompts.value.length })
  notifyEdit()
}

function updatePrompt(id: string, patch: Partial<DraftImagePrompt>) {
  // 原地修改当前项，保持对象引用稳定，避免每次按键重建数组导致受控输入光标跳到末尾
  const target = imagePrompts.value.find((item) => item.id === id)
  if (!target) return
  Object.assign(target, patch)
  notifyEdit()
}

// ── 参考图上传（点击 + 拖拽，统一转 base64） ─────────────────

async function addReferenceFiles(id: string, files: FileList | File[]) {
  const all = Array.from(files)
  console.info('[RedCopy] 选择参考图', {
    id,
    count: all.length,
    files: all.map((f) => ({ name: f.name, type: f.type, size: f.size })),
  })
  const list = all.filter((file) => isLikelyImageFile(file))
  if (list.length === 0) {
    message.warning('请选择图片文件（支持 JPG、PNG、WebP 等）')
    return
  }

  const accepted: string[] = []
  for (const file of list) {
    if (file.size > 10 * 1024 * 1024) {
      message.warning(`「${file.name}」超过 10MB，已跳过`)
      continue
    }
    try {
      const dataUrl = await compressImageFileForStorage(file, { maxEdge: 1280, quality: 0.82 })
      if (!isValidImageDataUrl(dataUrl)) {
        console.warn('[RedCopy] 参考图格式校验未通过', {
          name: file.name,
          type: file.type,
          prefix: dataUrl.slice(0, 32),
        })
        message.warning(`「${file.name}」格式不受支持，已跳过`)
        continue
      }
      accepted.push(dataUrl)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 读取参考图失败', { name: file.name, detail }, error)
      message.warning(`「${file.name}」读取失败`)
    }
  }

  if (accepted.length === 0) {
    message.warning('未能添加参考图，请换用 JPG / PNG / WebP 后重试')
    return
  }
  referencesByPrompt[id] = [...getReferences(id), ...accepted]
  message.success(`已添加 ${accepted.length} 张参考图`)
}

function onReferenceFileChange(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  console.info('[RedCopy] 参考图 input change 触发', {
    id,
    fileCount: files?.length ?? 0,
  })
  const selected = files ? Array.from(files) : []
  input.value = ''
  if (selected.length === 0) return
  void addReferenceFiles(id, selected)
}

function onDrop(id: string, event: DragEvent) {
  dragOverId.value = null
  const files = event.dataTransfer?.files
  console.info('[RedCopy] 参考图拖拽 drop', { id, fileCount: files?.length ?? 0 })
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

async function generateOneImage(item: DraftImagePrompt): Promise<boolean> {
  if (!props.isGenerateReady) {
    message.warning(props.isProPlan ? '请先在设置中配置 Pro 版 API Key' : '请先在设置中配置 ARK API Key')
    return false
  }
  if (!item.prompt.trim()) {
    message.warning('请先填写配图提示词')
    return false
  }
  if (isGenerating(item)) {
    return false
  }

  const { taskId } = props
  const references = getReferences(item.id)
  const meta = currentImageMeta(item.id)
  const proModel = getProModel(item.id)

  taskOps.startImage(taskId, item.id)
  try {
    const url = await generateDraftImage({
      prompt: item.prompt,
      referenceImages: references,
      size: getSize(item.id),
      proModel,
      proGemini: {
        aspectRatio: getProGeminiRatio(item.id),
        imageSize: getProGeminiSize(item.id),
      },
      proGpt: {
        size: getProGptSize(item.id),
        quality: getProGptQuality(item.id),
        moderation: getProGptModeration(item.id),
        background: getProGptBackground(item.id),
      },
    })

    const record: GeneratedImageRecord = {
      id: createImageRecordId(),
      promptId: item.id,
      label: item.label,
      prompt: item.prompt,
      size: props.isProPlan ? `${proModel} · ${meta.size}` : meta.size,
      aspectRatio: meta.aspectRatio,
      fromReference: references.length > 0,
      url,
      createdAt: Date.now(),
    }
    emit('generated', record)
    message.success(references.length > 0 ? '参考图生成完成' : '配图生成完成')
    return true
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy] 配图生成失败', { taskId, promptId: item.id, detail }, error)
    message.error(detail)
    return false
  } finally {
    taskOps.stopImage(taskId, item.id)
  }
}

async function handleGenerate(item: DraftImagePrompt) {
  await generateOneImage(item)
}

async function handleGenerateAll() {
  if (isGeneratingAll.value) return
  if (!props.isGenerateReady) {
    message.warning(props.isProPlan ? '请先在设置中配置 Pro 版 API Key' : '请先在设置中配置 ARK API Key')
    return
  }

  const pending = imagePrompts.value.filter((item) => item.prompt.trim() && !isGenerating(item))
  if (pending.length === 0) {
    message.warning('没有可生成的配图提示词')
    return
  }

  isGeneratingAll.value = true
  let success = 0
  try {
    for (const item of pending) {
      const ok = await generateOneImage(item)
      if (ok) success += 1
    }
    if (success === pending.length) {
      message.success(`全部配图生成完成：${success} 张`)
    } else {
      message.warning(`批量生成结束：成功 ${success} 张，失败 ${pending.length - success} 张`)
    }
  } finally {
    isGeneratingAll.value = false
  }
}

// ── 用户上传自己的配图（直接入历史，不经过 AI 生成） ─────────

/** 将一组本地图片文件转为配图历史记录（点击上传与剪贴板粘贴共用） */
async function addUploadedImageFiles(files: File[]): Promise<void> {
  const list = files.filter((file) => isLikelyImageFile(file))
  if (list.length === 0) {
    message.warning('请选择图片文件（支持 JPG、PNG、WebP 等）')
    return
  }

  let added = 0
  for (const file of list) {
    if (file.size > 15 * 1024 * 1024) {
      message.warning(`「${file.name}」超过 15MB，已跳过`)
      continue
    }
    try {
      const dataUrl = await compressImageFileForStorage(file, { maxEdge: 1920, quality: 0.85 })
      if (!isValidImageDataUrl(dataUrl)) {
        console.warn('[RedCopy] 上传配图格式校验未通过', {
          name: file.name,
          type: file.type,
          prefix: dataUrl.slice(0, 32),
        })
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
      console.error('[RedCopy] 上传配图失败', { name: file.name, detail }, error)
      message.warning(`「${file.name}」读取失败`)
    }
  }

  if (added > 0) message.success(`已上传 ${added} 张配图到历史`)
  else message.warning('未能上传配图，请换用 JPG / PNG / WebP 后重试')
}

async function onImageFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  const all = files ? Array.from(files) : []
  console.info('[RedCopy] 上传配图 input change 触发', {
    fileCount: all.length,
    files: all.map((f) => ({ name: f.name, type: f.type, size: f.size })),
  })
  input.value = ''
  if (all.length === 0) return
  await addUploadedImageFiles(all)
}

/** 剪贴板粘贴上传：侧栏内即使点击被其他扩展拦截，粘贴仍可用 */
function onPasteUpload(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length === 0) return
  console.info('[RedCopy] 剪贴板粘贴图片', { count: files.length })
  event.preventDefault()
  void addUploadedImageFiles(files)
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
const generateAllCount = computed(
  () => imagePrompts.value.filter((item) => item.prompt.trim()).length,
)
</script>

<template>
  <div class="image-prompt-list" @paste="onPasteUpload">
    <div class="image-prompt-header">
      <NText depth="3" class="content-label">配图创作 · {{ promptCount }} 条</NText>
      <NSpace :size="6">
        <NButton
          size="tiny"
          type="primary"
          secondary
          :loading="isGeneratingAll"
          :disabled="generateAllCount === 0"
          @click="handleGenerateAll"
        >
          生成全部
        </NButton>
        <label class="upload-config-btn">
          上传配图
          <input
            type="file"
            accept="image/*"
            multiple
            class="file-input-hidden"
            @change="onImageFilesSelected"
          />
        </label>
        <NButton size="tiny" secondary @click="addPrompt">添加配图</NButton>
      </NSpace>
    </div>

    <NText depth="3" class="image-prompt-hint">
      每条提示词可直接文生图；上传 / 拖拽 / 粘贴（Ctrl+V）参考图后转为图生图（支持多图融合），生成前可自由编辑提示词与尺寸。若点击「上传配图」无法弹出文件框，请改用拖拽或粘贴。
    </NText>
    <NText depth="3" class="image-prompt-hint image-prompt-hint--warn">
      AI 分析或生图进行中请不要离开当前页面，避免结果返回前无法写入任务导致数据丢失。
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

      <textarea
        v-autosize
        :value="item.prompt"
        class="prompt-textarea"
        :placeholder="`配图 ${index + 1} 的完整文生图提示词`"
        @input="(e) => updatePrompt(item.id, { prompt: (e.target as HTMLTextAreaElement).value })"
      ></textarea>

      <div v-if="isProPlan" class="control-row control-row--wrap">
        <div class="size-field size-field--wide">
          <NText depth="3" class="mini-label">Pro 模型</NText>
          <NSelect
            :value="getProModel(item.id)"
            :options="proModelOptions"
            size="small"
            class="model-select"
            @update:value="(v) => (proModelByPrompt[item.id] = v)"
          />
        </div>

        <template v-if="getProModel(item.id) === 'gemini-3.1-flash-image'">
          <div class="size-field">
            <NText depth="3" class="mini-label">比例</NText>
            <NSelect
              :value="getProGeminiRatio(item.id)"
              :options="geminiRatioOptions"
              size="small"
              class="compact-select"
              @update:value="(v) => (proGeminiRatioByPrompt[item.id] = v)"
            />
          </div>
          <div class="size-field">
            <NText depth="3" class="mini-label">清晰度</NText>
            <NSelect
              :value="getProGeminiSize(item.id)"
              :options="geminiImageSizeOptions"
              size="small"
              class="compact-select"
              @update:value="(v) => (proGeminiSizeByPrompt[item.id] = v)"
            />
          </div>
        </template>

        <template v-else>
          <div class="size-field">
            <NText depth="3" class="mini-label">尺寸</NText>
            <NSelect
              :value="getProGptSize(item.id)"
              :options="gptSizeOptions"
              size="small"
              class="size-select"
              @update:value="(v) => (proGptSizeByPrompt[item.id] = v)"
            />
          </div>
          <div class="size-field">
            <NText depth="3" class="mini-label">质量</NText>
            <NSelect
              :value="getProGptQuality(item.id)"
              :options="gptQualityOptions"
              size="small"
              class="compact-select"
              @update:value="(v) => (proGptQualityByPrompt[item.id] = v)"
            />
          </div>
          <div class="size-field">
            <NText depth="3" class="mini-label">审核</NText>
            <NSelect
              :value="getProGptModeration(item.id)"
              :options="gptModerationOptions"
              size="small"
              class="compact-select"
              @update:value="(v) => (proGptModerationByPrompt[item.id] = v)"
            />
          </div>
          <div class="size-field">
            <NText depth="3" class="mini-label">背景</NText>
            <NSelect
              :value="getProGptBackground(item.id)"
              :options="gptBackgroundOptions"
              size="small"
              class="compact-select"
              @update:value="(v) => (proGptBackgroundByPrompt[item.id] = v)"
            />
          </div>
          <NText depth="3" class="gpt-image-warning">
            gpt-image-2 费用较高且出图较慢，生成期间请不要离开页面，避免结果无法写入任务。
          </NText>
        </template>
      </div>

      <div v-else class="control-row">
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

      <NText v-if="isProPlan" depth="3" class="image-prompt-hint image-prompt-hint--compact">
        Pro 生图请求可能需要更久；参考图会保留在本地临时输入中，当前接口优先按文生图参数生成。
      </NText>

      <label
        class="dropzone"
        :class="{ 'dropzone-active': dragOverId === item.id }"
        @dragover.prevent="dragOverId = item.id"
        @dragenter.prevent="dragOverId = item.id"
        @dragleave.prevent="dragOverId = null"
        @drop.prevent="onDrop(item.id, $event)"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          class="file-input-hidden"
          @change="(e) => onReferenceFileChange(item.id, e)"
        />
        <NText depth="3" class="dropzone-text">
          点击或拖拽上传参考图（可多张，转 Base64 图生图）
        </NText>
      </label>

      <div v-if="getReferences(item.id).length > 0" class="reference-grid">
        <div
          v-for="(refImage, refIndex) in getReferences(item.id)"
          :key="refIndex"
          class="reference-thumb"
        >
          <NImage
            :src="refImage"
            object-fit="contain"
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
          {{ isProPlan ? '需配置 Pro 版 API Key' : '需配置 ARK API Key' }}
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
            object-fit="contain"
            class="result-image"
            :img-props="{ alt: '生成结果' }"
          />
          <div class="result-meta">
            <NText depth="3" class="result-size">
              {{ record.aspectRatio ?? '' }} · {{ record.size }}
            </NText>
            <NSpace :size="4" class="result-actions">
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
  gap: 8px;
  margin-bottom: 6px;
}

.image-prompt-header .content-label {
  margin-bottom: 0;
  flex-shrink: 0;
}

.image-prompt-header :deep(.n-space) {
  justify-content: flex-end;
}

/* 文件输入用 display:none：不占布局、不会盖住侧栏；
   由原生 <label> 关联唤起文件框（比 JS .click() 在侧栏中更可靠） */
.file-input-hidden {
  display: none !important;
}

/* 「上传配图」用原生 label 包裹 input，点击 label 即触发文件框 */
.upload-config-btn {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #4e5969;
  background: #f2f3f5;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  user-select: none;
}

.upload-config-btn:hover {
  background: #e5e6eb;
  color: #ff2442;
}

.image-prompt-hint {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  margin-bottom: 10px;
}

.image-prompt-hint--compact {
  margin: 6px 0 0;
  font-size: 11px;
}

.image-prompt-hint--warn {
  margin-top: -4px;
  color: #d48806;
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

/* 原生 textarea，外观对齐 naive-ui，但由原生元素保证编辑时光标不跳 */
.prompt-textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 78px;
  max-height: 240px;
  padding: 6px 10px;
  border: 1px solid #e0e0e6;
  border-radius: 4px;
  background: #fff;
  color: #333;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.prompt-textarea::placeholder {
  color: #c2c2c8;
}

.prompt-textarea:hover {
  border-color: #ff7088;
}

.prompt-textarea:focus {
  border-color: #ff2442;
  box-shadow: 0 0 0 2px rgba(255, 36, 66, 0.16);
  outline: none;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.control-row--wrap {
  flex-wrap: wrap;
  gap: 8px;
}

.size-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.size-field--wide {
  flex: 1 1 100%;
}

.mini-label {
  font-size: 12px;
  white-space: nowrap;
}

.size-select {
  width: 160px;
}

.model-select {
  flex: 1;
  min-width: 180px;
}

.compact-select {
  width: 96px;
}

.gpt-image-warning {
  flex: 1 1 100%;
  padding: 6px 8px;
  border-radius: 6px;
  background: #fff7e8;
  border: 1px solid #ffe7ba;
  color: #d48806;
  font-size: 11px;
  line-height: 1.5;
}

.dropzone {
  display: block;
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
  background: #fff;
}

.reference-thumb-image {
  width: 100%;
  height: 100%;
}

.reference-thumb-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e5e6eb;
}

.result-card {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  min-width: 0;
}

.result-image {
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #f7f8fa;
}

.result-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  cursor: zoom-in;
}

.result-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  gap: 4px;
  min-width: 0;
}

.result-size {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-actions {
  flex-shrink: 0;
  flex-wrap: nowrap;
}
</style>
