import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'

export type MeetingRole = 'host' | 'participant'

export type MeetingSessionState = {
  roomId: string | null
  userId: string | null
  displayName: string
  role: MeetingRole
  profileImage: string | null
  /** True after URL was parsed (browser only). */
  initialized: boolean
}

function parseSearch(search: string): Omit<MeetingSessionState, 'initialized'> {
  const params = new URLSearchParams(search)
  const id =
    params.get('id')?.trim() || params.get('roomId')?.trim() || 'default-room'
  const userId =
    params.get('userId')?.trim() ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `guest-${crypto.randomUUID().slice(0, 8)}`
      : `guest-${Math.random().toString(36).slice(2, 10)}`)
  const name = params.get('name')?.trim() || params.get('displayName')?.trim() || 'Guest'
  const roleParam = params.get('role')?.trim().toLowerCase()
  const role: MeetingRole = roleParam === 'host' ? 'host' : 'participant'
  const profileImage = params.get('profileImage')?.trim() || null
  return {
    roomId: id,
    userId,
    displayName: name || 'Guest',
    role,
    profileImage,
  }
}

const initialState: MeetingSessionState = {
  roomId: null,
  userId: null,
  displayName: 'Guest',
  role: 'participant',
  profileImage: null,
  initialized: false,
}

const meetingSessionSlice = createSlice({
  name: 'meetingSession',
  initialState,
  reducers: {
    initMeetingSessionFromLocation: (state) => {
      if (typeof window === 'undefined' || state.initialized) {
        return
      }
      const parsed = parseSearch(window.location.search)
      state.roomId = parsed.roomId
      state.userId = parsed.userId
      state.displayName = parsed.displayName
      state.role = parsed.role
      state.profileImage = parsed.profileImage
      state.initialized = true
    },
    /** For tests or future deep links without reload. */
    setMeetingSession: (state, action: PayloadAction<Partial<MeetingSessionState>>) => {
      Object.assign(state, action.payload)
      state.initialized = true
    },
  },
})

export const { initMeetingSessionFromLocation, setMeetingSession } = meetingSessionSlice.actions

export const selectMeetingSession = (state: RootState) => state.meetingSession
export const selectMeetingRoomId = (state: RootState) => state.meetingSession.roomId
export const selectMeetingUserId = (state: RootState) => state.meetingSession.userId
export const selectMeetingDisplayName = (state: RootState) => state.meetingSession.displayName
export const selectMeetingRole = (state: RootState) => state.meetingSession.role
export const selectMeetingProfileImage = (state: RootState) => state.meetingSession.profileImage
export const selectMeetingSessionInitialized = (state: RootState) => state.meetingSession.initialized

export default meetingSessionSlice.reducer
