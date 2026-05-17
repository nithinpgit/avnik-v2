import { resolveMeetingApiPath } from '../meetingRoom/socketUrl'
import type { RoomFileRecord } from './presentationTypes'

export async function fetchRoomFiles(roomId: string): Promise<RoomFileRecord[]> {
  const res = await fetch(resolveMeetingApiPath(`/api/files/rooms/${encodeURIComponent(roomId)}`), {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`list files ${res.status}`)
  }
  const data = (await res.json()) as { files?: RoomFileRecord[] }
  return data.files ?? []
}

export async function uploadRoomFile(
  roomId: string,
  file: File,
  onProgress: (percent: number) => void,
  uploadedBy?: string,
): Promise<RoomFileRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)
    if (uploadedBy) form.append('uploadedBy', uploadedBy)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { file: RoomFileRecord }
          resolve(data.file)
        } catch {
          reject(new Error('Invalid upload response'))
        }
      } else {
        let message = `Upload failed (${xhr.status})`
        try {
          const err = JSON.parse(xhr.responseText) as { message?: string | string[] }
          if (Array.isArray(err.message)) message = err.message.join(', ')
          else if (typeof err.message === 'string') message = err.message
        } catch {
          /* ignore */
        }
        reject(new Error(message))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed')))
    xhr.open('POST', resolveMeetingApiPath(`/api/files/rooms/${encodeURIComponent(roomId)}/upload`))
    xhr.withCredentials = true
    xhr.send(form)
  })
}

export async function deleteRoomFile(fileId: string): Promise<void> {
  const res = await fetch(resolveMeetingApiPath(`/api/files/${encodeURIComponent(fileId)}`), {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`delete file ${res.status}`)
  }
}

export async function patchFilePageCount(fileId: string, pageCount: number): Promise<RoomFileRecord> {
  const res = await fetch(resolveMeetingApiPath(`/api/files/${encodeURIComponent(fileId)}/page-count`), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageCount }),
  })
  if (!res.ok) {
    throw new Error(`update page count ${res.status}`)
  }
  const data = (await res.json()) as { file: RoomFileRecord }
  return data.file
}

/**
 * Resolve a stored file URL for browser fetch (pdf.js, <img>, etc.).
 * Uses same-origin relative paths so dev goes through the Vite /uploads proxy
 * and production goes through nginx — avoids cross-origin CORS on static files.
 */
export function resolveFileAssetUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return url.startsWith('/') ? url : `/${url}`
}
