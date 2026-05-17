export const MEETING_LIFECYCLE_CHANNEL = 'meeting_lifecycle'

export type MeetingLifecycleStatus = 'not_started' | 'started' | 'paused' | 'ended'

export type MeetingLifecycleState = {
  status: MeetingLifecycleStatus
  startedAt: string | null
  startedBy: string | null
  /** Set when host pauses; used to freeze the elapsed timer display. */
  pausedAt: string | null
}

export const DEFAULT_MEETING_LIFECYCLE: MeetingLifecycleState = {
  status: 'not_started',
  startedAt: null,
  startedBy: null,
  pausedAt: null,
}
