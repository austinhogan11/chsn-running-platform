import type { Run, RunInput, RunType } from './types'
import { formatNumber, secondsToHms, secondsToMmss, toMiles } from './format'

export function normalizeRunType(value?: string | null): RunType | undefined {
  if (!value) return undefined
  const lookup: Record<string, RunType> = {
    'easy run': 'Easy Run',
    'workout': 'Workout',
    'long run': 'Long Run',
    'race': 'Race',
  }
  const normalized = lookup[value.toLowerCase?.() || '']
  return normalized ?? (['Easy Run', 'Workout', 'Long Run', 'Race'] as RunType[]).find((t) => t === value) ?? undefined
}

export function runDisplayType(run: Run): RunType | undefined {
  return normalizeRunType((run.run_type || run.type || run.category || '') as RunType)
}

export function sortRuns(runs: Run[]): Run[] {
  return [...runs].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
}

export function paceDisplay(run: Run): string {
  const distance = Number(run.distance) || 0
  const duration = Number(run.duration_s) || 0
  if (distance <= 0 || duration <= 0) return '—'
  return secondsToMmss(Math.round(duration / distance))
}

export function unitAbbrev(run: Run): 'mi' | 'km' {
  return run.unit === 'km' ? 'km' : 'mi'
}

export function distanceDisplay(run: Run): string {
  return formatNumber(Number(run.distance) || 0, 2)
}

export function elevationDisplay(run: Run): string {
  return formatNumber(Number(run.elevation_ft ?? 0), 0)
}

export function createRunPayload(data: RunInput): RunInput {
  return {
    ...data,
    distance: Number(data.distance),
    duration_s: Number(data.duration_s),
    elevation_ft: Number(data.elevation_ft ?? 0),
  }
}

export function weekDailyMiles(runs: Run[], reference = new Date()): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0]
  const weekStart = startOfWeek(reference)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  for (const run of runs) {
    const started = new Date(run.started_at)
    if (started >= weekStart && started < weekEnd) {
      const idx = (started.getDay() + 6) % 7
      days[idx] += toMiles(run.distance, unitAbbrev(run))
    }
  }

  return days
}

export type TrendRange = '12w' | '6m' | '1y'

export function weeklyTotals(runs: Run[], range: TrendRange, reference = new Date()): number[] {
  const weeks = range === '6m' ? 26 : range === '1y' ? 52 : 12
  const results: number[] = []
  const baseEnd = startOfWeek(reference)

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(baseEnd)
    start.setDate(start.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    let sum = 0
    for (const run of runs) {
      const started = new Date(run.started_at)
      if (started >= start && started < end) {
        sum += toMiles(run.distance, unitAbbrev(run))
      }
    }
    results.push(sum)
  }

  return results
}

export function startOfWeek(date: Date): Date {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setHours(0, 0, 0, 0)
  result.setDate(result.getDate() - day)
  return result
}

export function runDetailsSummary(run: Run): string {
  return [
    `${distanceDisplay(run)} ${unitAbbrev(run)}`,
    `${Math.round((run.duration_s || 0) / 60)} min`,
    `pace ${paceDisplay(run)} / ${unitAbbrev(run)}`,
    `elev ${elevationDisplay(run)} ft`,
  ].join(' • ')
}

export function runModalContent(run: Run): Array<[string, string]> {
  return [
    ['Date', new Date(run.started_at).toLocaleString()],
    ['Distance', `${distanceDisplay(run)} ${unitAbbrev(run)}`],
    ['Duration', secondsToHms(run.duration_s || 0)],
    ['Pace', `${paceDisplay(run)} / ${unitAbbrev(run)}`],
    ['Elevation gain', `${elevationDisplay(run)} ft`],
    ['Type', runDisplayType(run) ?? '—'],
    ['Description', run.description || '—'],
  ]
}
