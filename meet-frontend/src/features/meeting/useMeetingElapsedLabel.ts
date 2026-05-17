import { useEffect, useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectMeetingLifecycle } from './meetingLifecycleSlice'

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** `24:00:00` before start; live elapsed `HH:MM:SS` from server `startedAt` when started. */
export function useMeetingElapsedLabel(): string {
  const { status, startedAt } = useAppSelector(selectMeetingLifecycle)
  const [label, setLabel] = useState('24:00:00')

  useEffect(() => {
    if (status !== 'started' || !startedAt) {
      setLabel('24:00:00')
      return
    }

    const startedMs = Date.parse(startedAt)
    if (Number.isNaN(startedMs)) {
      setLabel('00:00:00')
      return
    }

    const tick = () => setLabel(formatElapsed(Date.now() - startedMs))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [status, startedAt])

  return label
}
