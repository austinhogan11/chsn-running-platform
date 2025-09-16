import { useEffect, useMemo, useRef, useState } from 'react'
import AppLayout from '../../components/AppLayout'
import RunFormModal from './RunFormModal'
import RunDetailModal from './RunDetailModal'
import StravaImportModal from './StravaImportModal'
import { createRun, deleteRun, getStravaStatus, listRuns, updateRun } from '../../lib/api'
import type { Run, RunInput } from '../../lib/types'
import type { StravaStatus } from '../../lib/api'
import { paceDisplay, runDisplayType, sortRuns, unitAbbrev, weekDailyMiles, weeklyTotals, type TrendRange } from '../../lib/runs'
import { formatNumber } from '../../lib/format'

interface Filters {
  type: 'all' | string
  from?: string
  to?: string
}

export function TrainingLogPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ type: 'all' })
  const [viewingRun, setViewingRun] = useState<Run | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRun, setEditingRun] = useState<Run | null>(null)
  const [stravaStatus, setStravaStatus] = useState<StravaStatus | null>(null)
  const [stravaModalOpen, setStravaModalOpen] = useState(false)
  const [trendRange, setTrendRange] = useState<TrendRange>('12w')

  const weekCanvasRef = useRef<HTMLCanvasElement>(null)
  const trendCanvasRef = useRef<HTMLCanvasElement>(null)
  const weekTotalPillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadRuns()
    refreshStravaStatus()
  }, [])

  useEffect(() => {
    drawCharts()
  }, [runs, trendRange])

  const filteredRuns = useMemo(() => {
    const { type, from, to } = filters
    const fromDate = from ? new Date(`${from}T00:00:00`) : null
    const toDate = to ? new Date(`${to}T00:00:00`) : null
    return runs.filter((run) => {
      if (type !== 'all') {
        const runType = runDisplayType(run)
        if ((runType || '').toLowerCase() !== type.toLowerCase()) {
          return false
        }
      }
      if (!run.started_at) return false
      const started = new Date(run.started_at)
      if (fromDate && started < fromDate) return false
      if (toDate) {
        const endExclusive = new Date(toDate)
        endExclusive.setDate(endExclusive.getDate() + 1)
        if (started >= endExclusive) return false
      }
      return true
    })
  }, [filters, runs])

  async function loadRuns() {
    setLoading(true)
    setError(null)
    try {
      const data = await listRuns()
      setRuns(sortRuns(data))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to load runs')
    } finally {
      setLoading(false)
    }
  }

  async function refreshStravaStatus() {
    try {
      const status = await getStravaStatus()
      setStravaStatus(status)
    } catch (err) {
      console.warn('Strava status check failed', err)
      setStravaStatus(null)
    }
  }

  async function handleSaveRun(payload: RunInput, id?: Run['id']) {
    if (id) {
      await updateRun(id, payload)
    } else {
      await createRun(payload)
    }
    await loadRuns()
  }

  async function handleDeleteRun(run: Run) {
    if (!window.confirm('Delete this run?')) return
    await deleteRun(run.id)
    await loadRuns()
  }

  function handleFilterChange(next: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...next }))
  }

  function drawCharts() {
    if (!weekCanvasRef.current || !trendCanvasRef.current) return
    const weekMiles = weekDailyMiles(runs)
    drawWeekChart(weekCanvasRef.current, weekMiles)
    const total = weekMiles.reduce((sum, value) => sum + value, 0)
    if (weekTotalPillRef.current) {
      weekTotalPillRef.current.textContent = `${total.toFixed(1)} mi`
    }
    drawTrendChart(trendCanvasRef.current, weeklyTotals(runs, trendRange))
  }

  function openForm(run?: Run) {
    setEditingRun(run ?? null)
    setFormOpen(true)
  }

  function openStravaImport() {
    if (stravaStatus?.connected) {
      setStravaModalOpen(true)
    } else {
      window.location.href = '/api/strava/connect'
    }
  }

  const isConnected = Boolean(stravaStatus?.connected)
  const athleteName = stravaStatus?.athlete ? `${stravaStatus.athlete.firstname || ''} ${stravaStatus.athlete.lastname || ''}`.trim() : ''

  return (
    <AppLayout pageId="training-log">
      <div className="page__container">
        <header className="tl-header">
          <div className="tl-header__title">
            <h1>Training Log</h1>
          </div>
          <div className="tl-header__status">
            <button
              id="strava-status-text"
              className={`strava-link small ${isConnected ? 'is-connected' : ''}`}
              type="button"
              onClick={() => {
                if (!isConnected) window.location.href = '/api/strava/connect'
              }}
            >
              {isConnected ? `Connected${athleteName ? ` • ${athleteName}` : ''}` : 'Connect to Strava'}
            </button>
            <button id="open-strava-import" className="btn-secondary small" type="button" style={{ marginLeft: 8, display: isConnected ? 'inline-flex' : 'none' }} onClick={openStravaImport}>
              Import
            </button>
          </div>
        </header>

        <section className="tl-row tl-row--charts">
          <article className="card tl-card tl-card--chart" aria-labelledby="week-chart-title">
            <div className="tl-card__head">
              <h2 id="week-chart-title">This week</h2>
              <div className="pill" ref={weekTotalPillRef}>
                0 mi
              </div>
            </div>
            <canvas id="weekChart" ref={weekCanvasRef} height={140} aria-label="Mon–Sun daily mileage"></canvas>
            <p className="muted small">Mon–Sun daily mileage</p>
          </article>
          <article className="card tl-card tl-card--chart" aria-labelledby="trend-chart-title">
            <div className="tl-card__head">
              <h2 id="trend-chart-title">Mileage trend</h2>
              <div className="seg" data-seg="trend-range" role="tablist" aria-label="Trend range">
                <button className={`seg__btn ${trendRange === '12w' ? 'is-active' : ''}`} data-range="12w" role="tab" aria-selected={trendRange === '12w'} onClick={() => setTrendRange('12w')}>
                  12 wks
                </button>
                <button className={`seg__btn ${trendRange === '6m' ? 'is-active' : ''}`} data-range="6m" role="tab" aria-selected={trendRange === '6m'} onClick={() => setTrendRange('6m')}>
                  6 mo
                </button>
                <button className={`seg__btn ${trendRange === '1y' ? 'is-active' : ''}`} data-range="1y" role="tab" aria-selected={trendRange === '1y'} onClick={() => setTrendRange('1y')}>
                  1 yr
                </button>
              </div>
            </div>
            <canvas id="trendChart" ref={trendCanvasRef} height={140} aria-label="Weekly totals trend"></canvas>
            <p className="muted small">Weekly totals</p>
          </article>
        </section>

        <section className="tl-row tl-row--filters card tl-card" aria-label="Filters">
          <div className="filter">
            <label htmlFor="filter-type">Type</label>
            <select id="filter-type" value={filters.type} onChange={(event) => handleFilterChange({ type: event.target.value })}>
              <option value="all">All</option>
              <option value="Easy Run">Easy Run</option>
              <option value="Workout">Workout</option>
              <option value="Long Run">Long Run</option>
              <option value="Race">Race</option>
            </select>
          </div>
          <div className="filter">
            <label htmlFor="filter-from">From</label>
            <input id="filter-from" type="date" value={filters.from || ''} onChange={(event) => handleFilterChange({ from: event.target.value })} />
          </div>
          <div className="filter">
            <label htmlFor="filter-to">To</label>
            <input id="filter-to" type="date" value={filters.to || ''} onChange={(event) => handleFilterChange({ to: event.target.value })} />
          </div>
          <div className="filter filter--actions">
            <button
              id="filter-clear"
              className="btn-secondary"
              type="button"
              onClick={() => setFilters({ type: 'all' })}
            >
              Clear
            </button>
          </div>
        </section>

        <section className="tl-row" aria-label="Runs">
          <div id="run-list" className="tl-list card tl-card">
            {loading ? <div className="tl-empty"><p>Loading runs…</p></div> : null}
            {error ? <div className="tl-empty"><p>{error}</p></div> : null}
            {!loading && !error && filteredRuns.length === 0 ? <div className="tl-empty"><p>No runs match the current filters.</p></div> : null}
            {!loading && !error
              ? filteredRuns.map((run) => (
                  <div key={run.id} className="tl-item" onClick={() => setViewingRun(run)}>
                    <div className="tl-item__main">
                      <div className="tl-item__title">{run.title || 'Untitled run'}</div>
                      <div className="tl-item__meta">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '—'} • {formatNumber(run.distance)} {unitAbbrev(run)} •
                        {` ${Math.round((run.duration_s || 0) / 60)} min`} • pace {paceDisplay(run)} / {unitAbbrev(run)} • elev {formatNumber(run.elevation_ft || 0, 0)} ft •{` `}
                        {runDisplayType(run) || '—'}
                      </div>
                    </div>
                    <div className="tl-item__actions" onClick={(event) => event.stopPropagation()}>
                      <button className="icon-btn tl-action" aria-label="Edit" title="Edit" onClick={() => openForm(run)}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button className="icon-btn tl-action" aria-label="Delete" title="Delete" onClick={() => handleDeleteRun(run)}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </section>
      </div>

      <button id="add-run-btn" className="fab" type="button" aria-label="Add run" title="Add run" onClick={() => openForm()}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      <RunFormModal open={formOpen} run={editingRun} onClose={() => setFormOpen(false)} onSubmit={handleSaveRun} />
      <RunDetailModal open={Boolean(viewingRun)} run={viewingRun} onClose={() => setViewingRun(null)} />
      <StravaImportModal
        open={stravaModalOpen}
        onClose={() => setStravaModalOpen(false)}
        onImported={async () => {
          await loadRuns()
          await refreshStravaStatus()
        }}
      />
    </AppLayout>
  )
}

function drawWeekChart(canvas: HTMLCanvasElement, values: number[]) {
  const ctx = prepareCanvas(canvas)
  if (!ctx) return
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  drawBarChart(ctx, canvas, values, labels)
}

function drawTrendChart(canvas: HTMLCanvasElement, values: number[]) {
  const ctx = prepareCanvas(canvas)
  if (!ctx) return
  drawLineChart(ctx, canvas, values)
}

function prepareCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const ratio = window.devicePixelRatio || 1
  const { clientWidth, clientHeight } = canvas
  canvas.width = Math.max(1, Math.floor(clientWidth * ratio))
  canvas.height = Math.max(1, Math.floor(clientHeight * ratio))
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, clientWidth, clientHeight)
  return ctx
}

