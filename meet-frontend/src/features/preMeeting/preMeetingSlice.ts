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
  preferredVideoDeviceId: string | null
  preferredAudioDeviceId: string | null
  preferredAudioOutputDeviceId: string | null
}

const initialState: PreMeetingState = {
  isOpen: true,
  entryCompleted: false,
  wantsVideo: true,
  lastMediaMode: null,
  preferredVideoDeviceId: null,
  preferredAudioDeviceId: null,
  preferredAudioOutputDeviceId: null,
}

export type MediaDevicePreferences = {
  videoDeviceId?: string
  audioDeviceId?: string
  audioOutputDeviceId?: string
}

function applyDevicePreferences(state: PreMeetingState, prefs?: MediaDevicePreferences) {
  if (prefs?.videoDeviceId) state.preferredVideoDeviceId = prefs.videoDeviceId
  if (prefs?.audioDeviceId) state.preferredAudioDeviceId = prefs.audioDeviceId
  if (prefs?.audioOutputDeviceId) state.preferredAudioOutputDeviceId = prefs.audioOutputDeviceId
}

const preMeetingSlice = createSlice({
  name: 'preMeeting',
  initialState,
  reducers: {
    completePreMeeting: (
      state,
      action: PayloadAction<{
        wantsVideo: boolean
        mediaMode: PreMeetingMediaMode
      } & MediaDevicePreferences>,
    ) => {
      state.isOpen = false
      state.entryCompleted = true
      state.wantsVideo = action.payload.wantsVideo
      state.lastMediaMode = action.payload.mediaMode
      applyDevicePreferences(state, action.payload)
    },
    openPreMeetingSettings: (state) => {
      if (state.entryCompleted) {
        state.isOpen = true
      }
    },
    closePreMeetingModal: (state) => {
      state.isOpen = false
    },
    applyMeetingMediaSettings: (
      state,
      action: PayloadAction<{
        wantsVideo: boolean
        mediaMode: PreMeetingMediaMode
      } & MediaDevicePreferences>,
    ) => {
      state.wantsVideo = action.payload.wantsVideo
      state.lastMediaMode = action.payload.mediaMode
      applyDevicePreferences(state, action.payload)
    },
  },
})

export const {
  completePreMeeting,
  openPreMeetingSettings,
  closePreMeetingModal,
  applyMeetingMediaSettings,
} = preMeetingSlice.actions

export const selectPreMeetingOpen = (state: RootState) => state.preMeeting.isOpen
export const selectPreMeetingEntryCompleted = (state: RootState) =>
  state.preMeeting.entryCompleted
export const selectPreMeetingWantsVideo = (state: RootState) => state.preMeeting.wantsVideo
export const selectPreMeetingLastMediaMode = (state: RootState) => state.preMeeting.lastMediaMode
export const selectPreferredVideoDeviceId = (state: RootState) =>
  state.preMeeting.preferredVideoDeviceId
export const selectPreferredAudioDeviceId = (state: RootState) =>
  state.preMeeting.preferredAudioDeviceId

export default preMeetingSlice.reducer
