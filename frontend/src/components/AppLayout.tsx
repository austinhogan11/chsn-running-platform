import type { ReactNode } from 'react'
import clsx from 'clsx'
import NavRail from './NavRail'
import ThemeToggle from './ThemeToggle'

export function AppLayout({
  pageId,
  children,
  mainClassName,
  containerClassName,
}: {
  pageId: string
  children: ReactNode
  mainClassName?: string
  containerClassName?: string
}) {
  return (
    <div className="page" data-page={pageId}>
      <NavRail />
      <ThemeToggle />
      <main className={mainClassName}>
        <div className={clsx('page__container', containerClassName)}>{children}</div>
      </main>
    </div>
  )
}

export default AppLayout
