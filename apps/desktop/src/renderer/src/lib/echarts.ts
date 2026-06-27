// Central ECharts registration. We import only the renderers, chart types, and
// components the activity dashboard actually uses so the bundle stays lean.
// Components call `ensureEcharts()` once before mounting a <VChart>.
import { use } from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

let registered = false

export function ensureEcharts(): void {
  if (registered) return
  use([
    CanvasRenderer,
    BarChart,
    LineChart,
    PieChart,
    GridComponent,
    LegendComponent,
    TooltipComponent,
    TitleComponent,
    DatasetComponent,
    MarkAreaComponent,
    MarkLineComponent
  ])
  registered = true
}
