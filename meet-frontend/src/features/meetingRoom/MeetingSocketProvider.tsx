import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { fetchMeetingLifecycle } from '../meeting/meetingLifecycleApi'
import {
  resetMeetingLifecycle,
  setMeetingLifecycle,
} from '../meeting/meetingLifecycleSlice'
import {
  MEETING_LIFECYCLE_CHANNEL,
  parseMeetingLifecycle,
} from '../meeting/meetingLifecycleTypes'
import {
  selectMeetingDisplayName,
  selectMeetingProfileImage,
  selectMeetingRole,
  selectMeetingRoomId,
  selectMeetingUserId,
  setMeetingSession,
  type MeetingRole,
} from '../meetingSession/meetingSessionSlice'
import { selectPreMeetingEntryCompleted } from '../preMeeting/preMeetingSlice'
import { applyRoomSyncBulk, applyRoomSyncPatch, resetRoomSync } from '../roomSync/roomSyncSlice'
import {
  applyRoomSnapshot,
  removeParticipant,
  upsertParticipant,
} from '../videoConference/videoConferenceSlice'
import { resolveMeetingSocketUrl } from './socketUrl'

export type MeetingSocketContextValue = {
  socket: Socket | null
  /** True after first `room_snapshot` for this Socket.IO session (SFU can join). */
  presenceJoined: boolean
  /** Emit a persisted room document update (same contract for whiteboard and future channels). */
  emitRoomSync: (channel: string, payload: unknown) => void
  /** Host-only: persist and broadcast meeting start. */
  startMeeting: () => void
}

const MeetingSocketContext = createContext<MeetingSocketContextValue | null>(null)

export function useMeetingSocket(): MeetingSocketContextValue {
  const ctx = useContext(MeetingSocketContext)
  if (!ctx) {
    throw new Error('useMeetingSocket must be used within MeetingSocketProvider')
  }
  return ctx
}

/**
 * Owns the Socket.IO client for the meeting: peers, and centralized room_sync / room_sync_bulk.
 */
