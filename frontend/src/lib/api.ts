import type { DistanceUnit, Run, RunInput, StravaActivityPreview, StravaActivitySummary } from './types'

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  let data: unknown
  try {
    data = await response.json()
  } catch {
    data = undefined
  }

  if (!response.ok) {
    const detail =
      typeof (data as any)?.detail === 'string'
        ? (data as any).detail
        : Array.isArray((data as any)?.detail)
          ? (data as any).detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
          : `Request failed (${response.status})`
    const error = new Error(detail)
    ;(error as any).status = response.status
    ;(error as any).data = data
    throw error
  }

  return data as T
}

export async function listRuns(): Promise<Run[]> {
  const runs = await request<Run[]>('/runs')
  return runs
}

export async function createRun(payload: RunInput): Promise<Run> {
  return request<Run>('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateRun(id: Run['id'], payload: RunInput): Promise<Run> {
  return request<Run>(`/runs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function deleteRun(id: Run['id']): Promise<void> {
  await request(`/runs/${id}`, { method: 'DELETE' })
}

export interface StravaStatus {
  connected: boolean
  athlete_id?: number
  athlete?: { firstname?: string; lastname?: string }
  expires_at?: number
}

export async function getStravaStatus(): Promise<StravaStatus> {
  return request<StravaStatus>('/api/strava/status')
}

export async function listStravaActivities(page: number, perPage: number): Promise<StravaActivitySummary[]> {
  return request<StravaActivitySummary[]>(`/api/strava/activities?page=${page}&per_page=${perPage}`)
}

export async function previewStravaActivity(id: number): Promise<StravaActivityPreview> {
  return request<StravaActivityPreview>(`/api/strava/activities/${id}/preview`)
}

export async function importStravaActivity(activityId: number): Promise<Run> {
  return request<Run>('/runs/from-strava', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activity_id: activityId }),
  })
}

export async function fetchRunRoute(sourceRef: string): Promise<{ polyline: [number, number][] }> {
  return request<{ polyline: [number, number][] }>(`/api/strava/activities/${sourceRef}/route`)
}

export async function calculatePace(params: {
  unit: DistanceUnit
  distance?: string
  time?: string
  pace?: string
}): Promise<{ distance: number | null; time: string | null; pace: string | null; unit: DistanceUnit }> {
  const search = new URLSearchParams()
  search.set('unit', params.unit)
  if (params.distance) search.set('distance', params.distance)
  if (params.time) search.set('time', params.time)
  if (params.pace) search.set('pace', params.pace)
  return request(`/pace-calc?${search.toString()}`)
}
