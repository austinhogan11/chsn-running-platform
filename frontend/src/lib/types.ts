export type DistanceUnit = 'mi' | 'km'
export type RunType = 'Easy Run' | 'Workout' | 'Long Run' | 'Race'

export interface Run {
  id: string | number
  title: string
  description?: string | null
  started_at: string
  distance: number
  unit: DistanceUnit
  duration_s: number
  elevation_ft?: number | null
  run_type?: RunType
  type?: RunType
  source?: string | null
  source_ref?: string | null
  pace?: string | null
  pace_s?: number | null
  metadata?: {
    source?: string
    source_ref?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface RunInput {
  title: string
  description?: string
  started_at: string
  distance: number
  unit: DistanceUnit
  duration_s: number
  elevation_ft?: number
  run_type: RunType
}

export interface StravaActivitySummary {
  id: number
  name: string
  type: string
  start_date: string
  distance_mi: number
  moving_time_s: number
}

export interface StravaActivityPreview {
  summary?: {
    distance_mi?: number
    duration_s?: number
    avg_pace_s_per_mi?: number | null
    avg_hr?: number | null
    elev_gain_ft?: number | null
  }
  polyline?: [number, number][]
  series?: Record<string, unknown>
  auto_mile_splits?: Array<{
    mile: number
    time_s?: number
    pace_s_per_mi?: number | null
    avg_hr?: number | null
  }>
}
