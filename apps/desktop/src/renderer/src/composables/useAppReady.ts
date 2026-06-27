import { ref } from 'vue'

const isReady = ref(false)
let readyPromise: Promise<void> | null = null
let resolveReady: (() => void) | null = null

function getReadyPromise(): Promise<void> {
  if (isReady.value) return Promise.resolve()
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      resolveReady = resolve
    })
  }
  return readyPromise
}

function markReady(): void {
  isReady.value = true
  resolveReady?.()
}

export function useAppReady() {
  return { isReady, whenReady: getReadyPromise, markReady }
}
