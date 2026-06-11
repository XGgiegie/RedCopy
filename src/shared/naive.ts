import type { GlobalThemeOverrides } from 'naive-ui'
import { dateZhCN, zhCN } from 'naive-ui'

/** 小红书主题色 */
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ff2442',
    primaryColorHover: '#ff4d66',
    primaryColorPressed: '#e61f3b',
    primaryColorSuppl: '#ff4d66',
    borderRadius: '10px',
    fontFamily:
      'v-sans, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyMono: 'v-mono, "SF Mono", Monaco, Consolas, monospace',
  },
  Card: {
    borderRadius: '12px',
  },
  Button: {
    borderRadiusMedium: '10px',
  },
}

export { zhCN, dateZhCN }
