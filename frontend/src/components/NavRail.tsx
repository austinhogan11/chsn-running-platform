import clsx from 'clsx'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10.5V20a1.5 1.5 0 0 0 1.5 1.5H10v-6h4v6h3.5A1.5 1.5 0 0 0 19 20v-9.5" />
    </svg>
  )
}

function LogIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  )
}

function CalculatorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h.01" />
      <path d="M13 15h.01" />
      <path d="M17 15h.01" />
      <path d="M9 19h.01" />
      <path d="M13 19h.01" />
      <path d="M17 19h.01" />
    </svg>
  )
}

type NavItem = {
  to: string
  label: string
  id: string
  icon: ReactNode
  end?: boolean
}

const LINKS: NavItem[] = [
  { to: '/', label: 'Home', id: 'home', icon: <HomeIcon />, end: true },
  { to: '/training-log', label: 'Training Log', id: 'training-log', icon: <LogIcon /> },
  { to: '/pace-calculator', label: 'Pace Calculator', id: 'pace-calc', icon: <CalculatorIcon /> },
]

export function NavRail() {
  return (
    <nav className="rail" aria-label="Primary">
      <ul className="rail__list">
        {LINKS.map((link) => (
          <li key={link.id} className="rail__item">
            <NavLink
              to={link.to}
              end={Boolean(link.end)}
              className={({ isActive }) =>
                clsx('rail__link', { 'is-active': isActive })
              }
              title={link.label}
            >
              <span className="rail__icon" aria-hidden="true">
                {link.icon}
              </span>
              <span className="rail__label">{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default NavRail
