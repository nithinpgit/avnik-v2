import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'

export type ParticipantRole = 'host' | 'participant'

export type Participant = {
  id: string
  name: string
  role: ParticipantRole
  profileImage?: string | null
}

export type CameraStatus = 'idle' | 'pending' | 'ready' | 'denied' | 'error'

type VideoConferenceState = {
  isConferenceMode: boolean
  participants: Participant[]
  /** Participant id that receives the local getUserMedia preview (self). */
  localParticipantId: string
  /** Local camera stream — non-serializable; ignored in store middleware checks. */
  localStream: MediaStream | null
  cameraStatus: CameraStatus
  cameraErrorMessage: string | null
  openParticipantMenuId: string | null
}

const initialState: VideoConferenceState = {
  isConferenceMode: false,
  participants: [],
  localParticipantId: '',
  localStream: null,
  cameraStatus: 'idle',
  cameraErrorMessage: null,
  openParticipantMenuId: null,
}

function sortParticipants(peers: Participant[]): Participant[] {
  return [...peers].sort((a, b) => {
    if (a.role === 'host' && b.role !== 'host') return -1
    if (b.role === 'host' && a.role !== 'host') return 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

const videoConferenceSlice = createSlice({
  name: 'videoConference',
  initialState,
  reducers: {
    toggleConferenceMode: (state) => {
      state.isConferenceMode = !state.isConferenceMode
    },
    setLocalParticipantId: (state, action: PayloadAction<string>) => {
      state.localParticipantId = action.payload
    },
    applyRoomSnapshot: (state, action: PayloadAction<{ peers: Participant[] }>) => {
      state.participants = sortParticipants(action.payload.peers)
    },
    upsertParticipant: (state, action: PayloadAction<Participant>) => {
      const idx = state.participants.findIndex((p) => p.id === action.payload.id)
      if (idx >= 0) {
        state.participants[idx] = action.payload
      } else {
        state.participants.push(action.payload)
      }
      state.participants = sortParticipants(state.participants)
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participants = state.participants.filter((p) => p.id !== action.payload)
    },
    setLocalStream: (state, action: PayloadAction<MediaStream | null>) => {
      state.localStream = action.payload
    },
    setCameraStatus: (state, action: PayloadAction<CameraStatus>) => {
      state.cameraStatus = action.payload
    },
    setCameraErrorMessage: (state, action: PayloadAction<string | null>) => {
      state.cameraErrorMessage = action.payload
    },
    toggleParticipantMenu: (state, action: PayloadAction<string>) => {
      state.openParticipantMenuId =
        state.openParticipantMenuId === action.payload ? null : action.payload
    },
    closeParticipantMenu: (state) => {
      state.openParticipantMenuId = null
    },
  },
})

export const {
  toggleConferenceMode,
  setLocalParticipantId,
  applyRoomSnapshot,
  upsertParticipant,
  removeParticipant,
  setLocalStream,
  setCameraStatus,
  setCameraErrorMessage,
  toggleParticipantMenu,
  closeParticipantMenu,
} = videoConferenceSlice.actions

export const selectConferenceMode = (state: RootState) =>
  state.videoConference.isConferenceMode
export const selectParticipants = (state: RootState) => state.videoConference.participants
export const selectLocalParticipantId = (state: RootState) =>
  state.videoConference.localParticipantId
export const selectLocalStream = (state: RootState) => state.videoConference.localStream
export const selectCameraStatus = (state: RootState) => state.videoConference.cameraStatus
export const selectCameraErrorMessage = (state: RootState) =>
  state.videoConference.cameraErrorMessage
export const selectOpenParticipantMenuId = (state: RootState) =>
  state.videoConference.openParticipantMenuId

export default videoConferenceSlice.reducer
