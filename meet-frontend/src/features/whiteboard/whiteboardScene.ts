import {
  CaptureUpdateAction,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { WhiteboardSyncPayload } from './WhiteboardModule'

export function parseWhiteboardPayload(raw: unknown): WhiteboardSyncPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const doc = raw as Partial<WhiteboardSyncPayload>
  if (doc.format !== 'excalidraw-json' || typeof doc.body !== 'string') {
    return null
  }
  return { format: 'excalidraw-json', body: doc.body }
}

export function serializeCurrentScene(api: ExcalidrawImperativeAPI): WhiteboardSyncPayload | null {
  try {
    const elements = api.getSceneElementsIncludingDeleted()
    const appState = api.getAppState()
    const files = api.getFiles()
    const body = serializeAsJSON(elements, appState, files, 'database')
    return { format: 'excalidraw-json', body }
  } catch {
    return null
  }
}

export function applyWhiteboardPayload(
  api: ExcalidrawImperativeAPI,
  payload: WhiteboardSyncPayload | null,
  options: {
    viewBackgroundColor: string
    gridModeEnabled: boolean
  },
): string | null {
  if (!payload?.body) {
    api.updateScene({
      elements: [],
      appState: {
        viewBackgroundColor: options.viewBackgroundColor,
        gridModeEnabled: options.gridModeEnabled,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
    return ''
  }

  try {
    const parsed = JSON.parse(payload.body) as Parameters<typeof restore>[0]
    const restored = restore(parsed, null, null)
    api.updateScene({
      elements: restored.elements,
      appState: {
        ...restored.appState,
        viewBackgroundColor: options.viewBackgroundColor,
        gridModeEnabled: options.gridModeEnabled,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
    if (restored.files && Object.keys(restored.files).length > 0) {
      api.addFiles(Object.values(restored.files))
    }
    return payload.body
  } catch {
    api.updateScene({
      elements: [],
      appState: {
        viewBackgroundColor: options.viewBackgroundColor,
        gridModeEnabled: options.gridModeEnabled,
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
    return null
  }
}
