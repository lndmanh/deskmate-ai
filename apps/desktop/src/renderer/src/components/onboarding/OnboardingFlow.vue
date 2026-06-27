<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Activity,
  Bell,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Camera,
  Code2,
  Eye,
  HeartPulse,
  Laptop,
  Lock,
  MessageCircle,
  Moon,
  Palette,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  ToggleLeft,
  UserRoundCog,
  UsersRound,
  Zap
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import OnboardingModal from './OnboardingModal.vue'
import OptionCard from './OptionCard.vue'
import { readStoredOnboardingFromDisk, writeStoredOnboarding, type StoredOnboardingData } from './storage'

type Option = {
  id: string
  title: string
  description?: string
  icon: unknown
  recommended?: boolean
}

type ModuleResult = {
  id: string
  name: string
  description: string
  score: number
  recommended: boolean
  enabled: boolean
  reasons: string[]
}

type OnboardingState = {
  step: number
  role?: string
  computerUsage?: string
  impactAreas: string[]
  followUps: string[]
  workPattern?: string
  interventionStyle?: string
  privacyMode?: string
  cameraConsent?: string
  moduleOverrides: Record<string, boolean>
}

type ModuleCatalogItem = {
  id: string
  name: string
  description: string
}

type UnknownRecord = Record<string, unknown>

const totalSteps = 10
const router = useRouter()

const state = reactive<OnboardingState>({
  step: 1,
  impactAreas: [],
  followUps: [],
  interventionStyle: 'balanced',
  privacyMode: 'balanced',
  cameraConsent: 'ask-first',
  moduleOverrides: {}
})

const roles: Option[] = [
  { id: 'developer', title: 'Developer / Engineer', icon: Code2 },
  { id: 'designer', title: 'Designer / Creator', icon: Palette },
  { id: 'support', title: 'Customer Support', icon: MessageCircle },
  { id: 'office', title: 'Office Worker', icon: BriefcaseBusiness },
  { id: 'manager', title: 'Manager / Team Lead', icon: UsersRound },
  { id: 'student', title: 'Student', icon: BookOpen },
  { id: 'freelancer', title: 'Freelancer / Remote Worker', icon: Laptop },
  { id: 'other', title: 'Other', icon: Sparkles }
]

const usageOptions: Option[] = [
  { id: 'under-4', title: 'Less than 4 hours', icon: TimerReset },
  { id: '4-6', title: '4-6 hours', icon: TimerReset },
  { id: '6-8', title: '6-8 hours', icon: TimerReset },
  { id: '8-10', title: '8-10 hours', icon: TimerReset },
  { id: 'over-10', title: 'More than 10 hours', icon: TimerReset },
  { id: 'varies', title: 'It varies a lot', icon: Activity }
]

const impactOptions: Option[] = [
  {
    id: 'physical',
    title: 'Physical health',
    description: 'Eye strain, neck or shoulder tension, back discomfort, low movement.',
    icon: HeartPulse
  },
  {
    id: 'mental',
    title: 'Mental & emotional state',
    description: 'Stress, tiredness, irritability, feeling overloaded.',
    icon: Brain
  },
  {
    id: 'focus',
    title: 'Focus & energy',
    description: 'Low focus, low energy, working long but feeling ineffective.',
    icon: Target
  },
  {
    id: 'rhythm',
    title: 'Work rhythm & breaks',
    description: 'Forgetting breaks, working too long continuously, late-night work.',
    icon: TimerReset
  },
  {
    id: 'communication',
    title: 'Communication & notifications',
    description: 'Meetings, messages, and notifications creating pressure.',
    icon: Bell
  },
  {
    id: 'recovery',
    title: 'Sleep & recovery',
    description: 'Poor sleep, waking up tired, difficulty recovering after work.',
    icon: Moon
  },
  {
    id: 'unsure',
    title: 'Not sure yet',
    description: 'I want DeskMate to help me notice patterns.',
    icon: Sparkles
  }
]

