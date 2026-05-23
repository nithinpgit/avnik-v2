import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import type { RoomFileRecord } from '../documents/presentationTypes'
import type { VideoShareSyncPayload } from './videoShareTypes'

type VideoShareUiState = {
  shareModalOpen: boolean
  uploadProgress: number | null
  library: RoomFileRecord[]
  libraryLoading: boolean
  librarySearch: string
  videoShare: VideoShareSyncPayload | null
}

const initialState: VideoShareUiState = {
  shareModalOpen: false,
  uploadProgress: null,
  library: [],
  libraryLoading: false,
  librarySearch: '',
  videoShare: null,
}

const videoShareSlice = createSlice({
  name: 'videoShare',
  initialState,
  reducers: {
    openShareVideoModal: (state) => {
      state.shareModalOpen = true
    },
    closeShareVideoModal: (state) => {
      state.shareModalOpen = false
      state.uploadProgress = null
    },
    setVideoUploadProgress: (state, action: PayloadAction<number | null>) => {
      state.uploadProgress = action.payload
    },
    setVideoLibrary: (state, action: PayloadAction<RoomFileRecord[]>) => {
      state.library = action.payload
    },
    setVideoLibraryLoading: (state, action: PayloadAction<boolean>) => {
      state.libraryLoading = action.payload
    },
    setVideoLibrarySearch: (state, action: PayloadAction<string>) => {
      state.librarySearch = action.payload
    },
    setVideoShare: (state, action: PayloadAction<VideoShareSyncPayload | null>) => {
      state.videoShare = action.payload
    },
    resetVideoShare: () => initialState,
  },
})

export const {
  openShareVideoModal,
  closeShareVideoModal,
  setVideoUploadProgress,
  setVideoLibrary,
  setVideoLibraryLoading,
  setVideoLibrarySearch,
  setVideoShare,
  resetVideoShare,
} = videoShareSlice.actions

export const selectShareVideoModalOpen = (state: RootState) => state.videoShare.shareModalOpen
export const selectVideoUploadProgress = (state: RootState) => state.videoShare.uploadProgress
export const selectVideoLibrary = (state: RootState) => state.videoShare.library
export const selectVideoLibraryLoading = (state: RootState) => state.videoShare.libraryLoading
export const selectVideoLibrarySearch = (state: RootState) => state.videoShare.librarySearch
export const selectActiveVideoShare = (state: RootState) => state.videoShare.videoShare
export const selectVideoShareVisible = (state: RootState) => Boolean(state.videoShare.videoShare?.active)

export default videoShareSlice.reducer
