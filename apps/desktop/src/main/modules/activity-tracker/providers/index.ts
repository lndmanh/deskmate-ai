import type { ActiveWindowSample } from '../types'
import { createGetWindowsProvider } from './getWindowsProvider'
import { createShellProvider } from './shellProvider'
import type { ActivityProvider, ProviderQueryOptions, ResolvedProvider } from './types'

export type { ActivityProvider, ProviderQueryOptions, ResolvedProvider } from './types'
export { createGetWindowsProvider } from './getWindowsProvider'
export { createShellProvider } from './shellProvider'

/** Consecutive failures of the active provider before we demote it. */
const FAILURE_LIMIT = 3

/**
 * A provider that tries the native `get-windows` provider first and falls back
 * to the shell provider. If the active provider keeps failing at runtime it is
 * demoted to the back of the queue so the next candidate is used instead.
 */
export function createCompositeProvider(): ResolvedProvider {
  const candidates: ActivityProvider[] = [createGetWindowsProvider(), createShellProvider()]
  let active: ActivityProvider | null = null
  let failures = 0

  async function ensureActive(): Promise<ActivityProvider | null> {
    if (active) {
      return active
    }
    for (const candidate of candidates) {
      if (await candidate.isAvailable()) {
        active = candidate
        failures = 0
        return active
      }
    }
    return null
  }

  function demote(provider: ActivityProvider): void {
    const index = candidates.indexOf(provider)
    if (index >= 0 && candidates.length > 1) {
      candidates.splice(index, 1)
      candidates.push(provider)
    }
    active = null
    failures = 0
  }

  return {
    name: 'composite',

    activeName(): string | null {
      return active ? active.name : null
    },

    async isAvailable(): Promise<boolean> {
      return (await ensureActive()) !== null
    },

    async getActiveWindow(options: ProviderQueryOptions): Promise<ActiveWindowSample | null> {
      const provider = await ensureActive()
      if (!provider) {
        return null
      }
      try {
        const sample = await provider.getActiveWindow(options)
        failures = 0
        return sample
      } catch {
        failures += 1
        if (failures >= FAILURE_LIMIT) {
          demote(provider)
        }
        return null
      }
    }
  }
}
