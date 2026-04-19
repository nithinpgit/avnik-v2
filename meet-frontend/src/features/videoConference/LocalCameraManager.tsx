import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import {
  selectPreMeetingEntryCompleted,
  selectPreMeetingOpen,
  selectPreMeetingWantsVideo,
} from '../preMeeting/preMeetingSlice'
import {
  setCameraErrorMessage,
  setCameraStatus,
  setLocalStream,
} from './videoConferenceSlice'

/**
 * Acquires the local camera when there is no stream yet (e.g. after pre-meeting
 * closed without a preview stream). Skips while the pre-meeting modal is open or
 * when the user chose not to use video.
 */
export function LocalCameraManager() {
  const dispatch = useAppDispatch()
  const preMeetingOpen = useAppSelector(selectPreMeetingOpen)
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const wantsVideo = useAppSelector(selectPreMeetingWantsVideo)

  useEffect(() => {
    if (preMeetingOpen) {
      return
    }
    if (store.getState().videoConference.localStream) {
      return
    }
    if (entryCompleted && !wantsVideo) {
      dispatch(setCameraStatus('idle'))
      dispatch(setCameraErrorMessage(null))
      return
    }

    let stream: MediaStream | null = null
    let cancelled = false

    dispatch(setCameraStatus('pending'))
    dispatch(setCameraErrorMessage(null))

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        dispatch(setLocalStream(s))
        dispatch(setCameraStatus('ready'))
      })
      .catch((err: Error) => {
        if (cancelled) return
        dispatch(setLocalStream(null))
        dispatch(setCameraStatus(err.name === 'NotAllowedError' ? 'denied' : 'error'))
        dispatch(setCameraErrorMessage(err.message))
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      dispatch(setLocalStream(null))
      dispatch(setCameraStatus('idle'))
      dispatch(setCameraErrorMessage(null))
    }
  }, [preMeetingOpen, entryCompleted, wantsVideo, dispatch])

  return null
}