const followUpGroups: Record<string, { question: string; options: Option[] }> = {
  physical: {
    question: 'What physical issue do you notice most often?',
    options: [
      { id: 'eye-strain', title: 'Eye strain', icon: Eye },
      { id: 'neck-shoulder', title: 'Neck / shoulder tension', icon: HeartPulse },
      { id: 'back-discomfort', title: 'Back discomfort', icon: HeartPulse },
      { id: 'wrist-hand', title: 'Wrist / hand discomfort', icon: ToggleLeft },
      { id: 'head-tension', title: 'Head tension or mental heaviness', icon: Brain },
      { id: 'low-movement', title: 'Low movement / sitting too long', icon: Activity },
      { id: 'physical-unsure', title: 'Not sure', icon: Sparkles }
    ]
  },
  mental: {
    question: 'What feels closest to your usual workday state?',
    options: [
      { id: 'stressed', title: 'Easily stressed', icon: Brain },
      { id: 'overloaded', title: 'Easily overloaded', icon: Brain },
      { id: 'irritable', title: 'More irritable than usual', icon: MessageCircle },
      { id: 'mentally-tired', title: 'Mentally tired even before finishing work', icon: Moon },
      { id: 'hard-relax', title: 'Hard to relax after work', icon: Moon },
      { id: 'mood-changes', title: 'Mood changes throughout the day', icon: Activity },
      { id: 'just-tired', title: 'Not sure, just tired', icon: Sparkles }
    ]
  },
  focus: {
    question: 'What focus or energy issue happens most often?',
    options: [
      { id: 'distracted', title: 'I get distracted easily', icon: Target },
      { id: 'hard-start', title: 'It is hard to start working', icon: Activity },
      { id: 'interrupted', title: 'I get interrupted often', icon: Bell },
      { id: 'deep-crash', title: 'I deep work for too long and then crash', icon: Zap },
      { id: 'afternoon-drop', title: 'My energy drops in the afternoon', icon: Moon },
      { id: 'ineffective', title: 'I work a lot but do not feel effective', icon: TimerReset },
      { id: 'focus-unsure', title: 'Not sure', icon: Sparkles }
    ]
  },
  rhythm: {
    question: 'Which work rhythm pattern sounds most like you?',
    options: [
      { id: 'forget-breaks', title: 'I often forget to take breaks', icon: TimerReset },
      { id: 'sit-too-long', title: 'I sit for too long', icon: Activity },
      { id: 'work-through', title: 'I work through lunch or evenings', icon: Moon },
      { id: 'late-night', title: 'I often work late at night', icon: Moon },
      { id: 'breaks-not-restorative', title: 'I take breaks but do not feel recovered', icon: HeartPulse },
      { id: 'irregular-schedule', title: 'My schedule is irregular', icon: Activity },
      { id: 'rhythm-unsure', title: 'Not sure', icon: Sparkles }
    ]
  },
  communication: {
    question: 'What creates the most communication pressure?',
    options: [
      { id: 'too-many-meetings', title: 'Too many meetings', icon: UsersRound },
      { id: 'constant-messages', title: 'Constant messages', icon: MessageCircle },
      { id: 'notifications-break-focus', title: 'Notifications break my focus', icon: Bell },
      { id: 'stressful-conversations', title: 'Stressful customer or user conversations', icon: MessageCircle },
      { id: 'after-hours', title: 'After-hours messages', icon: Moon },
      { id: 'reply-pressure', title: 'I feel pressure to reply too quickly', icon: Zap },
      { id: 'communication-unsure', title: 'Not sure', icon: Sparkles }
    ]
  },
  recovery: {
    question: 'What recovery issue sounds most familiar?',
    options: [
      { id: 'not-enough-sleep', title: 'I do not sleep enough', icon: Moon },
      { id: 'still-tired', title: 'I sleep enough but still feel tired', icon: Moon },
      { id: 'hard-sleep', title: 'It is hard to sleep after intense work', icon: Brain },
      { id: 'night-affects-sleep', title: 'Late-night work affects my sleep', icon: Moon },
      { id: 'drained', title: 'I feel drained at the end of the day', icon: HeartPulse },
      { id: 'no-sleep-track', title: 'I do not track sleep, so I am not sure', icon: Sparkles }
    ]
  }
}

const workPatterns: Option[] = [
  { id: 'long-focus', title: 'I usually focus for a long time before taking a break', icon: Target },
  { id: 'frequent-interruptions', title: 'I am often interrupted by messages, meetings, or notifications', icon: Bell },
  { id: 'many-small-tasks', title: 'I switch between many small tasks during the day', icon: ToggleLeft },
  { id: 'tight-deadlines', title: 'I often work under tight deadlines', icon: Zap },
  { id: 'changing-schedule', title: 'My schedule changes a lot', icon: Activity },
  { id: 'evening-work', title: 'I often study or work in the evening or late at night', icon: Moon }
]

const interventionStyles: Option[] = [
  { id: 'gentle', title: 'Gentle', description: 'Light reminders, minimal interruptions.', icon: Sparkles },
  { id: 'balanced', title: 'Balanced', description: 'Remind me when it actually matters.', icon: ShieldCheck, recommended: true },
  { id: 'focus-first', title: 'Focus-first', description: 'Avoid interrupting me when I am focused.', icon: Target },
  { id: 'strict', title: 'Strict Self-care', description: 'Be more direct when I am overworking.', icon: HeartPulse },
  { id: 'deadline', title: 'Deadline Mode', description: 'Support intense work sessions, but keep micro-breaks.', icon: Zap },
  { id: 'report-only', title: 'Report only', description: 'Do not remind me much; summarize insights at the end of the day.', icon: BookOpen }
]

