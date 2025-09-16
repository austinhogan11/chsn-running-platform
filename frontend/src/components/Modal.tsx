import type { ReactNode } from 'react'
import clsx from 'clsx'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  labelledBy?: string
}

export function Modal({ open, onClose, children, className, labelledBy }: ModalProps) {
  if (!open) return null
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? undefined}>
      <div className="modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className={clsx('modal__card', 'card', className)}>
        {children}
      </div>
    </div>
  )
}

export default Modal
