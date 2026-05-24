import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { pushToast } from '../documents/notificationsSlice'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { selectMeetingRoomId } from '../meetingSession/meetingSessionSlice'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import { closeParticipantMenu } from '../videoConference/videoConferenceSlice'
import {
  closeKickConfirm,
  openKickConfirm,
  selectKickConfirmTarget,
  selectUserModeration,
} from './participantModerationSlice'
import type { ParticipantControlAction } from './participantModerationTypes'

export function useParticipantModeration() {
  const dispatch = useAppDispatch()
  const { socket } = useMeetingSocket()
  const roomId = useAppSelector(selectMeetingRoomId)
  const isHost = useIsMeetingHost()

  const emitControl = useCallback(
    (targetUserId: string, action: ParticipantControlAction) => {
      if (!isHost || !socket?.connected || !roomId) {
        dispatch(pushToast({ message: 'Only the host can control participants.', variant: 'error' }))
        return
      }
      socket.emit('participant_control', { roomId, targetUserId, action })
      dispatch(closeParticipantMenu())
    },
    [dispatch, isHost, roomId, socket],
  )

  const requestKick = useCallback(
    (targetUserId: string, targetName: string) => {
      dispatch(closeParticipantMenu())
      dispatch(openKickConfirm({ userId: targetUserId, name: targetName }))
    },
    [dispatch],
  )

  const confirmKick = useCallback(() => {
    const target = selectKickConfirmTarget(store.getState())
    if (!target) return
    emitControl(target.userId, 'kick')
    dispatch(closeKickConfirm())
    dispatch(
      pushToast({
        message: `${target.name} was removed from the meeting.`,
        variant: 'info',
        durationMs: 3500,
      }),
    )
  }, [dispatch, emitControl])

  const cancelKick = useCallback(() => {
    dispatch(closeKickConfirm())
  }, [dispatch])

  return {
    emitControl,
    requestKick,
    confirmKick,
    cancelKick,
  }
}

export function useParticipantModerationState(userId: string) {
  return useAppSelector(selectUserModeration(userId))
}
