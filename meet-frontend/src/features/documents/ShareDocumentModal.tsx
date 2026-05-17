import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  closeShareDocumentModal,
  selectLibraryLoading,
  selectLibrarySearch,
  selectShareModalOpen,
  selectUploadProgress,
  setLibrary,
  setLibraryLoading,
  setLibrarySearch,
  setUploadProgress,
} from './documentsSlice'
import { deleteRoomFile, fetchRoomFiles, uploadRoomFile } from './documentsApi'
import { IconDeleteFile, IconSearch, IconShareFile, IconUploadDoc } from './DocumentIcons'
import { pushToast } from './notificationsSlice'
import { usePresentationSync } from './usePresentationSync'
import { selectMeetingRoomId, selectMeetingUserId } from '../meetingSession/meetingSessionSlice'
import type { RoomFileRecord } from './presentationTypes'
import './shareDocumentModal.css'

const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'gif', 'webp']
const MAX_MB = 20

type TabId = 'upload' | 'choose'

export function ShareDocumentModal() {
  const dispatch = useAppDispatch()
  const open = useAppSelector(selectShareModalOpen)
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const uploadProgress = useAppSelector(selectUploadProgress)
  const libraryLoading = useAppSelector(selectLibraryLoading)
  const search = useAppSelector(selectLibrarySearch)
  const library = useAppSelector((s) => s.documents.library)
  const { loadPresentation } = usePresentationSync()

  const [tab, setTab] = useState<TabId>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshLibrary = useCallback(async () => {
    if (!roomId) return
    dispatch(setLibraryLoading(true))
    try {
      const files = await fetchRoomFiles(roomId)
      dispatch(setLibrary(files))
    } catch {
      dispatch(pushToast({ message: 'Could not load file library.', variant: 'error' }))
    } finally {
      dispatch(setLibraryLoading(false))
    }
  }, [dispatch, roomId])

  useEffect(() => {
    if (open && roomId) {
      void refreshLibrary()
    }
  }, [open, roomId, refreshLibrary])

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return library
    return library.filter((f) => f.originalName.toLowerCase().includes(q))
  }, [library, search])

  const handleClose = () => {
    dispatch(closeShareDocumentModal())
    setTab('upload')
  }

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.includes(ext)) {
      return 'Please upload a valid file [pdf, doc, docx, xls, xlsx, ppt, pptx, png, jpg, jpeg, gif, webp]'
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return `File size should be less than ${MAX_MB} MB`
    }
    return null
  }

  const handleUpload = async (file: File) => {
    if (!roomId) return
    const err = validateFile(file)
    if (err) {
      dispatch(pushToast({ message: err, variant: 'error' }))
      return
    }
    dispatch(setUploadProgress(0))
    try {
      const saved = await uploadRoomFile(roomId, file, (p) => dispatch(setUploadProgress(p)), userId ?? undefined)
      dispatch(setUploadProgress(null))
      dispatch(pushToast({ message: 'Document uploaded successfully.', variant: 'success', durationMs: 5000 }))
      await refreshLibrary()
      await loadPresentation(saved)
      handleClose()
    } catch (e) {
      dispatch(setUploadProgress(null))
      dispatch(pushToast({ message: e instanceof Error ? e.message : 'Upload failed', variant: 'error' }))
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void handleUpload(file)
  }

  const onShareFromLibrary = async (file: RoomFileRecord) => {
    await loadPresentation(file)
    handleClose()
  }

  const onDelete = async (fileId: string) => {
    try {
      await deleteRoomFile(fileId)
      dispatch(pushToast({ message: 'Deleted successfully', variant: 'success' }))
      await refreshLibrary()
    } catch {
      dispatch(pushToast({ message: 'Could not delete file.', variant: 'error' }))
    }
  }

  if (!open) return null

  return (
    <div
      className="share-doc-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className="share-document-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-doc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="share-document-popup__header">
          <h2 id="share-doc-title" className="share-document-popup__title">
            Share Document
          </h2>
          <button type="button" className="share-document-popup__close" aria-label="Close" onClick={handleClose}>
            ×
          </button>
        </header>

        <div className="av-default-tabs">
          <div className="ah-tab-wrapper">
            <div className="ah-tab" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'upload'}
                className={`ah-tab-item ${tab === 'upload' ? 'ah-tab-item--active' : ''}`}
                onClick={() => setTab('upload')}
              >
                Upload
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'choose'}
                className={`ah-tab-item ${tab === 'choose' ? 'ah-tab-item--active' : ''}`}
                onClick={() => setTab('choose')}
              >
                Choose
              </button>
            </div>
          </div>

          <div
            id="uploadtabcontent"
            className={`ah-tab-content ${tab === 'upload' ? 'ah-tab-content--active' : ''}`}
            role="tabpanel"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="share-doc-hidden-input"
              accept={ALLOWED_EXT.map((e) => `.${e}`).join(',')}
              onChange={onFileInputChange}
            />
            <button
              type="button"
              className="share-file-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadProgress !== null}
            >
              <IconUploadDoc />
              <div className="add-file-size-text">
                <p>
                  Add a File (maximum file size {MAX_MB}mb)
                  <br />
                  [pdf,doc,docx,xls,xlsx,ppt,pptx,png,jpg,jpeg,gif,webp]
                </p>
              </div>
            </button>

            {uploadProgress !== null ? (
              <div className="file-upload-status">
                <strong className="uploading-heading">Uploading...</strong>
                <div className="loader-inside">
                  <div className="upload-progress-track">
                    <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="upload-progress-label">{uploadProgress}%</span>
                </div>
              </div>
            ) : null}
          </div>

          <div
            id="choosetabcontent"
            className={`ah-tab-content ${tab === 'choose' ? 'ah-tab-content--active' : ''}`}
            role="tabpanel"
          >
            <div className="uploaded-search-files">
              <div className="btn-input">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search File"
                  value={search}
                  onChange={(e) => dispatch(setLibrarySearch(e.target.value))}
                />
                <button type="button" className="btn input-btn" tabIndex={-1} aria-hidden>
                  <IconSearch />
                </button>
              </div>
              <ul className="share-files-list" id="presentation-ul">
                {libraryLoading ? (
                  <li>
                    <h4 className="upload-files-heading">Loading files…</h4>
                  </li>
                ) : filteredLibrary.length === 0 ? (
                  <li>
                    <h4 className="upload-files-heading">No saved documents found !</h4>
                  </li>
                ) : (
                  filteredLibrary.map((file, index) => (
                    <li key={file.id} style={{ animationDelay: `${index * 40}ms` }}>
                      <div className="doc-name" title={file.originalName}>
                        {file.originalName.length > 40
                          ? `${file.originalName.slice(0, 40)}…`
                          : file.originalName}
                      </div>
                      <div className="doc-btn-grp">
                        <button
                          type="button"
                          className="link-btn"
                          aria-label="Share"
                          onClick={() => void onShareFromLibrary(file)}
                        >
                          <IconShareFile />
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          aria-label="Delete"
                          onClick={() => void onDelete(file.id)}
                        >
                          <IconDeleteFile />
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
