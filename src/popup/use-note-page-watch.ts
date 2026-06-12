import { onMounted, onUnmounted, type Ref } from 'vue'
import { isXhsNoteUrl } from '../shared/extract-note'

function applyPageUrl(
  url: string,
  isXhsPage: Ref<boolean>,
  isNotePage: Ref<boolean>,
) {
  const matched = /xiaohongshu\.com/.test(url)
  const note = isXhsNoteUrl(url)

  isXhsPage.value = matched
  isNotePage.value = note

  console.info('[RedCopy] 页面状态更新', {
    url: url.slice(0, 100),
    isXhsPage: matched,
    isNotePage: note,
  })
}

/** 实时监听当前标签页是否进入小红书笔记详情，用于控制按钮可用状态 */
export function useNotePageWatch(
  isXhsPage: Ref<boolean>,
  isNotePage: Ref<boolean>,
) {
  let watchingTabId: number | undefined

  async function syncActiveTab(urlHint?: string) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    watchingTabId = tab?.id
    const url = urlHint ?? tab?.url ?? ''
    applyPageUrl(url, isXhsPage, isNotePage)
  }

  function isWatchingTab(tabId: number) {
    return watchingTabId === tabId
  }

  const onTabActivated: Parameters<
    typeof chrome.tabs.onActivated.addListener
  >[0] = (activeInfo) => {
    void (async () => {
      const tab = await chrome.tabs.get(activeInfo.tabId)
      watchingTabId = tab.id
      applyPageUrl(tab.url ?? '', isXhsPage, isNotePage)
    })()
  }

  const onTabUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
    tabId,
    changeInfo,
    tab,
  ) => {
    if (!changeInfo.url && changeInfo.status !== 'complete') return
    if (!isWatchingTab(tabId)) return

    applyPageUrl(changeInfo.url ?? tab.url ?? '', isXhsPage, isNotePage)
  }

  const onHistoryStateUpdated: Parameters<
    typeof chrome.webNavigation.onHistoryStateUpdated.addListener
  >[0] = (details) => {
    if (!isWatchingTab(details.tabId)) return
    applyPageUrl(details.url, isXhsPage, isNotePage)
  }

  onMounted(() => {
    void (async () => {
      await syncActiveTab()

      chrome.tabs.onActivated.addListener(onTabActivated)
      chrome.tabs.onUpdated.addListener(onTabUpdated)
      chrome.webNavigation.onHistoryStateUpdated.addListener(
        onHistoryStateUpdated,
        { url: [{ hostSuffix: 'xiaohongshu.com' }] },
      )
    })()
  })

  onUnmounted(() => {
    chrome.tabs.onActivated.removeListener(onTabActivated)
    chrome.tabs.onUpdated.removeListener(onTabUpdated)
    chrome.webNavigation.onHistoryStateUpdated.removeListener(
      onHistoryStateUpdated,
    )
  })
}
