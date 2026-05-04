import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'

export type PreMeetingMediaMode = 'webcam_only' | 'mic_only' | 'both' | 'none'

type PreMeetingState = {
  isOpen: boolean
  /** Set true after user clicks Enter; coordinates camera acquisition. */
  entryCompleted: boolean
  /** Whether the user chose a mode that includes camera preview in the meeting. */
  wantsVideo: boolean
  lastMediaMode: PreMeetingMediaMode | null
}

const initialState: PreMeetingState = {
  isOpen: true,
  entryCompleted: false,
  wantsVideo: true,
  lastMediaMode: null,
}

const preMeetingSlice = createSlice({
  name: 'preMeeting',
  initialState,
  reducers: {
    completePreMeeting: (
      state,
      action: PayloadAction<{ wantsVideo: boolean; mediaMode: PreMeetingMediaMode }>,
    ) => {
      state.isOpen = false
      state.entryCompleted = true
      state.wantsVideo = action.payload.wantsVideo
      state.lastMediaMode = action.payload.mediaMode
    },
  },
})

export const { completePreMeeting } = preMeetingSlice.actions

export const selectPreMeetingOpen = (state: RootState) => state.preMeeting.isOpen
export const selectPreMeetingEntryCompleted = (state: RootState) =>
  state.preMeeting.entryCompleted
export const selectPreMeetingWantsVideo = (state: RootState) => state.preMeeting.wantsVideo
export const selectPreMeetingLastMediaMode = (state: RootState) => state.preMeeting.lastMediaMode

export default preMeetingSlice.reducer
