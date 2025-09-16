import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import { importStravaActivity, listStravaActivities, previewStravaActivity } from '../../lib/api'
import type { StravaActivityPreview, StravaActivitySummary } from '../../lib/types'
import { secondsToHms, secondsToMmss } from '../../lib/format'

const PER_PAGE = 30

export interface StravaImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => Promise<void>
}

export function StravaImportModal({ open, onClose, onImported }: StravaImportModalProps) {
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [activities, setActivities] = useState<StravaActivitySummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<StravaActivitySummary | null>(null)
  const [preview, setPreview] = useState<StravaActivityPreview | null>(null)
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    load(page)
  }, [open])

  async function load(targetPage: number) {
    if (!open) return
    setLoading(true)
    setError(null)
    try {
      const data = await listStravaActivities(targetPage, PER_PAGE)
      setActivities(data)
      setPage(targetPage)
      setSelected(null)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(activity: StravaActivitySummary) {
    setSelected(activity)
    setPreview(null)
    setPreviewStatus('loading')
    try {
      const data = await previewStravaActivity(activity.id)
      setPreview(data)
      setPreviewStatus('idle')
    } catch (err) {
      console.error(err)
      setPreviewStatus('error')
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      await importStravaActivity(selected.id)
      await onImported()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Failed to import activity')
    } finally {
      setSaving(false)
    }
  }

  const filteredActivities = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return activities
    return activities.filter((activity) => (activity.name || '').toLowerCase().includes(q))
  }, [activities, filter])

  function renderPreview() {
    if (!selected) return <p className="muted">Select an activity to preview.</p>
    if (previewStatus === 'loading') return <p className="muted">Loading preview…</p>
    if (previewStatus === 'error' || !preview) return <p className="muted">Failed to load preview.</p>

    const summary = preview.summary || {}
    const dist = (summary.distance_mi ?? 0).toFixed(2)
    const dur = secondsToHms(summary.duration_s || 0)
    const pace = summary.distance_mi ? secondsToMmss(Math.round((summary.duration_s || 0) / (summary.distance_mi || 1))) : '—'
    const elev = Math.round(summary.elev_gain_ft || 0)
    const hr = summary.avg_hr ? Math.round(summary.avg_hr) : '—'

    return (
      <div>
        <h4>{selected.name || 'Run'}</h4>
        <p className="muted small">{selected.start_date ? new Date(selected.start_date).toLocaleString() : ''}</p>
        <p>
          <strong>{dist} mi</strong> • {dur} • pace {pace} / mi • elev {elev} ft • HR {hr}
        </p>
        <div className="muted small">
          Mile splits:{' '}
          {Array.isArray(preview.auto_mile_splits) && preview.auto_mile_splits.length > 0
            ? preview.auto_mile_splits.map((m) => `M${m.mile}:${secondsToMmss(m.time_s || 0)}`).join(', ')
            : '—'}
        </div>
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="strava-import-title">
      <header className="modal__head">
        <h3 id="strava-import-title">Import from Strava</h3>
        <button className="icon-btn" aria-label="Close Strava import" type="button" onClick={onClose}>
          &times;
        </button>
      </header>
      <div className="modal__body">
        <div className="strava-import__columns">
          <aside className="strava-import__list">
            <div className="list__controls">
              <input id="strava-filter" type="text" placeholder="Filter by name…" className="input" value={filter} onChange={(event) => setFilter(event.target.value)} />
              <button id="strava-refresh" className="btn-secondary" type="button" onClick={() => load(page)} disabled={loading}>
                Refresh
              </button>
            </div>
            <ul id="strava-activity-list" className="list">
              {loading ? <li className="muted">Loading…</li> : null}
              {error ? <li className="muted">{error}</li> : null}
              {!loading && !error && filteredActivities.length === 0 ? <li className="muted">No activities.</li> : null}
              {!loading && !error
                ? filteredActivities.map((activity) => {
                    const selectedClass = selected?.id === activity.id ? 'is-selected' : ''
                    const dateLabel = activity.start_date ? new Date(activity.start_date).toLocaleString() : ''
                    return (
                      <li key={activity.id} className={selectedClass} onClick={() => handleSelect(activity)}>
                        <div>
                          <strong>{activity.name || 'Run'}</strong>
                        </div>
                        <div className="muted small">
                          {dateLabel} • {(activity.distance_mi || 0).toFixed(2)} mi • {Math.round((activity.moving_time_s || 0) / 60)} min
                        </div>
                      </li>
                    )
                  })
                : null}
            </ul>
            <div className="list__paging">
              <button id="strava-prev" className="btn-secondary" type="button" onClick={() => load(Math.max(1, page - 1))} disabled={page <= 1 || loading}>
                Prev
              </button>
              <span id="strava-page" className="muted small">
                Page {page}
              </span>
              <button id="strava-next" className="btn-secondary" type="button" onClick={() => load(page + 1)} disabled={loading}>
                Next
              </button>
            </div>
          </aside>
          <section className="strava-import__preview">
            <div id="strava-preview" className="preview">
              {renderPreview()}
            </div>
          </section>
        </div>
      </div>
      <footer className="modal__footer">
        <button id="strava-import-save" className="btn-primary" type="button" onClick={handleSave} disabled={!selected || saving}>
          {saving ? 'Saving…' : 'Save to Training Log'}
        </button>
      </footer>
    </Modal>
  )
}

export default StravaImportModal
