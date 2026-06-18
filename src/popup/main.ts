import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
} from 'naive-ui'
import App from './App.vue'
import { router } from './router'
import { dateZhCN, themeOverrides, zhCN } from '../shared/naive'

// Naive UI 推荐字体（本地 woff2，适合扩展环境）
import 'vfonts/Inter.css'
import 'vfonts/FiraCode.css'

const app = createApp({
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
          h(
            NMessageProvider,
            { class: 'rc-message-shell' },
            {
              default: () => h('div', { class: 'rc-shell-host' }, [h(App)]),
            },
          ),
        ],
      },
    ),
})

app.use(createPinia())
app.use(router)
app.mount('#app')
