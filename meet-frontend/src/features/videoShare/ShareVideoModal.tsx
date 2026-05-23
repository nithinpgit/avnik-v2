import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { deleteRoomFile, fetchRoomFiles, uploadRoomFile } from '../documents/documentsApi'
import { IconDeleteFile, IconSearch, IconShareFile } from '../documents/DocumentIcons'
import { pushToast } from '../documents/notificationsSlice'
import type { RoomFileRecord } from '../documents/presentationTypes'
import { selectMeetingRoomId, selectMeetingUserId } from '../meetingSession/meetingSessionSlice'
import { IconVideoShare } from '../videoConference/MeetingIcons'
import { saveYoutubeToLibrary } from './videoShareApi'
import {
  closeShareVideoModal,
  selectShareVideoModalOpen,
  selectVideoLibraryLoading,
  selectVideoLibrarySearch,
  selectVideoUploadProgress,
  setVideoLibrary,
  setVideoLibraryLoading,
  setVideoLibrarySearch,
  setVideoUploadProgress,
} from './videoShareSlice'
import { isVideoLibraryExtension } from './videoShareTypes'
import { parseYoutubeVideoId } from './youtubeUtils'
import { useVideoShareSync } from './useVideoShareSync'
import '../documents/shareDocumentModal.css'
import './shareVideoModal.css'

const MAX_VIDEO_MB = 50

type TabId = 'upload' | 'choose'

export function ShareVideoModal() {
  const dispatch = useAppDispatch()
  const open = useAppSelector(selectShareVideoModalOpen)
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const uploadProgress = useAppSelector(selectVideoUploadProgress)
  const libraryLoading = useAppSelector(selectVideoLibraryLoading)
  const search = useAppSelector(selectVideoLibrarySearch)
  const library = useAppSelector((s) => s.videoShare.library)
  const { loadVideoShare } = useVideoShareSync()

  const [tab, setTab] = useState<TabId>('upload')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeBusy, setYoutubeBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshLibrary = useCallback(async () => {
    if (!roomId) return
    dispatch(setVideoLibraryLoading(true))
    try {
      const files = await fetchRoomFiles(roomId)
      dispatch(setVideoLibrary(files.filter((f) => isVideoLibraryExtension(f.extension))))
    } catch {
      dispatch(pushToast({ message: 'Could not load video library.', variant: 'error' }))
    } finally {
      dispatch(setVideoLibraryLoading(false))
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
    dispatch(closeShareVideoModal())
    setTab('upload')
    setYoutubeUrl('')
  }

  const validateMp4 = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'mp4') {
      return 'Please upload an MP4 video file.'
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      return `File size should be less than ${MAX_VIDEO_MB} MB`
    }
    return null
  }

  const handleUpload = async (file: File) => {
    if (!roomId) return
    const err = validateMp4(file)
    if (err) {
      dispatch(pushToast({ message: err, variant: 'error' }))
      return
    }
    dispatch(setVideoUploadProgress(0))
    try {
      const saved = await uploadRoomFile(roomId, file, (p) => dispatch(setVideoUploadProgress(p)), userId ?? undefined)
      dispatch(setVideoUploadProgress(null))
      dispatch(pushToast({ message: 'Video uploaded successfully.', variant: 'success', durationMs: 5000 }))
      await refreshLibrary()
      await loadVideoShare(saved)
      handleClose()
    } catch (e) {
      dispatch(setVideoUploadProgress(null))
      dispatch(pushToast({ message: e instanceof Error ? e.message : 'Upload failed', variant: 'error' }))
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void handleUpload(file)
  }

  const onShareYoutube = async () => {
    if (!roomId || youtubeBusy) return
    const videoId = parseYoutubeVideoId(youtubeUrl)
    if (!videoId) {
      dispatch(pushToast({ message: 'Enter a valid YouTube URL.', variant: 'error' }))
      return
    }
    setYoutubeBusy(true)
    try {
      const saved = await saveYoutubeToLibrary(roomId, videoId, userId ?? undefined)
      dispatch(pushToast({ message: 'YouTube link saved.', variant: 'success', durationMs: 4000 }))
      await refreshLibrary()
      await loadVideoShare(saved)
      handleClose()
    } catch (e) {
      dispatch(pushToast({ message: e instanceof Error ? e.message : 'Could not save link', variant: 'error' }))
    } finally {
      setYoutubeBusy(false)
    }
  }

  const onShareFromLibrary = async (file: RoomFileRecord) => {
    await loadVideoShare(file)
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
        aria-labelledby="share-video-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="share-document-popup__header">
          <h2 id="share-video-title" className="share-document-popup__title">
            Share Video
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
            className={`ah-tab-content ${tab === 'upload' ? 'ah-tab-content--active' : ''}`}
            role="tabpanel"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="share-doc-hidden-input"
              accept=".mp4,video/mp4"
              onChange={onFileInputChange}
            />
            <button
              type="button"
              className="share-file-upload-btn share-video-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadProgress !== null}
            >
              <span className="share-video-upload-icon" aria-hidden>
                <IconVideoShare size={28} />
              </span>
              <div className="add-file-size-text">
                <p>Upload Video (Format:mp4)</p>
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

            <div className="share-video-or" aria-hidden>
              <span className="share-video-or__label">OR</span>
            </div>

            <div className="share-video-youtube-row">
              <input
                type="url"
                className="form-control share-video-youtube-input"
                placeholder="Paste youtube URL here"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onShareYoutube()
                }}
              />
              <button
                type="button"
                className="share-video-youtube-share-btn"
                disabled={youtubeBusy || !youtubeUrl.trim()}
                onClick={() => void onShareYoutube()}
              >
                Share
              </button>
            </div>
          </div>

          <div
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
                  onChange={(e) => dispatch(setVideoLibrarySearch(e.target.value))}
                />
                <button type="button" className="btn input-btn" tabIndex={-1} aria-hidden>
                  <IconSearch />
                </button>
              </div>
              <ul className="share-files-list">
                {libraryLoading ? (
                  <li>
                    <h4 className="upload-files-heading">Loading videos…</h4>
                  </li>
                ) : filteredLibrary.length === 0 ? (
                  <li>
                    <h4 className="upload-files-heading">No saved videos found !</h4>
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
