export const ONBOARDING_STORAGE_KEY = 'deskmate:onboarding:v1'

export type StoredOnboardingData = {
  version: 1
  completed: boolean
  updatedAt: string
  completedAt?: string
  state?: unknown
  modules?: unknown[]
}

type UnknownRecord = Record<string, unknown>

function getLocalStorage() {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function readStoredOnboarding(): StoredOnboardingData | null {
  const storage = getLocalStorage()
  if (!storage) return null

  try {
    const raw = storage.getItem(ONBOARDING_STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    return normalizeStoredOnboarding(parsed)
  } catch {
    return null
  }
}

export async function readStoredOnboardingFromDisk(): Promise<StoredOnboardingData | null> {
  const onboardingApi = window.api?.onboarding
  if (!onboardingApi?.read) return readStoredOnboarding()

  try {
    const data = await onboardingApi.read()
    const parsed = normalizeStoredOnboarding(data)

    if (parsed) {
      const storage = getLocalStorage()
      storage?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(parsed, null, 2))
      return parsed
    }

    clearStoredOnboardingCache()
    return null
  } catch {
    return readStoredOnboarding()
  }
}

export function writeStoredOnboarding(data: StoredOnboardingData) {
  const storage = getLocalStorage()
  storage?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data, null, 2))

  window.api?.onboarding?.write(data).catch((error) => {
    console.error('Failed to write onboarding JSON file', error)
  })
}

export async function clearStoredOnboarding() {
  clearStoredOnboardingCache()

  try {
    await window.api?.onboarding?.clear()
  } catch {
    // Local cache is still cleared even if the disk file is unavailable.
  }
}

export async function getOnboardingFilePath(): Promise<string | null> {
  try {
    return await window.api?.onboarding?.getPath()
  } catch {
    return null
  }
}

export async function isOnboardingComplete() {
  return Boolean((await readStoredOnboardingFromDisk())?.completed)
}

function clearStoredOnboardingCache() {
  getLocalStorage()?.removeItem(ONBOARDING_STORAGE_KEY)
}

function normalizeStoredOnboarding(data: unknown): StoredOnboardingData | null {
  if (!isUnknownRecord(data)) return null
  if (data.version !== 1) return null

  return {
    version: 1,
    completed: Boolean(data.completed),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
    completedAt: typeof data.completedAt === 'string' ? data.completedAt : undefined,
    state: data.state,
    modules: Array.isArray(data.modules) ? data.modules : []
  }
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
