import { createApp, h } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
} from 'naive-ui'
import App from './App.vue'
import { dateZhCN, themeOverrides, zhCN } from '../shared/naive'

// Naive UI 推荐字体（本地 woff2，适合扩展环境）
import 'vfonts/Inter.css'
import 'vfonts/FiraCode.css'

createApp({
  render: () =>
    h(
      NConfigProvider,
      {
        locale: zhCN,
        dateLocale: dateZhCN,
        themeOverrides,
      },
      {
        default: () => [
          h(NGlobalStyle),
          h(NMessageProvider, null, { default: () => h(App) }),
        ],
      },
    ),
}).mount('#app')
