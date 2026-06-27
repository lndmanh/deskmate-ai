export type ThemeMode = 'dark' | 'light'
export type ThemePreference = 'system' | ThemeMode

export const themeStorageKey = 'deskmate:theme-preference'

const darkSchemeQuery = '(prefers-color-scheme: dark)'

export function getSystemThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  if (typeof window.matchMedia !== 'function') return 'light'

  return window.matchMedia(darkSchemeQuery).matches ? 'dark' : 'light'
}

export function resolveThemePreference(preference: ThemePreference, systemThemeMode: ThemeMode): ThemeMode {
  return preference === 'system' ? systemThemeMode : preference
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'

  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey)
    if (isThemePreference(savedTheme)) return savedTheme
  } catch {
    return 'system'
  }

  return 'system'
}

export function writeThemePreference(preference: ThemePreference) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(themeStorageKey, preference)
  } catch {
    return
  }
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return

  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
}

export function watchSystemThemeChange(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined
  if (typeof window.matchMedia !== 'function') return () => undefined

  const mediaQuery = window.matchMedia(darkSchemeQuery)
  const listener = () => callback()

  mediaQuery.addEventListener('change', listener)

  return () => {
    mediaQuery.removeEventListener('change', listener)
  }
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'dark' || value === 'light'
}
