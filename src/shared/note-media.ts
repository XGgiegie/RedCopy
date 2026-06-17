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

const BLOB_URL_REVOKE_DELAY_MS = 60_000

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\u0000-\u001f\n\r]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 60)
    || '未命名笔记'
  )
}

function normalizeDownloadUrl(url: string): string {
  const trimmed = url.trim().replace(/&amp;/g, '&')
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function extensionFromMimeType(mimeType?: string): string | null {
  const mime = mimeType?.split(';')[0]?.trim().toLowerCase()
  if (!mime) return null

  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/gif':
      return '.gif'
    case 'image/webp':
      return '.webp'
    case 'image/avif':
      return '.avif'
    case 'image/bmp':
      return '.bmp'
    case 'image/svg+xml':
      return '.svg'
    default:
      return null
  }
}

/** 根据 URL 猜测图片扩展名 */
export function guessImageExtension(url: string, mimeType?: string): string {
  const mimeExt = extensionFromMimeType(mimeType)
  if (mimeExt) return mimeExt

  const lower = normalizeDownloadUrl(url).toLowerCase()
  if (lower.includes('webp')) return '.webp'
  if (lower.includes('avif')) return '.avif'
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
  mimeType?: string,
): string {
  const folder = sanitizeFilename(context.title || context.noteId || '笔记')
  const order = String(index + 1).padStart(2, '0')
  const ext = guessImageExtension(url, mimeType)
  return `薯薯小抄/${folder}/image-${order}${ext}`
}

function downloadByUrl(url: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: normalizeDownloadUrl(url),
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

interface BlobDownloadUrl {
  url: string
  mimeType?: string
  revoke: () => void
}

async function createBlobDownloadUrl(url: string): Promise<BlobDownloadUrl> {
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error('图片内容为空')
  }

  const objectUrl = URL.createObjectURL(blob)
  return {
    url: objectUrl,
    mimeType: blob.type || response.headers.get('content-type') || undefined,
    revoke: () => URL.revokeObjectURL(objectUrl),
  }
}

async function downloadImageLikeUrl(
  url: string,
  buildFilename: (mimeType?: string) => string,
): Promise<void> {
  const normalizedUrl = normalizeDownloadUrl(url)
  if (!isHttpUrl(normalizedUrl)) {
    await downloadByUrl(normalizedUrl, buildFilename())
    return
  }

  let blobDownload: BlobDownloadUrl | null = null
  try {
    blobDownload = await createBlobDownloadUrl(normalizedUrl)
    await downloadByUrl(blobDownload.url, buildFilename(blobDownload.mimeType))
    setTimeout(blobDownload.revoke, BLOB_URL_REVOKE_DELAY_MS)
  } catch (error) {
    if (blobDownload) blobDownload.revoke()
    const detail = error instanceof Error ? error.message : String(error)
    console.warn('[RedCopy] Blob 图片下载失败，回退直链下载', {
      url: normalizedUrl,
      detail,
      error,
    })
    await downloadByUrl(normalizedUrl, buildFilename())
  }
}

function ensureImageFilenameExtension(
  filename: string,
  url: string,
  mimeType?: string,
): string {
  const safe = sanitizeFilename(filename)
  if (/\.[a-z0-9]{2,5}$/i.test(safe)) return safe
  return `${safe}${guessImageExtension(url, mimeType)}`
}

/** 通用：按 URL（含 data:）下载图片，filename 为不含目录的文件名 */
export async function downloadImageByUrl(
  url: string,
  filename: string,
): Promise<void> {
  await downloadImageLikeUrl(
    url,
    (mimeType) =>
      `薯薯小抄/配图/${ensureImageFilenameExtension(filename, url, mimeType)}`,
  )
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
  await downloadImageLikeUrl(url, (mimeType) =>
    buildImageFilename(context, index, url, mimeType),
  )
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
