import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
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
          h(NMessageProvider, null, {
            default: () => h('div', { class: 'rc-shell-host' }, [h(App)]),
          }),
        ],
      },
    ),
})

app.use(createPinia())
app.use(router)
app.mount('#app')
