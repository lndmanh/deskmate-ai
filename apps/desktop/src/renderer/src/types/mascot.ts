export interface MascotMotion {
  /** Motion id used to trigger it, e.g. 'waiting' | 'appearing' | 'liked' | 'happy'. */
  name: string
  /** Path relative to assets/motions, e.g. 'standard/waiting.vrma'. */
  file: string
  /** Looping motions (waiting) are used as the idle pose; the rest play once. */
  loop: boolean
}

export interface MascotPersonality {
  name: string
  label: string
  motions: MascotMotion[]
}

export interface MascotMotionsFile {
  defaultPersonality: string
  personalities: MascotPersonality[]
}

/**
 * Imperative API the rendering component (VrmMascot) registers with the
 * `useMascot` composable, so the radial menu — or a future chatbot — can drive
 * the avatar without touching Three.js directly.
 */
export interface MascotDriver {
  playMotion: (motion: MascotMotion) => void
}
