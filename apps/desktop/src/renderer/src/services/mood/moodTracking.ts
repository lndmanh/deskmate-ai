export type MoodLabel =
  | 'good'
  | 'tired'
  | 'stressed'
  | 'focused'
  | 'distracted'
  | 'calm'
  | 'overwhelmed'
  | 'neutral'

export type MoodCheckInInput = {
  mood: MoodLabel
  energy: number
  stress: number
  note?: string
  timestampMs?: number
}

export type MoodCheckIn = {
  id: string
  timestampMs: number
  mood: MoodLabel
  energy: number
  stress: number
  note: string | null
  source: 'self_report'
  cameraEmotionDetection: false
}

export type MoodSummary = {
  totalCheckins: number
  latestMood: MoodLabel | null
  latestNote: string | null
  averageEnergy: number | null
  averageStress: number | null
  moodCounts: Partial<Record<MoodLabel, number>>
  source: 'self_report'
  cameraEmotionDetection: false
}

export type DeleteMoodHistoryResponse = {
  ok: boolean
  deleted: boolean
}

export type MoodTrackingClientOptions = {
  baseUrl?: string
  fetchClient?: typeof fetch
}

type MoodCheckInRequestBody = {
  mood: MoodLabel
  energy: number
  stress: number
  note?: string
  timestamp_ms?: number
}

type MoodCheckInApiResponse = {
  id: string
  timestamp_ms: number
  mood: MoodLabel
  energy: number
  stress: number
  note: string | null
  source: string
  camera_emotion_detection?: boolean
}

type MoodSummaryApiResponse = {
  total_checkins: number
  latest_mood: MoodLabel | null
  latest_note: string | null
  average_energy: number | null
  average_stress: number | null
  mood_counts: Partial<Record<MoodLabel, number>>
  source?: string
  camera_emotion_detection?: boolean
}

const DEFAULT_MOOD_API_BASE_URL = 'http://127.0.0.1:8000'
const MOOD_LABELS: MoodLabel[] = [
  'good',
  'tired',
  'stressed',
  'focused',
  'distracted',
  'calm',
  'overwhelmed',
  'neutral'
]

