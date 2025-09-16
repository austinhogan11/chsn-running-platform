import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import Modal from '../../components/Modal'
import type { Run } from '../../lib/types'
import { runModalContent } from '../../lib/runs'
import { fetchRunRoute } from '../../lib/api'

export interface RunDetailModalProps {
  open: boolean
  run: Run | null
  onClose: () => void
}

export function RunDetailModal({ open, run, onClose }: RunDetailModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')

  const mapInstanceRef = useRef<L.Map | null>(null)

  const details = useMemo(() => (run ? runModalContent(run) : []), [run])
  const title = run?.title || 'Run details'

  useEffect(() => {
    if (!open) return
    if (!mapContainerRef.current) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    async function loadMap() {
      if (!run) return
      const current = mapContainerRef.current
      if (!current) return
      setStatus('loading')
      let latlng: [number, number][] | null = null

      const source = (run as any).source || ((run as any).metadata && (run as any).metadata.source)
      const ref = (run as any).source_ref || ((run as any).metadata && (run as any).metadata.source_ref)

      if (source === 'strava' && ref) {
        try {
          const route = await fetchRunRoute(ref)
          if (Array.isArray(route.polyline) && route.polyline.length >= 2) {
            latlng = route.polyline
          }
        } catch (err) {
          console.warn('Failed to load Strava route', err)
          setStatus('error')
        }
      }

      if (!latlng && Array.isArray((run as any).polyline) && (run as any).polyline.length >= 2) {
        latlng = (run as any).polyline
      }

      if (!latlng || latlng.length < 2) {
        setStatus('empty')
        return
      }

      setStatus('idle')
      current.innerHTML = ''
      const map = L.map(current, { zoomControl: false })
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(map)

      const line = L.polyline(latlng, { weight: 4, opacity: 0.95, color: '#2ad2c9' })
      line.addTo(map)
      map.fitBounds(line.getBounds(), { padding: [12, 12] })

      const start = latlng[0]
      const finish = latlng[latlng.length - 1]
      L.circleMarker(start, { radius: 5, color: '#00e676', fillColor: '#00e676', fillOpacity: 0.95, weight: 2 }).addTo(map).bindTooltip('Start')
      L.circleMarker(finish, { radius: 5, color: '#ff5252', fillColor: '#ff5252', fillOpacity: 0.95, weight: 2 }).addTo(map).bindTooltip('Finish')
    }

    loadMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [open, run])

  return (
    <Modal open={open} onClose={onClose} labelledBy="modal-title">
      <header className="modal__head">
        <h3 id="modal-title">{title}</h3>
        <button className="icon-btn" type="button" aria-label="Close details" onClick={onClose}>
          &times;
        </button>
      </header>
      <div className="modal__body">
        <div className="run-detail__grid">
          <div className="run-detail__info" id="modal-body">
            {details.map(([label, value]) => (
              <p key={label}>
                <strong>{label}:</strong> {value}
              </p>
            ))}
          </div>
          <div className="run-detail__map">
            <div id="run-map" ref={mapContainerRef} aria-label="Route map">
              {status === 'loading' ? <p className="muted small">Loading map…</p> : null}
              {status === 'empty' ? <p className="muted small">No GPS route available.</p> : null}
              {status === 'error' ? <p className="muted small">Failed to load route.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default RunDetailModal
