import { useEffect, useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { resolveFileAssetUrl } from './documentsApi'
import { selectActivePresentation, selectPageRenderKey } from './documentsSlice'
import { renderPdfPageToDataUrl } from './pdfUtils'
import { usePresentationSync } from './usePresentationSync'
import './presentationLayer.css'

export function PresentationLayer() {
  const presentation = useAppSelector(selectActivePresentation)
  const pageRenderKey = useAppSelector(selectPageRenderKey)
  const isHost = useIsMeetingHost()
  const { closePresentation } = usePresentationSync()

  const [slideSrc, setSlideSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!presentation?.active) {
      setSlideSrc(null)
      return
    }

    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const url = resolveFileAssetUrl(presentation.fileUrl)
        if (presentation.extension === 'pdf') {
          const dataUrl = await renderPdfPageToDataUrl(
            presentation.fileUrl,
            presentation.currentPage,
            1.5,
          )
          if (!cancelled) setSlideSrc(dataUrl)
        } else {
          if (!cancelled) setSlideSrc(url)
        }
      } catch {
        if (!cancelled) setSlideSrc(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [
    presentation?.active,
    presentation?.fileUrl,
    presentation?.currentPage,
    presentation?.zoomPercent,
    presentation?.extension,
    pageRenderKey,
  ])

  if (!presentation?.active) return null

  const zoom = presentation.zoomPercent / 100

  return (
    <>
      {isHost ? (
        <button
          type="button"
          className="presentation-close-btn meeting-tooltip meeting-tooltip--bottom"
          data-tooltip="Close document"
          aria-label="Close document"
          onClick={closePresentation}
        >
          ×
        </button>
      ) : null}
      <div className="presentation-layer presentation-layer--visible" aria-hidden>
        <div
          className={`presentation-slide-wrap ${loading ? 'presentation-slide-wrap--loading' : ''}`}
          style={{ transform: `scale(${zoom})` }}
        >
          {slideSrc ? (
            <img src={slideSrc} alt={presentation.originalName} draggable={false} />
          ) : null}
        </div>
      </div>
    </>
  )
}
