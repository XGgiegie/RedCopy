import { computed, ref, watch, type Ref } from 'vue'

/** 管理 AI 分析用配图勾选状态 */
export function useImageSelection(images: Ref<string[]>) {
  const selectedIndices = ref<number[]>([])

  watch(
    images,
    (list) => {
      selectedIndices.value = list.map((_, index) => index)
    },
    { immediate: true },
  )

  const selectedImageUrls = computed(() =>
    selectedIndices.value
      .map((index) => images.value[index])
      .filter((url): url is string => Boolean(url)),
  )

  const hasImages = computed(() => images.value.length > 0)

  function isImageSelected(index: number): boolean {
    return selectedIndices.value.includes(index)
  }

  function toggleImage(index: number) {
    if (isImageSelected(index)) {
      selectedIndices.value = selectedIndices.value.filter((i) => i !== index)
      return
    }
    selectedIndices.value = [...selectedIndices.value, index].sort(
      (a, b) => a - b,
    )
  }

  function selectAllImages() {
    selectedIndices.value = images.value.map((_, index) => index)
  }

  function clearImageSelection() {
    selectedIndices.value = []
  }

  function setImageSelected(index: number, selected: boolean) {
    if (selected) {
      if (!isImageSelected(index)) {
        selectedIndices.value = [...selectedIndices.value, index].sort(
          (a, b) => a - b,
        )
      }
      return
    }
    selectedIndices.value = selectedIndices.value.filter((i) => i !== index)
  }

  return {
    selectedIndices,
    selectedImageUrls,
    hasImages,
    isImageSelected,
    toggleImage,
    setImageSelected,
    selectAllImages,
    clearImageSelection,
  }
}
