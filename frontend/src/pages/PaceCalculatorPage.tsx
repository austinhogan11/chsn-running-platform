import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { digitsToHms, digitsToMmss } from '../lib/format'
import { calculatePace } from '../lib/api'
import type { DistanceUnit } from '../lib/types'

const INITIAL_MESSAGE = 'Fill any two fields and click Calculate.'

function sanitizeTime(value: string): string {
  return value && value !== '00:00:00' ? value : ''
}

function sanitizePace(value: string): string {
  return value && value !== '00:00' ? value : ''
}

export function PaceCalculatorPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [distance, setDistance] = useState('')
  const [time, setTime] = useState('')
  const [pace, setPace] = useState('')
  const [unit, setUnit] = useState<DistanceUnit>('mi')

  const [message, setMessage] = useState(INITIAL_MESSAGE)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copyLabel, setCopyLabel] = useState('Copy Link')
  const [loading, setLoading] = useState(false)

  const timeRef = useRef<HTMLInputElement | null>(null)
  const paceRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const unitParam = searchParams.get('unit')
    if (unitParam === 'km' || unitParam === 'mi') {
      setUnit(unitParam)
    }
    const distanceParam = searchParams.get('distance')
    const timeParam = searchParams.get('time')
    const paceParam = searchParams.get('pace')
    if (distanceParam) setDistance(distanceParam)
    if (timeParam) setTime(timeParam)
    if (paceParam) setPace(paceParam)
  }, [searchParams])

  const providedCount = useMemo(() => {
    const keys = [distance, sanitizeTime(time), sanitizePace(pace)].filter(Boolean)
    return keys.length
  }, [distance, pace, time])

  useEffect(() => {
    setCopyLabel('Copy Link')
  }, [shareUrl])

  const handleTimeInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = digitsToHms(event.target.value)
    setTime(formatted)
    const input = timeRef.current
    if (input && document.activeElement === input) {
      requestAnimationFrame(() => {
        const end = input.value.length
        input.setSelectionRange(end, end)
      })
    }
  }, [])

  const handlePaceInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = digitsToMmss(event.target.value)
    setPace(formatted)
    const input = paceRef.current
    if (input && document.activeElement === input) {
      requestAnimationFrame(() => {
        const end = input.value.length
        input.setSelectionRange(end, end)
      })
    }
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const distanceTrimmed = distance.trim()
      const timeFormatted = sanitizeTime(time.trim())
      const paceFormatted = sanitizePace(pace.trim())

      const provided = [distanceTrimmed, timeFormatted, paceFormatted].filter(Boolean)
      if (provided.length !== 2) {
        setMessage('Please provide exactly two of: distance, time, pace. (Unit is selected separately.)')
        setShareUrl(null)
        return
      }

      if (distanceTrimmed) {
        const value = Number(distanceTrimmed)
        if (!Number.isFinite(value) || value <= 0) {
          setMessage('Distance must be a positive number (e.g., 5 or 5.25).')
          setShareUrl(null)
          return
        }
      }

      setLoading(true)
      setMessage('Loading…')
      setShareUrl(null)

      try {
        const response = await calculatePace({
          unit,
          distance: distanceTrimmed || undefined,
          time: timeFormatted || undefined,
          pace: paceFormatted || undefined,
        })

        const rows: Array<[string, string | number | null]> = [
          [`Distance (${response.unit})`, response.distance],
          ['Time', response.time],
          [`Pace (min/${response.unit})`, response.pace],
        ]
        setMessage(rows.map(([label, value]) => `${label}: ${value ?? '—'}`).join('\n'))

        const params = new URLSearchParams()
        params.set('unit', response.unit)
        if (distanceTrimmed) params.set('distance', distanceTrimmed)
        if (timeFormatted) params.set('time', timeFormatted)
        if (paceFormatted) params.set('pace', paceFormatted)
        setSearchParams(params, { replace: true })

        const fullUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`
        setShareUrl(fullUrl)
        setCopyLabel('Copy Link')
      } catch (err) {
        const error = err as Error & { status?: number }
        setMessage(`Error${error.status ? ` (${error.status})` : ''}: ${error.message || error}`)
        setShareUrl(null)
      } finally {
        setLoading(false)
      }
    },
    [distance, pace, time, unit, setSearchParams],
  )

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyLabel('Copied ✅')
      setTimeout(() => setCopyLabel('Copy Link'), 1500)
    } catch (err) {
      console.warn('Copy failed', err)
    }
  }, [shareUrl])

  return (
    <AppLayout pageId="pace-calc" mainClassName="pace-main" containerClassName="pace-container">
      <h1>Pace Calculator</h1>
      <form id="pace-form" autoComplete="off" onSubmit={handleSubmit}>
        <label htmlFor="distance">Distance</label>
        <div className="distance-row">
          <input
            id="distance"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="e.g. 5"
            value={distance}
            onChange={(event) => {
              setDistance(event.target.value)
              setShareUrl(null)
            }}
          />
          <div className={`unit-toggle is-${unit}`}>
            <span className="thumb" aria-hidden="true" />
            <label>
              <input
                type="radio"
                name="unit"
                value="mi"
                checked={unit === 'mi'}
                onChange={() => {
                  setUnit('mi')
                  setShareUrl(null)
                }}
              />
              <span>mi</span>
            </label>
            <label>
              <input
                type="radio"
                name="unit"
                value="km"
                checked={unit === 'km'}
                onChange={() => {
                  setUnit('km')
                  setShareUrl(null)
                }}
              />
              <span>km</span>
            </label>
          </div>
        </div>

        <label htmlFor="time">Time (HH:MM:SS)</label>
        <input
          id="time"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00:00:00"
          value={time}
          onChange={(event) => {
            handleTimeInput(event)
            setShareUrl(null)
          }}
          ref={timeRef}
        />

        <label htmlFor="pace">Pace (MM:SS per unit)</label>
        <input
          id="pace"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00:00"
          value={pace}
          onChange={(event) => {
            handlePaceInput(event)
            setShareUrl(null)
          }}
          ref={paceRef}
        />

        <button type="submit" disabled={loading}>
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </form>

      <pre id="result">{message}</pre>

      {shareUrl ? (
        <button type="button" className="copy-link-btn" onClick={handleCopy}>
          {copyLabel}
        </button>
      ) : null}

      <p className="muted small" aria-live="polite">
        {loading
          ? 'Calculating…'
          : shareUrl
            ? 'Result ready. Copy the link or adjust your inputs.'
            : providedCount !== 2
              ? 'Enter any two values to compute the third.'
              : 'Ready to calculate.'}
      </p>
    </AppLayout>
  )
}

export default PaceCalculatorPage
