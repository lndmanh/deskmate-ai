import { powerMonitor } from 'electron'
import type { IdleState } from './types'

/**
 * Thin wrappers over Electron's cross-platform `powerMonitor`. These let the
 * tracker tell "the user is actively working" from "the machine is on but the
 * user stepped away / locked the screen", without any extra native deps.
 */

/** Seconds since the last user input (keyboard / mouse). */
export function getIdleSeconds(): number {
  return powerMonitor.getSystemIdleTime()
}

/**
 * Coarse activity state. Anything past `thresholdSec` of no input is `idle`;
 * a locked session is reported as `locked` on supported platforms.
 */
export function getIdleState(thresholdSec: number): IdleState {
  const state = powerMonitor.getSystemIdleState(Math.max(1, Math.round(thresholdSec)))
  if (state === 'active' || state === 'idle' || state === 'locked') {
    return state
  }
  return 'unknown'
}
