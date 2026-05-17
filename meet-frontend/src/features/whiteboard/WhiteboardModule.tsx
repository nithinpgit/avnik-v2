import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectActivePresentation } from '../documents/documentsSlice'
import { selectPreMeetingEntryCompleted } from '../preMeeting/preMeetingSlice'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import { selectConferenceMode } from '../videoConference/videoConferenceSlice'
import { PresentationLayer } from '../documents/PresentationLayer'
import { selectWhiteboardTheme } from './whiteboardSlice'
import {
  getWhiteboardPageKey,
  getWhiteboardSyncChannel,
  resolveWhiteboardChannelPayload,
} from './whiteboardPageKey'
import {
  applyWhiteboardPayload,
  parseWhiteboardPayload,
  serializeCurrentScene,
} from './whiteboardScene'
import './whiteboard.css'

export type WhiteboardSyncPayload = {
  format: 'excalidraw-json'
  body: string
}

const DEFAULT_VIEW_BG = '#ffffff'
const TRANSPARENT_VIEW_BG = 'transparent'
const PAGE_SWITCH_MS = 120

export function WhiteboardModule() {
  const theme = useAppSelector(selectWhiteboardTheme)
  const presentation = useAppSelector(selectActivePresentation)
  const presentationActive = Boolean(presentation?.active)
  const conferenceMode = useAppSelector(selectConferenceMode)
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const roomChannels = useAppSelector((s) => s.roomSync.channels)
  const { emitRoomSync } = useMeetingSocket()

  const pageKey = useMemo(() => getWhiteboardPageKey(presentation), [presentation])
  const syncChannel = useMemo(() => getWhiteboardSyncChannel(pageKey), [pageKey])

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const pageKeyRef = useRef(pageKey)
  const initializedRef = useRef(false)
  const suppressEmitRef = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRemoteJsonByPageRef = useRef<Map<string, string>>(new Map())
  const localSceneByPageRef = useRef<Map<string, string>>(new Map())

  const [canvasSwitching, setCanvasSwitching] = useState(false)

  const sceneAppearance = useMemo(
    () => ({
      viewBackgroundColor: presentationActive ? TRANSPARENT_VIEW_BG : theme === 'dark' ? '#121212' : DEFAULT_VIEW_BG,
      gridModeEnabled: !presentationActive,
    }),
    [presentationActive, theme],
  )

  const flushSave = useCallback(
    (targetPageKey: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      const api = apiRef.current
      if (!api || !entryCompleted || suppressEmitRef.current) return

      const payload = serializeCurrentScene(api)
      if (!payload) return

      localSceneByPageRef.current.set(targetPageKey, payload.body)
      const channel = getWhiteboardSyncChannel(targetPageKey)
      emitRoomSync(channel, payload)
    },
    [emitRoomSync, entryCompleted],
  )

  const loadPage = useCallback(
    (targetPageKey: string) => {
      const api = apiRef.current
      if (!api) return

      const raw = resolveWhiteboardChannelPayload(roomChannels, targetPageKey)
      const remotePayload = parseWhiteboardPayload(raw)
      const cachedBody = localSceneByPageRef.current.get(targetPageKey)
      const payload =
        remotePayload ??
        (cachedBody != null ? { format: 'excalidraw-json' as const, body: cachedBody } : null)

      suppressEmitRef.current = true
      const fingerprint = applyWhiteboardPayload(api, payload, sceneAppearance)
      const fp = fingerprint ?? ''
      lastRemoteJsonByPageRef.current.set(targetPageKey, fp)
      if (fp) {
        localSceneByPageRef.current.set(targetPageKey, fp)
      }
      requestAnimationFrame(() => {
        suppressEmitRef.current = false
      })
    },
    [roomChannels, sceneAppearance],
  )

  const schedulePush = useCallback(() => {
    if (!entryCompleted || suppressEmitRef.current) return
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      if (suppressEmitRef.current) return
      const api = apiRef.current
      if (!api) return
      const payload = serializeCurrentScene(api)
      if (!payload) return
      const key = pageKeyRef.current
      localSceneByPageRef.current.set(key, payload.body)
      emitRoomSync(getWhiteboardSyncChannel(key), payload)
    }, 400)
  }, [emitRoomSync, entryCompleted])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const flushActivePage = () => {
      if (pageKeyRef.current) {
        flushSave(pageKeyRef.current)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushActivePage()
    }
    window.addEventListener('beforeunload', flushActivePage)
    window.addEventListener('pagehide', flushActivePage)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flushActivePage)
      window.removeEventListener('pagehide', flushActivePage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushSave])

  const runPageSwitch = useCallback(
    (prevKey: string, nextKey: string) => {
      let cancelled = false
      setCanvasSwitching(true)

      void (async () => {
        flushSave(prevKey)
        if (cancelled) return
        pageKeyRef.current = nextKey
        loadPage(nextKey)
        await new Promise((r) => setTimeout(r, PAGE_SWITCH_MS))
        if (!cancelled) setCanvasSwitching(false)
      })()

      return () => {
        cancelled = true
      }
    },
    [flushSave, loadPage],
  )

  useEffect(() => {
    if (!initializedRef.current || !apiRef.current) return

    const prevKey = pageKeyRef.current
    if (prevKey === pageKey) return

    return runPageSwitch(prevKey, pageKey)
  }, [pageKey, runPageSwitch])

  useEffect(() => {
    const api = apiRef.current
    if (!api) return
    if (pageKeyRef.current !== pageKey) return

    const raw = resolveWhiteboardChannelPayload(roomChannels, pageKey)
    const payload = parseWhiteboardPayload(raw)
    if (!payload) return

    const fingerprint = payload.body
    if (lastRemoteJsonByPageRef.current.get(pageKey) === fingerprint) {
      return
    }

    if (localSceneByPageRef.current.get(pageKey) === fingerprint) {
      lastRemoteJsonByPageRef.current.set(pageKey, fingerprint)
      return
    }

    suppressEmitRef.current = true
    const fp = applyWhiteboardPayload(api, payload, sceneAppearance)
    lastRemoteJsonByPageRef.current.set(pageKey, fp ?? fingerprint)
    localSceneByPageRef.current.set(pageKey, fingerprint)
    requestAnimationFrame(() => {
      suppressEmitRef.current = false
    })
  }, [roomChannels, pageKey, syncChannel, sceneAppearance])

  useEffect(() => {
    const api = apiRef.current
    if (!api || pageKeyRef.current !== pageKey) return
    api.updateScene({
      appState: {
        viewBackgroundColor: sceneAppearance.viewBackgroundColor,
        gridModeEnabled: sceneAppearance.gridModeEnabled,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
  }, [sceneAppearance, pageKey])

  return (
    <section
      className={`whiteboard-module${presentationActive ? ' whiteboard-module--over-document' : ''}${conferenceMode ? ' whiteboard-module--conference-hidden' : ''}`}
      aria-label="Whiteboard workspace"
    >
      <PresentationLayer />
      <div
        className={`whiteboard-module__canvas${canvasSwitching ? ' whiteboard-module__canvas--switching' : ''}`}
      >
        <Excalidraw
          theme={theme}
          initialData={{
            appState: {
              viewBackgroundColor: sceneAppearance.viewBackgroundColor,
              gridModeEnabled: sceneAppearance.gridModeEnabled,
              gridStep: 5,
            },
          }}
          excalidrawAPI={(api) => {
            const firstReady = !apiRef.current
            apiRef.current = api
            if (firstReady && !initializedRef.current) {
              initializedRef.current = true
              pageKeyRef.current = pageKey
              requestAnimationFrame(() => loadPage(pageKey))
            }
          }}
          onChange={() => {
            schedulePush()
          }}
        />
      </div>
    </section>
  )
}
