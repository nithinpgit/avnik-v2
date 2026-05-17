import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '../../app/store'
import type { PresentationSyncPayload, RoomFileRecord } from './presentationTypes'

type DocumentsUiState = {
  shareModalOpen: boolean
  uploadProgress: number | null
  library: RoomFileRecord[]
  libraryLoading: boolean
  librarySearch: string
  /** Local mirror of active presentation (also in room_sync). */
  presentation: PresentationSyncPayload | null
  pageRenderKey: number
}

const initialState: DocumentsUiState = {
  shareModalOpen: false,
  uploadProgress: null,
  library: [],
  libraryLoading: false,
  librarySearch: '',
  presentation: null,
  pageRenderKey: 0,
}

const documentsSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    openShareDocumentModal: (state) => {
      state.shareModalOpen = true
    },
    closeShareDocumentModal: (state) => {
      state.shareModalOpen = false
      state.uploadProgress = null
    },
    setUploadProgress: (state, action: PayloadAction<number | null>) => {
      state.uploadProgress = action.payload
    },
    setLibrary: (state, action: PayloadAction<RoomFileRecord[]>) => {
      state.library = action.payload
    },
    setLibraryLoading: (state, action: PayloadAction<boolean>) => {
      state.libraryLoading = action.payload
    },
    setLibrarySearch: (state, action: PayloadAction<string>) => {
      state.librarySearch = action.payload
    },
    setPresentation: (state, action: PayloadAction<PresentationSyncPayload | null>) => {
      state.presentation = action.payload
      state.pageRenderKey += 1
    },
    bumpPageRender: (state) => {
      state.pageRenderKey += 1
    },
    resetDocuments: () => initialState,
  },
})

export const {
  openShareDocumentModal,
  closeShareDocumentModal,
  setUploadProgress,
  setLibrary,
  setLibraryLoading,
  setLibrarySearch,
  setPresentation,
  bumpPageRender,
  resetDocuments,
} = documentsSlice.actions

export const selectShareModalOpen = (state: RootState) => state.documents.shareModalOpen
export const selectUploadProgress = (state: RootState) => state.documents.uploadProgress
export const selectDocumentLibrary = (state: RootState) => state.documents.library
export const selectLibraryLoading = (state: RootState) => state.documents.libraryLoading
export const selectLibrarySearch = (state: RootState) => state.documents.librarySearch
export const selectActivePresentation = (state: RootState) => state.documents.presentation
export const selectPresentationVisible = (state: RootState) =>
  Boolean(state.documents.presentation?.active)
export const selectPageRenderKey = (state: RootState) => state.documents.pageRenderKey

export default documentsSlice.reducer
