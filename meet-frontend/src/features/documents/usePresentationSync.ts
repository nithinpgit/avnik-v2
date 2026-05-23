import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { selectIsMeetingLive } from '../meeting/meetingLifecycleSlice'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import { pushToast } from './notificationsSlice'
import { setPresentation, selectActivePresentation } from './documentsSlice'
import { patchFilePageCount } from './documentsApi'
import { getPdfPageCount } from './pdfUtils'
import {
  PRESENTATION_CHANNEL,
  parsePresentationPayload,
  type PresentationSyncPayload,
  type RoomFileRecord,
  isPresentableExtension,
} from './presentationTypes'
import { VIDEO_SHARE_CHANNEL } from '../videoShare/videoShareTypes'

export function usePresentationSync() {
  const dispatch = useAppDispatch()
  const { emitRoomSync } = useMeetingSocket()
  const isHost = useIsMeetingHost()
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const presentationDoc = useAppSelector((s) => s.roomSync.channels[PRESENTATION_CHANNEL])

  useEffect(() => {
    const parsed = parsePresentationPayload(presentationDoc)
    dispatch(setPresentation(parsed))
  }, [presentationDoc, dispatch])

  const emitPresentation = useCallback(
    (payload: PresentationSyncPayload | null) => {
      dispatch(setPresentation(payload))
      emitRoomSync(PRESENTATION_CHANNEL, payload ?? { active: false })
    },
    [dispatch, emitRoomSync],
  )

  const resolvePageCount = useCallback(async (file: RoomFileRecord): Promise<number> => {
    if (file.extension !== 'pdf') return 1
    if (file.pageCount > 1) return file.pageCount
    try {
      const count = await getPdfPageCount(file.url)
      if (count > 1) {
        void patchFilePageCount(file.id, count).catch(() => undefined)
      }
      return count
    } catch {
      return file.pageCount || 1
    }
  }, [])

  const loadPresentation = useCallback(
    async (file: RoomFileRecord) => {
      if (!isHost) {
        dispatch(pushToast({ message: 'Only the host can share a document.', variant: 'error' }))
        return
      }
      if (!meetingLive) {
        dispatch(
          pushToast({
            message: 'Start the meeting before sharing a document.',
            variant: 'error',
          }),
        )
        return
      }
      if (!isPresentableExtension(file.extension)) {
        dispatch(
          pushToast({
            message: 'Only PDF and image files can be presented on the whiteboard.',
            variant: 'error',
          }),
        )
        return
      }

      let pageCount = file.pageCount
      try {
        pageCount = await resolvePageCount(file)
      } catch {
        dispatch(pushToast({ message: 'Could not read document pages.', variant: 'error' }))
        return
      }

      emitRoomSync(VIDEO_SHARE_CHANNEL, { active: false })

      const payload: PresentationSyncPayload = {
        active: true,
        fileId: file.id,
        fileUrl: file.url,
        originalName: file.originalName,
        mimeType: file.mimeType,
        extension: file.extension,
        pageCount,
        currentPage: 1,
        zoomPercent: 100,
      }
      emitPresentation(payload)
      dispatch(
        pushToast({ message: 'Document shared with everyone.', variant: 'success', durationMs: 3500 }),
      )
    },
    [dispatch, emitPresentation, emitRoomSync, isHost, meetingLive, resolvePageCount],
  )

  const closePresentation = useCallback(() => {
    if (!isHost) return
    emitPresentation(null)
    dispatch(pushToast({ message: 'Document closed.', variant: 'info', durationMs: 2500 }))
  }, [dispatch, emitPresentation, isHost])

  const patchPresentation = useCallback(
    (patch: Partial<PresentationSyncPayload>) => {
      if (!isHost) return
      const prev = store.getState().documents.presentation
      if (!prev) return
      emitPresentation({ ...prev, ...patch })
    },
    [emitPresentation, isHost],
  )

  const presentation = useAppSelector(selectActivePresentation)

  return {
    presentation,
    loadPresentation,
    closePresentation,
    patchPresentation,
  }
}
