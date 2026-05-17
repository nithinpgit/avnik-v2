import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { selectIsMeetingLive } from '../meeting/meetingLifecycleSlice'
import {
  selectPreMeetingEntryCompleted,
  selectPreMeetingLastMediaMode,
  selectPreMeetingOpen,
} from '../preMeeting/preMeetingSlice'
import {
  setCameraErrorMessage,
  setCameraStatus,
  setLocalStream,
} from './videoConferenceSlice'

/**
 * Ensures a local MediaStream exists for the meeting when pre-meeting did not leave one
 * (e.g. user skipped device preview). Constraints follow `lastMediaMode` so the SFU can publish
 * the right tracks.
 */
export function LocalCameraManager() {
  const dispatch = useAppDispatch()
  const preMeetingOpen = useAppSelector(selectPreMeetingOpen)
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const lastMediaMode = useAppSelector(selectPreMeetingLastMediaMode)

  useEffect(() => {
    if (preMeetingOpen || !entryCompleted || !meetingLive) {
      return
    }
    if (store.getState().videoConference.localStream) {
      return
    }

    const mode = lastMediaMode ?? 'none'

    if (mode === 'none') {
      dispatch(setCameraStatus('idle'))
      dispatch(setCameraErrorMessage(null))
      return
    }

    let stream: MediaStream | null = null
    let cancelled = false

    const videoCons =
      mode === 'both' || mode === 'webcam_only'
        ? ({ facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } as const)
        : false
    const audioCons = mode === 'both' || mode === 'mic_only'

    if (!videoCons && !audioCons) {
      return
    }

    dispatch(setCameraStatus('pending'))
    dispatch(setCameraErrorMessage(null))

    navigator.mediaDevices
      .getUserMedia({
        video: videoCons || false,
        audio: audioCons || false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        dispatch(setLocalStream(s))
        if (videoCons) {
          dispatch(setCameraStatus('ready'))
        } else {
          dispatch(setCameraStatus('idle'))
        }
        dispatch(setCameraErrorMessage(null))
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
  }, [preMeetingOpen, entryCompleted, meetingLive, lastMediaMode, dispatch])

  return null
}
