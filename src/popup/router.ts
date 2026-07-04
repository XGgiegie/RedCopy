import { createRouter, createWebHashHistory } from 'vue-router'
import GrowthPage from './pages/growth/GrowthPage.vue'
import ListPage from './pages/list/ListPage.vue'
import PromptEditorPage from './pages/prompts/PromptEditorPage.vue'
import PromptsPage from './pages/prompts/PromptsPage.vue'
import ApiKeyView from './pages/settings/ApiKeyView.vue'
import SettingsView from './pages/settings/SettingsView.vue'
import TaskPage from './pages/task/TaskPage.vue'

/**
 * 侧栏/弹窗运行在 chrome-extension:// 下，必须用 hash 模式，
 * 否则刷新或深链会 404。
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/creation',
    },
    {
      path: '/creation',
      name: 'creation',
      component: ListPage,
    },
    {
      path: '/analysis',
      redirect: '/creation',
    },
    {
      path: '/growth',
      name: 'growth',
      component: GrowthPage,
    },
    {
      path: '/task/:id',
      name: 'task',
      component: TaskPage,
      props: true,
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/apikey',
      name: 'apikey',
      component: ApiKeyView,
    },
    {
      path: '/prompts',
      name: 'prompts',
      component: PromptsPage,
    },
    {
      path: '/prompts/:key',
      name: 'prompt-editor',
      component: PromptEditorPage,
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/creation',
    },
  ],
})
