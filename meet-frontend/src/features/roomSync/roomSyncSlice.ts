import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'

export type RoomSyncState = {
  /** Latest persisted document per logical channel (whiteboard, future features). */
  channels: Record<string, unknown>
}

const initialState: RoomSyncState = {
  channels: {},
}

const roomSyncSlice = createSlice({
  name: 'roomSync',
  initialState,
  reducers: {
    /** Full replace/merge after join or server-driven snapshot. */
    applyRoomSyncBulk: (state, action: PayloadAction<{ states: Record<string, unknown> }>) => {
      state.channels = { ...state.channels, ...action.payload.states }
    },
    /** Single channel update from another participant. */
    applyRoomSyncPatch: (state, action: PayloadAction<{ channel: string; payload: unknown }>) => {
      state.channels[action.payload.channel] = action.payload.payload
    },
    resetRoomSync: () => initialState,
  },
})

export const { applyRoomSyncBulk, applyRoomSyncPatch, resetRoomSync } = roomSyncSlice.actions

export const selectRoomSyncChannels = (state: RootState) => state.roomSync.channels
export const selectRoomSyncChannel =
  (channel: string) =>
  (state: RootState): unknown =>
    state.roomSync.channels[channel]

export default roomSyncSlice.reducer