const privacyModes: Option[] = [
  { id: 'maximum', title: 'Maximum Privacy', description: 'Process only locally on this device.', icon: Lock },
  { id: 'balanced', title: 'Balanced', description: 'Local by default. Cloud features only when I allow them.', icon: ShieldCheck, recommended: true },
  { id: 'manual', title: 'Manual Only', description: 'Use only the data I enter myself.', icon: UserRoundCog }
]

const cameraOptions: Option[] = [
  { id: 'yes-local', title: 'Yes, process locally and do not save images', icon: Camera },
  { id: 'ask-first', title: 'Yes, but ask me again before turning it on', icon: ShieldCheck, recommended: true },
  { id: 'no-camera', title: 'No, use No Camera Mode', icon: Lock }
]

const moduleCatalog: ModuleCatalogItem[] = [
  { id: 'work-rhythm', name: 'Work Rhythm', description: 'Track your work rhythm and help you take breaks at the right time.' },
  { id: 'posture-body', name: 'Posture & Body', description: 'Notice long sitting sessions and posture patterns that may affect your neck, shoulders, or back.' },
  { id: 'eye-strain', name: 'Eye Strain', description: 'Help you rest your eyes and reduce screen fatigue.' },
  { id: 'focus-mode', name: 'Focus Mode', description: 'Protect focus time and reduce unnecessary interruptions.' },
  { id: 'recovery', name: 'Recovery', description: 'Track recovery signals and overwork risk after long workdays.' },
  { id: 'communication-strain', name: 'Communication Strain', description: 'Notice pressure from meetings, messages, and notifications.' },
  { id: 'mood-check-in', name: 'Mood Check-in', description: 'Lightweight check-ins to understand how your workday feels.' },
  { id: 'study-mode', name: 'Study Mode', description: 'Shape study sessions around focus and recovery.' },
  { id: 'ergonomic-reminder', name: 'Ergonomic Reminder', description: 'Suggest simple ergonomic check-ins during long sessions.' },
  { id: 'movement-break', name: 'Movement Break', description: 'Prompt low-friction movement when you have been still for too long.' },
  { id: 'meeting-fatigue', name: 'Meeting Fatigue', description: 'Notice meeting-heavy days and recovery needs.' },
  { id: 'boundary-reminder', name: 'Boundary Reminder', description: 'Help protect recovery time from after-hours work pressure.' },
  { id: 'overwork-risk', name: 'Overwork Risk', description: 'Watch for patterns that suggest you may be pushing too long.' },
  { id: 'night-work-warning', name: 'Night Work Warning', description: 'Help you notice late work that may affect recovery.' },
  { id: 'context-switching', name: 'Context Switching Insight', description: 'Summarize patterns when your day has many task switches.' }
]

const stepCopy = computed(() => {
  const copy = [
    ['Welcome to DeskMate AI', 'A private AI companion that helps you work longer hours at your computer in a healthier, more focused, and more sustainable way.'],
    ['What do you mainly use your computer for?', 'This helps DeskMate start with modules that fit your kind of work.'],
    ['On average, how long do you sit in front of your computer each day?', 'DeskMate uses this to tune break and recovery recommendations.'],
    ['When you work on your computer for a long time, what affects you the most?', `Choose up to 2 areas. ${state.impactAreas.length} of 2 selected.`],
    ['Could you tell us a little more?', 'Pick up to 3 specific patterns total. Keep it lightweight.'],
    ['Which type of workday sounds most like yours?', 'This helps DeskMate choose when and how to support you.'],
    ['How would you like DeskMate to support you?', 'This replaces separate reminder frequency and intensity setup.'],
    ['How would you like DeskMate to handle your data?', 'DeskMate does not share your data with employers and is not designed for employee monitoring.'],
    ['Would you like to use your camera for posture analysis?', 'No Camera Mode is fully supported. You can still use work rhythm, movement, and manual posture check-ins.'],
    ['DeskMate is ready to personalize your workspace', 'Based on your answers, we recommend starting with these modules.']
  ]

  return {
    title: copy[state.step - 1][0],
    description: copy[state.step - 1][1]
  }
})

const visibleFollowUpGroups = computed(() => {
  const selected = state.impactAreas.filter((id) => id !== 'unsure' && followUpGroups[id])
  return selected.length ? selected : ['physical']
})

const recommendedModules = computed(() => scoreModules())

