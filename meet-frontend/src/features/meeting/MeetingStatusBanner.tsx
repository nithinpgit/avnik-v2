import { useAppSelector } from '../../app/hooks'
import { selectMeetingStatus } from './meetingLifecycleSlice'
import { useIsMeetingHost } from './useIsMeetingHost'

export function MeetingStatusBanner() {
  const status = useAppSelector(selectMeetingStatus)
  const host = useIsMeetingHost()

  if (status === 'started') {
    return null
  }

  let message: string
  if (status === 'paused') {
    message = host
      ? 'Meeting is paused. Resume when you are ready to continue.'
      : 'Host paused the meeting. Please wait until they resume.'
  } else if (status === 'ended') {
    message = 'This meeting has ended.'
  } else if (host) {
    message = 'Meeting not started yet. Click play button on the left to start timer.'
  } else {
    message = 'Meeting not started yet. Please wait until the host starts the meeting.'
  }

  return (
    <div className="meeting-status-banner" role="status" aria-live="polite">
      {message}
    </div>
  )
}
