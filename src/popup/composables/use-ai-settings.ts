import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  type AnalysisProvider,
  type DeepSeekModel,
  type DoubaoModel,
  getAnalysisProviderLabel,
  isAnalysisConfigured,
  isGenerateConfigured,
  isProviderConfigured,
  loadAiSettings,
  saveAnalysisModel,
  saveAnalysisProvider,
} from '../../shared/ai-settings'

/** AI 配置状态与设置页开关 */
export function useAiSettings() {
  const isAiConfigured = ref(false)
  const isGenerateReady = ref(false)
  const hasDeepseekKey = ref(false)
  const hasDoubaoKey = ref(false)
  const analysisProvider = ref<AnalysisProvider>('deepseek')
  const deepseekModel = ref<DeepSeekModel>('deepseek-v4-flash')
  const doubaoModel = ref<DoubaoModel>('doubao-seed-2-0-pro-260215')
  const isSettingsOpen = ref(false)

  const analysisModel = computed<DeepSeekModel | DoubaoModel>(() =>
    analysisProvider.value === 'doubao' ? doubaoModel.value : deepseekModel.value,
  )

  const supportsVision = computed(() => analysisProvider.value === 'doubao')
  const isSettingsView = computed(() => isSettingsOpen.value)
  const analysisProviderLabel = computed(() =>
    getAnalysisProviderLabel(analysisProvider.value),
  )

  function applySettings(settings: Awaited<ReturnType<typeof loadAiSettings>>) {
    analysisProvider.value = settings.analysisProvider
    deepseekModel.value = settings.deepseek.model
    doubaoModel.value = settings.doubao.model
    hasDeepseekKey.value = isProviderConfigured(settings, 'deepseek')
    hasDoubaoKey.value = isProviderConfigured(settings, 'doubao')
    isAiConfigured.value = isAnalysisConfigured(settings)
    isGenerateReady.value = isGenerateConfigured(settings)
  }

  async function refreshAiSettings() {
    applySettings(await loadAiSettings())
  }

  async function setAnalysisProvider(provider: AnalysisProvider) {
    if (provider === analysisProvider.value) return

    const settings = await saveAnalysisProvider(provider)
    applySettings(settings)
    console.info('[RedCopy] 分析服务商已切换', { provider })
  }

  async function setAnalysisModel(model: DeepSeekModel | DoubaoModel) {
    const provider = analysisProvider.value
    const settings = await saveAnalysisModel(provider, model)
    applySettings(settings)
    console.info('[RedCopy] 分析模型已切换', { provider, model })
  }

  function openSettingsPage() {
    isSettingsOpen.value = true
  }

  function closeSettingsPage() {
    isSettingsOpen.value = false
  }

  function handleSettingsSaved() {
    isSettingsOpen.value = false
    void refreshAiSettings()
  }

  function handleStorageChanged(
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) {
    if (areaName !== 'local' || !changes['redcopy:aiSettings']) return
    void refreshAiSettings()
  }

  onMounted(() => {
    chrome.storage?.onChanged?.addListener(handleStorageChanged)
    void refreshAiSettings()
  })

  onUnmounted(() => {
    chrome.storage?.onChanged?.removeListener(handleStorageChanged)
  })

  return {
    isAiConfigured,
    isGenerateReady,
    hasDeepseekKey,
    hasDoubaoKey,
    analysisProvider,
    analysisModel,
    analysisProviderLabel,
    supportsVision,
    isSettingsView,
    refreshAiSettings,
    setAnalysisProvider,
    setAnalysisModel,
    openSettingsPage,
    closeSettingsPage,
    handleSettingsSaved,
  }
}
