import './App.css'
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { initMeetingSessionFromLocation, selectMeetingUserId } from './features/meetingSession/meetingSessionSlice'
import { MeetingChatProvider } from './features/chat/MeetingChatProvider'
import { MediasoupMediaProvider } from './features/mediasoup/MediasoupMediaProvider'
import { MeetingSocketProvider } from './features/meetingRoom/MeetingSocketProvider'
import { PreMeetingModal } from './features/preMeeting/PreMeetingModal'
import { setLocalParticipantId } from './features/videoConference/videoConferenceSlice'
import { VideoConferenceModule } from './features/videoConference/VideoConferenceModule'
import { WhiteboardModule } from './features/whiteboard/WhiteboardModule'

function App() {
  const dispatch = useAppDispatch()
  const meetingUserId = useAppSelector(selectMeetingUserId)

  useEffect(() => {
    dispatch(initMeetingSessionFromLocation())
  }, [dispatch])

  useEffect(() => {
    if (meetingUserId) {
      dispatch(setLocalParticipantId(meetingUserId))
    }
  }, [meetingUserId, dispatch])

  return (
    <main className="app-shell">
      <MeetingSocketProvider>
        <MeetingChatProvider>
          <MediasoupMediaProvider>
            <WhiteboardModule />
            <VideoConferenceModule />
            <PreMeetingModal />
          </MediasoupMediaProvider>
        </MeetingChatProvider>
      </MeetingSocketProvider>
    </main>
  )
}

export default App
