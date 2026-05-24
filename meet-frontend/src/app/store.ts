import { configureStore } from '@reduxjs/toolkit'
import documentsReducer from '../features/documents/documentsSlice'
import videoShareReducer from '../features/videoShare/videoShareSlice'
import participantModerationReducer from '../features/participantControls/participantModerationSlice'
import notificationsReducer from '../features/documents/notificationsSlice'
import meetingLifecycleReducer from '../features/meeting/meetingLifecycleSlice'
import meetingSessionReducer from '../features/meetingSession/meetingSessionSlice'
import roomSyncReducer from '../features/roomSync/roomSyncSlice'
import whiteboardReducer from '../features/whiteboard/whiteboardSlice'
import preMeetingReducer from '../features/preMeeting/preMeetingSlice'
import videoConferenceReducer from '../features/videoConference/videoConferenceSlice'

export const store = configureStore({
  reducer: {
    whiteboard: whiteboardReducer,
    preMeeting: preMeetingReducer,
    meetingSession: meetingSessionReducer,
    meetingLifecycle: meetingLifecycleReducer,
    documents: documentsReducer,
    videoShare: videoShareReducer,
    participantModeration: participantModerationReducer,
    notifications: notificationsReducer,
    roomSync: roomSyncReducer,
    videoConference: videoConferenceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'videoConference/setLocalStream',
        ],
        ignoredPaths: ['videoConference.localStream', 'roomSync.channels'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
