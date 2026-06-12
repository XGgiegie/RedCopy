import { createApp, h } from 'vue'
import {
  NConfigProvider,
  NGlobalStyle,
  NMessageProvider,
} from 'naive-ui'
import OptionsApp from './OptionsApp.vue'
import { dateZhCN, themeOverrides, zhCN } from '../shared/naive'

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
          h(NMessageProvider, null, { default: () => h(OptionsApp) }),
        ],
      },
    ),
}).mount('#app')
