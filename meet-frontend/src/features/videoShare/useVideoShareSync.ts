import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { PRESENTATION_CHANNEL } from '../documents/presentationTypes'
import { selectIsMeetingLive } from '../meeting/meetingLifecycleSlice'
import { useMeetingPermissions } from '../participantControls/useMeetingPermissions'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import { pushToast } from '../documents/notificationsSlice'
import type { RoomFileRecord } from '../documents/presentationTypes'
import {
  VIDEO_SHARE_CHANNEL,
  isVideoLibraryExtension,
  parseVideoSharePayload,
  videoShareSourceFromFile,
  youtubeIdFromFile,
  type VideoShareSyncPayload,
} from './videoShareTypes'
import { selectActiveVideoShare, setVideoShare } from './videoShareSlice'

export function useVideoShareSync() {
  const dispatch = useAppDispatch()
  const { emitRoomSync } = useMeetingSocket()
  const { canPresentContent } = useMeetingPermissions()
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const videoShareDoc = useAppSelector((s) => s.roomSync.channels[VIDEO_SHARE_CHANNEL])

  useEffect(() => {
    const parsed = parseVideoSharePayload(videoShareDoc)
    dispatch(setVideoShare(parsed))
  }, [videoShareDoc, dispatch])

  const emitVideoShare = useCallback(
    (payload: VideoShareSyncPayload | null) => {
      dispatch(setVideoShare(payload))
      emitRoomSync(VIDEO_SHARE_CHANNEL, payload ?? { active: false })
    },
    [dispatch, emitRoomSync],
  )

  const buildPayloadFromFile = useCallback((file: RoomFileRecord): VideoShareSyncPayload => {
    const source = videoShareSourceFromFile(file.extension)
    return {
      active: true,
      source,
      fileId: file.id,
      fileUrl: file.url,
      originalName: file.originalName,
      extension: file.extension,
      youtubeVideoId: youtubeIdFromFile(file.extension, file.storedName),
      currentTimeSec: 0,
      isPlaying: true,
      durationSec: 0,
    }
  }, [])

  const loadVideoShare = useCallback(
    async (file: RoomFileRecord) => {
      if (!canPresentContent) {
        dispatch(pushToast({ message: 'Only the host or a presenter can share a video.', variant: 'error' }))
        return
      }
      if (!meetingLive) {
        dispatch(
          pushToast({
            message: 'Start the meeting before sharing a video.',
            variant: 'error',
          }),
        )
        return
      }
      if (!isVideoLibraryExtension(file.extension)) {
        dispatch(pushToast({ message: 'Only MP4 or YouTube videos can be shared.', variant: 'error' }))
        return
      }

      emitRoomSync(PRESENTATION_CHANNEL, { active: false })
      const payload = buildPayloadFromFile(file)
      emitVideoShare(payload)
      dispatch(
        pushToast({ message: 'Video shared with everyone.', variant: 'success', durationMs: 3500 }),
      )
    },
    [buildPayloadFromFile, dispatch, emitRoomSync, emitVideoShare, canPresentContent, meetingLive],
  )

  const closeVideoShare = useCallback(() => {
    if (!canPresentContent) return
    emitVideoShare(null)
    dispatch(pushToast({ message: 'Video closed.', variant: 'info', durationMs: 2500 }))
  }, [dispatch, emitVideoShare, canPresentContent])

  const patchVideoShare = useCallback(
    (patch: Partial<VideoShareSyncPayload>) => {
      if (!canPresentContent) return
      const prev = store.getState().videoShare.videoShare
      if (!prev) return
      emitVideoShare({ ...prev, ...patch })
    },
    [emitVideoShare, canPresentContent],
  )

  const videoShare = useAppSelector(selectActiveVideoShare)

  return {
    videoShare,
    loadVideoShare,
    closeVideoShare,
    patchVideoShare,
  }
}
