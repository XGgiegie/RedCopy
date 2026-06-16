import type { NoteTextInfo } from './note-types'

/** 获取笔记正文纯文本 */
export function getNoteBodyText(note: NoteTextInfo): string {
  const body = note.desc?.trim() || note.allText?.trim()
  return body || '（无正文）'
}

/** 将图片 URL 格式化为 Markdown */
export function formatImagesAsMarkdown(images: string[]): string {
  return images
    .map((url, index) => `![笔记图片 ${index + 1}](${url})`)
    .join('\n')
}

/** 将图片 URL 格式化为纯文本链接（每行一条） */
export function formatImagesAsUrls(images: string[]): string {
  return images.join('\n')
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\n\r]/g, '_').trim().slice(0, 60) || '未命名笔记'
}

/** 根据 URL 猜测图片扩展名 */
export function guessImageExtension(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('webp')) return '.webp'
  if (lower.includes('.png')) return '.png'
  if (lower.includes('.gif')) return '.gif'
  if (lower.includes('.jpeg') || lower.includes('.jpg')) return '.jpg'
  return '.jpg'
}

export interface ImageDownloadContext {
  title?: string
  noteId?: string | null
}

function buildImageFilename(
  context: ImageDownloadContext,
  index: number,
  url: string,
): string {
  const folder = sanitizeFilename(context.title || context.noteId || '笔记')
  const order = String(index + 1).padStart(2, '0')
  const ext = guessImageExtension(url)
  return `薯薯小抄/${folder}/image-${order}${ext}`
}

function downloadByUrl(url: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        conflictAction: 'uniquify',
      },
      (downloadId) => {
        const err = chrome.runtime.lastError?.message
        if (err) {
          reject(new Error(err))
          return
        }
        if (downloadId === undefined) {
          reject(new Error('下载失败'))
          return
        }
        resolve(downloadId)
      },
    )
  })
}

/** 通用：按 URL（含 data:）下载图片，filename 为不含目录的文件名 */
export async function downloadImageByUrl(
  url: string,
  filename: string,
): Promise<void> {
  await downloadByUrl(url, `薯薯小抄/配图/${sanitizeFilename(filename)}`)
}

/** 通用：把文本内容（如 Markdown）保存到本地下载 */
export async function downloadTextFile(
  content: string,
  filename: string,
  mime = 'text/markdown',
): Promise<void> {
  const url = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`
  await downloadByUrl(url, `薯薯小抄/${sanitizeFilename(filename)}`)
}

/** 下载单张笔记图片 */
export async function downloadNoteImage(
  url: string,
  index: number,
  context: ImageDownloadContext = {},
): Promise<void> {
  const filename = buildImageFilename(context, index, url)
  await downloadByUrl(url, filename)
}

/** 批量下载笔记图片 */
export async function downloadAllNoteImages(
  images: string[],
  context: ImageDownloadContext = {},
  options: { delayMs?: number } = {},
): Promise<{ success: number; failed: number }> {
  const delayMs = options.delayMs ?? 180
  let success = 0
  let failed = 0

  for (const [index, url] of images.entries()) {
    try {
      await downloadNoteImage(url, index, context)
      success += 1
    } catch (error) {
      failed += 1
      const detail = error instanceof Error ? error.message : String(error)
      console.error('[RedCopy] 图片下载失败', { index, url, detail, error })
    }

    if (index < images.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { success, failed }
}
