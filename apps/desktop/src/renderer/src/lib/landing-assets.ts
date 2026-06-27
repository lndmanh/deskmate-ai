// Remote assets for the DeskMate AI landing page.
// These are the still-life / portrait images shipped at qclay.design and are used
// here as placeholders — swap them for DeskMate module artwork when available.
const BASE = 'https://qclay.design/lovable/pelmatech'

export const ASSETS = {
  // Hero: a person working at a computer (fits DeskMate's "computer-heavy worker").
  doctorComputer: `${BASE}/doctor-computer.png`,
  // Module carousel portraits.
  blurDoctor: `${BASE}/blur-doctor.png`,
  happyDoctor: `${BASE}/happy-doctor.png`,
  youngDoctor: `${BASE}/young-doctor.png`,
  // Benefits / problem cards (square still lifes).
  clockLamp: `${BASE}/clock-lamp.png`,
  pills: `${BASE}/pills.png`,
  waitlist: `${BASE}/waitlist.png`
} as const
