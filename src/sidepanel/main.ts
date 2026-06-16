import { createApp, h } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
} from 'naive-ui'
import App from '../popup/App.vue'
import { router } from '../popup/router'
import { dateZhCN, themeOverrides, zhCN } from '../shared/naive'

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
          h(NMessageProvider, null, { default: () => h(App) }),
        ],
      },
    ),
})

app.use(router)
app.mount('#app')