const canContinue = computed(() => {
  if (state.step === 1 || state.step === 10) return true
  if (state.step === 2) return Boolean(state.role)
  if (state.step === 3) return Boolean(state.computerUsage)
  if (state.step === 4) return state.impactAreas.length > 0
  if (state.step === 5) return true
  if (state.step === 6) return Boolean(state.workPattern)
  if (state.step === 7) return Boolean(state.interventionStyle)
  if (state.step === 8) return Boolean(state.privacyMode)
  if (state.step === 9) return Boolean(state.cameraConsent)
  return true
})

watch(
  recommendedModules,
  (modules) => {
    for (const module of modules) {
      if (state.moduleOverrides[module.id] === undefined) {
        state.moduleOverrides[module.id] = module.enabled
      }
    }
  },
  { immediate: true }
)

watch(
  state,
  () => {
    persistOnboarding(false)
  },
  { deep: true }
)

onMounted(async () => {
  hydrateStoredOnboarding(await readStoredOnboardingFromDisk())
})

function hydrateStoredOnboarding(stored: StoredOnboardingData | null) {
  if (!stored) return

  if (stored.completed) {
    router.replace({ name: 'home' })
    return
  }

  if (!isUnknownRecord(stored.state)) return

  state.step = clampStep(stored.state.step)
  state.role = typeof stored.state.role === 'string' ? stored.state.role : undefined
  state.computerUsage = typeof stored.state.computerUsage === 'string' ? stored.state.computerUsage : undefined
  state.impactAreas = Array.isArray(stored.state.impactAreas) ? stored.state.impactAreas.filter(isString) : []
  state.followUps = Array.isArray(stored.state.followUps) ? stored.state.followUps.filter(isString) : []
  state.workPattern = typeof stored.state.workPattern === 'string' ? stored.state.workPattern : undefined
  state.interventionStyle = typeof stored.state.interventionStyle === 'string' ? stored.state.interventionStyle : 'balanced'
  state.privacyMode = typeof stored.state.privacyMode === 'string' ? stored.state.privacyMode : 'balanced'
  state.cameraConsent = typeof stored.state.cameraConsent === 'string' ? stored.state.cameraConsent : 'ask-first'
  state.moduleOverrides = isBooleanRecord(stored.state.moduleOverrides) ? { ...stored.state.moduleOverrides } : {}
}

function persistOnboarding(completed: boolean) {
  const now = new Date().toISOString()

  writeStoredOnboarding({
    version: 1,
    completed,
    updatedAt: now,
    completedAt: completed ? now : undefined,
    state: {
      step: state.step,
      role: state.role,
      computerUsage: state.computerUsage,
      impactAreas: [...state.impactAreas],
      followUps: [...state.followUps],
      workPattern: state.workPattern,
      interventionStyle: state.interventionStyle,
      privacyMode: state.privacyMode,
      cameraConsent: state.cameraConsent,
      moduleOverrides: { ...state.moduleOverrides }
    },
    modules: recommendedModules.value.map((module) => ({
      id: module.id,
      name: module.name,
      score: module.score,
      recommended: module.recommended,
      enabled: module.enabled,
      reasons: module.reasons
    }))
  })
}

function completeOnboarding() {
  persistOnboarding(true)
  router.replace({ name: 'home' })
}

function clampStep(step: unknown) {
  if (typeof step !== 'number' || !Number.isFinite(step)) return 1
  return Math.min(totalSteps, Math.max(1, Math.round(step)))
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((item) => typeof item === 'boolean')
}

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function next() {
  if (!canContinue.value) return
  if (state.step < totalSteps) state.step += 1
}

function back() {
  if (state.step > 1) state.step -= 1
}

function skipCamera() {
  state.cameraConsent = 'no-camera'
  next()
}

function toggleImpact(id: string) {
  if (state.impactAreas.includes(id)) {
    state.impactAreas = state.impactAreas.filter((item) => item !== id)
    return
  }

  if (id === 'unsure') {
    state.impactAreas = ['unsure']
    return
  }

  state.impactAreas = state.impactAreas.filter((item) => item !== 'unsure')
  if (state.impactAreas.length < 2) state.impactAreas.push(id)
}

function toggleFollowUp(id: string) {
  if (state.followUps.includes(id)) {
    state.followUps = state.followUps.filter((item) => item !== id)
    return
  }
  if (state.followUps.length < 3) state.followUps.push(id)
}

function toggleModule(id: string) {
  const current = state.moduleOverrides[id] ?? recommendedModules.value.find((module) => module.id === id)?.enabled ?? false
  state.moduleOverrides[id] = !current
}

