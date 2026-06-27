export type OpenAiChatRole = 'system' | 'user' | 'assistant'

export type OpenAiChatMessage = {
  role: OpenAiChatRole
  content: string
}

export type OpenAiChatOptions = {
  apiKey: string
  model?: string
  messages: OpenAiChatMessage[]
  temperature?: number
  signal?: AbortSignal
}

export type OpenAiChatResponse = {
  content: string
  model: string
  id: string
}

export type OpenAiChatStreamOptions = OpenAiChatOptions & {
  onToken: (token: string) => void
  onComplete?: (content: string) => void
}

type OpenAiTextContent = {
  type: 'text'
  text: string
}

type OpenAiMessage = {
  content?: string | OpenAiTextContent[]
}

type OpenAiChoice = {
  message?: OpenAiMessage
  delta?: {
    content?: string
  }
}

type OpenAiChatCompletion = {
  id: string
  model: string
  choices?: OpenAiChoice[]
}

type OpenAiChatCompletionChunk = {
  choices?: OpenAiChoice[]
}

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

export async function createOpenAiChatCompletion(
  options: OpenAiChatOptions
): Promise<OpenAiChatResponse> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: buildOpenAiHeaders(options.apiKey),
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OPENAI_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.4
    }),
    signal: options.signal
  })

  const data = await parseOpenAiJsonResponse(response)
  const firstChoice = data.choices?.[0]
  const content = readMessageContent(firstChoice?.message)

  if (!content) {
    throw new Error('OpenAI response did not include message content.')
  }

  return {
    content,
    model: data.model,
    id: data.id
  }
}

export async function streamOpenAiChatCompletion(
  options: OpenAiChatStreamOptions
): Promise<string> {
  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: buildOpenAiHeaders(options.apiKey),
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OPENAI_MODEL,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      stream: true
    }),
    signal: options.signal
  })

  if (!response.ok) {
    throw new Error(await buildOpenAiErrorMessage(response))
  }

  if (!response.body) {
    throw new Error('OpenAI stream response body is empty.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  while (true) {
    const result = await reader.read()

    if (result.done) {
      break
    }

    buffer += decoder.decode(result.value, { stream: true })
    const parsed = consumeSseBuffer(buffer)
    buffer = parsed.remainingBuffer

    for (const eventData of parsed.events) {
      if (eventData === '[DONE]') {
        options.onComplete?.(fullContent)
        return fullContent
      }

      const token = readStreamToken(eventData)

      if (token) {
        fullContent += token
        options.onToken(token)
      }
    }
  }

  options.onComplete?.(fullContent)
  return fullContent
}

function buildOpenAiHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
}

async function parseOpenAiJsonResponse(response: Response): Promise<OpenAiChatCompletion> {
  if (!response.ok) {
    throw new Error(await buildOpenAiErrorMessage(response))
  }

  const value: unknown = await response.json()

  if (!isOpenAiChatCompletion(value)) {
    throw new Error('OpenAI response shape is invalid.')
  }

  return value
}

async function buildOpenAiErrorMessage(response: Response): Promise<string> {
  const body = await response.text()
  const details = body ? ` ${body}` : ''
  return `OpenAI request failed with ${response.status}.${details}`
}

function consumeSseBuffer(buffer: string): { events: string[]; remainingBuffer: string } {
  const normalizedBuffer = buffer.replace(/\r\n/g, '\n')
  const chunks = normalizedBuffer.split('\n\n')
  const remainingBuffer = chunks.pop() ?? ''
  const events = chunks.flatMap(readSseEventData)

  return { events, remainingBuffer }
}

function readSseEventData(chunk: string): string[] {
  return chunk
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter((line) => line.length > 0)
}

function readStreamToken(eventData: string): string {
  try {
    const value: unknown = JSON.parse(eventData)

    if (!isOpenAiChatCompletionChunk(value)) {
      return ''
    }

    return value.choices?.[0]?.delta?.content ?? ''
  } catch {
    return ''
  }
}

function readMessageContent(message: OpenAiMessage | undefined): string {
  const content = message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .filter(isOpenAiTextContent)
      .map((item) => item.text)
      .join('')
      .trim()
  }

  return ''
}

function isOpenAiChatCompletion(value: unknown): value is OpenAiChatCompletion {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.id === 'string' && typeof value.model === 'string'
}

function isOpenAiChatCompletionChunk(value: unknown): value is OpenAiChatCompletionChunk {
  if (!isRecord(value)) {
    return false
  }

  return value.choices === undefined || Array.isArray(value.choices)
}

function isOpenAiTextContent(value: unknown): value is OpenAiTextContent {
  if (!isRecord(value)) {
    return false
  }

  return value.type === 'text' && typeof value.text === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
