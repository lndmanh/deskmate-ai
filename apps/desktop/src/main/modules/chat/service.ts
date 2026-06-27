import type { MascotChatRequest, MascotChatResponse } from './types'

const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * Server-side mascot chat entry point.
 *
 * The renderer talks to this through IPC. When the OpenAI-compatible backend is
 * ready, set DESKMATE_CHAT_BASE_URL to its API root, for example
 * http://localhost:8787/v1. Do not include /chat/completions here; the AI SDK
 * adds the chat endpoint path through openai.chat(...). If your local backend
 * ignores Authorization, DESKMATE_CHAT_API_KEY can stay unset.
 */
export async function sendMascotChatMessage(
  request: MascotChatRequest
): Promise<MascotChatResponse> {
  const apiKey =
    process.env['DESKMATE_CHAT_API_KEY']?.trim() ||
    process.env['OPENAI_API_KEY']?.trim() ||
    'sk-noop'
  const baseURL = process.env['DESKMATE_CHAT_BASE_URL']?.trim()
  const model = process.env['DESKMATE_CHAT_MODEL']?.trim() || DEFAULT_MODEL
  const createdAt = new Date().toISOString()

  if (!baseURL) {
    return {
      message: 'I can chat once the AI backend is connected.',
      motion: 'happy',
      createdAt
    }
  }

  const [{ createOpenAI }, { generateText }] = await Promise.all([
    import('@ai-sdk/openai'),
    import('ai')
  ])

  const openai = createOpenAI({ apiKey, baseURL })
  const result = await generateText({
    model: openai.chat(model),
    system:
      'You are DeskMate, a concise, warm desktop mascot. Reply like a helpful companion, not a generic assistant.',
    prompt: request.message
  })

  return {
    message: result.text,
    motion: 'happy',
    createdAt
  }
}
