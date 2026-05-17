import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import {
  DEFAULT_MEETING_LIFECYCLE,
  type MeetingLifecycleState,
} from './meetingLifecycleTypes'

export type MeetingLifecycleSliceState = MeetingLifecycleState & {
  /** True after REST or Socket.IO has supplied lifecycle at least once. */
  hydrated: boolean
}

const initialState: MeetingLifecycleSliceState = {
  ...DEFAULT_MEETING_LIFECYCLE,
  hydrated: false,
}

const meetingLifecycleSlice = createSlice({
  name: 'meetingLifecycle',
  initialState,
  reducers: {
    setMeetingLifecycle: (state, action: PayloadAction<MeetingLifecycleState>) => {
      state.status = action.payload.status
      state.startedAt = action.payload.startedAt
      state.startedBy = action.payload.startedBy
      state.hydrated = true
    },
    resetMeetingLifecycle: () => initialState,
  },
})

export const { setMeetingLifecycle, resetMeetingLifecycle } = meetingLifecycleSlice.actions

export const selectMeetingLifecycle = (state: RootState) => state.meetingLifecycle
export const selectMeetingLifecycleHydrated = (state: RootState) => state.meetingLifecycle.hydrated
export const selectMeetingStatus = (state: RootState) => state.meetingLifecycle.status
export const selectIsMeetingLive = (state: RootState) => state.meetingLifecycle.status === 'started'

export default meetingLifecycleSlice.reducer
