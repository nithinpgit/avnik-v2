export const MEETING_LIFECYCLE_CHANNEL = 'meeting_lifecycle'

export type MeetingLifecycleStatus = 'not_started' | 'started' | 'paused' | 'ended'

export type MeetingLifecycleState = {
  status: MeetingLifecycleStatus
  startedAt: string | null
  startedBy: string | null
}

export const DEFAULT_MEETING_LIFECYCLE: MeetingLifecycleState = {
  status: 'not_started',
  startedAt: null,
  startedBy: null,
}

export function parseMeetingLifecycle(raw: unknown): MeetingLifecycleState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_MEETING_LIFECYCLE }
  }
  const o = raw as Record<string, unknown>
  const valid: MeetingLifecycleStatus[] = ['not_started', 'started', 'paused', 'ended']
  const status = o.status as MeetingLifecycleStatus
  return {
    status: valid.includes(status) ? status : 'not_started',
    startedAt: typeof o.startedAt === 'string' ? o.startedAt : null,
    startedBy: typeof o.startedBy === 'string' ? o.startedBy : null,
  }
}
