import { resolveMeetingApiPath } from '../meetingRoom/socketUrl'
import type { RoomFileRecord } from '../documents/presentationTypes'

export async function saveYoutubeToLibrary(
  roomId: string,
  videoId: string,
  uploadedBy?: string,
): Promise<RoomFileRecord> {
  const res = await fetch(
    resolveMeetingApiPath(`/api/files/rooms/${encodeURIComponent(roomId)}/youtube`),
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId, uploadedBy }),
    },
  )
  if (!res.ok) {
    let message = `Could not save YouTube link (${res.status})`
    try {
      const err = (await res.json()) as { message?: string | string[] }
      if (Array.isArray(err.message)) message = err.message.join(', ')
      else if (typeof err.message === 'string') message = err.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const data = (await res.json()) as { file: RoomFileRecord }
  return data.file
}