function buildAxis(values: number[]) {
  const max = Math.max(0, ...values)
  const top = Math.ceil(max)
  const mid = Math.round(top / 2)
  const ticks = top > 0 ? [0, mid, top] : [0]
  return { top, ticks }
}

function drawBarChart(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, values: number[], labels: string[]) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const padLeft = 40
  const pad = 24
  const left = padLeft
  const right = pad
  const topPad = pad
  const bottomPad = pad
  const chartWidth = width - left - right
  const chartHeight = height - topPad - bottomPad

  const axis = buildAxis(values)
  const toY = (value: number) => height - bottomPad - (axis.top ? (value / axis.top) * (chartHeight - 16) : 0)

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--border')
  ctx.fillRect(left, height - bottomPad, chartWidth, 1)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#a1a1aa'
  ctx.font = '12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
  ctx.textAlign = 'right'
  axis.ticks.forEach((tick) => {
    const y = toY(tick)
    ctx.beginPath()
    ctx.moveTo(left, y + 0.5)
    ctx.lineTo(left + chartWidth, y + 0.5)
    ctx.stroke()
    ctx.fillText(String(tick), left - 8, y + 4)
  })

  const barWidth = (chartWidth / values.length) * 0.7
  const gap = (chartWidth / values.length) * 0.3
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--green-600') || '#169b80'
  values.forEach((value, index) => {
    const x = left + index * (barWidth + gap) + (gap * 0.5)
    const y = toY(value)
    const barHeight = height - bottomPad - y
    ctx.fillRect(x, y, barWidth, barHeight)
  })

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted')
  ctx.textAlign = 'center'
  labels.forEach((label, index) => {
    const x = left + index * (barWidth + gap) + (gap * 0.5) + barWidth / 2
    ctx.fillText(label, x, height - 6)
  })
}

