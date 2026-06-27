import { useStorage } from '@vueuse/core'
import { computed } from 'vue'

import rawMotions from '@/assets/mascot-motions.json'
import type { MascotDriver, MascotMotion, MascotMotionsFile, MascotPersonality } from '@/types/mascot'

const PERSONALITY_STORAGE_KEY = 'deskmate:mascot-personality'

const data: MascotMotionsFile = rawMotions

const personalities: MascotPersonality[] = data.personalities

// The rendering component registers itself here; external callers reach the
// avatar through this single driver. Module-level so state is shared app-wide,
// matching the pattern used by other composables (see useSpaces).
let driver: MascotDriver | null = null

const isValidPersonality = (name: string): boolean => personalities.some((p) => p.name === name)

const storedPersonality = useStorage(PERSONALITY_STORAGE_KEY, data.defaultPersonality)
if (!isValidPersonality(storedPersonality.value)) storedPersonality.value = data.defaultPersonality

const currentPersonality = computed<MascotPersonality>(
  () =>
    personalities.find((p) => p.name === storedPersonality.value) ??
    personalities[0]
)

/** Motions of the active personality, surfaced in the radial menu. */
const motions = computed<MascotMotion[]>(() => currentPersonality.value.motions)

/** The looping motion used as the resting/idle pose. */
const idleMotion = computed<MascotMotion | null>(
  () => currentPersonality.value.motions.find((m) => m.loop) ?? null
)

/** First non-looping motion (typically "appearing"), played when the avatar mounts. */
const introMotion = computed<MascotMotion | null>(
  () => currentPersonality.value.motions.find((m) => m.name === 'appearing') ?? null
)

function findMotion(name: string): MascotMotion | null {
  const inCurrent = currentPersonality.value.motions.find((m) => m.name === name)
  if (inCurrent) return inCurrent
  // Fall back across personalities: motions retarget onto any model, so a
  // chatbot can ask for "happy" even when the active personality lacks it.
  for (const personality of personalities) {
    const match = personality.motions.find((m) => m.name === name)
    if (match) return match
  }
  return null
}

/**
 * Trigger a motion by id. This is the entry point for the radial menu and for
 * any programmatic caller (e.g. a chatbot mapping a reply to `playMotion('liked')`).
 * Returns false when the motion id is unknown or no avatar is mounted.
 */
function playMotion(name: string): boolean {
  const motion = findMotion(name)
  if (!motion || !driver) return false
  driver.playMotion(motion)
  return true
}

function setPersonality(name: string): void {
  if (!isValidPersonality(name)) return
  storedPersonality.value = name
  const idle = idleMotion.value
  if (idle && driver) driver.playMotion(idle)
}

function cyclePersonality(direction: 1 | -1): void {
  const index = personalities.findIndex((p) => p.name === storedPersonality.value)
  const next = (index + direction + personalities.length) % personalities.length
  setPersonality(personalities[next].name)
}

function registerDriver(next: MascotDriver): void {
  driver = next
}

function unregisterDriver(next: MascotDriver): void {
  if (driver === next) driver = null
}

export function useMascot() {
  return {
    personalities,
    currentPersonality,
    personalityName: storedPersonality,
    motions,
    idleMotion,
    introMotion,
    playMotion,
    setPersonality,
    cyclePersonality,
    registerDriver,
    unregisterDriver
  }
}
