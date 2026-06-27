// Frontend LLM client for the activity summary.
//
// A client built with the Vercel AI SDK lives here in the renderer and talks
// directly to the model provider. The API key is read from Vite-exposed env
// vars (set VITE_OPENAI_API_KEY to enable it). When no key is configured — or
// if the request fails for any reason — we transparently fall back to an
// on-device, deterministic summary so the UI always has something to show.
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import {
  buildLocalSummary,
  buildSummaryPrompt,
  type DailyUsage,
  type TrendPoint
} from './activity-insights'

const env = import.meta.env as Record<string, string | undefined>

const API_KEY =
  env.VITE_OPENAI_API_KEY ?? env.RENDERER_VITE_OPENAI_API_KEY ?? env.VITE_AI_API_KEY ?? ''
const MODEL = env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini'
const BASE_URL = env.VITE_OPENAI_BASE_URL

export type SummarySource = 'llm' | 'local'

export interface ActivitySummary {
  text: string
  source: SummarySource
  model?: string
  /** Present when the LLM was configured but the request failed. */
  error?: string
}

/** Whether an LLM API key is configured for the renderer. */
export function hasLlm(): boolean {
  return API_KEY.length > 0
}

export function summaryModelName(): string {
  return MODEL
}

/**
 * Generate a short, friendly recap of a day's activity. Uses the configured LLM
 * when available, otherwise an on-device summary.
 */
export async function generateActivitySummary(
  day: DailyUsage,
  trend?: TrendPoint[]
): Promise<ActivitySummary> {
  const fallback = buildLocalSummary(day, trend)

  if (!hasLlm()) {
    return { text: fallback, source: 'local' }
  }

  try {
    const provider = createOpenAI({ apiKey: API_KEY, ...(BASE_URL ? { baseURL: BASE_URL } : {}) })
    const { system, prompt } = buildSummaryPrompt(day, trend)
    const { text } = await generateText({
      model: provider(MODEL),
      system,
      prompt,
      temperature: 0.6,
      maxOutputTokens: 320
    })
    const trimmed = text.trim()
    return trimmed ? { text: trimmed, source: 'llm', model: MODEL } : { text: fallback, source: 'local' }
  } catch (error) {
    return {
      text: fallback,
      source: 'local',
      error: error instanceof Error ? error.message : 'LLM request failed'
    }
  }
}
