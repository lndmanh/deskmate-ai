// Self-contained ECharts setup + themed option builders for the Report screen.
// Kept independent of lib/echarts.ts (the activity dashboard's registry) so the
// two features never step on each other; echarts `use()` de-dupes registrations.
import type { EChartsOption } from 'echarts'
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

import type { NamedCount, TrendPoint } from '@/services/report'

use([
  CanvasRenderer,
  GaugeChart,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent
])

export { VChart }

export interface ReportChartTheme {
  text: string
  muted: string
  border: string
  card: string
  palette: string[]
}

const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16']

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Read theme colors from CSS variables so charts follow light/dark mode. */
export function readReportChartTheme(): ReportChartTheme {
  return {
    text: cssVar('--foreground', '#18181b'),
    muted: cssVar('--muted-foreground', '#71717a'),
    border: cssVar('--border', 'rgba(120,120,130,0.18)'),
    card: cssVar('--card', '#ffffff'),
    palette: PALETTE
  }
}

export function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

export function formatDuration(ms: number): string {
  return formatMinutesLabel(Math.round(ms / 60000))
}

function formatMinutesLabel(min: number): string {
  const hours = Math.floor(min / 60)
  const minutes = Math.round(min % 60)
  if (hours && minutes) return `${hours}h ${minutes}m`
  if (hours) return `${hours}h`
  return `${minutes}m`
}

export function prettyEvent(event: string): string {
  const tail = event.split('.').pop() ?? event
  return tail.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function prettyLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function shortDate(value: string): string {
  const parts = value.split('-')
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : value
}

function tooltipStyle(theme: ReportChartTheme): EChartsOption['tooltip'] {
  return {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: theme.text, fontSize: 12 },
    extraCssText: 'border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.12);'
  }
}

/** Radial gauge for the overall desk-health score. */
export function overallGaugeOption(score: number, theme: ReportChartTheme): EChartsOption {
  const color = scoreColor(score)
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: '96%',
        center: ['50%', '54%'],
        progress: { show: true, width: 16, roundCap: true, itemStyle: { color } },
        axisLine: { roundCap: true, lineStyle: { width: 16, color: [[1, theme.border]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 44,
          fontWeight: 'bolder',
          offsetCenter: [0, '0%'],
          color: theme.text,
          formatter: (value: number) => `${Math.round(value)}`
        },
        data: [{ value: score }]
      }
    ]
  }
}

/** Energy + stress (1-5) over the window. */
export function moodTrendOption(
  energy: TrendPoint[],
  stress: TrendPoint[],
  theme: ReportChartTheme
): EChartsOption {
  return {
    color: [theme.palette[0], theme.palette[3]],
    tooltip: { ...tooltipStyle(theme), trigger: 'axis' },
    legend: {
      data: ['Energy', 'Stress'],
      top: 0,
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: theme.muted, fontSize: 11 }
    },
    grid: { left: 6, right: 12, top: 30, bottom: 6, containLabel: true },
    xAxis: {
      type: 'category',
      data: energy.map((point) => point.label),
      axisLabel: { color: theme.muted, fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 5,
      axisLabel: { color: theme.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    series: [
      {
        name: 'Energy',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        areaStyle: { opacity: 0.1 },
        data: energy.map((point) => point.value)
      },
      {
        name: 'Stress',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: stress.map((point) => point.value)
      }
    ]
  }
}

/** Distribution of self-reported moods. */
export function moodDistributionOption(
  counts: Record<string, number>,
  theme: ReportChartTheme
): EChartsOption {
  const data = Object.entries(counts).map(([name, value], index) => ({
    name: prettyLabel(name),
    value,
    itemStyle: { color: theme.palette[index % theme.palette.length] }
  }))
  return {
    tooltip: {
      ...tooltipStyle(theme),
      trigger: 'item',
      formatter: (params) => {
        const point = params as { marker: string; name: string; value: number; percent: number }
        return `${point.marker} ${point.name}<br/><b>${point.value}</b> · ${point.percent}%`
      }
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: theme.muted, fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderColor: theme.card, borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        labelLine: { show: false },
        data
      }
    ]
  }
}

/** Posture score (0-100) per session. */
export function postureScoreOption(trend: TrendPoint[], theme: ReportChartTheme): EChartsOption {
  return {
    color: [theme.palette[4]],
    tooltip: { ...tooltipStyle(theme), trigger: 'axis' },
    grid: { left: 6, right: 12, top: 16, bottom: 6, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.map((point) => point.label),
      axisLabel: { color: theme.muted, fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: theme.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.1 },
        data: trend.map((point) => point.value)
      }
    ]
  }
}

