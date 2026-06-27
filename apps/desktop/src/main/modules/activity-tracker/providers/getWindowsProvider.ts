import type { ActiveWindowSample } from '../types'
import type { ActivityProvider, ProviderQueryOptions } from './types'

/**
 * Primary provider, backed by the maintained `get-windows` native module
 * (formerly `active-win`). It ships a prebuilt Swift CLI on macOS and native
 * addons on Windows/Linux, covering all three platforms.
 *
 * `get-windows` is ESM-only while the Electron main bundle is CommonJS, so we
 * load it through a dynamic `import()`, which electron-vite preserves for
 * externalized dependencies. If the module fails to load (missing binary,
 * wrong ABI, Wayland session, …) the composite provider falls back to the
 * shell provider.
 */

type GetWindowsModule = typeof import('get-windows')
type ActiveWindowResult = Awaited<ReturnType<GetWindowsModule['activeWindow']>>

let modulePromise: Promise<GetWindowsModule> | null = null

function loadModule(): Promise<GetWindowsModule> {
  if (!modulePromise) {
    modulePromise = import('get-windows')
  }
  return modulePromise
}

function toSample(result: NonNullable<ActiveWindowResult>): ActiveWindowSample {
  const sample: ActiveWindowSample = {
    app: result.owner.name,
    title: result.title,
    pid: result.owner.processId,
    path: result.owner.path,
    platform: result.platform,
    windowId: result.id
  }

  if (result.platform === 'macos') {
    sample.bundleId = result.owner.bundleId
    if (typeof result.url === 'string' && result.url.length > 0) {
      sample.url = result.url
    }
  }

  return sample
}

export function createGetWindowsProvider(): ActivityProvider {
  return {
    name: 'get-windows',

    async isAvailable(): Promise<boolean> {
      try {
        const mod = await loadModule()
        return typeof mod.activeWindow === 'function'
      } catch {
        // Reset so a later retry can attempt the import again.
        modulePromise = null
        return false
      }
    },

    async getActiveWindow(options: ProviderQueryOptions): Promise<ActiveWindowSample | null> {
      const mod = await loadModule()
      // On macOS these flags gate permission prompts. We only request the
      // capabilities the caller actually wants, keeping the tracker quiet and
      // privacy-friendly by default.
      const result = await mod.activeWindow({
        accessibilityPermission: options.captureUrls,
        screenRecordingPermission: options.captureTitles
      })
      if (!result) {
        return null
      }
      return toSample(result)
    }
  }
}
