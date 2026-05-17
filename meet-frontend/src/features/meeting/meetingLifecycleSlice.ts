import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import {
  DEFAULT_MEETING_LIFECYCLE,
  type MeetingLifecycleState,
} from './meetingLifecycleTypes'

export type MeetingLifecycleSliceState = MeetingLifecycleState & {
  /** True after REST or Socket.IO has supplied lifecycle at least once. */
  hydrated: boolean
  /** Bumped when meeting becomes live so SFU reconnects after pause/resume. */
  sfuSessionKey: number
}

const initialState: MeetingLifecycleSliceState = {
  ...DEFAULT_MEETING_LIFECYCLE,
  hydrated: false,
  sfuSessionKey: 0,
}

const meetingLifecycleSlice = createSlice({
  name: 'meetingLifecycle',
  initialState,
  reducers: {
    setMeetingLifecycle: (state, action: PayloadAction<MeetingLifecycleState>) => {
      const prevStatus = state.status
      state.status = action.payload.status
      state.startedAt = action.payload.startedAt
      state.startedBy = action.payload.startedBy
      state.pausedAt = action.payload.pausedAt
      state.hydrated = true
      if (action.payload.status === 'started' && prevStatus !== 'started') {
        state.sfuSessionKey += 1
      }
    },
    resetMeetingLifecycle: () => initialState,
  },
})

export const { setMeetingLifecycle, resetMeetingLifecycle } = meetingLifecycleSlice.actions

export const selectMeetingLifecycle = (state: RootState) => state.meetingLifecycle
export const selectMeetingLifecycleHydrated = (state: RootState) => state.meetingLifecycle.hydrated
export const selectMeetingStatus = (state: RootState) => state.meetingLifecycle.status
export const selectIsMeetingLive = (state: RootState) => state.meetingLifecycle.status === 'started'
export const selectIsMeetingPaused = (state: RootState) => state.meetingLifecycle.status === 'paused'
export const selectSfuSessionKey = (state: RootState) => state.meetingLifecycle.sfuSessionKey

export default meetingLifecycleSlice.reducer
