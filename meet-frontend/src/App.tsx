import './App.css'
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import { initMeetingSessionFromLocation, selectMeetingUserId } from './features/meetingSession/meetingSessionSlice'
import { MeetingChatChrome } from './features/chat/MeetingChatChrome'
import { MeetingChatProvider } from './features/chat/MeetingChatProvider'
import { MediasoupMediaProvider } from './features/mediasoup/MediasoupMediaProvider'
import { MeetingSocketProvider } from './features/meetingRoom/MeetingSocketProvider'
import { NotificationStack } from './features/documents/NotificationStack'
import { ShareDocumentModal } from './features/documents/ShareDocumentModal'
import { ShareVideoModal } from './features/videoShare/ShareVideoModal'
import { KickUserConfirmModal } from './features/participantControls/KickUserConfirmModal'
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
            <MeetingChatChrome />
            <PreMeetingModal />
            <ShareDocumentModal />
            <ShareVideoModal />
            <KickUserConfirmModal />
            <NotificationStack />
          </MediasoupMediaProvider>
        </MeetingChatProvider>
      </MeetingSocketProvider>
    </main>
  )
}

export default App
