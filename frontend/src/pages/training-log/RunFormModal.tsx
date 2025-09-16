import { useEffect, useMemo, useState } from 'react'
import Modal from '../../components/Modal'
import type { Run, RunInput, RunType } from '../../lib/types'
import { digitsToHms, hmsToSeconds, secondsToHms } from '../../lib/format'
import { normalizeRunType } from '../../lib/runs'

const RUN_TYPES: RunType[] = ['Easy Run', 'Workout', 'Long Run', 'Race']

type FormState = {
  id?: Run['id']
  title: string
  description: string
  date: string
  time: string
  distance: string
  unit: 'mi' | 'km'
  duration: string
  runType: RunType
  elev: string
}

function buildStateFromRun(run?: Run | null): FormState {
  if (!run) {
    const now = new Date()
    const iso = now.toISOString()
    return {
      title: '',
      description: '',
      date: iso.slice(0, 10),
      time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      distance: '',
      unit: 'mi',
      duration: '00:00:00',
      runType: 'Easy Run',
      elev: '0',
    }
  }
  const started = new Date(run.started_at)
  return {
    id: run.id,
    title: run.title || '',
    description: run.description || '',
    date: started.toISOString().slice(0, 10),
    time: `${String(started.getHours()).padStart(2, '0')}:${String(started.getMinutes()).padStart(2, '0')}`,
    distance: String(run.distance ?? ''),
    unit: run.unit === 'km' ? 'km' : 'mi',
    duration: secondsToHms(run.duration_s || 0),
    runType: normalizeRunType(run.run_type || run.type || 'Easy Run') || 'Easy Run',
    elev: String(run.elevation_ft ?? 0),
  }
}

export interface RunFormModalProps {
  open: boolean
  run?: Run | null
  onClose: () => void
  onSubmit: (payload: RunInput, id?: Run['id']) => Promise<void>
}

export function RunFormModal({ open, run, onClose, onSubmit }: RunFormModalProps) {
  const [state, setState] = useState<FormState>(() => buildStateFromRun(run))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setState(buildStateFromRun(run))
      setError(null)
      setSubmitting(false)
    }
  }, [open, run])

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = event.target.value
    setState((prev) => ({ ...prev, [field]: value }))
  }

  const handleDurationInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = digitsToHms(event.target.value)
    setState((prev) => ({ ...prev, duration: formatted }))
  }

  const payload = useMemo<RunInput | null>(() => {
    if (!state.date || !state.time || !state.title || !state.distance) return null
    const startedAt = `${state.date}T${state.time}:00`
    const durationSeconds = hmsToSeconds(state.duration)
    if (!durationSeconds) return null
    return {
      title: state.title,
      description: state.description,
      started_at: startedAt,
      distance: Number.parseFloat(state.distance),
      unit: state.unit,
      duration_s: durationSeconds,
      elevation_ft: Number.parseInt(state.elev || '0', 10) || 0,
      run_type: state.runType,
    }
  }, [state])

  const isEdit = Boolean(state.id)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!payload) {
      setError('Please complete all required fields.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(payload, state.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save run')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="run-form-title" className="form-card">
      <header className="modal__head">
        <h1 id="run-form-title">{isEdit ? 'Edit run' : 'Add run'}</h1>
        <button className="icon-btn" type="button" aria-label="Close form" onClick={onClose}>
          &times;
        </button>
      </header>
      <form id="run-form" className="form-grid" autoComplete="off" onSubmit={handleSubmit}>
        <input type="hidden" value={state.id ? String(state.id) : ''} />
        <label className="span-2">
          <span>Title</span>
          <input id="f-title" type="text" value={state.title} onChange={handleChange('title')} placeholder="Morning easy" required />
        </label>
        <label className="span-2">
          <span>Description</span>
          <textarea id="f-description" value={state.description} onChange={handleChange('description')} placeholder="How it felt, route, etc." rows={4} />
        </label>
        <label>
          <span>Date</span>
          <input id="f-date" type="date" value={state.date} onChange={handleChange('date')} required />
        </label>
        <label>
          <span>Time</span>
          <input id="f-time" type="time" step={60} value={state.time} onChange={handleChange('time')} required />
        </label>
        <label>
          <span>Distance</span>
          <div className="input-with-toggle">
            <input id="f-distance" type="number" step="0.01" min="0" placeholder="5.00" value={state.distance} onChange={handleChange('distance')} required />
            <div className="unit-toggle" role="group" aria-label="Unit" data-active={state.unit}>
              <input type="radio" name="f-unit" id="unit-mi" value="mi" checked={state.unit === 'mi'} onChange={() => setState((prev) => ({ ...prev, unit: 'mi' }))} />
              <label htmlFor="unit-mi" className="pill">
                mi
              </label>
              <input type="radio" name="f-unit" id="unit-km" value="km" checked={state.unit === 'km'} onChange={() => setState((prev) => ({ ...prev, unit: 'km' }))} />
              <label htmlFor="unit-km" className="pill">
                km
              </label>
            </div>
          </div>
        </label>
        <label>
          <span>Duration (HH:MM:SS)</span>
          <input id="f-duration-hms" inputMode="numeric" placeholder="00:00:00" value={state.duration} onChange={handleDurationInput} />
        </label>
        <label>
          <span>Run type</span>
          <select id="f-type" value={state.runType} onChange={(event) => setState((prev) => ({ ...prev, runType: event.target.value as RunType }))} required>
            {RUN_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Elevation gain (ft)</span>
          <input id="f-elev" type="number" step="1" min="0" value={state.elev} onChange={handleChange('elev')} />
        </label>
        {error ? (
          <p className="muted small" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions span-2">
          <button type="submit" className="btn-primary btn-primary--wide" disabled={submitting || !payload}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default RunFormModal