export function MeetingSocketProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const displayName = useAppSelector(selectMeetingDisplayName)
  const role = useAppSelector(selectMeetingRole)
  const profileImage = useAppSelector(selectMeetingProfileImage)

  const [socket, setSocket] = useState<Socket | null>(null)
  const [presenceJoined, setPresenceJoined] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const emitRoomSync = useCallback((channel: string, payload: unknown) => {
    const s = socketRef.current
    const rid = store.getState().meetingSession.roomId
    if (!s?.connected || !rid) return
    s.emit('room_sync', { roomId: rid, channel, payload })
  }, [])

  const startMeeting = useCallback(() => {
    const s = socketRef.current
    const rid = store.getState().meetingSession.roomId
    if (!s?.connected || !rid) return
    s.emit('start_meeting', { roomId: rid })
  }, [])

  useEffect(() => {
    if (!entryCompleted || !roomId) return
    let cancelled = false
    void fetchMeetingLifecycle(roomId)
      .then((meeting) => {
        if (!cancelled) {
          dispatch(setMeetingLifecycle(meeting))
        }
      })
      .catch((e) => {
        console.warn('meeting lifecycle fetch failed', e)
      })
    return () => {
      cancelled = true
    }
  }, [entryCompleted, roomId, dispatch])

  useEffect(() => {
    if (!entryCompleted || !roomId || !userId) {
      return
    }

    const baseUrl = resolveMeetingSocketUrl()
    const socketOptions = {
      path: '/socket.io',
      transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
      autoConnect: true,
      withCredentials: true,
    }
    const client = baseUrl ? io(baseUrl, socketOptions) : io(socketOptions)
    socketRef.current = client
    setSocket(client)
    setPresenceJoined(false)

    const onSnapshot = (payload: { roomId: string; peers: PeerDto[]; meeting?: unknown }) => {
      dispatch(applyRoomSnapshot({ peers: payload.peers.map((p) => mapPeer(p)) }))
      if (payload.meeting !== undefined) {
        dispatch(setMeetingLifecycle(parseMeetingLifecycle(payload.meeting)))
      }
      setPresenceJoined(true)
    }

    const onMeetingLifecycle = (payload: { meeting?: unknown }) => {
      if (payload.meeting !== undefined) {
        dispatch(setMeetingLifecycle(parseMeetingLifecycle(payload.meeting)))
      }
    }

    const onMeetingError = (payload: { message?: string }) => {
      console.error('meeting_error', payload)
    }

    const onRoleUpdated = (payload: { userId: string; role: MeetingRole }) => {
      if (payload.userId === userId) {
        dispatch(setMeetingSession({ role: payload.role }))
      }
      const self = store.getState().videoConference.participants.find((p) => p.id === payload.userId)
      if (self) {
        dispatch(upsertParticipant({ ...self, role: payload.role }))
      }
    }

    const onPeerJoined = (payload: { peer: PeerDto }) => {
      dispatch(upsertParticipant(mapPeer(payload.peer)))
    }

    const onPeerLeft = (payload: { userId: string }) => {
      dispatch(removeParticipant(payload.userId))
    }

    const onJoinError = (payload: { message?: string }) => {
      console.error('join_error', payload)
    }

    const onRoomSyncBulk = (payload: { states: Record<string, unknown> }) => {
      const states = payload.states ?? {}
      dispatch(applyRoomSyncBulk({ states }))
      if (states[MEETING_LIFECYCLE_CHANNEL] !== undefined) {
        dispatch(setMeetingLifecycle(parseMeetingLifecycle(states[MEETING_LIFECYCLE_CHANNEL])))
      }
    }

    const onRoomSync = (payload: { channel: string; payload: unknown }) => {
      dispatch(applyRoomSyncPatch({ channel: payload.channel, payload: payload.payload }))
      if (payload.channel === MEETING_LIFECYCLE_CHANNEL) {
        dispatch(setMeetingLifecycle(parseMeetingLifecycle(payload.payload)))
      }
    }

    const onConnect = () => {
      client.emit('join_room', {
        roomId,
        userId,
        name: displayName,
        role,
        profileImage: profileImage ?? undefined,
      })
    }

    client.on('connect', onConnect)
    client.on('room_snapshot', onSnapshot)
    client.on('peer_joined', onPeerJoined)
    client.on('peer_left', onPeerLeft)
    client.on('join_error', onJoinError)
    client.on('room_sync_bulk', onRoomSyncBulk)
    client.on('room_sync', onRoomSync)
    client.on('meeting_lifecycle', onMeetingLifecycle)
    client.on('meeting_error', onMeetingError)
    client.on('role_updated', onRoleUpdated)

    return () => {
      client.off('connect', onConnect)
      client.off('room_snapshot', onSnapshot)
      client.off('peer_joined', onPeerJoined)
      client.off('peer_left', onPeerLeft)
      client.off('join_error', onJoinError)
      client.off('room_sync_bulk', onRoomSyncBulk)
      client.off('room_sync', onRoomSync)
      client.off('meeting_lifecycle', onMeetingLifecycle)
      client.off('meeting_error', onMeetingError)
      client.off('role_updated', onRoleUpdated)
      client.disconnect()
      socketRef.current = null
      setSocket(null)
      setPresenceJoined(false)
      dispatch(resetRoomSync())
      dispatch(resetMeetingLifecycle())
    }
  }, [entryCompleted, roomId, userId, displayName, role, profileImage, dispatch])

  const value = useMemo<MeetingSocketContextValue>(
    () => ({ socket, presenceJoined, emitRoomSync, startMeeting }),
    [socket, presenceJoined, emitRoomSync, startMeeting],
  )

  return <MeetingSocketContext.Provider value={value}>{children}</MeetingSocketContext.Provider>
}

type PeerDto = {
  userId: string
  name: string
  role: 'host' | 'participant'
  profileImage: string | null
}

function mapPeer(p: PeerDto) {
  return {
    id: p.userId,
    name: p.name,
    role: p.role,
    profileImage: p.profileImage,
  }
}
