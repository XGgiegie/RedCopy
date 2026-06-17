import {
  isValidImageDataUrl,
  normalizeImageDataUrl,
} from './draft-image'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('图片转 Base64 失败'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function fetchImageAsDataUrl(url: string, index: number): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error(`第 ${index + 1} 张图片地址为空`)
  }

  if (isValidImageDataUrl(trimmed)) {
    return normalizeImageDataUrl(trimmed)
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error(`第 ${index + 1} 张图片不是可转换的网络图片地址`)
  }

  const response = await fetch(trimmed)
  if (!response.ok) {
    throw new Error(`第 ${index + 1} 张图片下载失败：HTTP ${response.status}`)
  }

  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error(`第 ${index + 1} 张图片响应不是图片格式`)
  }

  const dataUrl = await blobToDataUrl(blob)
  if (!isValidImageDataUrl(dataUrl)) {
    throw new Error(`第 ${index + 1} 张图片 Base64 格式异常`)
  }
  return normalizeImageDataUrl(dataUrl)
}

/** 将图文分析图片统一转成 data:image/...;base64 URL，避免把 https 原图地址传给模型。 */
export async function resolveAnalysisImageDataUrls(
  imageUrls?: string[],
): Promise<string[] | undefined> {
  const urls = (imageUrls ?? []).map((url) => url.trim()).filter(Boolean)
  if (urls.length === 0) return undefined

  console.info('[RedCopy] 开始转换分析图片为 Base64', {
    count: urls.length,
  })

  const dataUrls = await Promise.all(
    urls.map((url, index) => fetchImageAsDataUrl(url, index)),
  )

  console.info('[RedCopy] 分析图片 Base64 转换完成', {
    count: dataUrls.length,
    totalChars: dataUrls.reduce((sum, item) => sum + item.length, 0),
  })

  return dataUrls
}