function moduleIcon(id: string) {
  if (id.includes('posture') || id.includes('ergonomic') || id.includes('movement')) return HeartPulse
  if (id.includes('eye')) return Eye
  if (id.includes('focus') || id.includes('context')) return Target
  if (id.includes('communication') || id.includes('meeting') || id.includes('boundary')) return MessageCircle
  if (id.includes('recovery') || id.includes('night') || id.includes('overwork')) return Moon
  if (id.includes('mood')) return Brain
  if (id.includes('study')) return BookOpen
  return TimerReset
}

function addScore(scores: Record<string, number>, reasons: Record<string, string[]>, id: string, value: number, reason: string) {
  scores[id] = (scores[id] ?? 0) + value
  reasons[id] ??= []
  if (!reasons[id].includes(reason)) reasons[id].push(reason)
}

function scoreModules(): ModuleResult[] {
  const scores: Record<string, number> = {}
  const reasons: Record<string, string[]> = {}

  const score = (id: string, value: number, reason: string) => addScore(scores, reasons, id, value, reason)

  if (state.role === 'developer') {
    score('work-rhythm', 2, 'Recommended because developer work often benefits from healthy work rhythm.')
    score('focus-mode', 2, 'Recommended because focused technical work needs protected focus time.')
    score('posture-body', 1, 'Recommended because long desk sessions can affect posture patterns.')
  }
  if (state.role === 'designer') {
    score('eye-strain', 2, 'Recommended because visual work can create screen fatigue.')
    score('posture-body', 1, 'Recommended because creative work often involves long seated sessions.')
    score('work-rhythm', 1, 'Recommended to support sustainable creative sessions.')
  }
  if (state.role === 'support') {
    score('communication-strain', 2, 'Recommended because support work can create message and conversation pressure.')
    score('mood-check-in', 1, 'Recommended to understand how customer conversations feel.')
    score('focus-mode', 1, 'Recommended to protect focus between conversations.')
  }
  if (state.role === 'manager') {
    score('communication-strain', 2, 'Recommended because leadership work often includes communication pressure.')
    score('meeting-fatigue', 2, 'Recommended because meeting-heavy days can affect recovery.')
    score('recovery', 1, 'Recommended to watch recovery after demanding workdays.')
  }
  if (state.role === 'student') {
    score('study-mode', 2, 'Recommended because you use your computer for studying.')
    score('eye-strain', 1, 'Recommended to reduce screen fatigue during study sessions.')
    score('work-rhythm', 1, 'Recommended to pace study blocks.')
  }
  if (state.role === 'freelancer') {
    score('work-rhythm', 2, 'Recommended because flexible work benefits from adaptive rhythm support.')
    score('focus-mode', 1, 'Recommended to protect focused solo work.')
    score('recovery', 1, 'Recommended to avoid drifting into overwork.')
  }

  if (state.computerUsage === '6-8') {
    score('work-rhythm', 2, 'Recommended because you work 6-8 hours at the computer.')
    score('eye-strain', 1, 'Recommended because longer screen time can strain your eyes.')
  }
  if (state.computerUsage === '8-10') {
    score('work-rhythm', 2, 'Recommended because you work 8-10 hours a day.')
    score('posture-body', 2, 'Recommended because long sitting sessions can affect your body.')
    score('eye-strain', 2, 'Recommended because long screen time can create eye fatigue.')
    score('recovery', 1, 'Recommended to support recovery after long workdays.')
  }
  if (state.computerUsage === 'over-10') {
    score('work-rhythm', 3, 'Recommended because you work more than 10 hours at the computer.')
    score('recovery', 3, 'Recommended because very long workdays need recovery support.')
    score('posture-body', 2, 'Recommended because long sitting sessions can affect posture patterns.')
    score('eye-strain', 2, 'Recommended because very long screen time can fatigue your eyes.')
    score('overwork-risk', 2, 'Recommended because very long workdays can increase overwork risk.')
  }
  if (state.computerUsage === 'varies') score('work-rhythm', 2, 'Recommended because your schedule varies a lot.')

  for (const area of state.impactAreas) {
    if (area === 'physical') {
      score('posture-body', 2, 'Recommended because you selected physical health.')
      score('eye-strain', 2, 'Recommended because physical strain can include screen fatigue.')
      score('work-rhythm', 1, 'Recommended because breaks can reduce physical strain.')
    }
    if (area === 'mental') {
      score('mood-check-in', 2, 'Recommended because you selected mental and emotional state.')
      score('recovery', 2, 'Recommended because recovery can help with emotional overload.')
    }
    if (area === 'focus') {
      score('focus-mode', 2, 'Recommended because you selected focus and energy.')
      score('work-rhythm', 1, 'Recommended because work rhythm affects focus.')
      score('recovery', 1, 'Recommended because recovery affects energy.')
    }
    if (area === 'rhythm') {
      score('work-rhythm', 3, 'Recommended because you selected work rhythm and breaks.')
      score('recovery', 1, 'Recommended because break patterns affect recovery.')
    }
    if (area === 'communication') {
      score('communication-strain', 3, 'Recommended because you selected communication and notifications.')
      score('focus-mode', 2, 'Recommended because notifications can break focus.')
    }
    if (area === 'recovery') {
      score('recovery', 3, 'Recommended because you selected sleep and recovery.')
      score('mood-check-in', 1, 'Recommended because recovery and workday mood are connected.')
    }
  }

  for (const followUp of state.followUps) {
    if (followUp === 'eye-strain') score('eye-strain', 3, 'Recommended because you selected eye strain.')
    if (followUp === 'neck-shoulder') score('posture-body', 3, 'Recommended because you selected neck / shoulder tension.')
    if (followUp === 'back-discomfort') {
      score('posture-body', 2, 'Recommended because you selected back discomfort.')
      score('work-rhythm', 1, 'Recommended because breaks can help with long sitting patterns.')
    }
    if (followUp === 'wrist-hand') score('ergonomic-reminder', 3, 'Recommended because you selected wrist / hand discomfort.')
    if (followUp === 'head-tension') {
      score('eye-strain', 2, 'Recommended because head tension can be connected to screen fatigue.')
      score('recovery', 1, 'Recommended because head heaviness can signal recovery needs.')
    }
    if (followUp === 'low-movement') {
      score('work-rhythm', 2, 'Recommended because you selected low movement.')
      score('movement-break', 3, 'Recommended because you sit or stay still for long periods.')
    }
    if (['stressed', 'overloaded', 'irritable', 'mood-changes', 'just-tired'].includes(followUp)) {
      score('mood-check-in', 2, 'Recommended because you selected workday emotional strain.')
      score('recovery', 1, 'Recommended because emotional strain can affect recovery.')
    }
    if (['distracted', 'hard-start', 'interrupted', 'notifications-break-focus'].includes(followUp)) score('focus-mode', 3, 'Recommended because you selected focus interruptions.')
    if (followUp === 'deep-crash') {
      score('work-rhythm', 2, 'Recommended because long focus sessions can benefit from rhythm support.')
      score('recovery', 2, 'Recommended because you selected focus crashes.')
    }
    if (followUp === 'forget-breaks') score('work-rhythm', 3, 'Recommended because you often forget to take breaks.')
    if (followUp === 'sit-too-long') {
      score('work-rhythm', 2, 'Recommended because you sit too long.')
      score('posture-body', 2, 'Recommended because long sitting can affect posture patterns.')
    }
    if (['late-night', 'night-affects-sleep'].includes(followUp)) {
      score('recovery', 2, 'Recommended because late-night work can affect recovery.')
      score('night-work-warning', 3, 'Recommended because you often work late.')
    }
    if (['too-many-meetings', 'constant-messages', 'stressful-conversations', 'reply-pressure'].includes(followUp)) score('communication-strain', 3, 'Recommended because you selected communication pressure.')
    if (followUp === 'too-many-meetings') score('meeting-fatigue', 3, 'Recommended because meeting-heavy days can affect recovery.')
    if (followUp === 'after-hours') {
      score('boundary-reminder', 3, 'Recommended because after-hours messages affect boundaries.')
      score('recovery', 1, 'Recommended because boundaries protect recovery.')
    }
    if (['not-enough-sleep', 'still-tired', 'hard-sleep', 'drained'].includes(followUp)) score('recovery', 3, 'Recommended because you selected recovery strain.')
  }

  if (state.workPattern === 'frequent-interruptions') {
    score('communication-strain', 2, 'Recommended because your day includes frequent interruptions.')
    score('focus-mode', 2, 'Recommended because interruptions can break focus.')
  }
  if (state.workPattern === 'many-small-tasks') score('context-switching', 3, 'Recommended because you switch between many small tasks.')
  if (state.workPattern === 'tight-deadlines') score('work-rhythm', 2, 'Recommended because deadline work still needs micro-breaks.')
  if (state.workPattern === 'evening-work') {
    score('recovery', 2, 'Recommended because evening work can affect recovery.')
    score('night-work-warning', 2, 'Recommended because you often work at night.')
  }

  return moduleCatalog
    .map((module) => {
      const scoreValue = scores[module.id] ?? 0
      const recommended = scoreValue >= 5
      const optional = scoreValue >= 3
      const defaultEnabled = recommended && !(state.privacyMode === 'manual' && module.id === 'posture-body') && !(state.cameraConsent === 'no-camera' && module.id === 'posture-body')
      const enabled = state.moduleOverrides[module.id] ?? defaultEnabled
      return {
        id: module.id,
        name: module.name,
        description: module.description,
        score: scoreValue,
        recommended,
        enabled,
        reasons: reasons[module.id] ?? ['Suggested as a helpful starting point for healthier computer work.'],
        optional
      }
    })
    .filter((module) => module.recommended || module.optional)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}
