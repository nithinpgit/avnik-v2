import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { dismissToast, selectToasts } from './notificationsSlice'
import './notificationStack.css'

export function NotificationStack() {
  const dispatch = useAppDispatch()
  const toasts = useAppSelector(selectToasts)

  return (
    <div className="notification-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          variant={toast.variant}
          durationMs={toast.durationMs}
          onDismiss={() => dispatch(dismissToast(toast.id))}
        />
      ))}
    </div>
  )
}

function ToastItem({
  id,
  message,
  variant,
  durationMs,
  onDismiss,
}: {
  id: string
  message: string
  variant: 'success' | 'error' | 'info'
  durationMs: number
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(t)
  }, [id, durationMs, onDismiss])

  return (
    <div className={`notification-toast notification-toast--${variant}`} role="status">
      <span className="notification-toast__message">{message}</span>
      <button type="button" className="notification-toast__close" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}
