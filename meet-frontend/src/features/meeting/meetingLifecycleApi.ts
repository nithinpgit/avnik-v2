import { resolveMeetingApiPath } from '../meetingRoom/socketUrl'
import type { MeetingLifecycleState } from './meetingLifecycleTypes'
import { parseMeetingLifecycle } from './meetingLifecycleTypes'

export async function fetchMeetingLifecycle(roomId: string): Promise<MeetingLifecycleState> {
  const res = await fetch(resolveMeetingApiPath(`/api/rooms/${encodeURIComponent(roomId)}/lifecycle`), {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`meeting lifecycle ${res.status}`)
  }
  const data = (await res.json()) as { meeting?: unknown }
  return parseMeetingLifecycle(data.meeting)
}
