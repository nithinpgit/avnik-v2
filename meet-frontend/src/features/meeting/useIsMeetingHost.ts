import { useMemo } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectMeetingRole, selectMeetingUserId } from '../meetingSession/meetingSessionSlice'
import { selectParticipants } from '../videoConference/videoConferenceSlice'

/** Host if URL/session role is host, or the peer list marks this user as host. */
export function useIsMeetingHost(): boolean {
  const userId = useAppSelector(selectMeetingUserId)
  const sessionRole = useAppSelector(selectMeetingRole)
  const participants = useAppSelector(selectParticipants)

  return useMemo(() => {
    if (sessionRole === 'host') return true
    if (!userId) return false
    return participants.some((p) => p.id === userId && p.role === 'host')
  }, [sessionRole, userId, participants])
}
