import type { MascotChatRequest, MascotChatResponse } from './types'

export async function sendMascotChatMessage(
  request: MascotChatRequest
): Promise<MascotChatResponse> {
  const baseURL = getChatBaseUrl()
  const response = await fetch(`${baseURL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question: request.message })
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(buildHttpErrorMessage(response.status, responseText))
  }

  const parsedResponse: unknown = parseJsonResponse(responseText)
  const chatResponse = parseChatResponse(parsedResponse)
  const createdAt = new Date().toISOString()

  return {
    message: chatResponse.answer,
    motion: chatResponse.used_llm ? 'happy' : 'liked',
    createdAt
  }
}

function getChatBaseUrl(): string {
  const baseURL =
    process.env['DESKMATE_LOCAL_CHAT_BASE_URL']?.trim() ||
    'http://127.0.0.1:8000'

  return baseURL.replace(/\/+$/, '')
}

function buildHttpErrorMessage(status: number, responseText: string): string {
  const trimmedResponseText = responseText.trim()

  if (trimmedResponseText.length === 0) {
    return `Mascot chat request failed with status ${status}`
  }

  return `Mascot chat request failed with status ${status}: ${trimmedResponseText}`
}

function parseJsonResponse(responseText: string): unknown {
  if (responseText.trim().length === 0) {
    throw new Error('Mascot chat response was empty')
  }

  const parsed: unknown = JSON.parse(responseText)

  return parsed
}

interface ChatBackendResponse {
  answer: string
  used_llm: boolean
  retrieved_documents: Array<{
    source: string
    title: string
    content: string
    score: number
  }>
}

function parseChatResponse(value: unknown): ChatBackendResponse {
  if (!isRecord(value)) {
    throw new Error('Mascot chat response must be an object')
  }

  if (typeof value.answer !== 'string') {
    throw new Error('Mascot chat response is missing answer')
  }

  if (typeof value.used_llm !== 'boolean') {
    throw new Error('Mascot chat response is missing used_llm')
  }

  if (!Array.isArray(value.retrieved_documents)) {
    throw new Error('Mascot chat response is missing retrieved_documents')
  }

  for (const document of value.retrieved_documents) {
    if (!isRecord(document)) {
      throw new Error('Mascot chat response contains an invalid retrieved document')
    }

    if (
      typeof document.source !== 'string' ||
      typeof document.title !== 'string' ||
      typeof document.content !== 'string' ||
      typeof document.score !== 'number'
    ) {
      throw new Error('Mascot chat response contains an invalid retrieved document')
    }
  }

  return {
    answer: value.answer,
    used_llm: value.used_llm,
    retrieved_documents: value.retrieved_documents
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
