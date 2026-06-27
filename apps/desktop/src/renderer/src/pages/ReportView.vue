<script setup lang="ts">
import {
  Activity,
  Armchair,
  ArrowLeft,
  BookOpen,
  ChartColumn,
  ChartLine,
  ChartPie,
  CircleCheck,
  Database,
  Gauge,
  Info,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Smile,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert
} from '@lucide/vue'
import { computed, onMounted, type Component } from 'vue'
import { RouterLink } from 'vue-router'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useReport } from '@/composables/useReport'
import {
  activeTrendOption,
  categoryOption,
  moodDistributionOption,
  moodTrendOption,
  overallGaugeOption,
  postureEventsOption,
  postureScoreOption,
  readReportChartTheme,
  topAppsOption,
  VChart
} from '@/lib/report-charts'
import type { DimensionStatus, Priority, ReportScope, Severity } from '@/services/report'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'

const { report, loading, error, scope, generate } = useReport()

const scopeOptions: { value: ReportScope; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: 'all', label: 'All time' }
]

function statusVariant(status: DimensionStatus): BadgeVariant {
  if (status === 'good') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'risk') return 'destructive'
  return 'secondary'
}

function statusColor(status: DimensionStatus): string {
  if (status === 'good') return '#22c55e'
  if (status === 'warning') return '#f59e0b'
  if (status === 'risk') return '#ef4444'
  return '#a1a1aa'
}

function severityVariant(severity: Severity): BadgeVariant {
  if (severity === 'high') return 'destructive'
  if (severity === 'medium') return 'warning'
  if (severity === 'low') return 'secondary'
  return 'outline'
}

function severityColor(severity: Severity): string {
  if (severity === 'high') return '#ef4444'
  if (severity === 'medium') return '#f59e0b'
  if (severity === 'low') return '#a1a1aa'
  return '#6366f1'
}

function priorityVariant(priority: Priority): BadgeVariant {
  if (priority === 'high') return 'destructive'
  if (priority === 'medium') return 'warning'
  return 'secondary'
}

function qualityVariant(level: string): BadgeVariant {
  if (level === 'rich') return 'success'
  if (level === 'sparse') return 'destructive'
  return 'secondary'
}

function dimensionIcon(key: string): Component {
  if (key === 'posture') return Armchair
  if (key === 'activity') return Activity
  if (key === 'mood') return Smile
  return Target
}

function severityIcon(severity: Severity): Component {
  return severity === 'high' || severity === 'medium' ? TriangleAlert : Info
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString()
}

const theme = (): ReturnType<typeof readReportChartTheme> => readReportChartTheme()

const gaugeOption = computed(() =>
  report.value ? overallGaugeOption(report.value.report.overall_score, theme()) : null
)
const moodTrendOpt = computed(() =>
  report.value
    ? moodTrendOption(report.value.stats.mood.energy_trend, report.value.stats.mood.stress_trend, theme())
    : null
)
const moodDistOpt = computed(() =>
  report.value ? moodDistributionOption(report.value.stats.mood.mood_counts, theme()) : null
)
const postureScoreOpt = computed(() =>
  report.value ? postureScoreOption(report.value.stats.posture.score_trend, theme()) : null
)
const postureEventsOpt = computed(() =>
  report.value ? postureEventsOption(report.value.stats.posture.event_counts, theme()) : null
)
const categoryOpt = computed(() =>
  report.value ? categoryOption(report.value.stats.activity.by_category, theme()) : null
)
const topAppsOpt = computed(() =>
  report.value ? topAppsOption(report.value.stats.activity.top_apps, theme()) : null
)
const activeTrendOpt = computed(() =>
  report.value ? activeTrendOption(report.value.stats.activity.active_trend, theme()) : null
)

const hasMood = computed(() => !!report.value && report.value.stats.mood.total_checkins > 0)
const hasPosture = computed(() => !!report.value && report.value.stats.posture.total_sessions > 0)
const hasActivity = computed(() => !!report.value && report.value.stats.activity.days_count > 0)
const hasAnyChart = computed(() => hasMood.value || hasPosture.value || hasActivity.value)
const moodCountKeys = computed(() =>
  report.value ? Object.keys(report.value.stats.mood.mood_counts) : []
)
const postureEventKeys = computed(() =>
  report.value ? Object.keys(report.value.stats.posture.event_counts) : []
)
const statsJson = computed(() => (report.value ? JSON.stringify(report.value.stats, null, 2) : ''))

onMounted(() => {
  void generate()
})
</script>

