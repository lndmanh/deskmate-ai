// Themed ECharts option builders for the activity dashboard. Each builder is a
// pure function of already-aggregated data + the current theme tokens, so the
// dashboard component stays declarative and the chart configs stay testable.
import type { EChartsOption } from 'echarts'

import {
  formatClockHour,
  formatMinutes,
  formatShortDate,
  type AppSlice,
  type CategorySlice,
  type TrendPoint
} from './activity-insights'

export interface ChartTheme {
  text: string
  muted: string
  border: string
  card: string
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** Read theme colors from the app's CSS variables so charts follow light/dark mode. */
export function readChartTheme(): ChartTheme {
  return {
    text: cssVar('--foreground', '#18181b'),
    muted: cssVar('--muted-foreground', '#71717a'),
    border: cssVar('--border', 'rgba(120,120,130,0.18)'),
    card: cssVar('--card', '#ffffff')
  }
}

function tooltip(theme: ChartTheme): EChartsOption['tooltip'] {
  return {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    padding: [8, 12],
    textStyle: { color: theme.text, fontSize: 12 },
    extraCssText: 'border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.12);'
  }
}

function verticalGradient(color: string, topAlpha: string, bottomAlpha: string): object {
  return {
    type: 'linear',
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `${color}${topAlpha}` },
      { offset: 1, color: `${color}${bottomAlpha}` }
    ]
  }
}

/** Donut: how the day's focused time splits across activity categories. */
export function categoryDonutOption(slices: CategorySlice[], theme: ChartTheme): EChartsOption {
  return {
    tooltip: {
      ...tooltip(theme),
      trigger: 'item',
      formatter: (params) => {
        const point = params as { marker: string; name: string; value: number; percent: number }
        return `${point.marker} ${point.name}<br/><b>${formatMinutes(point.value)}</b> · ${point.percent}%`
      }
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 9,
      itemHeight: 9,
      itemGap: 14,
      textStyle: { color: theme.muted, fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderColor: theme.card, borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          itemStyle: { shadowBlur: 14, shadowColor: 'rgba(0,0,0,0.18)' }
        },
        data: slices.map((slice) => ({
          value: Math.round(slice.activeMs / 60000),
          name: slice.label,
          itemStyle: { color: slice.color }
        }))
      }
    ]
  }
}

/** Horizontal bars: which specific apps consumed the most focused time. */
export function topAppsBarOption(apps: AppSlice[], theme: ChartTheme): EChartsOption {
  return {
    grid: { left: 4, right: 18, top: 8, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip(theme),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = params as Array<{ name: string; value: number; marker: string }>
        const point = list[0]
        return `${point.name}<br/>${point.marker} <b>${formatMinutes(point.value)}</b>`
      }
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: theme.muted, fontSize: 11, formatter: (value: number) => formatMinutes(value) },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: apps.map((app) => app.app),
      axisLabel: { color: theme.text, fontSize: 12, width: 120, overflow: 'truncate' },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        barWidth: '56%',
        data: apps.map((app) => ({
          value: Math.round(app.activeMs / 60000),
          itemStyle: { color: app.color, borderRadius: [0, 6, 6, 0] }
        })),
        label: {
          show: true,
          position: 'right',
          color: theme.muted,
          fontSize: 11,
          formatter: (params: { value?: unknown }) => formatMinutes(Number(params.value) || 0)
        }
      }
    ]
  }
}

/** Area across the 24-hour clock: when during the day focus happened. */
export function hourlyFocusOption(buckets: number[], theme: ChartTheme): EChartsOption {
  const accent = '#6366f1'
  return {
    grid: { left: 6, right: 16, top: 16, bottom: 6, containLabel: true },
    tooltip: {
      ...tooltip(theme),
      trigger: 'axis',
      formatter: (params) => {
        const list = params as Array<{ dataIndex: number; value: number; marker: string }>
        const point = list[0]
        return `${formatClockHour(point.dataIndex)}<br/>${point.marker} <b>${formatMinutes(point.value)}</b> focused`
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: Array.from({ length: 24 }, (_, hour) => formatClockHour(hour)),
      axisLabel: {
        color: theme.muted,
        fontSize: 11,
        interval: (index: number) => index % 3 === 0
      },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.muted, fontSize: 11, formatter: (value: number) => `${value}m` },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: accent, width: 2 },
        itemStyle: { color: accent },
        areaStyle: { color: verticalGradient(accent, '59', '0d') },
        data: buckets,
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(99,102,241,0.07)' },
          data: [
            [{ xAxis: formatClockHour(0) }, { xAxis: formatClockHour(5) }],
            [{ xAxis: formatClockHour(22) }, { xAxis: formatClockHour(23) }]
          ]
        }
      }
    ]
  }
}

/** Area over recent days: the multi-day focused-time trend, with an average line. */
export function trendOption(trend: TrendPoint[], theme: ChartTheme): EChartsOption {
  const accent = '#22c55e'
  const minutes = trend.map((point) => Math.round(point.activeMs / 60000))
  const average =
    minutes.length > 0 ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : 0
  return {
    grid: { left: 6, right: 16, top: 18, bottom: 6, containLabel: true },
    tooltip: {
      ...tooltip(theme),
      trigger: 'axis',
      formatter: (params) => {
        const list = params as Array<{ dataIndex: number; value: number; marker: string }>
        const point = list[0]
        const day = trend[point.dataIndex]
        const late = day && day.lateNightMs > 0 ? `<br/><span style="opacity:.7">late night ${formatMinutes(Math.round(day.lateNightMs / 60000))}</span>` : ''
        return `${day ? formatShortDate(day.date) : ''}<br/>${point.marker} <b>${formatMinutes(point.value)}</b> focused${late}`
      }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((point) => formatShortDate(point.date)),
      axisLabel: { color: theme.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.muted, fontSize: 11, formatter: (value: number) => formatMinutes(value) },
      splitLine: { lineStyle: { color: theme.border, type: 'dashed' } }
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: accent, width: 2 },
        itemStyle: { color: accent },
        areaStyle: { color: verticalGradient(accent, '40', '08') },
        data: minutes,
        markLine: average
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: theme.muted, type: 'dashed', width: 1 },
              label: {
                color: theme.muted,
                fontSize: 10,
                formatter: `avg ${formatMinutes(average)}`,
                position: 'insideEndTop'
              },
              data: [{ yAxis: average }]
            }
          : undefined
      }
    ]
  }
}
