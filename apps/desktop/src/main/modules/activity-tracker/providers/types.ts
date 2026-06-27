import type { ActiveWindowSample } from '../types'

export interface ProviderQueryOptions {
  /** Include the window title in the sample. */
  captureTitles: boolean
  /** Include the active browser URL in the sample (macOS). */
  captureUrls: boolean
}

/**
 * A source of foreground-window samples. Implementations must never throw
 * for an "expected" empty result (e.g. no focused window) — they return
 * `null` instead, and reserve thrown errors for "this provider is broken".
 */
export interface ActivityProvider {
  /** Human-readable provider name, shown in tracker status. */
  readonly name: string
  /** Cheap probe that resolves true when this provider can run here. */
  isAvailable(): Promise<boolean>
  /** Read the current foreground window, or null when none / unknown. */
  getActiveWindow(options: ProviderQueryOptions): Promise<ActiveWindowSample | null>
}

/**
 * A provider that may delegate to one of several underlying providers and
 * can report which one is currently in use.
 */
export interface ResolvedProvider extends ActivityProvider {
  /** Name of the underlying provider currently in use, or null. */
  activeName(): string | null
}