export function createMoodTrackingClient(options: MoodTrackingClientOptions = {}) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_MOOD_API_BASE_URL)
  const fetchClient = options.fetchClient ?? fetch

  return {
    checkIn(input: MoodCheckInInput): Promise<MoodCheckIn> {
      const body = buildMoodCheckInRequest(input)

      return requestJson(fetchClient, `${baseUrl}/mood/check-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }).then(parseMoodCheckInApiResponse).then(toMoodCheckIn)
    },

    recent(limit = 10): Promise<MoodCheckIn[]> {
      const searchParams = new URLSearchParams({ limit: String(limit) })

      return requestJson(
        fetchClient,
        `${baseUrl}/mood/recent?${searchParams.toString()}`
      ).then(parseMoodCheckInApiResponseList).then((items) => items.map(toMoodCheckIn))
    },

    summary(limit = 20): Promise<MoodSummary> {
      const searchParams = new URLSearchParams({ limit: String(limit) })

      return requestJson(
        fetchClient,
        `${baseUrl}/mood/summary?${searchParams.toString()}`
      ).then(parseMoodSummaryApiResponse).then(toMoodSummary)
    },

    deleteHistory(): Promise<DeleteMoodHistoryResponse> {
      return requestJson(fetchClient, `${baseUrl}/mood/history`, {
        method: 'DELETE'
      }).then(parseDeleteMoodHistoryResponse)
    }
  }
}

export function isMoodLabel(value: string): value is MoodLabel {
  return MOOD_LABELS.some((mood) => mood === value)
}

export function getMoodLabels(): MoodLabel[] {
  return [...MOOD_LABELS]
}

export function getMoodLabelText(mood: MoodLabel): string {
  const labels: Record<MoodLabel, string> = {
    good: 'Ổn/tốt',
    tired: 'Mệt',
    stressed: 'Căng thẳng',
    focused: 'Đang tập trung',
    distracted: 'Dễ xao nhãng',
    calm: 'Bình tĩnh',
    overwhelmed: 'Quá tải',
    neutral: 'Bình thường'
  }

  return labels[mood]
}

export function buildMoodPrivacyNotice(): string {
  return 'Mood là dữ liệu bạn tự check-in. DeskMate không detect cảm xúc từ camera hoặc khuôn mặt.'
}

function buildMoodCheckInRequest(input: MoodCheckInInput): MoodCheckInRequestBody {
  return {
    mood: input.mood,
    energy: clampRating(input.energy),
    stress: clampRating(input.stress),
    note: input.note?.trim() || undefined,
    timestamp_ms: input.timestampMs
  }
}

function clampRating(value: number): number {
  if (value < 1) {
    return 1
  }

  if (value > 5) {
    return 5
  }

  return Math.round(value)
}

async function requestJson(fetchClient: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetchClient(url, init)

  if (!response.ok) {
    throw new Error(await buildMoodApiErrorMessage(response))
  }

  return response.json()
}

async function buildMoodApiErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  const details = body ? ` ${body}` : ''
  return `Mood API request failed with ${response.status}.${details}`
}

function toMoodCheckIn(response: MoodCheckInApiResponse): MoodCheckIn {
  return {
    id: response.id,
    timestampMs: response.timestamp_ms,
    mood: response.mood,
    energy: response.energy,
    stress: response.stress,
    note: response.note,
    source: 'self_report',
    cameraEmotionDetection: false
  }
}

function toMoodSummary(response: MoodSummaryApiResponse): MoodSummary {
  return {
    totalCheckins: response.total_checkins,
    latestMood: response.latest_mood,
    latestNote: response.latest_note,
    averageEnergy: response.average_energy,
    averageStress: response.average_stress,
    moodCounts: response.mood_counts,
    source: 'self_report',
    cameraEmotionDetection: false
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function parseMoodCheckInApiResponse(value: unknown): MoodCheckInApiResponse {
  if (!isRecord(value)) {
    throw new Error('Mood check-in response shape is invalid.')
  }

  if (
    typeof value.id !== 'string' ||
    typeof value.timestamp_ms !== 'number' ||
    typeof value.mood !== 'string' ||
    !isMoodLabel(value.mood) ||
    typeof value.energy !== 'number' ||
    typeof value.stress !== 'number' ||
    !isNullableString(value.note) ||
    typeof value.source !== 'string'
  ) {
    throw new Error('Mood check-in response shape is invalid.')
  }

  return {
    id: value.id,
    timestamp_ms: value.timestamp_ms,
    mood: value.mood,
    energy: value.energy,
    stress: value.stress,
    note: value.note,
    source: value.source,
    camera_emotion_detection:
      typeof value.camera_emotion_detection === 'boolean' ? value.camera_emotion_detection : false
  }
}

function parseMoodCheckInApiResponseList(value: unknown): MoodCheckInApiResponse[] {
  if (!Array.isArray(value)) {
    throw new Error('Mood recent response shape is invalid.')
  }

  return value.map(parseMoodCheckInApiResponse)
}

function parseMoodSummaryApiResponse(value: unknown): MoodSummaryApiResponse {
  if (!isRecord(value)) {
    throw new Error('Mood summary response shape is invalid.')
  }

  if (
    typeof value.total_checkins !== 'number' ||
    !isNullableMoodLabel(value.latest_mood) ||
    !isNullableString(value.latest_note) ||
    !isNullableNumber(value.average_energy) ||
    !isNullableNumber(value.average_stress)
  ) {
    throw new Error('Mood summary response shape is invalid.')
  }

  return {
    total_checkins: value.total_checkins,
    latest_mood: value.latest_mood,
    latest_note: value.latest_note,
    average_energy: value.average_energy,
    average_stress: value.average_stress,
    mood_counts: parseMoodCounts(value.mood_counts),
    source: typeof value.source === 'string' ? value.source : 'self_report',
    camera_emotion_detection:
      typeof value.camera_emotion_detection === 'boolean' ? value.camera_emotion_detection : false
  }
}

function parseDeleteMoodHistoryResponse(value: unknown): DeleteMoodHistoryResponse {
  if (!isRecord(value) || typeof value.ok !== 'boolean' || typeof value.deleted !== 'boolean') {
    throw new Error('Delete mood history response shape is invalid.')
  }

  return {
    ok: value.ok,
    deleted: value.deleted
  }
}

function parseMoodCounts(value: unknown): Partial<Record<MoodLabel, number>> {
  const moodCounts: Partial<Record<MoodLabel, number>> = {}

  if (!isRecord(value)) {
    return moodCounts
  }

  for (const mood of getMoodLabels()) {
    const count = value[mood]

    if (typeof count === 'number') {
      moodCounts[mood] = count
    }
  }

  return moodCounts
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isNullableMoodLabel(value: unknown): value is MoodLabel | null {
  return value === null || (typeof value === 'string' && isMoodLabel(value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