/** Counts of posture / fatigue events. */
export function postureEventsOption(
  counts: Record<string, number>,
  theme: ReportChartTheme
): EChartsOption {
  const entries = Object.entries(counts)
  return {
    tooltip: { ...tooltipStyle(theme), trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 6, right: 12, top: 12, bottom: 6, containLabel: true },
    xAxis: {
      type: 'category',
      data: entries.map(([key]) => prettyEvent(key)),
      axisLabel: { color: theme.muted, fontSize: 10, interval: 0, rotate: entries.length > 3 ? 20 : 0 },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: theme.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    series: [
      {
        type: 'bar',
        barWidth: '46%',
        data: entries.map(([, value], index) => ({
          value,
          itemStyle: { color: theme.palette[index % theme.palette.length], borderRadius: [6, 6, 0, 0] }
        }))
      }
    ]
  }
}

/** Donut of focused time by activity category (values in ms). */
export function categoryOption(slices: NamedCount[], theme: ReportChartTheme): EChartsOption {
  const data = slices.map((slice, index) => ({
    name: prettyLabel(slice.name),
    value: Math.round(slice.value / 60000),
    itemStyle: { color: theme.palette[index % theme.palette.length] }
  }))
  return {
    tooltip: {
      ...tooltipStyle(theme),
      trigger: 'item',
      formatter: (params) => {
        const point = params as { marker: string; name: string; value: number; percent: number }
        return `${point.marker} ${point.name}<br/><b>${formatMinutesLabel(point.value)}</b> · ${point.percent}%`
      }
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: theme.muted, fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderColor: theme.card, borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        labelLine: { show: false },
        data
      }
    ]
  }
}

/** Horizontal bars of the apps with the most focused time (values in ms). */
export function topAppsOption(apps: NamedCount[], theme: ReportChartTheme): EChartsOption {
  return {
    grid: { left: 4, right: 16, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltipStyle(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = params as Array<{ name: string; value: number; marker: string }>
        const point = list[0]
        return `${point.name}<br/>${point.marker} <b>${formatMinutesLabel(point.value)}</b>`
      }
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: theme.muted,
        fontSize: 11,
        formatter: (value: number) => formatMinutesLabel(value)
      },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: apps.map((app) => app.name),
      axisLabel: { color: theme.text, fontSize: 12, width: 110, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        barWidth: '56%',
        data: apps.map((app, index) => ({
          value: Math.round(app.value / 60000),
          itemStyle: { color: theme.palette[index % theme.palette.length], borderRadius: [0, 6, 6, 0] }
        }))
      }
    ]
  }
}

/** Active focused time per day (values in ms). */
export function activeTrendOption(trend: TrendPoint[], theme: ReportChartTheme): EChartsOption {
  return {
    color: [theme.palette[1]],
    tooltip: {
      ...tooltipStyle(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = params as Array<{ name: string; value: number; marker: string }>
        const point = list[0]
        return `${point.name}<br/>${point.marker} <b>${formatMinutesLabel(point.value)}</b> active`
      }
    },
    grid: { left: 6, right: 12, top: 12, bottom: 6, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.map((point) => shortDate(point.label)),
      axisLabel: { color: theme.muted, fontSize: 10 },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.muted,
        fontSize: 11,
        formatter: (value: number) => formatMinutesLabel(value)
      },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    series: [
      {
        type: 'bar',
        barWidth: '50%',
        data: trend.map((point) => Math.round(point.value / 60000)),
        itemStyle: { borderRadius: [6, 6, 0, 0] }
      }
    ]
  }
}
