import {
  injectCheckXhsLogin,
  type XhsLoginInjectResult,
} from '../../shared/xhs-login'

export interface XhsLoginCheckResult extends XhsLoginInjectResult {
  onXhsPage: boolean
}

async function executeInTab<T, A extends unknown[]>(
  tabId: number,
  func: (...args: A) => T,
  args: A,
): Promise<T> {
  if (!chrome.scripting?.executeScript) {
    throw new Error('scripting 权限不可用，请刷新扩展后重试')
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  })

  if (result?.result === undefined) {
    throw new Error('页面脚本未返回数据')
  }

  return result.result as T
}

/** 检测当前激活标签页的小红书登录状态 */
export async function checkXhsLoginOnActiveTab(): Promise<XhsLoginCheckResult> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let tab = activeTab
  const activeUrl = tab?.url ?? ''
  let onXhsPage = /xiaohongshu\.com/i.test(activeUrl)

  // 侧栏打开时若当前激活标签不是小红书，回退到同窗口内的小红书标签
  if (!onXhsPage && tab?.windowId != null) {
    const windowTabs = await chrome.tabs.query({ windowId: tab.windowId })
    const xhsTab = windowTabs.find((candidate) =>
      /xiaohongshu\.com/i.test(candidate.url ?? ''),
    )
    if (xhsTab) {
      tab = xhsTab
      onXhsPage = true
      console.info('[RedCopy][登录] 激活标签非小红书，回退检测同窗口小红书标签', {
        activeUrl: activeUrl.slice(0, 80),
        fallbackTabId: xhsTab.id,
        fallbackUrl: (xhsTab.url ?? '').slice(0, 80),
      })
    }
  }

  if (!tab?.id || !onXhsPage) {
    console.info('[RedCopy][登录] 当前不在小红书页面', { url: activeUrl.slice(0, 80) })
    return { onXhsPage: false, loggedIn: false, source: 'none' }
  }

  try {
    const injectResult = await executeInTab(tab.id, injectCheckXhsLogin, [])
    console.info('[RedCopy][登录] 检测结果', {
      tabId: tab.id,
      loggedIn: injectResult.loggedIn,
      source: injectResult.source,
      nickname: injectResult.nickname,
    })
    return { ...injectResult, onXhsPage: true }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[RedCopy][登录] 注入检测脚本失败', { tabId: tab.id, detail }, error)
    throw error
  }
}
