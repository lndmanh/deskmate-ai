// Client for the DeskMate `/report` endpoint. The response is a fixed structure
// (see service_ai/reporting/types.py); we keep these interfaces in lock-step with
// it (snake_case, matching the API) so parsing stays a single source of truth.

export type ReportScope = 'today' | '7d' | 'all'
export type Severity = 'info' | 'low' | 'medium' | 'high'
export type Priority = 'low' | 'medium' | 'high'
export type DimensionStatus = 'good' | 'warning' | 'risk' | 'unknown'
export type DataLevel = 'rich' | 'limited' | 'sparse'
export type ReportMode = 'llm' | 'fallback_local' | 'fallback_error'

export interface TrendPoint {
  label: string
  value: number
}

export interface NamedCount {
  name: string
  value: number
}

export interface MoodTimelinePoint {
  id: string | null
  timestamp_ms: number | null
  mood: string | null
  energy: number | null
  stress: number | null
  note: string | null
}

export interface MoodStats {
  total_checkins: number
  latest_mood: string | null
  latest_note: string | null
  average_energy: number | null
  average_stress: number | null
  mood_counts: Record<string, number>
  energy_trend: TrendPoint[]
  stress_trend: TrendPoint[]
  timeline: MoodTimelinePoint[]
}

export interface PostureSessionStat {
  session_id: string | null
  started_at: string | null
  ended_at: string | null
  average_score: number | null
  total_snapshots: number | null
  time_good_pct: number | null
  event_counts: Record<string, number>
}

export interface PostureStats {
  total_sessions: number
  total_snapshots: number
  average_score: number | null
  time_good_pct: number | null
  event_counts: Record<string, number>
  score_trend: TrendPoint[]
  sessions: PostureSessionStat[]
}

export interface ActivityStats {
  days_count: number
  total_active_ms: number
  total_idle_ms: number
  total_break_count: number
  longest_session_ms: number
  total_context_switches: number
  total_late_night_ms: number
  avg_active_ms_per_day: number
  by_category: NamedCount[]
  top_apps: NamedCount[]
  active_trend: TrendPoint[]
}

export interface ReportStats {
  mood: MoodStats
  posture: PostureStats
  activity: ActivityStats
}

export interface ReportMetric {
  label: string
  value: string
  hint: string | null
}

export interface ReportDimension {
  key: string
  label: string
  score: number
  grade: string
  status: DimensionStatus
  summary: string
  metrics: ReportMetric[]
}

export interface ReportFinding {
  title: string
  detail: string
  severity: Severity
  category: string
  evidence: string[]
}

export interface ReportSuggestion {
  title: string
  detail: string
  priority: Priority
  category: string
  timeframe: string | null
  effort: string | null
}

export interface DataQuality {
  level: DataLevel
  note: string
  sources_used: string[]
}

export interface AiReport {
  overall_score: number
  overall_grade: string
  overall_status: DimensionStatus
  headline: string
  summary: string
  dimensions: ReportDimension[]
  key_findings: ReportFinding[]
  correlations: string[]
  suggestions: ReportSuggestion[]
  positives: string[]
  watch_outs: string[]
  data_quality: DataQuality
  privacy_note: string
  disclaimer: string
}

export interface RagDocument {
  source: string
  title: string
  content: string
  score: number
}

export interface ReportPeriod {
  scope: ReportScope
  from_ms: number
  to_ms: number
  label: string
}

export interface ReportResponse {
  ok: boolean
  used_llm: boolean
  mode: ReportMode
  generated_at_ms: number
  period: ReportPeriod
  report: AiReport
  stats: ReportStats
  retrieved_documents: RagDocument[]
  notice: string | null
}

export interface GenerateReportInput {
  scope: ReportScope
  fromMs?: number
  toMs?: number
  referenceMs?: number
  /** Raw activity-tracker daily rollups (camelCase) — sent through verbatim. */
  activityDays?: unknown[]
}

export interface ReportClientOptions {
  baseUrl?: string
  fetchClient?: typeof fetch
}

const DEFAULT_REPORT_API_BASE_URL = 'http://127.0.0.1:8000'

export function createReportClient(options: ReportClientOptions = {}) {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_REPORT_API_BASE_URL)
  const fetchClient = options.fetchClient ?? fetch

  return {
    generateReport(input: GenerateReportInput): Promise<ReportResponse> {
      return requestReport(fetchClient, baseUrl, input)
    }
  }
}

async function requestReport(
  fetchClient: typeof fetch,
  baseUrl: string,
  input: GenerateReportInput
): Promise<ReportResponse> {
  const body = {
    scope: input.scope,
    from_ms: input.fromMs,
    to_ms: input.toMs,
    reference_ms: input.referenceMs,
    activity_days: input.activityDays ?? []
  }

  const response = await fetchClient(`${baseUrl}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    throw new Error(await buildReportApiErrorMessage(response))
  }

  return parseReportResponse(await response.json())
}

async function buildReportApiErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  const details = text ? ` ${text}` : ''
  return `DeskMate report API request failed with ${response.status}.${details}`
}

function parseReportResponse(value: unknown): ReportResponse {
  if (!isRecord(value) || !isRecord(value.report) || !isRecord(value.stats) || !isRecord(value.period)) {
    throw new Error('DeskMate report response shape is invalid.')
  }
  return value as unknown as ReportResponse
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