</script>

<template>
  <OnboardingModal
    :step="state.step"
    :total-steps="totalSteps"
    :title="stepCopy.title"
    :description="stepCopy.description"
    :can-continue="canContinue"
    :show-back="state.step > 1"
    :show-skip="state.step === 9"
    :show-continue="state.step < 10"
    :continue-label="state.step === 1 ? 'Start personalization' : state.step === 10 ? 'Enable recommended modules' : 'Continue'"
    @back="back"
    @continue="next"
    @skip="skipCamera"
  >
    <div v-if="state.step === 1" class="grid min-h-[360px] grid-cols-1 items-center gap-8 md:grid-cols-[1fr_240px]">
      <div>
        <div class="inline-flex items-center gap-2 rounded-full border border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel-soft)] px-3 py-1.5 text-sm font-semibold text-[color:var(--onboarding-teal)]">
          <ShieldCheck class="size-4" />
          Private by design
        </div>
        <p class="mt-6 max-w-xl text-[15px] leading-7 text-[color:var(--onboarding-muted)]">
          Personalize your setup in about 2 minutes. DeskMate helps you notice work rhythm, focus, recovery, and strain patterns without turning your workspace into a monitoring dashboard.
        </p>
      </div>
      <div class="grid aspect-square place-items-center rounded-[22px] border border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel)]">
        <div class="relative grid size-36 place-items-center rounded-[36px] bg-[color:var(--onboarding-accent-soft)]">
          <Laptop class="size-16 text-[color:var(--onboarding-teal)]" />
          <Sparkles class="absolute right-8 top-7 size-5 text-[color:var(--onboarding-accent)]" />
          <Moon class="absolute bottom-8 left-8 size-5 text-[color:var(--onboarding-teal)]" />
        </div>
      </div>
    </div>

    <div v-else-if="state.step === 2" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <OptionCard v-for="option in roles" :key="option.id" :title="option.title" :selected="state.role === option.id" @click="state.role = option.id">
        <template #icon><component :is="option.icon" class="size-5" /></template>
      </OptionCard>
    </div>

    <div v-else-if="state.step === 3" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <OptionCard v-for="option in usageOptions" :key="option.id" :title="option.title" :selected="state.computerUsage === option.id" @click="state.computerUsage = option.id">
        <template #icon><component :is="option.icon" class="size-5" /></template>
      </OptionCard>
    </div>

    <div v-else-if="state.step === 4" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <OptionCard
        v-for="option in impactOptions"
        :key="option.id"
        :title="option.title"
        :description="option.description"
        :selected="state.impactAreas.includes(option.id)"
        :disabled="!state.impactAreas.includes(option.id) && state.impactAreas.length >= 2 && option.id !== 'unsure'"
        @click="toggleImpact(option.id)"
      >
        <template #icon><component :is="option.icon" class="size-5" /></template>
      </OptionCard>
    </div>

    <div v-else-if="state.step === 5" class="grid gap-4" :class="visibleFollowUpGroups.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'">
      <section v-for="groupId in visibleFollowUpGroups" :key="groupId" class="rounded-[20px] border border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel-soft)] p-4">
        <h2 class="break-words text-[16px] font-semibold leading-6 text-[color:var(--onboarding-text)]">{{ followUpGroups[groupId].question }}</h2>
        <div class="mt-4 grid gap-2">
          <OptionCard
            v-for="option in followUpGroups[groupId].options"
            :key="option.id"
            :title="option.title"
            compact
            :selected="state.followUps.includes(option.id)"
            :disabled="!state.followUps.includes(option.id) && state.followUps.length >= 3"
            @click="toggleFollowUp(option.id)"
          >
            <template #icon><component :is="option.icon" class="size-4" /></template>
          </OptionCard>
        </div>
      </section>
    </div>

    <div v-else-if="state.step === 6" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <OptionCard v-for="option in workPatterns" :key="option.id" :title="option.title" :selected="state.workPattern === option.id" @click="state.workPattern = option.id">
        <template #icon><component :is="option.icon" class="size-5" /></template>
      </OptionCard>
    </div>

    <div v-else-if="state.step === 7" class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <OptionCard
        v-for="option in interventionStyles"
        :key="option.id"
        :title="option.title"
        :description="option.description"
        :recommended="option.recommended"
        :selected="state.interventionStyle === option.id"
        @click="state.interventionStyle = option.id"
      >
        <template #icon><component :is="option.icon" class="size-5" /></template>
      </OptionCard>
    </div>

    <div v-else-if="state.step === 8" class="grid gap-3">
      <OptionCard
        v-for="option in privacyModes"
        :key="option.id"
        :title="option.title"
        :description="option.description"
        :recommended="option.recommended"
        :selected="state.privacyMode === option.id"
        @click="state.privacyMode = option.id"
      >
        <template #icon><component :is="option.icon" class="size-5" /></template>
      </OptionCard>
    </div>

    <div v-else-if="state.step === 9" class="grid grid-cols-1 gap-5 md:grid-cols-[1fr_260px]">
      <div class="grid gap-3">
        <OptionCard
          v-for="option in cameraOptions"
          :key="option.id"
          :title="option.title"
          :recommended="option.recommended"
          :selected="state.cameraConsent === option.id"
          @click="state.cameraConsent = option.id"
        >
          <template #icon><component :is="option.icon" class="size-5" /></template>
        </OptionCard>
      </div>
      <Card class="rounded-[20px] border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel)] py-0">
        <CardContent class="p-5">
          <ShieldCheck class="size-7 text-[color:var(--onboarding-teal)]" />
          <p class="mt-4 text-sm leading-6 text-[color:var(--onboarding-muted)]">
            DeskMate does not store raw webcam frames. The camera is only used to create posture signals such as long sitting, neck angle, screen distance, or signs that you may need to change position.
          </p>
        </CardContent>
      </Card>
    </div>

    <div v-else class="space-y-5">
      <div class="grid max-h-[320px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
        <Button
          v-for="module in recommendedModules"
          :key="module.id"
          type="button"
          variant="ghost"
          class="h-auto !whitespace-normal justify-start rounded-[18px] p-0 text-left text-[color:var(--onboarding-text)] hover:bg-transparent focus-visible:ring-[color:var(--onboarding-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--onboarding-ring-offset)]"
          @click="toggleModule(module.id)"
        >
          <Card class="w-full rounded-[18px] border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel)] py-0 transition hover:border-[color:var(--onboarding-accent-muted)] hover:bg-[color:var(--onboarding-panel-hover)]">
            <CardContent class="p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex gap-3">
                  <div class="grid size-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--onboarding-icon-bg)] text-[color:var(--onboarding-teal)]">
                    <component :is="moduleIcon(module.id)" class="size-5" />
                  </div>
                  <div>
                    <p class="break-words font-semibold !text-[color:var(--onboarding-text)]">{{ module.name }}</p>
                    <p class="mt-1 break-words text-sm leading-5 !text-[color:var(--onboarding-muted)]">{{ module.description }}</p>
                    <p class="mt-3 break-words text-xs leading-5 !text-[color:var(--onboarding-teal)]">{{ module.reasons[0] }}</p>
                  </div>
                </div>
                <div class="grid h-6 w-11 shrink-0 place-items-center rounded-full transition" :class="module.enabled ? 'bg-[color:var(--onboarding-accent)]' : 'bg-[color:var(--onboarding-track)]'">
                  <span class="size-4 rounded-full bg-white transition" :class="module.enabled ? 'translate-x-2' : '-translate-x-2'" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Button>
      </div>
      <div class="flex flex-wrap gap-3">
        <Button class="rounded-xl bg-[color:var(--onboarding-accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[color:var(--onboarding-accent-hover)] focus-visible:ring-[color:var(--onboarding-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--onboarding-ring-offset)]" @click="completeOnboarding">Enable recommended modules</Button>
        <Button variant="outline" class="rounded-xl border-[color:var(--onboarding-border)] bg-[color:var(--onboarding-panel-soft)] px-5 py-3 text-sm font-semibold text-[color:var(--onboarding-text)] hover:bg-[color:var(--onboarding-panel-hover)] hover:text-[color:var(--onboarding-text)] focus-visible:ring-[color:var(--onboarding-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--onboarding-ring-offset)]" @click="completeOnboarding">Customize manually</Button>
        <Button variant="ghost" class="rounded-xl px-5 py-3 text-sm font-semibold text-[color:var(--onboarding-teal)] hover:bg-[color:var(--onboarding-panel-soft)] hover:text-[color:var(--onboarding-teal)] focus-visible:ring-[color:var(--onboarding-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--onboarding-ring-offset)]" @click="completeOnboarding">Review privacy settings</Button>
      </div>
    </div>
  </OnboardingModal>
</template>
