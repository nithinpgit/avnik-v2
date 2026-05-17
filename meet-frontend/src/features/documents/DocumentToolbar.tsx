import { useCallback } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { selectActivePresentation } from './documentsSlice'
import {
  IconPageNext,
  IconPagePrev,
  IconZoomIn,
  IconZoomOut,
} from '../videoConference/MeetingIcons'
import { usePresentationSync } from './usePresentationSync'
import './documentToolbar.css'

const ZOOM_STEP = 10
const ZOOM_MIN = 50
const ZOOM_MAX = 200

export function DocumentToolbar() {
  const presentation = useAppSelector(selectActivePresentation)
  const isHost = useIsMeetingHost()
  const { patchPresentation } = usePresentationSync()

  const apply = useCallback(
    (patch: Parameters<typeof patchPresentation>[0]) => {
      if (!isHost) return
      patchPresentation(patch)
    },
    [isHost, patchPresentation],
  )

  if (!presentation?.active) return null

  const page = presentation.currentPage
  const total = presentation.pageCount
  const zoom = presentation.zoomPercent

  return (
    <li className="document-toolbar dock-toolbar-section--document" aria-label="Document controls">
      <div className="document-toolbar__group zoom-in-out-bx zoom-blk">
        <button
          type="button"
          className="document-toolbar__btn meeting-tooltip meeting-tooltip--top"
          data-tooltip="Zoom Out"
          aria-label="Zoom out"
          disabled={!isHost || zoom <= ZOOM_MIN}
          onClick={() => apply({ zoomPercent: Math.max(ZOOM_MIN, zoom - ZOOM_STEP) })}
        >
          <IconZoomOut />
        </button>
        <span className="document-toolbar__value zoomval">{zoom}%</span>
        <button
          type="button"
          className="document-toolbar__btn meeting-tooltip meeting-tooltip--top"
          data-tooltip="Zoom In"
          aria-label="Zoom in"
          disabled={!isHost || zoom >= ZOOM_MAX}
          onClick={() => apply({ zoomPercent: Math.min(ZOOM_MAX, zoom + ZOOM_STEP) })}
        >
          <IconZoomIn />
        </button>
      </div>

      {total > 1 ? (
        <div className="document-toolbar__group page-pre-next-bx zoom-blk">
          <button
            type="button"
            className="document-toolbar__btn meeting-tooltip meeting-tooltip--top"
            data-tooltip="Previous Page"
            aria-label="Previous page"
            disabled={!isHost || page <= 1}
            onClick={() => apply({ currentPage: page - 1 })}
          >
            <IconPagePrev />
          </button>
          <input
            className="document-toolbar__page-input pagen"
            aria-label="Current page"
            value={page}
            readOnly={!isHost}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n) && n >= 1 && n <= total) {
                apply({ currentPage: Math.floor(n) })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = Number((e.target as HTMLInputElement).value)
                if (Number.isFinite(n) && n >= 1 && n <= total) {
                  apply({ currentPage: Math.floor(n) })
                }
              }
            }}
          />
          <button
            type="button"
            className="document-toolbar__btn meeting-tooltip meeting-tooltip--top"
            data-tooltip="Next Page"
            aria-label="Next page"
            disabled={!isHost || page >= total}
            onClick={() => apply({ currentPage: page + 1 })}
          >
            <IconPageNext />
          </button>
        </div>
      ) : null}
    </li>
  )
}