function drawLineChart(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, values: number[]) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const padLeft = 40
  const pad = 24
  const left = padLeft
  const right = pad
  const topPad = pad
  const bottomPad = pad
  const chartWidth = width - left - right
  const chartHeight = height - topPad - bottomPad

  const axis = buildAxis(values)
  const step = chartWidth / Math.max(1, values.length - 1)
  const toY = (value: number) => height - bottomPad - (axis.top ? (value / axis.top) * (chartHeight - 16) : 0)

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--border')
  ctx.fillRect(left, height - bottomPad, chartWidth, 1)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#a1a1aa'
  ctx.font = '12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
  ctx.textAlign = 'right'
  axis.ticks.forEach((tick) => {
    const y = toY(tick)
    ctx.beginPath()
    ctx.moveTo(left, y + 0.5)
    ctx.lineTo(left + chartWidth, y + 0.5)
    ctx.stroke()
    ctx.fillText(String(tick), left - 8, y + 4)
  })

  const strokeColor = getComputedStyle(document.documentElement).getPropertyValue('--green-600') || '#169b80'
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 2
  ctx.beginPath()
  values.forEach((value, index) => {
    const x = left + index * step
    const y = toY(value)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()

  ctx.fillStyle = strokeColor
  values.forEach((value, index) => {
    const x = left + index * step
    const y = toY(value)
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

export default TrainingLogPage
