import type {
  DeskMateChatApiResponse,
  DeskMateRetrievedDocument,
  MascotChatContext,
  MascotChatRequest,
  MascotChatResponse
} from './types'

const DEFAULT_DESKMATE_API_BASE_URL = 'http://127.0.0.1:8000'

/**
 * Server-side mascot chat entry point.
 *
 * The renderer talks to this through IPC. The Python FastAPI backend handles
 * RAG + OpenAI, so the Electron main process only forwards the prompt to
 * /chat and returns the answer to the mascot UI.
 */
export async function sendMascotChatMessage(
  request: MascotChatRequest,
  context?: MascotChatContext
): Promise<MascotChatResponse> {
  const baseURL = process.env['DESKMATE_CHAT_BASE_URL']?.trim() || DEFAULT_DESKMATE_API_BASE_URL
  const createdAt = new Date().toISOString()

  const response = await fetch(`${trimTrailingSlash(baseURL)}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildChatApiRequest(request, context))
  })

  if (!response.ok) {
    throw new Error(await buildChatApiErrorMessage(response))
  }

  const value: unknown = await response.json()
  const apiResponse = parseDeskMateChatApiResponse(value)

  return {
    message: apiResponse.answer,
    motion: 'happy',
    createdAt
  }
}

function buildChatApiRequest(request: MascotChatRequest, context?: MascotChatContext) {
  const history = request.history?.map((message) => ({
    role: message.role,
    content: message.content
  }))

  if (!context) {
    return { question: request.message, history }
  }

  return {
    question: request.message,
    history,
    context: {
      active_time: context.activeTime,
      longest_session: context.longestSession,
      current_session_minutes: context.currentSessionMinutes,
      break_count: context.breakCount,
      extra_events: context.extraEvents
    }
  }
}

async function buildChatApiErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  const details = body ? ` ${body}` : ''
  return `DeskMate chat API request failed with ${response.status}.${details}`
}

function parseDeskMateChatApiResponse(value: unknown): DeskMateChatApiResponse {
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
    retrieved_documents: value.retrieved_documents.map(parseRetrievedDocument)
  }
}

function parseRetrievedDocument(value: unknown): DeskMateRetrievedDocument {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
