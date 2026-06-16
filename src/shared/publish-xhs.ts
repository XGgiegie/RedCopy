/** 小红书 PC 创作者中心 · 发布图文页 */
export const XHS_PUBLISH_URL =
  'https://creator.xiaohongshu.com/publish/publish?source=official'

/** 打开或聚焦小红书发布页 */
export async function openXhsPublishPage(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: '*://*.xiaohongshu.com/*' })
  const existing = tabs.find((tab) =>
    tab.id && /creator\.xiaohongshu\.com\/publish/i.test(tab.url ?? ''),
  )

  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: XHS_PUBLISH_URL })
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true })
    }
    console.info('[RedCopy] 已聚焦小红书发布页', { tabId: existing.id })
    return
  }

  const tab = await chrome.tabs.create({ url: XHS_PUBLISH_URL, active: true })
  console.info('[RedCopy] 已打开小红书发布页', { tabId: tab.id })
}
