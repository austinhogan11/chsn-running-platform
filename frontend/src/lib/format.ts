export function pad(num: number, size = 2): string {
  return String(num).padStart(size, '0')
}

export function secondsToHms(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function secondsToMmss(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${pad(m)}:${pad(s)}`
}

export function hmsToSeconds(value: string): number {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) return 0
  const [, hh, mm, ss] = match
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss)
}

export function digitsToHms(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(-6)
  if (!digits) return '00:00:00'
  return `${pad(Number(digits.slice(0, -4) || '0'))}:${pad(Number(digits.slice(-4, -2) || '0'))}:${pad(Number(digits.slice(-2) || '0'))}`
}

export function digitsToMmss(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '').slice(-4)
  if (!digits) return '00:00'
  return `${pad(Number(digits.slice(0, -2) || '0'))}:${pad(Number(digits.slice(-2) || '0'))}`
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(digits)
}

export function milesFromKm(km: number): number {
  return km * 0.621371
}

export function toMiles(distance: number, unit: 'mi' | 'km'): number {
  return unit === 'km' ? milesFromKm(distance) : distance
}
