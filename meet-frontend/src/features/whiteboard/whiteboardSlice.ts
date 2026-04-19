import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'

export type WhiteboardTheme = 'light' | 'dark'

type WhiteboardState = {
  theme: WhiteboardTheme
}

const initialState: WhiteboardState = {
  theme: 'light',
}

const whiteboardSlice = createSlice({
  name: 'whiteboard',
  initialState,
  reducers: {
    setWhiteboardTheme: (state, action: PayloadAction<WhiteboardTheme>) => {
      state.theme = action.payload
    },
  },
})

export const { setWhiteboardTheme } = whiteboardSlice.actions
export const selectWhiteboardTheme = (state: RootState) => state.whiteboard.theme
export default whiteboardSlice.reducer
