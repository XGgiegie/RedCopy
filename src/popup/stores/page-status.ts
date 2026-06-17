import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isXhsNoteUrl } from '../../shared/extract-note'

/** 当前标签页相对小红书的状态层级 */
export type PageStatusLevel = 'ready' | 'warn' | 'idle'

/**
 * 集中检测「当前激活标签页是否为小红书笔记详情页」。
 * 提升为全局 store，便于标题栏状态标签与列表页提取按钮共享同一份状态。
 */
export const usePageStatusStore = defineStore('pageStatus', () => {
  const isXhsPage = ref(false)
  const isNotePage = ref(false)
  let watchingTabId: number | undefined
  let started = false

  const level = computed<PageStatusLevel>(() => {
    if (isNotePage.value) return 'ready'
    if (isXhsPage.value) return 'warn'
    return 'idle'
  })

  /** 标题栏标签短文案 */
  const label = computed(() => {
    if (level.value === 'ready') return '笔记页'
    if (level.value === 'warn') return '非笔记页'
    return '未在小红书'
  })

  function applyPageUrl(url: string) {
    isXhsPage.value = /xiaohongshu\.com/.test(url)
    isNotePage.value = isXhsNoteUrl(url)
    console.info('[RedCopy] 页面状态更新', {
      url: url.slice(0, 100),
      isXhsPage: isXhsPage.value,
      isNotePage: isNotePage.value,
    })
  }

  async function syncActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    watchingTabId = tab?.id
    applyPageUrl(tab?.url ?? '')
  }

  const onTabActivated: Parameters<
    typeof chrome.tabs.onActivated.addListener
  >[0] = (activeInfo) => {
    void (async () => {
      const tab = await chrome.tabs.get(activeInfo.tabId)
      watchingTabId = tab.id
      applyPageUrl(tab.url ?? '')
    })()
  }

  const onTabUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
    tabId,
    changeInfo,
    tab,
  ) => {
    if (!changeInfo.url && changeInfo.status !== 'complete') return
    if (watchingTabId !== tabId) return
    applyPageUrl(changeInfo.url ?? tab.url ?? '')
  }

  const onHistoryStateUpdated: Parameters<
    typeof chrome.webNavigation.onHistoryStateUpdated.addListener
  >[0] = (details) => {
    if (watchingTabId !== details.tabId) return
    applyPageUrl(details.url)
  }

  /** 启动监听（幂等）。建议在常驻的 App 根组件挂载时调用。 */
  function start() {
    if (started) return
    started = true
    void syncActiveTab()
    chrome.tabs.onActivated.addListener(onTabActivated)
    chrome.tabs.onUpdated.addListener(onTabUpdated)
    chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated, {
      url: [{ hostSuffix: 'xiaohongshu.com' }],
    })
  }

  function stop() {
    if (!started) return
    started = false
    chrome.tabs.onActivated.removeListener(onTabActivated)
    chrome.tabs.onUpdated.removeListener(onTabUpdated)
    chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated)
  }

  return {
    isXhsPage,
    isNotePage,
    level,
    label,
    start,
    stop,
    syncActiveTab,
  }
})
