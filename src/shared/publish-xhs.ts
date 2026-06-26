/** 小红书 PC 创作者中心 · 发布图文页 */
export const XHS_PUBLISH_URL =
  'https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=image'

export interface XhsPublishImageInput {
  id?: string
  label?: string
  url: string
}

export interface XhsPublishContentInput {
  title?: string
  body?: string
  tags?: string[]
}

export interface XhsPublishFillResult {
  ok: boolean
  titleFilled: boolean
  bodyFilled: boolean
  tagsFilled: boolean
  titleFound: boolean
  bodyFound: boolean
  error?: string
}

export interface XhsPublishUploadResult {
  ok: boolean
  uploaded: number
  clicked: boolean
  inputFound: boolean
  uploadAreaFound?: boolean
  buttonFound?: boolean
  error?: string
}

export interface XhsPublishOpenResult {
  tabId: number
  upload: XhsPublishUploadResult | null
  content: XhsPublishFillResult | null
}

interface XhsUploadFilePayload {
  filename: string
  mimeType: string
  dataUrl?: string
}

const PUBLISH_PAGE_READY_TIMEOUT_MS = 20_000
const PUBLISH_PAGE_STABILIZE_DELAY_MS = 3_000

function isXhsPublishTab(tab: chrome.tabs.Tab): boolean {
  return Boolean(
    tab.id && /creator\.xiaohongshu\.com\/publish\/publish/i.test(tab.url ?? ''),
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeImageUrl(url: string): string {
  const trimmed = url.trim().replace(/&amp;/g, '&')
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed
}

function mimeToExtension(mimeType: string): string {
  const mime = mimeType.split(';')[0]?.trim().toLowerCase()
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/avif') return 'avif'
  if (mime === 'image/bmp') return 'bmp'
  return 'jpg'
}

function inferMimeType(url: string): string {
  const lower = url.toLowerCase()
  if (lower.startsWith('data:')) {
    const match = lower.match(/^data:([^;,]+)/)
    return match?.[1] || 'image/jpeg'
  }
  if (/\.(png)(?:$|[?#])/.test(lower)) return 'image/png'
  if (/\.(webp)(?:$|[?#])/.test(lower)) return 'image/webp'
  if (/\.(gif)(?:$|[?#])/.test(lower)) return 'image/gif'
  if (/\.(avif)(?:$|[?#])/.test(lower)) return 'image/avif'
  if (/\.(bmp)(?:$|[?#])/.test(lower)) return 'image/bmp'
  return 'image/jpeg'
}

function buildUploadFilename(index: number, image: XhsPublishImageInput, mimeType: string): string {
  const role = index === 0 ? 'cover' : `page-${index}`
  const label = (image.label || role)
    .replace(/[<>:"/\\|?*\u0000-\u001f\n\r]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 36)
  return `redcopy-${role}-${label || image.id || index + 1}.${mimeToExtension(mimeType)}`
}

async function buildUploadPayload(
  image: XhsPublishImageInput,
  index: number,
): Promise<XhsUploadFilePayload> {
  const url = normalizeImageUrl(image.url)
  const fallbackMimeType = inferMimeType(url)

  if (url.startsWith('data:')) {
    return {
      filename: buildUploadFilename(index, image, fallbackMimeType),
      mimeType: fallbackMimeType,
      dataUrl: url,
    }
  }

  throw new Error(
    '待发布图片仍是远程链接，无法稳定上传。请重新生成这张配图，或用「上传配图」导入本地图片后再发布。',
  )
}

function isExpectedPublishUrl(url?: string): boolean {
  return Boolean(
    url?.startsWith('https://creator.xiaohongshu.com/publish/publish') &&
    url.includes('target=image'),
  )
}

async function waitForPublishPageReady(tabId: number): Promise<void> {
  const startedAt = Date.now()
  let latest: chrome.tabs.Tab | null = null

  while (Date.now() - startedAt < PUBLISH_PAGE_READY_TIMEOUT_MS) {
    latest = await chrome.tabs.get(tabId)
    if (isExpectedPublishUrl(latest.url) && latest.status === 'complete') {
      await wait(PUBLISH_PAGE_STABILIZE_DELAY_MS)
      return
    }
    await wait(250)
  }

  if (!isExpectedPublishUrl(latest?.url)) {
    throw new Error(`发布页未进入图文上传地址：${latest?.url ?? 'unknown'}`)
  }

  await wait(PUBLISH_PAGE_STABILIZE_DELAY_MS)
}

async function resolvePublishTab(): Promise<chrome.tabs.Tab> {
  const tabs = await chrome.tabs.query({ url: '*://*.xiaohongshu.com/*' })
  const existing = tabs.find(isXhsPublishTab)

  if (existing?.id) {
    const updated = await chrome.tabs.update(existing.id, {
      active: true,
      url: XHS_PUBLISH_URL,
    })
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true })
    }
    console.info('[RedCopy] 已聚焦小红书发布页', { tabId: existing.id })
    return updated ?? existing
  }

  const tab = await chrome.tabs.create({ url: XHS_PUBLISH_URL, active: true })
  console.info('[RedCopy] 已打开小红书发布页', { tabId: tab.id })
  return tab
}

async function injectUploadImages(
  tabId: number,
  files: XhsUploadFilePayload[],
): Promise<XhsPublishUploadResult> {
  if (!chrome.scripting?.executeScript) {
    throw new Error('chrome.scripting 不可用，请确认 manifest 含 scripting 权限并已刷新扩展')
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: uploadImagesInXhsPublishPage,
    args: [files],
  })

  if (!result) throw new Error('发布页上传脚本未返回结果')
  return result
}

async function injectFillContent(
  tabId: number,
  content: XhsPublishContentInput,
): Promise<XhsPublishFillResult> {
  if (!chrome.scripting?.executeScript) {
    throw new Error('chrome.scripting 不可用，请确认 manifest 含 scripting 权限并已刷新扩展')
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: fillContentInXhsPublishPage,
    args: [content],
  })

  if (!result) throw new Error('发布页文案回填脚本未返回结果')
  return result
}

function normalizeTags(tags: string[] = []): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const item of tags) {
    const tag = item.trim().replace(/^[#＃]+/, '').trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    normalized.push(tag)
  }
  return normalized
}

function normalizePublishContent(
  content?: XhsPublishContentInput,
): XhsPublishContentInput | null {
  const title = content?.title?.trim() ?? ''
  const body = content?.body?.trim() ?? ''
  const tags = normalizeTags(content?.tags)

  if (!title && !body && tags.length === 0) return null
  return { title, body, tags }
}

/** 打开或聚焦小红书发布页，并按用户选择的顺序上传图片 */
export async function openXhsPublishPage(
  images: XhsPublishImageInput[] = [],
  content?: XhsPublishContentInput,
): Promise<XhsPublishOpenResult> {
  const tab = await resolvePublishTab()
  if (typeof tab.id !== 'number') throw new Error('打开发布页失败：缺少 tabId')

  await waitForPublishPageReady(tab.id)

  let upload: XhsPublishUploadResult | null = null
  if (images.length > 0) {
    const files = await Promise.all(
      images.map((image, index) => buildUploadPayload(image, index)),
    )
    upload = await injectUploadImages(tab.id, files)
    if (!upload.ok) {
      throw new Error(upload.error ?? '发布页未能自动上传图片')
    }

    console.info('[RedCopy] 发布页图片上传流程已触发', {
      tabId: tab.id,
      count: upload.uploaded,
    })
  }

  const normalizedContent = normalizePublishContent(content)
  let fill: XhsPublishFillResult | null = null
  if (normalizedContent) {
    await wait(1_000)
    fill = await injectFillContent(tab.id, normalizedContent)
    if (!fill.ok) {
      throw new Error(fill.error ?? '发布页未能自动回填标题、正文和标签')
    }

    console.info('[RedCopy] 发布页文案已回填', {
      tabId: tab.id,
      titleFilled: fill.titleFilled,
      bodyFilled: fill.bodyFilled,
      tagsFilled: fill.tagsFilled,
    })
  }

  return { tabId: tab.id, upload, content: fill }
}

async function uploadImagesInXhsPublishPage(
  files: XhsUploadFilePayload[],
): Promise<XhsPublishUploadResult> {
  const RETRY_DELAY_MS = 350
  const UPLOAD_AREA_WAIT_TIMEOUT_MS = 20_000
  const INPUT_WAIT_TIMEOUT_MS = 20_000
  const POST_BUTTON_CLICK_DELAY_MS = 1_500
  const STARTED_AT = Date.now()
  let clickedUpload = false
  let uploadAreaFound = false
  let buttonFound = false

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function visible(el: Element): boolean {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none'
    )
  }

  function normalizedText(el: Element): string {
    return (el.textContent ?? '').replace(/\s+/g, '')
  }

  function mouseClick(el: HTMLElement): void {
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    ;[
      'pointerover',
      'mouseover',
      'pointerenter',
      'mouseenter',
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ].forEach((type) => {
      el.dispatchEvent(new MouseEvent(type, init))
    })
    el.click()
  }

  function findUploadArea(): HTMLElement | null {
    const selectors = [
      '.wrapper:has(.image-upload-buttons)',
      '.wrapper:has(.upload-button)',
      '.image-upload-buttons',
      '[class*="upload"]:has(button)',
    ]

    for (const selector of selectors) {
      try {
        const target = [...document.querySelectorAll<HTMLElement>(selector)]
          .find((el) => visible(el) && normalizedText(el).includes('上传图片'))
        if (target) return target
      } catch {
        continue
      }
    }

    return [...document.querySelectorAll<HTMLElement>('.wrapper, [class*="upload"]')]
      .find((el) => visible(el) && normalizedText(el).includes('上传图片')) ?? null
  }

  function findUploadButton(): HTMLElement | null {
    const selectors = [
      'button.upload-button:not(.text2image-button)',
      '.wrapper .image-upload-buttons button.upload-button:not(.text2image-button)',
      '.image-upload-buttons button:not(.text2image-button)',
      '.wrapper button:not(.text2image-button)',
      'button',
      '[role="button"]',
    ]

    for (const selector of selectors) {
      const candidates = [...document.querySelectorAll<HTMLElement>(selector)]
      const target = candidates.find((el) => {
        if (!visible(el)) return false
        const text = normalizedText(el)
        return text.includes('上传图片') && !text.includes('文字配图')
      })
      if (target) return target
    }

    const wrappers = [...document.querySelectorAll<HTMLElement>('.wrapper, [class*="upload"]')]
    return wrappers.find((el) => visible(el) && normalizedText(el).includes('上传图片')) ?? null
  }

  function findFileInput(): HTMLInputElement | null {
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')]
    return (
      inputs.find((input) => input.multiple && /image|\*/i.test(input.accept || '')) ??
      inputs.find((input) => /image|\*/i.test(input.accept || '')) ??
      inputs[0] ??
      null
    )
  }

  function findDropTargets(input: HTMLInputElement | null): HTMLElement[] {
    const targets = [
      input?.closest<HTMLElement>('.wrapper, [class*="upload"], [class*="drop"]') ?? null,
      findUploadArea(),
      findUploadButton(),
      document.body,
      document.documentElement,
    ].filter((target): target is HTMLElement => Boolean(target))

    return [...new Set(targets)]
  }

  async function waitForUploadArea(): Promise<HTMLElement | null> {
    let area = findUploadArea()
    while (!area && Date.now() - STARTED_AT < UPLOAD_AREA_WAIT_TIMEOUT_MS) {
      await sleep(RETRY_DELAY_MS)
      area = findUploadArea()
    }
    uploadAreaFound = Boolean(area)
    return area
  }

  async function waitForUploadButton(): Promise<HTMLElement | null> {
    const startedAt = Date.now()
    let button = findUploadButton()
    while (!button && Date.now() - startedAt < UPLOAD_AREA_WAIT_TIMEOUT_MS) {
      await sleep(RETRY_DELAY_MS)
      button = findUploadButton()
    }
    buttonFound = Boolean(button)
    return button
  }

  function describePageState(): string {
    const text = normalizedText(document.body).slice(0, 160)
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')]
      .map((input) => `accept=${input.accept || 'none'},multiple=${input.multiple}`)
      .join(';')
    return (
      `uploadArea=${uploadAreaFound},button=${buttonFound},` +
      `fileInputs=${inputs || 'none'},body=${text}`
    )
  }

  function dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/)
    if (!match) throw new Error(`图片 ${filename} 不是有效的 data URL`)

    const mime = match[1] || mimeType || 'image/jpeg'
    const encoded = match[3] || ''
    const binary = match[2]
      ? atob(encoded)
      : decodeURIComponent(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return new File([bytes], filename, { type: mime })
  }

  async function urlToFile(file: XhsUploadFilePayload): Promise<File> {
    if (file.dataUrl) {
      return dataUrlToFile(file.dataUrl, file.filename, file.mimeType)
    }
    throw new Error(`图片 ${file.filename} 缺少本地 data URL，无法交给发布页上传`)
  }

  async function waitForInput(): Promise<HTMLInputElement | null> {
    const startedAt = Date.now()
    let input = findFileInput()
    while (!input && Date.now() - startedAt < INPUT_WAIT_TIMEOUT_MS) {
      await sleep(RETRY_DELAY_MS)
      input = findFileInput()
    }
    return input
  }

  function dispatchDragEvents(dataTransfer: DataTransfer): void {
    const dropTargets = findDropTargets(findFileInput())
    ;['dragenter', 'dragover', 'drop'].forEach((type) => {
      dropTargets.forEach((target) => {
        target.dispatchEvent(new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }))
      })
    })
  }

  function dispatchUploadEvents(input: HTMLInputElement, dataTransfer: DataTransfer): void {
    ;['focus', 'input', 'change'].forEach((type) => {
      input.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))
    })

    dispatchDragEvents(dataTransfer)

    // 有些上传组件把真正监听挂在 input 的父级，补一次 change 冒泡到就近容器。
    input.closest<HTMLElement>('.wrapper, [class*="upload"], [class*="drop"]')
      ?.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  }

  async function clickUploadButtonUntilInput(): Promise<HTMLInputElement | null> {
    const uploadButton = await waitForUploadButton()
    if (uploadButton) {
      mouseClick(uploadButton)
      clickedUpload = true
      await sleep(POST_BUTTON_CLICK_DELAY_MS)
    }

    let input = await waitForInput()
    if (input) return input

    const retryStartedAt = Date.now()
    while (!input && Date.now() - retryStartedAt < INPUT_WAIT_TIMEOUT_MS) {
      const retryButton = findUploadButton()
      if (retryButton) {
        mouseClick(retryButton)
        clickedUpload = true
      }
      await sleep(RETRY_DELAY_MS)
      const input = findFileInput()
      if (input) return input
    }
    return findFileInput()
  }

  try {
    if (!location.href.includes('/publish/publish')) {
      return {
        ok: false,
        uploaded: 0,
        clicked: false,
        inputFound: false,
        uploadAreaFound: false,
        buttonFound: false,
        error: `当前页面不是小红书图文发布页：${location.href}`,
      }
    }

    await waitForUploadArea()
    await sleep(POST_BUTTON_CLICK_DELAY_MS)

    const input = await clickUploadButtonUntilInput()
    if (!input) {
      return {
        ok: false,
        uploaded: 0,
        clicked: clickedUpload,
        inputFound: false,
        uploadAreaFound,
        buttonFound,
        error: `未找到发布页图片上传 input，请确认已停留在图文发布页；${describePageState()}`,
      }
    }

    const uploadFiles = await Promise.all(files.map(urlToFile))
    const dataTransfer = new DataTransfer()
    uploadFiles.forEach((file) => dataTransfer.items.add(file))

    dispatchDragEvents(dataTransfer)
    await sleep(600)

    input.files = dataTransfer.files

    dispatchUploadEvents(input, dataTransfer)

    return {
      ok: true,
      uploaded: uploadFiles.length,
      clicked: clickedUpload,
      inputFound: true,
      uploadAreaFound,
      buttonFound,
    }
  } catch (error) {
    return {
      ok: false,
      uploaded: 0,
      clicked: clickedUpload || Boolean(findUploadButton()),
      inputFound: Boolean(findFileInput()),
      uploadAreaFound: uploadAreaFound || Boolean(findUploadArea()),
      buttonFound: buttonFound || Boolean(findUploadButton()),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function fillContentInXhsPublishPage(
  content: XhsPublishContentInput,
): Promise<XhsPublishFillResult> {
  type TextTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement

  const RETRY_DELAY_MS = 300
  const FIELD_WAIT_TIMEOUT_MS = 20_000
  const title = (content.title ?? '').trim()
  const tags = [...new Set((content.tags ?? [])
    .map((tag) => tag.trim().replace(/^[#＃]+/, '').trim())
    .filter(Boolean))]
  const body = content.body?.trim() ?? ''

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  function visible(el: Element): boolean {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none'
    )
  }

  function normalize(text: string): string {
    return text.replace(/\s+/g, '').toLowerCase()
  }

  function attrText(el: Element): string {
    const box = el.closest<HTMLElement>(
      'label, [class*="title"], [class*="Title"], [class*="content"], [class*="Content"], [class*="desc"], [class*="Desc"], [class*="editor"], [class*="Editor"], [class*="form"], [class*="Form"]',
    )
    return normalize([
      el.getAttribute('placeholder'),
      el.getAttribute('data-placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('name'),
      el.getAttribute('id'),
      el.getAttribute('class'),
      box?.textContent,
      box?.getAttribute('class'),
    ].filter(Boolean).join(' '))
  }

  function isEditable(el: Element): el is TextTarget {
    if (!visible(el)) return false
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase()
      return !el.disabled && !el.readOnly && ['text', 'search', ''].includes(type)
    }
    if (el instanceof HTMLTextAreaElement) {
      return !el.disabled && !el.readOnly
    }
    return el instanceof HTMLElement && el.isContentEditable
  }

  function allTextTargets(): TextTarget[] {
    const targets = [
      ...document.querySelectorAll<TextTarget>('input, textarea, [contenteditable="true"]'),
    ].filter(isEditable)

    return [...new Set(targets)]
  }

  function findBySelectors(selectors: string[]): TextTarget | null {
    for (const selector of selectors) {
      try {
        const target = [...document.querySelectorAll<TextTarget>(selector)]
          .find(isEditable)
        if (target) return target
      } catch {
        continue
      }
    }
    return null
  }

  function findTitleField(): TextTarget | null {
    const bySelector = findBySelectors([
      'input[placeholder*="标题"]',
      'textarea[placeholder*="标题"]',
      '[contenteditable="true"][placeholder*="标题"]',
      '[contenteditable="true"][data-placeholder*="标题"]',
      '[contenteditable="true"][aria-label*="标题"]',
      '[class*="title"] input',
      '[class*="Title"] input',
      '[class*="title"] textarea',
      '[class*="Title"] textarea',
      '[class*="title"] [contenteditable="true"]',
      '[class*="Title"] [contenteditable="true"]',
    ])
    if (bySelector) return bySelector

    const targets = allTextTargets()
    return (
      targets.find((el) => attrText(el).includes('标题')) ??
      targets.find((el) => el instanceof HTMLInputElement) ??
      null
    )
  }

  function findBodyField(titleField: TextTarget | null): TextTarget | null {
    const bySelector = findBySelectors([
      '[contenteditable="true"].ProseMirror',
      '[contenteditable="true"].tiptap',
      '.ProseMirror[contenteditable="true"]',
      '.tiptap[contenteditable="true"]',
      'textarea[placeholder*="正文"]',
      'textarea[placeholder*="内容"]',
      'textarea[placeholder*="描述"]',
      'textarea[placeholder*="分享"]',
      '[contenteditable="true"][placeholder*="正文"]',
      '[contenteditable="true"][placeholder*="内容"]',
      '[contenteditable="true"][data-placeholder*="正文"]',
      '[contenteditable="true"][data-placeholder*="内容"]',
      '[contenteditable="true"][aria-label*="正文"]',
      '[contenteditable="true"][aria-label*="内容"]',
      '[class*="content"] [contenteditable="true"]',
      '[class*="Content"] [contenteditable="true"]',
      '[class*="desc"] [contenteditable="true"]',
      '[class*="Desc"] [contenteditable="true"]',
      '[class*="editor"] [contenteditable="true"]',
      '[class*="Editor"] [contenteditable="true"]',
    ])
    if (bySelector && bySelector !== titleField) return bySelector

    const targets = allTextTargets().filter((el) => el !== titleField)
    const scored = targets
      .map((el) => {
        const text = attrText(el)
        let score = 0
        if (el instanceof HTMLTextAreaElement) score += 5
        if (el instanceof HTMLElement && el.isContentEditable) score += 4
        if (text.includes('正文')) score += 12
        if (text.includes('内容')) score += 8
        if (text.includes('描述') || text.includes('分享')) score += 6
        if (text.includes('标题')) score -= 20
        const rect = el.getBoundingClientRect()
        score += Math.min(6, Math.round(rect.height / 60))
        return { el, score }
      })
      .sort((a, b) => b.score - a.score)

    return scored[0]?.el ?? null
  }

  function normalizeContentText(text: string): string {
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, '')
      .trim()
  }

  function targetText(target: TextTarget): string {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value
    }
    return target.innerText || target.textContent || ''
  }

  function targetHasText(target: TextTarget, value: string): boolean {
    const actual = normalizeContentText(targetText(target))
    const expected = normalizeContentText(value)
    return Boolean(expected) && actual.includes(expected)
  }

  async function waitForTarget(
    find: () => TextTarget | null,
    timeoutMs: number,
  ): Promise<TextTarget | null> {
    const startedAt = Date.now()
    let target = find()
    while (!target && Date.now() - startedAt < timeoutMs) {
      await sleep(RETRY_DELAY_MS)
      target = find()
    }
    return target
  }

  function mouseClick(el: HTMLElement): void {
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    ;['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      el.dispatchEvent(new MouseEvent(type, init))
    })
    el.click()
    el.focus()
  }

  function placeCaretAtEnd(el: TextTarget): void {
    mouseClick(el)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const end = el.value.length
      el.setSelectionRange?.(end, end)
      return
    }

    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  function dispatchTextEvents(el: Element, value: string): void {
    try {
      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value,
      }))
    } catch {
      el.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }))
    }

    try {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: value,
      }))
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    }

    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  }

  function dispatchKeyboard(el: Element, type: 'keydown' | 'keyup', key: string): void {
    const code = key === 'Enter' ? 'Enter' : key === 'ArrowDown' ? 'ArrowDown' : ''
    el.dispatchEvent(new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key,
      code,
    }))
  }

  function insertIntoInputLike(
    el: HTMLInputElement | HTMLTextAreaElement,
    text: string,
  ): void {
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const next = `${el.value.slice(0, start)}${text}${el.value.slice(end)}`
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )?.set

    if (setter) {
      setter.call(el, next)
    } else {
      el.value = next
    }
    const cursor = start + text.length
    el.setSelectionRange?.(cursor, cursor)
  }

  function insertIntoContentEditable(el: HTMLElement, text: string): void {
    const inputType = text === '\n' ? 'insertParagraph' : 'insertText'
    try {
      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType,
        data: text === '\n' ? null : text,
      }))
    } catch {
      el.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }))
    }

    if (text === '\n') {
      document.execCommand('insertParagraph', false)
    } else {
      document.execCommand('insertText', false, text)
    }

    try {
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType,
        data: text === '\n' ? null : text,
      }))
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    }
  }

  function selectAllTargetContent(el: TextTarget): void {
    mouseClick(el)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.select()
      return
    }

    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  function plainTextToHtml(text: string): string {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')

    return text
      .split(/\n{2,}/)
      .map((paragraph) => {
        const lines = paragraph.split('\n').map(escapeHtml).join('<br>')
        return `<p>${lines || '<br>'}</p>`
      })
      .join('')
  }

  function dispatchPaste(el: HTMLElement, text: string): void {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', text)
    dataTransfer.setData('text/html', plainTextToHtml(text))

    try {
      el.dispatchEvent(new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      }))
    } catch {
      el.dispatchEvent(new Event('paste', { bubbles: true, cancelable: true }))
    }
  }

  async function typeIntoTarget(
    el: TextTarget,
    text: string,
    delayMs = 25,
  ): Promise<void> {
    placeCaretAtEnd(el)
    for (const char of text) {
      const key = char === '\n' ? 'Enter' : char
      dispatchKeyboard(el, 'keydown', key)
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        insertIntoInputLike(el, char)
        dispatchTextEvents(el, el.value)
      } else {
        insertIntoContentEditable(el, char)
      }
      dispatchKeyboard(el, 'keyup', key)
      await sleep(char === '\n' ? Math.max(120, delayMs) : delayMs)
    }
  }

  function normalizedTopicText(el: Element): string {
    const dataTopic = el.getAttribute('data-topic')
    if (dataTopic) {
      try {
        const parsed = JSON.parse(dataTopic) as { name?: unknown }
        if (typeof parsed.name === 'string') return parsed.name.trim()
      } catch {
        // data-topic 解析失败时退回到可见文本判断。
      }
    }

    return (el.textContent ?? '')
      .replace(/\[话题]#/g, '')
      .replace(/^[#＃]+/, '')
      .trim()
  }

  function hasTopicAnchor(tag: string): boolean {
    return [...document.querySelectorAll('a.tiptap-topic')]
      .some((item) => normalizedTopicText(item) === tag)
  }

  function topicAnchorCount(): number {
    return document.querySelectorAll('a.tiptap-topic').length
  }

  function mouseClickOnce(el: HTMLElement): void {
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const rect = el.getBoundingClientRect()
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      clientX: rect.left + Math.min(12, Math.max(1, rect.width / 2)),
      clientY: rect.top + Math.max(1, Math.min(rect.height - 1, rect.height / 2)),
    }
    ;['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      el.dispatchEvent(new MouseEvent(type, init))
    })
  }

  function candidateDistanceToEditor(el: HTMLElement, editor: TextTarget): number {
    const itemRect = el.getBoundingClientRect()
    const editorRect = editor.getBoundingClientRect()
    const yGap = itemRect.top >= editorRect.bottom
      ? itemRect.top - editorRect.bottom
      : Math.abs(itemRect.bottom - editorRect.top)
    return Math.abs(itemRect.left - editorRect.left) + yGap
  }

  function sortByVisualOrder(items: HTMLElement[]): HTMLElement[] {
    return [...items].sort((a, b) => {
      const aRect = a.getBoundingClientRect()
      const bRect = b.getBoundingClientRect()
      return aRect.top - bRect.top || aRect.left - bRect.left
    })
  }

  function findFirstTopicSuggestion(editor: TextTarget): HTMLElement | null {
    const containers = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="listbox"], [class*="topic"], [class*="Topic"], [class*="suggest"], [class*="Suggest"], [class*="popover"], [class*="Popover"], [class*="dropdown"], [class*="Dropdown"], [class*="mention"], [class*="Mention"]',
      ),
    ]
      .filter((el) => visible(el) && !el.closest('[contenteditable="true"]'))
      .sort((a, b) => candidateDistanceToEditor(a, editor) - candidateDistanceToEditor(b, editor))

    for (const container of containers) {
      const directItems = [
        ...container.querySelectorAll<HTMLElement>(
          '[role="option"], li, [class*="item"], [class*="Item"]',
        ),
      ].filter((el) => visible(el) && !el.closest('[contenteditable="true"]'))

      if (directItems.length > 0) return sortByVisualOrder(directItems)[0]
      if (normalize(container.textContent ?? '').includes('话题')) return container
    }

    const looseItems = [
      ...document.querySelectorAll<HTMLElement>('[role="option"], li, [class*="item"], [class*="Item"]'),
    ].filter((el) => visible(el) && !el.closest('[contenteditable="true"]'))
      .sort((a, b) => candidateDistanceToEditor(a, editor) - candidateDistanceToEditor(b, editor))

    return looseItems[0] ?? null
  }

  async function waitForTopicSuggestionsToClose(editor: TextTarget): Promise<void> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < 1_200) {
      if (!findFirstTopicSuggestion(editor)) return
      await sleep(80)
    }
  }

  async function waitForFirstTopicSuggestion(
    editor: TextTarget,
    timeoutMs: number,
  ): Promise<HTMLElement | null> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      const candidate = findFirstTopicSuggestion(editor)
      if (candidate) return candidate
      await sleep(120)
    }
    return null
  }

  async function waitForTopicSelected(
    tag: string,
    previousCount: number,
    timeoutMs: number,
  ): Promise<boolean> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (topicAnchorCount() > previousCount || hasTopicAnchor(tag)) return true
      await sleep(100)
    }
    return topicAnchorCount() > previousCount || hasTopicAnchor(tag)
  }

  async function selectFirstTopicSuggestion(
    editor: TextTarget,
    tag: string,
    previousCount: number,
  ): Promise<boolean> {
    const candidate = await waitForFirstTopicSuggestion(editor, 4_500)
    if (candidate) {
      await sleep(280)
      mouseClickOnce(candidate)
      if (await waitForTopicSelected(tag, previousCount, 2_500)) return true

      const retryCandidate = findFirstTopicSuggestion(editor)
      if (retryCandidate) {
        await sleep(240)
        mouseClickOnce(retryCandidate)
        if (await waitForTopicSelected(tag, previousCount, 2_500)) return true
      }
    }

    await sleep(250)
    dispatchKeyboard(editor, 'keydown', 'Enter')
    dispatchKeyboard(editor, 'keyup', 'Enter')
    return await waitForTopicSelected(tag, previousCount, 2_500)
  }

  async function appendTopics(editor: TextTarget, topicTags: string[]): Promise<boolean> {
    if (topicTags.length === 0) return true

    let ok = true
    for (const [index, tag] of topicTags.entries()) {
      await waitForTopicSuggestionsToClose(editor)
      placeCaretAtEnd(editor)
      await sleep(180)

      const previousCount = topicAnchorCount()
      const prefix = index === 0 && body ? '\n\n' : index > 0 ? ' ' : ''
      if (prefix) await typeIntoTarget(editor, prefix, 60)
      await sleep(120)
      await typeIntoTarget(editor, `#${tag}`, 55)
      await sleep(450)
      const selected = await selectFirstTopicSuggestion(editor, tag, previousCount)
      ok = ok && selected
      await waitForTopicSuggestionsToClose(editor)
      await sleep(300)
    }
    return ok
  }

  function fillInputLike(
    el: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ): boolean {
    mouseClick(el)
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(el, '')
      dispatchTextEvents(el, '')
      setter.call(el, value)
    } else {
      el.value = value
    }
    dispatchTextEvents(el, value)
    el.blur()
    return el.value.trim() === value.trim()
  }

  async function fillContentEditable(el: HTMLElement, value: string): Promise<boolean> {
    selectAllTargetContent(el)
    try {
      document.execCommand('delete', false)
      dispatchTextEvents(el, '')
    } catch {
      // 继续尝试粘贴，避免一次 delete 失败就中断正文回填。
    }

    await sleep(100)
    dispatchPaste(el, value)
    await sleep(400)
    if (targetHasText(el, value)) return true

    placeCaretAtEnd(el)
    try {
      document.execCommand('insertText', false, value)
      dispatchTextEvents(el, value)
    } catch {
      // 后面还有逐字符输入兜底。
    }
    await sleep(400)
    if (targetHasText(el, value)) return true

    selectAllTargetContent(el)
    try {
      document.execCommand('delete', false)
    } catch {
      // 忽略，逐字符输入仍会接在当前光标后。
    }
    await typeIntoTarget(el, value)
    await sleep(400)
    return targetHasText(el, value)
  }

  async function fillTarget(target: TextTarget, value: string): Promise<boolean> {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return fillInputLike(target, value)
    }
    return await fillContentEditable(target, value)
  }

  function describePageState(): string {
    const placeholders = allTextTargets()
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return `${el.tagName.toLowerCase()}[${attrText(el).slice(0, 40)}](${Math.round(rect.width)}x${Math.round(rect.height)})`
      })
      .join(';')
    return `fields=${placeholders || 'none'}`
  }

  try {
    if (!location.href.includes('/publish/publish')) {
      return {
        ok: false,
        titleFilled: false,
        bodyFilled: false,
        tagsFilled: tags.length === 0,
        titleFound: false,
        bodyFound: false,
        error: `当前页面不是小红书图文发布页：${location.href}`,
      }
    }

    let titleField: TextTarget | null = null
    let bodyField: TextTarget | null = null
    let titleFilled = !title
    let bodyFilled = !body
    let tagsFilled = tags.length === 0

    if (title) {
      titleField = await waitForTarget(findTitleField, FIELD_WAIT_TIMEOUT_MS)
      titleFilled = titleField ? await fillTarget(titleField, title) : false
    } else {
      titleField = findTitleField()
    }

    if (body || tags.length > 0) {
      bodyField = await waitForTarget(
        () => findBodyField(titleField),
        FIELD_WAIT_TIMEOUT_MS,
      )
      bodyFilled = body && bodyField
        ? await fillTarget(bodyField, body)
        : Boolean(bodyField)
      if (bodyField && tags.length > 0) {
        tagsFilled = await appendTopics(bodyField, tags)
      }
    } else {
      bodyField = findBodyField(titleField)
    }

    const ok = titleFilled && bodyFilled && tagsFilled
    return {
      ok,
      titleFilled,
      bodyFilled,
      tagsFilled,
      titleFound: Boolean(titleField),
      bodyFound: Boolean(bodyField),
      error: ok
        ? undefined
        : `标题/正文/标签未全部回填；${describePageState()}`,
    }
  } catch (error) {
    return {
      ok: false,
      titleFilled: false,
      bodyFilled: false,
      tagsFilled: tags.length === 0,
      titleFound: Boolean(findTitleField()),
      bodyFound: Boolean(findBodyField(findTitleField())),
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
