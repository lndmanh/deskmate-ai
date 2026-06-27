// Local, bundled assets — the site is fully self-contained (no remote hotlinks).
// The doctor portraits in the modules carousel are placeholders; swap them for
// DeskMate module artwork here.
import doctorComputer from '@/assets/doctor-computer.png'
import blurDoctor from '@/assets/blur-doctor.png'
import happyDoctor from '@/assets/happy-doctor.png'
import youngDoctor from '@/assets/young-doctor.png'
import clockLamp from '@/assets/clock-lamp.png'
import pills from '@/assets/pills.png'
import waitlist from '@/assets/waitlist.png'

export const ASSETS = {
  doctorComputer,
  blurDoctor,
  happyDoctor,
  youngDoctor,
  clockLamp,
  pills,
  waitlist
} as const
