export type DeskMateChatContext = {
  activeTime?: string | null
  longestSession?: string | null
  currentSessionMinutes?: number | null
  breakCount?: number | null
  postureStatus?: string | null
  postureScore?: number | null
  postureConfidence?: number | null
  postureRiskEvents?: number | null
  highRiskPeriod?: string | null
  cloudMode?: boolean
  rawImagesStored?: number
  latestMood?: string | null
  latestMoodNote?: string | null
  averageEnergy?: number | null
  averageStress?: number | null
  extraEvents?: string[]
}

export type DeskMateChatRequest = {
  question: string
  context?: DeskMateChatContext
}

export type RetrievedDocument = {
  source: string
  title: string
  content: string
  score: number
}

export type DeskMateChatResponse = {
  answer: string
  usedLlm: boolean
  retrievedDocuments: RetrievedDocument[]
}

export type DeskMateChatClientOptions = {
  baseUrl?: string
  fetchClient?: typeof fetch
}

type ChatContextApiRequest = {
  active_time?: string | null
  longest_session?: string | null
  current_session_minutes?: number | null
  break_count?: number | null
  posture_status?: string | null
  posture_score?: number | null
  posture_confidence?: number | null
  posture_risk_events?: number | null
  high_risk_period?: string | null
  cloud_mode?: boolean
  raw_images_stored?: number
  latest_mood?: string | null
  latest_mood_note?: string | null
  average_energy?: number | null
  average_stress?: number | null
  extra_events?: string[]
}

type ChatApiRequest = {
  question: string
  context?: ChatContextApiRequest
}

type RetrievedDocumentApiResponse = {
  source: string
  title: string
  content: string
  score: number
}

type ChatApiResponse = {
  answer: string
  used_llm: boolean
  retrieved_documents: RetrievedDocumentApiResponse[]
}

const DEFAULT_DESKMATE_API_BASE_URL = 'http://127.0.0.1:8000'

export function createDeskMateChatClient(options: DeskMateChatClientOptions = {}) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_DESKMATE_API_BASE_URL)
  const fetchClient = options.fetchClient ?? fetch

  return {
    sendMessage(request: DeskMateChatRequest): Promise<DeskMateChatResponse> {
      return sendDeskMateChatMessage(fetchClient, baseUrl, request)
    }
  }
}

export async function sendDeskMateChatMessage(
  fetchClient: typeof fetch,
  baseUrl: string,
  request: DeskMateChatRequest
): Promise<DeskMateChatResponse> {
  const trimmedQuestion = request.question.trim()

  if (!trimmedQuestion) {
    throw new Error('Question is required.')
  }

  const response = await fetchClient(`${trimTrailingSlash(baseUrl)}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildChatApiRequest({ ...request, question: trimmedQuestion }))
  })

  if (!response.ok) {
    throw new Error(await buildChatApiErrorMessage(response))
  }

  const value: unknown = await response.json()
  return toDeskMateChatResponse(parseChatApiResponse(value))
}

function buildChatApiRequest(request: DeskMateChatRequest): ChatApiRequest {
  return {
    question: request.question,
    context: request.context ? buildChatContextApiRequest(request.context) : undefined
  }
}

function buildChatContextApiRequest(context: DeskMateChatContext): ChatContextApiRequest {
  return {
    active_time: context.activeTime,
    longest_session: context.longestSession,
    current_session_minutes: context.currentSessionMinutes,
    break_count: context.breakCount,
    posture_status: context.postureStatus,
    posture_score: context.postureScore,
    posture_confidence: context.postureConfidence,
    posture_risk_events: context.postureRiskEvents,
    high_risk_period: context.highRiskPeriod,
    cloud_mode: context.cloudMode,
    raw_images_stored: context.rawImagesStored,
    latest_mood: context.latestMood,
    latest_mood_note: context.latestMoodNote,
    average_energy: context.averageEnergy,
    average_stress: context.averageStress,
    extra_events: context.extraEvents
  }
}

async function buildChatApiErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  const details = body ? ` ${body}` : ''
  return `DeskMate chat API request failed with ${response.status}.${details}`
}

function parseChatApiResponse(value: unknown): ChatApiResponse {
  if (!isRecord(value)) {
    throw new Error('DeskMate chat response shape is invalid.')
  }

  if (
    typeof value.answer !== 'string' ||
    typeof value.used_llm !== 'boolean' ||
    !Array.isArray(value.retrieved_documents)
  ) {
    throw new Error('DeskMate chat response shape is invalid.')
  }

  return {
    answer: value.answer,
    used_llm: value.used_llm,
    retrieved_documents: value.retrieved_documents.map(parseRetrievedDocumentApiResponse)
  }
}

function parseRetrievedDocumentApiResponse(value: unknown): RetrievedDocumentApiResponse {
  if (!isRecord(value)) {
    throw new Error('Retrieved document response shape is invalid.')
  }

  if (
    typeof value.source !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.score !== 'number'
  ) {
    throw new Error('Retrieved document response shape is invalid.')
  }

  return {
    source: value.source,
    title: value.title,
    content: value.content,
    score: value.score
  }
}

function toDeskMateChatResponse(response: ChatApiResponse): DeskMateChatResponse {
  return {
    answer: response.answer,
    usedLlm: response.used_llm,
    retrievedDocuments: response.retrieved_documents.map((document) => ({
      source: document.source,
      title: document.title,
      content: document.content,
      score: document.score
    }))
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
