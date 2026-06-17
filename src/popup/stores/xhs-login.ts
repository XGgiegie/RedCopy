import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { checkXhsLoginOnActiveTab } from '../services/check-xhs-login'

export type XhsLoginStatus =
  | 'idle'
  | 'checking'
  | 'logged_in'
  | 'not_logged_in'
  | 'not_on_xhs'
  | 'error'

/**
 * 全局小红书登录态检测。
 * 与 page-status 类似监听标签页变化，在站内页面加载完成后自动复检。
 */
export const useXhsLoginStore = defineStore('xhsLogin', () => {
  const status = ref<XhsLoginStatus>('idle')
  const nickname = ref<string | undefined>()
  const errorMessage = ref<string | undefined>()

  let watchingTabId: number | undefined
  let started = false
  let checking = false

  const isLoggedIn = computed(() => status.value === 'logged_in')

  /** 标题栏登录态标签层级 */
  const tagLevel = computed<'ready' | 'warn' | 'idle'>(() => {
    if (status.value === 'checking' || status.value === 'idle') return 'idle'
    if (status.value === 'logged_in') return 'ready'
    return 'warn'
  })

  /** 标题栏登录态标签短文案 */
  const tagLabel = computed(() => {
    if (status.value === 'checking') return '检测中'
    if (status.value === 'logged_in') return '已登录'
    if (status.value === 'not_on_xhs') return '未检测'
    if (status.value === 'error') return '检测失败'
    return '未登录'
  })

  /** 标题栏登录态标签悬停说明 */
  const tagTooltip = computed(() => {
    if (status.value === 'checking') return '正在检测小红书登录状态'
    if (status.value === 'logged_in') {
      return nickname.value
        ? `已登录小红书：${nickname.value}`
        : '已成功登录小红书'
    }
    if (status.value === 'not_on_xhs') return '请先打开小红书页面后再检测登录状态'
    if (status.value === 'error') {
      return errorMessage.value ?? '登录状态检测失败，请切换回小红书页面后重试'
    }
    return '请在小红书页面完成登录'
  })

  async function checkLogin() {
    if (checking) return
    checking = true
    status.value = 'checking'
    errorMessage.value = undefined

    try {
      const result = await checkXhsLoginOnActiveTab()
      nickname.value = result.nickname

      if (!result.onXhsPage) {
        status.value = 'not_on_xhs'
        return
      }

      status.value = result.loggedIn ? 'logged_in' : 'not_logged_in'
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      status.value = 'error'
      errorMessage.value = detail
      console.error('[RedCopy][登录] 检测失败', detail, error)
    } finally {
      checking = false
    }
  }

  async function syncWatchingTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    watchingTabId = tab?.id
    if (/xiaohongshu\.com/i.test(tab?.url ?? '')) {
      await checkLogin()
      return
    }
    status.value = 'not_on_xhs'
    nickname.value = undefined
  }

  const onTabActivated: Parameters<
    typeof chrome.tabs.onActivated.addListener
  >[0] = (activeInfo) => {
    void (async () => {
      const tab = await chrome.tabs.get(activeInfo.tabId)
      watchingTabId = tab.id
      if (/xiaohongshu\.com/i.test(tab.url ?? '')) {
        await checkLogin()
        return
      }
      status.value = 'not_on_xhs'
      nickname.value = undefined
    })()
  }

  const onTabUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
    tabId,
    changeInfo,
    tab,
  ) => {
    if (watchingTabId !== tabId) return
    if (changeInfo.status !== 'complete' && !changeInfo.url) return

    const url = changeInfo.url ?? tab.url ?? ''
    if (!/xiaohongshu\.com/i.test(url)) {
      status.value = 'not_on_xhs'
      nickname.value = undefined
      return
    }

    void checkLogin()
  }

  const onHistoryStateUpdated: Parameters<
    typeof chrome.webNavigation.onHistoryStateUpdated.addListener
  >[0] = (details) => {
    if (watchingTabId !== details.tabId) return
    if (!/xiaohongshu\.com/i.test(details.url)) {
      status.value = 'not_on_xhs'
      nickname.value = undefined
      return
    }
    void checkLogin()
  }

  function start() {
    if (started) return
    started = true
    void syncWatchingTab()
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
    status,
    nickname,
    errorMessage,
    isLoggedIn,
    tagLevel,
    tagLabel,
    tagTooltip,
    checkLogin,
    start,
    stop,
  }
})
