import { ref } from 'vue'

export type AppToastType = 'success' | 'error' | 'info'

type AppToastState = {
  id: number
  message: string
  type: AppToastType
} | null

const toastState = ref<AppToastState>(null)
let toastId = 0
let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showAppToast(
  message: string,
  type: AppToastType = 'success',
  duration = 2400,
) {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  toastState.value = {
    id: ++toastId,
    message,
    type,
  }
  if (duration > 0) {
    toastTimer = setTimeout(() => {
      toastState.value = null
      toastTimer = null
    }, duration)
  }
}

export function hideAppToast() {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  toastState.value = null
}

export function useAppToast() {
  return {
    toastState,
    showAppToast,
    hideAppToast,
  }
}
