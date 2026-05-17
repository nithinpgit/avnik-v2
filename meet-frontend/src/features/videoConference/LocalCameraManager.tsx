import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { mediaConstraintsFor } from '../preMeeting/mediaDeviceUtils'
import { selectIsMeetingLive } from '../meeting/meetingLifecycleSlice'
import {
  selectPreMeetingEntryCompleted,
  selectPreMeetingLastMediaMode,
  selectPreMeetingOpen,
  selectPreferredAudioDeviceId,
  selectPreferredVideoDeviceId,
} from '../preMeeting/preMeetingSlice'
import {
  setCameraErrorMessage,
  setCameraStatus,
  setLocalStream,
} from './videoConferenceSlice'

/**
 * Ensures a local MediaStream exists for the meeting when pre-meeting did not leave one
 * (e.g. user skipped device preview). Constraints follow `lastMediaMode` and saved device ids.
 */
export function LocalCameraManager() {
  const dispatch = useAppDispatch()
  const preMeetingOpen = useAppSelector(selectPreMeetingOpen)
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const lastMediaMode = useAppSelector(selectPreMeetingLastMediaMode)
  const preferredVideoDeviceId = useAppSelector(selectPreferredVideoDeviceId)
  const preferredAudioDeviceId = useAppSelector(selectPreferredAudioDeviceId)

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

    const cons = mediaConstraintsFor(
      mode,
      preferredVideoDeviceId ?? '',
      preferredAudioDeviceId ?? '',
    )
    if (!cons) {
      return
    }

    let stream: MediaStream | null = null
    let cancelled = false

    dispatch(setCameraStatus('pending'))
    dispatch(setCameraErrorMessage(null))

    navigator.mediaDevices
      .getUserMedia(cons)
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        dispatch(setLocalStream(s))
        const wantsVideo = mode === 'both' || mode === 'webcam_only'
        if (wantsVideo) {
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
  }, [
    preMeetingOpen,
    entryCompleted,
    meetingLive,
    lastMediaMode,
    preferredVideoDeviceId,
    preferredAudioDeviceId,
    dispatch,
  ])

  return null
}
