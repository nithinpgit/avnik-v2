import { useMemo } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { selectMeetingUserId } from '../meetingSession/meetingSessionSlice'
import { selectUserModeration } from './participantModerationSlice'

export function useMeetingPermissions() {
  const userId = useAppSelector(selectMeetingUserId)
  const isHost = useIsMeetingHost()
  const selfModeration = useAppSelector(selectUserModeration(userId ?? ''))

  return useMemo(() => {
    const isPresenter = isHost || selfModeration.isPresenter
    return {
      isHost,
      isPresenter,
      canModerateParticipants: isHost,
      canPresentContent: isPresenter,
      canEditWhiteboard: isPresenter,
      canUseHostBulkControls: isHost,
    }
  }, [isHost, selfModeration.isPresenter, userId])
}
