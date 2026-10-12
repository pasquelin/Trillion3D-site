// What the reports page holds while it reads a campaign: its sources, its index and its loading
// state, and each source reading as the page lists it. The report format itself is the engine's
// (`#engine/bench/kit/report/`).
import { METRICS, type MetricKey } from '#engine/bench/kit/report/metrics.ts'
import type { Report, ReportCanvas } from '#engine/bench/kit/report/types.ts'

/** One run of a campaign, as the report lists it. */
type ReportRun = Report['runs'][number]

/** The keys of `METRICS`, in declaration order: `Object.keys` alone gives `string[]`. */
export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[]

export interface ReportSource {
  run: ReportRun
  data: unknown
}

export interface CampaignIndexItem {
  id: string
  records?: number
  date?: string
}

/** Loading, failed or listed without a campaign; a loaded report always carries its sources. */
export type ReportsState =
  | {
      loading: boolean
      error?: boolean
      index?: CampaignIndexItem[]
      report?: undefined
      sources?: undefined
    }
  | {
      loading: false
      error?: undefined
      index: CampaignIndexItem[]
      report: Report
      sources: ReportSource[]
    }

export interface SourceReadingRecord {
  id: string
  runId: string
  scene?: string
  view?: string
  quality?: number
  engine?: string
  side: string
  canvas?: ReportCanvas | null
  complete: {
    run: Record<string, unknown>
    frame: Record<string, unknown>
    measurement: Record<string, unknown>
  }
}
