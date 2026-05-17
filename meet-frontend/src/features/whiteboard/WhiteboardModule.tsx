import {
  CaptureUpdateAction,
  Excalidraw,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useCallback, useEffect, useRef } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectPreMeetingEntryCompleted } from '../preMeeting/preMeetingSlice'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import { selectPresentationVisible } from '../documents/documentsSlice'
import { PresentationLayer } from '../documents/PresentationLayer'
import { selectWhiteboardTheme } from './whiteboardSlice'
import './whiteboard.css'

const WHITEBOARD_CHANNEL = 'whiteboard'

export type WhiteboardSyncPayload = {
  format: 'excalidraw-json'
  body: string
}

const DEFAULT_VIEW_BG = '#ffffff'
const TRANSPARENT_VIEW_BG = 'transparent'

export function WhiteboardModule() {
  const theme = useAppSelector(selectWhiteboardTheme)
  const presentationActive = useAppSelector(selectPresentationVisible)
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const whiteboardDoc = useAppSelector((s) => s.roomSync.channels[WHITEBOARD_CHANNEL])
  const { emitRoomSync } = useMeetingSocket()

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const suppressEmitRef = useRef(false)
  const lastRemoteJsonRef = useRef<string | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const schedulePush = useCallback(
    (
      elements: Parameters<typeof serializeAsJSON>[0],
      appState: Parameters<typeof serializeAsJSON>[1],
      files: Parameters<typeof serializeAsJSON>[2],
    ) => {
      if (!entryCompleted) return
      if (suppressEmitRef.current) return
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        if (suppressEmitRef.current) return
        try {
          const body = serializeAsJSON(elements, appState, files, 'database')
          const payload: WhiteboardSyncPayload = { format: 'excalidraw-json', body }
          emitRoomSync(WHITEBOARD_CHANNEL, payload)
        } catch {
          /* serialization can fail for transient states */
        }
      }, 400)
    },
    [emitRoomSync, entryCompleted],
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const api = apiRef.current
    if (!api || whiteboardDoc === undefined || whiteboardDoc === null) {
      return
    }
    const doc = whiteboardDoc as Partial<WhiteboardSyncPayload>
    if (doc.format !== 'excalidraw-json' || typeof doc.body !== 'string') {
      return
    }
    const fingerprint = doc.body
    if (fingerprint === lastRemoteJsonRef.current) {
      return
    }
    lastRemoteJsonRef.current = fingerprint
    try {
      const parsed = JSON.parse(doc.body) as Parameters<typeof restore>[0]
      const restored = restore(parsed, null, null)
      suppressEmitRef.current = true
      api.updateScene({
        elements: restored.elements,
        appState: restored.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      })
      if (restored.files && Object.keys(restored.files).length > 0) {
        api.addFiles(Object.values(restored.files))
      }
      if (presentationActive) {
        api.updateScene({
          appState: {
            viewBackgroundColor: TRANSPARENT_VIEW_BG,
            gridModeEnabled: false,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        })
      }
      requestAnimationFrame(() => {
        suppressEmitRef.current = false
      })
    } catch {
      lastRemoteJsonRef.current = null
    }
  }, [whiteboardDoc, presentationActive])

  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    if (presentationActive) {
      api.updateScene({
        appState: {
          viewBackgroundColor: TRANSPARENT_VIEW_BG,
          gridModeEnabled: false,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      })
    } else {
      api.updateScene({
        appState: {
          viewBackgroundColor: theme === 'dark' ? '#121212' : DEFAULT_VIEW_BG,
          gridModeEnabled: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      })
    }
  }, [presentationActive, theme])

  return (
    <section
      className={`whiteboard-module${presentationActive ? ' whiteboard-module--over-document' : ''}`}
      aria-label="Whiteboard workspace"
    >
      <PresentationLayer />
      <div className="whiteboard-module__canvas">
      <Excalidraw
        theme={theme}
        initialData={{
          appState: {
            viewBackgroundColor: presentationActive ? TRANSPARENT_VIEW_BG : DEFAULT_VIEW_BG,
            gridModeEnabled: !presentationActive,
            gridStep: 5,
          },
        }}
        excalidrawAPI={(api) => {
          apiRef.current = api
        }}
        onChange={(elements, appState, files) => {
          schedulePush(elements, appState, files)
        }}
      />
      </div>
    </section>
  )
}
