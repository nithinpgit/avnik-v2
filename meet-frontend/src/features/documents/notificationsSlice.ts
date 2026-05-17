import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'

export type AppToast = {
  id: string
  message: string
  variant: 'success' | 'error' | 'info'
  durationMs: number
}

type NotificationsState = {
  toasts: AppToast[]
}

const initialState: NotificationsState = {
  toasts: [],
}

let toastSeq = 0

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    pushToast: (
      state,
      action: PayloadAction<{ message: string; variant?: AppToast['variant']; durationMs?: number }>,
    ) => {
      toastSeq += 1
      state.toasts.push({
        id: `toast-${toastSeq}`,
        message: action.payload.message,
        variant: action.payload.variant ?? 'info',
        durationMs: action.payload.durationMs ?? 4000,
      })
    },
    dismissToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
  },
})

export const { pushToast, dismissToast } = notificationsSlice.actions

export const selectToasts = (state: RootState) => state.notifications.toasts

export default notificationsSlice.reducer