<template>
  <main class="h-full overflow-y-auto bg-background">
    <div class="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <!-- Header -->
      <header class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to home" as-child>
            <RouterLink to="/home"><ArrowLeft class="size-4" /></RouterLink>
          </Button>
          <div class="flex flex-col gap-0.5">
            <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Gauge class="size-6 text-primary" /> Desk Health Report
            </h1>
            <p class="text-sm text-muted-foreground">
              A comprehensive AI analysis of your posture, work rhythm and mood.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="inline-flex rounded-lg border bg-card p-1">
            <Button
              v-for="option in scopeOptions"
              :key="option.value"
              size="sm"
              :variant="scope === option.value ? 'secondary' : 'ghost'"
              :disabled="loading"
              @click="generate(option.value)"
            >
              {{ option.label }}
            </Button>
          </div>
          <Button variant="outline" size="sm" :disabled="loading" @click="generate()">
            <RefreshCw class="size-4" :class="loading ? 'animate-spin' : ''" />
            {{ loading ? 'Generating…' : 'Regenerate' }}
          </Button>
        </div>

        <!-- Status row -->
        <div
          v-if="report"
          class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        >
          <Badge :variant="report.used_llm ? 'default' : 'secondary'" class="gap-1">
            <Sparkles class="size-3" /> {{ report.used_llm ? 'AI analysis' : 'Local analysis' }}
          </Badge>
          <Badge variant="outline">{{ report.period.label }}</Badge>
          <Badge :variant="qualityVariant(report.report.data_quality.level)" class="capitalize">
            Data: {{ report.report.data_quality.level }}
          </Badge>
          <span>Generated {{ formatDateTime(report.generated_at_ms) }}</span>
        </div>

        <div
          v-if="report?.notice"
          class="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground"
        >
          <Info class="size-4 shrink-0" />{{ report.notice }}
        </div>
        <div v-if="error && report" class="text-xs text-destructive">{{ error }}</div>
      </header>

      <!-- Loading skeleton (first load) -->
      <div v-if="loading && !report" class="flex flex-col gap-4">
        <Skeleton class="h-52 w-full rounded-xl" />
        <div class="grid gap-4 sm:grid-cols-3">
          <Skeleton v-for="i in 3" :key="i" class="h-44 rounded-xl" />
        </div>
        <Skeleton class="h-64 w-full rounded-xl" />
      </div>

      <!-- Error (no report to show) -->
      <Card v-else-if="error && !report" class="flex flex-col items-center gap-3 p-8 text-center">
        <TriangleAlert class="size-8 text-destructive" />
        <p class="font-medium">Couldn't generate the report</p>
        <p class="max-w-md text-sm text-muted-foreground">{{ error }}</p>
        <p class="text-xs text-muted-foreground">
          Make sure the DeskMate API is running at 127.0.0.1:8000.
        </p>
        <Button class="mt-1" @click="generate()">Try again</Button>
      </Card>

      <!-- Report -->
      <div v-else-if="report" class="flex flex-col gap-6">
        <!-- Hero -->
        <section
          v-if="report.report.dimensions.length"
          class="grid gap-4 lg:grid-cols-[300px_1fr]"
        >
          <Card class="flex flex-col items-center justify-center gap-2 p-6">
            <VChart v-if="gaugeOption" :option="gaugeOption" autoresize class="h-48 w-full" />
            <div class="flex items-center gap-2">
              <Badge :variant="statusVariant(report.report.overall_status)">
                Grade {{ report.report.overall_grade }}
              </Badge>
              <span class="text-sm capitalize text-muted-foreground">
                {{ report.report.overall_status }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">Overall desk-health score</p>
          </Card>
          <Card class="flex flex-col justify-center gap-3 p-6">
            <h2 class="text-xl font-semibold leading-snug">{{ report.report.headline }}</h2>
            <p class="text-sm leading-relaxed text-muted-foreground">{{ report.report.summary }}</p>
            <div class="flex flex-wrap gap-1.5">
              <Badge
                v-for="source in report.report.data_quality.sources_used"
                :key="source"
                variant="secondary"
                class="capitalize"
              >
                {{ source }}
              </Badge>
            </div>
          </Card>
        </section>
        <Card v-else class="flex flex-col items-center gap-3 p-10 text-center">
          <Database class="size-10 text-muted-foreground" />
          <h2 class="text-lg font-medium">{{ report.report.headline }}</h2>
          <p class="max-w-md text-sm text-muted-foreground">{{ report.report.summary }}</p>
        </Card>

        <!-- Dimension ratings -->
        <section
          v-if="report.report.dimensions.length"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Card
            v-for="dimension in report.report.dimensions"
            :key="dimension.key"
            class="flex flex-col gap-3 p-5"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <component :is="dimensionIcon(dimension.key)" class="size-4 text-muted-foreground" />
                <h3 class="font-medium">{{ dimension.label }}</h3>
              </div>
              <Badge :variant="statusVariant(dimension.status)">{{ dimension.grade }}</Badge>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-3xl font-semibold" :style="{ color: statusColor(dimension.status) }">
                {{ dimension.score }}
              </span>
              <span class="text-sm text-muted-foreground">/100</span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full transition-all"
                :style="{ width: `${dimension.score}%`, backgroundColor: statusColor(dimension.status) }"
              />
            </div>
            <p class="text-sm text-muted-foreground">{{ dimension.summary }}</p>
            <dl class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div
                v-for="metric in dimension.metrics"
                :key="metric.label"
                class="flex justify-between gap-2"
              >
                <dt class="text-muted-foreground">{{ metric.label }}</dt>
                <dd class="text-right font-medium">{{ metric.value }}</dd>
              </div>
            </dl>
          </Card>
        </section>

        <!-- Charts -->
        <section v-if="hasAnyChart" class="grid gap-4 lg:grid-cols-2">
          <Card
            v-if="hasMood && report.stats.mood.energy_trend.length"
            class="flex flex-col gap-3 p-5"
          >
            <h3 class="flex items-center gap-2 font-medium">
              <ChartLine class="size-4 text-muted-foreground" /> Mood — energy &amp; stress
            </h3>
            <VChart v-if="moodTrendOpt" :option="moodTrendOpt" autoresize class="h-64 w-full" />
          </Card>

          <Card v-if="hasMood && moodCountKeys.length" class="flex flex-col gap-3 p-5">
            <h3 class="flex items-center gap-2 font-medium">
              <ChartPie class="size-4 text-muted-foreground" /> Mood distribution
            </h3>
            <VChart v-if="moodDistOpt" :option="moodDistOpt" autoresize class="h-64 w-full" />
          </Card>

          <Card
            v-if="hasPosture && report.stats.posture.score_trend.length"
            class="flex flex-col gap-3 p-5"
          >
            <h3 class="flex items-center gap-2 font-medium">
              <ChartLine class="size-4 text-muted-foreground" /> Posture score over time
            </h3>
            <VChart v-if="postureScoreOpt" :option="postureScoreOpt" autoresize class="h-64 w-full" />
          </Card>

          <Card v-if="hasPosture && postureEventKeys.length" class="flex flex-col gap-3 p-5">
            <h3 class="flex items-center gap-2 font-medium">
              <ChartColumn class="size-4 text-muted-foreground" /> Posture &amp; fatigue events
            </h3>
            <VChart v-if="postureEventsOpt" :option="postureEventsOpt" autoresize class="h-64 w-full" />
          </Card>

          <Card v-if="hasActivity && report.stats.activity.by_category.length" class="flex flex-col gap-3 p-5">
            <h3 class="flex items-center gap-2 font-medium">
              <ChartPie class="size-4 text-muted-foreground" /> Focus by category
            </h3>
            <VChart v-if="categoryOpt" :option="categoryOpt" autoresize class="h-64 w-full" />
          </Card>

          <Card v-if="hasActivity && report.stats.activity.top_apps.length" class="flex flex-col gap-3 p-5">
            <h3 class="flex items-center gap-2 font-medium">
              <ChartColumn class="size-4 text-muted-foreground" /> Top apps
            </h3>
            <VChart v-if="topAppsOpt" :option="topAppsOpt" autoresize class="h-64 w-full" />
          </Card>

          <Card
            v-if="hasActivity && report.stats.activity.active_trend.length"
            class="flex flex-col gap-3 p-5 lg:col-span-2"
          >
            <h3 class="flex items-center gap-2 font-medium">
              <ChartColumn class="size-4 text-muted-foreground" /> Active time per day
            </h3>
            <VChart v-if="activeTrendOpt" :option="activeTrendOpt" autoresize class="h-64 w-full" />
          </Card>
        </section>

        <!-- Key findings -->
        <section v-if="report.report.key_findings.length" class="flex flex-col gap-3">
          <h2 class="text-lg font-semibold">Key findings</h2>
          <div class="grid gap-3">
            <Card
              v-for="(finding, index) in report.report.key_findings"
              :key="index"
              class="flex gap-3 p-4"
            >
              <component
                :is="severityIcon(finding.severity)"
                class="mt-0.5 size-4 shrink-0"
                :style="{ color: severityColor(finding.severity) }"
              />
              <div class="flex flex-col gap-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="font-medium">{{ finding.title }}</h4>
                  <Badge :variant="severityVariant(finding.severity)" class="capitalize">
                    {{ finding.severity }}
                  </Badge>
                </div>
                <p class="text-sm text-muted-foreground">{{ finding.detail }}</p>
                <div v-if="finding.evidence.length" class="flex flex-wrap gap-1">
                  <span
                    v-for="(item, itemIndex) in finding.evidence"
                    :key="itemIndex"
                    class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {{ item }}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <!-- Suggestions -->
        <section v-if="report.report.suggestions.length" class="flex flex-col gap-3">
          <h2 class="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb class="size-5 text-yellow-500" /> Suggestions
          </h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Card
              v-for="(suggestion, index) in report.report.suggestions"
              :key="index"
              class="flex flex-col gap-2 p-4"
            >
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-medium">{{ suggestion.title }}</h4>
                <Badge :variant="priorityVariant(suggestion.priority)" class="shrink-0 capitalize">
                  {{ suggestion.priority }}
                </Badge>
              </div>
              <p class="text-sm text-muted-foreground">{{ suggestion.detail }}</p>
              <div class="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant="outline" class="capitalize">{{ suggestion.category }}</Badge>
                <Badge v-if="suggestion.timeframe" variant="outline" class="capitalize">
                  {{ suggestion.timeframe }}
                </Badge>
                <Badge v-if="suggestion.effort" variant="outline" class="capitalize">
                  {{ suggestion.effort }}
                </Badge>
              </div>
            </Card>
          </div>
        </section>

        <!-- Positives / watch-outs -->
        <section class="grid gap-4 md:grid-cols-2">
          <Card class="flex flex-col gap-2 p-5">
            <h3 class="flex items-center gap-2 font-medium">
              <CircleCheck class="size-4 text-green-500" /> What's going well
            </h3>
            <ul class="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <li v-for="(item, index) in report.report.positives" :key="index" class="flex gap-2">
                <span class="text-green-500">•</span><span>{{ item }}</span>
              </li>
            </ul>
          </Card>
          <Card class="flex flex-col gap-2 p-5">
            <h3 class="flex items-center gap-2 font-medium">
              <TriangleAlert class="size-4 text-yellow-500" /> Watch-outs
            </h3>
            <ul
              v-if="report.report.watch_outs.length"
              class="flex flex-col gap-1.5 text-sm text-muted-foreground"
            >
              <li v-for="(item, index) in report.report.watch_outs" :key="index" class="flex gap-2">
                <span class="text-yellow-500">•</span><span>{{ item }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-muted-foreground">Nothing pressing right now.</p>
          </Card>
        </section>

        <!-- Cross-signal insights -->
        <Card v-if="report.report.correlations.length" class="flex flex-col gap-2 p-5">
          <h3 class="flex items-center gap-2 font-medium">
            <TrendingUp class="size-4 text-primary" /> Cross-signal insights
          </h3>
          <ul class="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li v-for="(item, index) in report.report.correlations" :key="index" class="flex gap-2">
              <span class="text-primary">•</span><span>{{ item }}</span>
            </li>
          </ul>
        </Card>

        <!-- Knowledge sources + raw data -->
        <Accordion type="single" collapsible class="flex flex-col gap-3">
          <AccordionItem
            v-if="report.retrieved_documents.length"
            value="sources"
            class="rounded-xl border bg-card/50 px-4"
          >
            <AccordionTrigger>
              <span class="flex items-center gap-2 text-sm font-medium">
                <BookOpen class="size-4" /> Knowledge sources ({{ report.retrieved_documents.length }})
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div class="flex flex-col gap-3 pb-2">
                <div
                  v-for="(document, index) in report.retrieved_documents"
                  :key="index"
                  class="rounded-lg border p-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium">{{ document.title }}</span>
                    <Badge variant="outline">score {{ document.score.toFixed(1) }}</Badge>
                  </div>
                  <p class="text-xs text-muted-foreground">{{ document.source }}</p>
                  <p class="mt-1 line-clamp-3 text-xs text-muted-foreground">{{ document.content }}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="raw" class="rounded-xl border bg-card/50 px-4">
            <AccordionTrigger>
              <span class="flex items-center gap-2 text-sm font-medium">
                <Database class="size-4" /> Raw statistics
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea class="h-72 rounded-md border">
                <pre class="p-3 text-xs leading-5 whitespace-pre-wrap">{{ statsJson }}</pre>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <!-- Privacy + disclaimer -->
        <div class="flex flex-col gap-2 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p class="flex gap-2">
            <ShieldCheck class="size-4 shrink-0 text-green-500" />{{ report.report.privacy_note }}
          </p>
          <p class="flex gap-2"><Info class="size-4 shrink-0" />{{ report.report.disclaimer }}</p>
        </div>
      </div>
    </div>
  </main>
</template>
